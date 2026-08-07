"use client"

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/(zustand-store)/authStore';
import {
    getPayrollConfig, updatePayrollConfig,
    getTaxConfigs, createTaxConfig, updateTaxConfig, deleteTaxConfig, reorderTaxConfigs,
    getBenefitItems, createBenefitItem, updateBenefitItem, deleteBenefitItem,
    getBenefitBands, createBenefitBand, updateBenefitBand, deleteBenefitBand,
    addBenefitBandItem, removeBenefitBandItem,
    calculateNetToGross,
} from '@/(api-handlers)/payrollHandler';
import {
    PayrollConfig, TaxConfig, TaxConfigMode, TaxConfigTarget, TaxBearer,
    BenefitItem, BenefitCategory, BenefitCalculationType, BenefitBand,
} from '@/interfaces/payroll';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import PageHeader from '@/components/(shared-components)/PageHeader';
import EmptyState from '@/components/(shared-components)/EmptyState';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Calculator, Gift, Layers, Plus, Pencil, Trash2,
    Search, GripVertical, Settings2, Wand2, ListTree, MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const CATEGORY_BADGE: Record<BenefitCategory, string> = {
    allowance: 'border-success/30 bg-success/10 text-success',
    deduction: 'border-destructive/30 bg-destructive/10 text-destructive',
};

const MODE_LABEL: Record<TaxConfigMode, string> = {
    flat_percentage: 'Flat Percentage',
    threshold_split: 'Threshold Split',
    progressive_bracket: 'Progressive Bracket',
};

const TARGET_LABEL: Record<TaxConfigTarget, string> = {
    base_salary: 'Base Salary',
    gross_pay: 'Gross Pay',
    bonus: 'Bonus',
};

const CONFIG_ROW_GRID = 'grid grid-cols-[32px_1.6fr_140px_110px_90px_100px_64px_84px] items-center gap-2';

export default function PayrollSettingsPage() {
    const { user } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        if (user && user.role !== 'admin') router.replace('/dashboard');
    }, [user, router]);

    if (!user || user.role !== 'admin') {
        return (
            <div className="flex items-center justify-center py-24">
                <Skeleton className="size-6 rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Payroll Settings"
                description="Pay cycle, tax configuration, and the org-wide benefit catalog."
            />

            <Tabs defaultValue="tax-config" className="w-full">
                <TabsList>
                    <TabsTrigger value="tax-config"><Calculator className="mr-1.5 size-4" /> Tax Config</TabsTrigger>
                    <TabsTrigger value="benefit-items"><Gift className="mr-1.5 size-4" /> Benefit Items</TabsTrigger>
                    <TabsTrigger value="benefit-bands"><Layers className="mr-1.5 size-4" /> Benefit Bands</TabsTrigger>
                    <TabsTrigger value="net-to-gross"><Wand2 className="mr-1.5 size-4" /> Net-to-Gross</TabsTrigger>
                </TabsList>
                <TabsContent value="tax-config"><TaxConfigTab /></TabsContent>
                <TabsContent value="benefit-items"><BenefitItemsTab /></TabsContent>
                <TabsContent value="benefit-bands"><BenefitBandsTab /></TabsContent>
                <TabsContent value="net-to-gross"><NetToGrossTab /></TabsContent>
            </Tabs>
        </div>
    );
}

// ─── Tax Config — generic rule list with drag-to-reorder ───────────────────
function SortableConfigRow({
    id, children,
}: {
    id: number;
    children: (drag: { attributes: ReturnType<typeof useSortable>['attributes']; listeners: ReturnType<typeof useSortable>['listeners'] }) => React.ReactNode;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 10 : undefined,
        position: 'relative',
        background: isDragging ? 'var(--card)' : undefined,
    };
    return (
        <div ref={setNodeRef} style={style} className={cn(CONFIG_ROW_GRID, 'border-border bg-card border-b px-4 py-3 last:border-b-0')}>
            {children({ attributes, listeners })}
        </div>
    );
}

function TaxConfigTab() {
    const [config, setConfig] = useState<PayrollConfig | null>(null);
    const [configs, setConfigs] = useState<TaxConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [payCycleOpen, setPayCycleOpen] = useState(false);
    const [payCycleForm, setPayCycleForm] = useState({ pay_frequency: 'monthly' as PayrollConfig['pay_frequency'], pay_day: 28 });
    const [savingPayCycle, setSavingPayCycle] = useState(false);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editing, setEditing] = useState<TaxConfig | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<TaxConfig | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        name: '', mode: 'flat_percentage' as TaxConfigMode, target: 'base_salary' as TaxConfigTarget,
        bearer: 'employee' as TaxBearer, ratePct: 0, lower_bound: 0, upper_bound: '' as string, openEnded: false,
    });

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [configData, configsData] = await Promise.all([
                getPayrollConfig(),
                getTaxConfigs(),
            ]);
            setConfig(configData);
            setConfigs([...configsData].sort((a, b) => a.step - b.step));
        } catch (err) {
            handleErrorMessage(err, 'Failed to load tax configuration');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const filtered = configs.filter(c =>
        `${c.name} ${MODE_LABEL[c.mode]} ${TARGET_LABEL[c.target]} ${c.bearer}`.toLowerCase().includes(search.toLowerCase())
    );

    const openPayCycle = () => {
        if (!config) return;
        setPayCycleForm({ pay_frequency: config.pay_frequency, pay_day: config.pay_day });
        setPayCycleOpen(true);
    };

    const handleSavePayCycle = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingPayCycle(true);
        try {
            await updatePayrollConfig(payCycleForm);
            toast.success('Pay cycle updated');
            setPayCycleOpen(false);
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, 'Failed to update pay cycle');
        } finally {
            setSavingPayCycle(false);
        }
    };

    const openDialog = (row: TaxConfig | null = null) => {
        setEditing(row);
        setForm(row
            ? {
                name: row.name, mode: row.mode, target: row.target, bearer: row.bearer,
                ratePct: row.rate * 100, lower_bound: row.lower_bound ?? 0,
                upper_bound: row.upper_bound != null ? String(row.upper_bound) : '', openEnded: row.upper_bound == null && row.mode !== 'flat_percentage',
            }
            : { name: '', mode: 'flat_percentage', target: 'base_salary', bearer: 'employee', ratePct: 0, lower_bound: 0, upper_bound: '', openEnded: false }
        );
        setIsDialogOpen(true);
    };

    const closeDialog = () => { setIsDialogOpen(false); setEditing(null); };

    const hasBounds = form.mode !== 'flat_percentage';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const payload = {
            name: form.name,
            mode: form.mode,
            target: form.target,
            bearer: form.bearer,
            rate: form.ratePct / 100,
            lower_bound: hasBounds ? form.lower_bound : null,
            upper_bound: hasBounds ? (form.openEnded ? null : Number(form.upper_bound)) : null,
        };
        try {
            if (editing) {
                await updateTaxConfig(editing.id, payload);
                toast.success('Tax config updated');
            } else {
                const nextStep = configs.length > 0 ? Math.max(...configs.map(c => c.step)) + 1 : 1;
                await createTaxConfig({ ...payload, step: nextStep });
                toast.success('Tax config created');
            }
            closeDialog();
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, editing ? 'Failed to update tax config' : 'Failed to create tax config');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (row: TaxConfig) => {
        try {
            await updateTaxConfig(row.id, { is_active: !row.is_active });
            setConfigs(prev => prev.map(c => c.id === row.id ? { ...c, is_active: !c.is_active } : c));
        } catch (err) {
            handleErrorMessage(err, 'Failed to update tax config');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteTaxConfig(deleteTarget.id);
            toast.success('Tax config deleted');
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, 'Failed to delete tax config');
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = configs.findIndex(c => c.id === active.id);
        const newIndex = configs.findIndex(c => c.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(configs, oldIndex, newIndex);
        setConfigs(reordered);
        try {
            const items = reordered.map((c, i) => ({ id: c.id, step: i + 1 }));
            const updated = await reorderTaxConfigs(items);
            setConfigs([...updated].sort((a, b) => a.step - b.step));
        } catch (err) {
            handleErrorMessage(err, 'Failed to reorder tax configs');
            fetchAll();
        }
    };

    return (
        <div className="mt-6 flex flex-col gap-4">
            {/* Pay cycle strip */}
            <Card className="border-primary/15 bg-primary/5 p-0">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                    {loading || !config ? (
                        <Skeleton className="h-9 w-64" />
                    ) : (
                        <>
                            <div className="flex items-center gap-6">
                                <div>
                                    <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Pay Frequency</p>
                                    <p className="text-foreground text-sm font-semibold capitalize">{config.pay_frequency}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Pay Day</p>
                                    <p className="text-foreground text-sm font-semibold">Day {config.pay_day} of the month</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={openPayCycle} className="gap-1.5">
                                <Settings2 className="size-3.5" /> Edit Pay Cycle
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative max-w-sm flex-1">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        placeholder="Search tax configurations…"
                        className="h-9 pl-9"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <Button onClick={() => openDialog()}>
                    <Plus className="mr-2 size-4" /> Add Tax Config
                </Button>
            </div>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="border-border bg-muted/30 flex items-center justify-between border-b px-5 py-3">
                    <p className="text-foreground text-sm font-semibold">All Tax Configurations</p>
                    <Badge variant="outline" className="rounded-full text-xs">{filtered.length} configs</Badge>
                </div>

                <div className={cn(CONFIG_ROW_GRID, 'border-border bg-muted/20 border-b px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide')}>
                    <span />
                    <span>Name</span>
                    <span>Mode</span>
                    <span>Target</span>
                    <span>Rate</span>
                    <span>Bearer</span>
                    <span>Active</span>
                    <span className="text-right">Actions</span>
                </div>

                {loading ? (
                    <div className="space-y-2 p-4">
                        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                            <ListTree className="text-muted-foreground size-7" />
                        </div>
                        {configs.length === 0 ? (
                            <>
                                <p className="text-foreground font-semibold">No tax configs yet</p>
                                <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
                                    New organizations start with an empty tax config list — nothing is pre-populated. Add SSNIT contributions, PAYE bands, or anything else that applies, then reorder them so employee-borne rows land before the brackets they should apply to.
                                </p>
                                <Button className="mt-4" onClick={() => openDialog()}>
                                    <Plus className="mr-2 size-4" /> Add Your First Tax Config
                                </Button>
                            </>
                        ) : (
                            <>
                                <p className="text-foreground font-semibold">No matching configurations</p>
                                <p className="text-muted-foreground mt-1 text-sm">Try a different search term.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={filtered.map(c => c.id)} strategy={verticalListSortingStrategy}>
                            {filtered.map(row => (
                                <SortableConfigRow key={row.id} id={row.id}>
                                    {({ attributes, listeners }) => (
                                        <>
                                            <button
                                                type="button" {...attributes} {...listeners}
                                                className="text-muted-foreground hover:text-foreground flex cursor-grab items-center justify-center active:cursor-grabbing"
                                                aria-label="Drag to reorder"
                                            >
                                                <GripVertical className="size-4" />
                                            </button>
                                            <div className="min-w-0">
                                                <p className="text-foreground truncate text-sm font-semibold">{row.name}</p>
                                                {row.mode !== 'flat_percentage' && (
                                                    <p className="text-muted-foreground truncate text-xs">
                                                        GHS {(row.lower_bound ?? 0).toLocaleString()} – {row.upper_bound == null ? 'and above' : row.upper_bound.toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-muted-foreground text-sm">{MODE_LABEL[row.mode]}</span>
                                            <span className="text-muted-foreground text-sm">{TARGET_LABEL[row.target]}</span>
                                            <span className="num-tabular text-sm font-medium">{(row.rate * 100).toFixed(2)}%</span>
                                            <Badge variant="outline" className={cn('rounded-full text-xs', row.bearer === 'employee' ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground')}>
                                                {row.bearer === 'employee' ? 'Employee' : 'Employer'}
                                            </Badge>
                                            <Switch checked={row.is_active} onCheckedChange={() => toggleActive(row)} />
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="size-8" onClick={() => openDialog(row)} aria-label="Edit tax config">
                                                    <Pencil className="size-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8" onClick={() => setDeleteTarget(row)} aria-label="Delete tax config">
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </SortableConfigRow>
                            ))}
                        </SortableContext>
                    </DndContext>
                )}
            </Card>

            {/* Pay cycle dialog */}
            <Dialog open={payCycleOpen} onOpenChange={setPayCycleOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Edit Pay Cycle</DialogTitle></DialogHeader>
                    <form onSubmit={handleSavePayCycle} className="space-y-5 pt-2">
                        <div className="space-y-1.5">
                            <Label>Pay Frequency</Label>
                            <Select value={payCycleForm.pay_frequency} onValueChange={v => setPayCycleForm(f => ({ ...f, pay_frequency: v as PayrollConfig['pay_frequency'] }))}>
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="biweekly">Biweekly</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Pay Day</Label>
                            <Input type="number" min={1} max={31} value={payCycleForm.pay_day} onChange={e => setPayCycleForm(f => ({ ...f, pay_day: Number(e.target.value) }))} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setPayCycleOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={savingPayCycle}>{savingPayCycle ? 'Saving…' : 'Save'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Create/edit tax config dialog */}
            <Dialog open={isDialogOpen} onOpenChange={open => !open && closeDialog()}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editing ? 'Edit Tax Config' : 'Add Tax Config'}</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-5 pt-2">
                        <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bonus Tax" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Mode</Label>
                                <Select value={form.mode} onValueChange={v => setForm(f => ({ ...f, mode: v as TaxConfigMode }))}>
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="flat_percentage">Flat Percentage</SelectItem>
                                        <SelectItem value="threshold_split">Threshold Split</SelectItem>
                                        <SelectItem value="progressive_bracket">Progressive Bracket</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Target</Label>
                                <Select value={form.target} onValueChange={v => setForm(f => ({ ...f, target: v as TaxConfigTarget }))}>
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="base_salary">Base Salary</SelectItem>
                                        <SelectItem value="gross_pay">Gross Pay</SelectItem>
                                        <SelectItem value="bonus">Bonus</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Bearer</Label>
                                <Select value={form.bearer} onValueChange={v => setForm(f => ({ ...f, bearer: v as TaxBearer }))}>
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="employee">Employee</SelectItem>
                                        <SelectItem value="employer">Employer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Rate (%)</Label>
                                <Input type="number" step="0.01" min={0} max={100} value={form.ratePct} onChange={e => setForm(f => ({ ...f, ratePct: Number(e.target.value) }))} required />
                            </div>
                        </div>
                        {hasBounds && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Lower Bound</Label>
                                        <Input type="number" step="0.01" min={0} value={form.lower_bound} onChange={e => setForm(f => ({ ...f, lower_bound: Number(e.target.value) }))} required />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Upper Bound</Label>
                                        <Input
                                            type="number" step="0.01" min={0}
                                            value={form.upper_bound}
                                            disabled={form.openEnded}
                                            onChange={e => setForm(f => ({ ...f, upper_bound: e.target.value }))}
                                            required={!form.openEnded}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border p-3">
                                    <div>
                                        <p className="text-foreground text-sm font-medium">Open-ended top band</p>
                                        <p className="text-muted-foreground text-xs">No upper limit — applies to everything above the lower bound.</p>
                                    </div>
                                    <Switch checked={form.openEnded} onCheckedChange={v => setForm(f => ({ ...f, openEnded: v }))} />
                                </div>
                            </>
                        )}
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={closeDialog}>Cancel</Button>
                            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editing ? 'Update' : 'Create'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Tax Config</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ─── Benefit Items (catalog) ────────────────────────────────────────────────
function BenefitItemsTab() {
    const [items, setItems] = useState<BenefitItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editing, setEditing] = useState<BenefitItem | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<BenefitItem | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        name: '', category: 'allowance' as BenefitCategory,
        calculation_type: 'fixed_amount' as BenefitCalculationType,
        value: 0, taxReliefAmount: 0, is_taxable: true,
    });

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            setItems(await getBenefitItems());
        } catch (err) {
            handleErrorMessage(err, 'Failed to load benefit items');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    const openDialog = (item: BenefitItem | null = null) => {
        setEditing(item);
        setForm(item
            ? {
                name: item.name, category: item.category, calculation_type: item.calculation_type,
                value: item.calculation_type === 'percentage_of_base' ? item.value * 100 : item.value,
                taxReliefAmount: item.tax_relief_amount, is_taxable: item.is_taxable,
            }
            : { name: '', category: 'allowance', calculation_type: 'fixed_amount', value: 0, taxReliefAmount: 0, is_taxable: true }
        );
        setIsDialogOpen(true);
    };

    const closeDialog = () => { setIsDialogOpen(false); setEditing(null); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const payload = {
            name: form.name,
            category: form.category,
            calculation_type: form.calculation_type,
            value: form.calculation_type === 'percentage_of_base' ? form.value / 100 : form.value,
            tax_relief_amount: form.taxReliefAmount,
            is_taxable: form.is_taxable,
        };
        try {
            if (editing) {
                await updateBenefitItem(editing.id, payload);
                toast.success('Benefit item updated');
            } else {
                await createBenefitItem(payload);
                toast.success('Benefit item created');
            }
            closeDialog();
            fetchItems();
        } catch (err) {
            handleErrorMessage(err, editing ? 'Failed to update benefit item' : 'Failed to create benefit item');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (item: BenefitItem) => {
        try {
            await updateBenefitItem(item.id, { is_active: !item.is_active });
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
        } catch (err) {
            handleErrorMessage(err, 'Failed to update benefit item');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteBenefitItem(deleteTarget.id);
            toast.success('Benefit item deleted');
            fetchItems();
        } catch (err) {
            handleErrorMessage(err, 'Failed to delete benefit item');
        } finally {
            setDeleteTarget(null);
        }
    };

    return (
        <div className="mt-6 flex flex-col gap-4">
            <div className="flex justify-end">
                <Button onClick={() => openDialog()}><Plus className="mr-2 size-4" /> Add Benefit Item</Button>
            </div>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                                <th className="px-4 py-2.5 pl-6 text-left">Name</th>
                                <th className="px-4 py-2.5 text-left">Category</th>
                                <th className="px-4 py-2.5 text-left">Calc. Type</th>
                                <th className="px-4 py-2.5 text-left">Value</th>
                                <th className="px-4 py-2.5 text-left">Tax Relief</th>
                                <th className="px-4 py-2.5 text-left">Taxable</th>
                                <th className="px-4 py-2.5 text-left">Active</th>
                                <th className="px-4 py-2.5 pr-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b last:border-0">
                                        {Array.from({ length: 8 }).map((_, j) => (
                                            <td key={j} className="px-4 py-2.5"><Skeleton className="h-5 w-full rounded" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <Gift className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-foreground font-semibold">No benefit items yet</p>
                                        <p className="text-muted-foreground mt-1 text-sm">Add an allowance or deduction to the catalog.</p>
                                    </td>
                                </tr>
                            ) : items.map(item => (
                                <tr key={item.id} className={cn('border-b last:border-0', !item.is_active && 'opacity-60')}>
                                    <td className="px-4 py-2.5 pl-6 font-semibold">{item.name}</td>
                                    <td className="px-4 py-2.5">
                                        <Badge variant="outline" className={cn('rounded-full text-xs capitalize', CATEGORY_BADGE[item.category])}>
                                            {item.category}
                                        </Badge>
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2.5">
                                        {item.calculation_type === 'fixed_amount' ? 'Fixed amount' : '% of base'}
                                    </td>
                                    <td className="num-tabular px-4 py-2.5">
                                        {item.calculation_type === 'percentage_of_base' ? `${(item.value * 100).toFixed(1)}%` : item.value.toLocaleString()}
                                    </td>
                                    <td className="num-tabular text-muted-foreground px-4 py-2.5">
                                        {item.tax_relief_amount > 0 ? item.tax_relief_amount.toLocaleString() : '—'}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <Badge variant="outline" className={cn('rounded-full text-xs', item.is_taxable ? 'border-warning/30 bg-warning/10 text-warning-foreground' : 'border-border bg-muted text-muted-foreground')}>
                                            {item.is_taxable ? 'Taxable' : 'Not taxable'}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <Switch checked={item.is_active} onCheckedChange={() => toggleActive(item)} />
                                    </td>
                                    <td className="px-4 py-2.5 pr-6 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="size-8" onClick={() => openDialog(item)} aria-label="Edit benefit item">
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8" onClick={() => setDeleteTarget(item)} aria-label="Delete benefit item">
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={open => !open && closeDialog()}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editing ? 'Edit Benefit Item' : 'Add Benefit Item'}</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-5 pt-2">
                        <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Housing Allowance" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Category</Label>
                                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as BenefitCategory }))}>
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="allowance">Allowance</SelectItem>
                                        <SelectItem value="deduction">Deduction</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Calculation Type</Label>
                                <Select value={form.calculation_type} onValueChange={v => setForm(f => ({ ...f, calculation_type: v as BenefitCalculationType }))}>
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed_amount">Fixed amount</SelectItem>
                                        <SelectItem value="percentage_of_base">% of base pay</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>{form.calculation_type === 'percentage_of_base' ? 'Percentage of base (%)' : 'Amount'}</Label>
                                <Input type="number" step="0.01" min={0} value={form.value} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} required />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Tax Relief Amount</Label>
                                <Input type="number" step="0.01" min={0} value={form.taxReliefAmount} onChange={e => setForm(f => ({ ...f, taxReliefAmount: Number(e.target.value) }))} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <p className="text-foreground text-sm font-medium">Taxable</p>
                                <p className="text-muted-foreground text-xs">Included in PAYE taxable income.</p>
                            </div>
                            <Switch checked={form.is_taxable} onCheckedChange={v => setForm(f => ({ ...f, is_taxable: v }))} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={closeDialog}>Cancel</Button>
                            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editing ? 'Update' : 'Create'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Benefit Item</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ─── Benefit Bands (reusable packages) ──────────────────────────────────────
interface ItemSelection {
    selected: boolean;
    override: string;
}

function BenefitBandsTab() {
    const fmt = useCurrency();
    const [bands, setBands] = useState<BenefitBand[]>([]);
    const [allItems, setAllItems] = useState<BenefitItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editing, setEditing] = useState<BenefitBand | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<BenefitBand | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({ name: '', description: '' });
    const [itemSelections, setItemSelections] = useState<Record<number, ItemSelection>>({});

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [bandsData, itemsData] = await Promise.all([
                getBenefitBands(),
                getBenefitItems(),
            ]);
            setBands(bandsData);
            setAllItems(itemsData.filter(i => i.is_active));
        } catch (err) {
            handleErrorMessage(err, 'Failed to load benefit bands');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const openDialog = (band: BenefitBand | null = null) => {
        setEditing(band);
        setForm(band ? { name: band.name, description: band.description ?? '' } : { name: '', description: '' });
        const selections: Record<number, ItemSelection> = {};
        allItems.forEach(item => {
            const existing = band?.band_items?.find(bi => bi.benefit_item_id === item.id);
            selections[item.id] = {
                selected: !!existing,
                override: existing?.override_value != null ? String(existing.override_value) : '',
            };
        });
        setItemSelections(selections);
        setIsDialogOpen(true);
    };

    const closeDialog = () => { setIsDialogOpen(false); setEditing(null); };

    const toggleItemSelection = (itemId: number) => {
        setItemSelections(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], selected: !prev[itemId]?.selected },
        }));
    };

    const setItemOverride = (itemId: number, override: string) => {
        setItemSelections(prev => ({ ...prev, [itemId]: { ...prev[itemId], override } }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const selectedEntries = Object.entries(itemSelections)
                .filter(([, v]) => v.selected)
                .map(([itemId, v]) => ({
                    benefit_item_id: Number(itemId),
                    override_value: v.override.trim() ? Number(v.override) : null,
                }));

            if (editing) {
                await updateBenefitBand(editing.id, form);

                const existingItems = editing.band_items ?? [];
                const selectedIds = new Set(selectedEntries.map(entry => entry.benefit_item_id));

                // No update endpoint for an existing band item's override — remove + re-add when it changes.
                for (const bi of existingItems) {
                    const entry = selectedEntries.find(e => e.benefit_item_id === bi.benefit_item_id);
                    const overrideChanged = entry != null && entry.override_value !== bi.override_value;
                    if (!selectedIds.has(bi.benefit_item_id) || overrideChanged) {
                        await removeBenefitBandItem(editing.id, bi.id);
                    }
                }
                for (const entry of selectedEntries) {
                    const existing = existingItems.find(bi => bi.benefit_item_id === entry.benefit_item_id);
                    const overrideChanged = existing != null && entry.override_value !== existing.override_value;
                    if (!existing || overrideChanged) {
                        await addBenefitBandItem(editing.id, entry);
                    }
                }

                toast.success('Benefit band updated');
            } else {
                const newBand = await createBenefitBand(form);
                for (const entry of selectedEntries) {
                    await addBenefitBandItem(newBand.id, entry);
                }
                toast.success('Benefit band created');
            }
            closeDialog();
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, editing ? 'Failed to update benefit band' : 'Failed to create benefit band');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (band: BenefitBand) => {
        try {
            await updateBenefitBand(band.id, { is_active: !band.is_active });
            setBands(prev => prev.map(b => b.id === band.id ? { ...b, is_active: !b.is_active } : b));
        } catch (err) {
            handleErrorMessage(err, 'Failed to update benefit band');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteBenefitBand(deleteTarget.id);
            toast.success('Benefit band deleted');
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, 'Failed to delete benefit band');
        } finally {
            setDeleteTarget(null);
        }
    };

    return (
        <div className="mt-6 flex flex-col gap-4">
            <div className="flex justify-end">
                <Button onClick={() => openDialog()}><Plus className="mr-2 size-4" /> Add Benefit Band</Button>
            </div>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                                <th className="px-4 py-2.5 pl-6 text-left">Name</th>
                                <th className="px-4 py-2.5 text-left">Description</th>
                                <th className="px-4 py-2.5 text-left">Items</th>
                                <th className="px-4 py-2.5 text-left">Active</th>
                                <th className="px-4 py-2.5 pr-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <tr key={i} className="border-b last:border-0">
                                        {Array.from({ length: 5 }).map((_, j) => (
                                            <td key={j} className="px-4 py-2.5"><Skeleton className="h-5 w-full rounded" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : bands.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center">
                                        <EmptyState icon={Layers} title="No benefit bands yet" description="Bundle benefit items into a reusable package to assign to employees in one action." />
                                    </td>
                                </tr>
                            ) : bands.map(band => {
                                const bandItems = band.band_items ?? [];
                                return (
                                <tr key={band.id} className={cn('border-b last:border-0', !band.is_active && 'opacity-60')}>
                                    <td className="px-4 py-2.5 pl-6 font-semibold">{band.name}</td>
                                    <td className="text-muted-foreground max-w-[240px] truncate px-4 py-2.5">{band.description || 'No description'}</td>
                                    <td className="px-4 py-2.5">
                                        {bandItems.length === 0 ? (
                                            <span className="text-muted-foreground text-xs">No items</span>
                                        ) : (
                                            <Badge variant="outline" className="rounded-full text-xs" title={bandItems.map(bi => bi.benefit_item.name).join(', ')}>
                                                {bandItems.length} item{bandItems.length !== 1 ? 's' : ''}
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <Switch checked={band.is_active} onCheckedChange={() => toggleActive(band)} />
                                    </td>
                                    <td className="px-4 py-2.5 pr-6 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8" aria-label="Band actions">
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openDialog(band)}>
                                                    <Pencil className="mr-2 size-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => setDeleteTarget(band)}
                                                >
                                                    <Trash2 className="mr-2 size-4" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            );})}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create/edit band dialog */}
            <Dialog open={isDialogOpen} onOpenChange={open => !open && closeDialog()}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Benefit Band' : 'Add Benefit Band'}</DialogTitle>
                        <DialogDescription>Pick which benefit items belong to this band — you can change the selection any time.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-5 pt-2">
                        <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Associate Staff Band" required />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="min-h-[70px] resize-none" placeholder="Optional" />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Benefit Items</Label>
                            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
                                {allItems.length === 0 ? (
                                    <p className="text-muted-foreground py-4 text-center text-sm">No active benefit items in the catalog yet.</p>
                                ) : allItems.map(item => {
                                    const selection = itemSelections[item.id] ?? { selected: false, override: '' };
                                    return (
                                        <div key={item.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                                            <Checkbox
                                                checked={selection.selected}
                                                onCheckedChange={() => toggleItemSelection(item.id)}
                                                aria-label={`Include ${item.name}`}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-foreground truncate text-sm font-medium">{item.name}</p>
                                                    <Badge variant="outline" className={cn('rounded-full text-xs capitalize', CATEGORY_BADGE[item.category])}>
                                                        {item.category}
                                                    </Badge>
                                                </div>
                                                <p className="text-muted-foreground text-xs">
                                                    Default: {item.calculation_type === 'percentage_of_base' ? `${(item.value * 100).toFixed(1)}% of base` : fmt(item.value)}
                                                </p>
                                            </div>
                                            {selection.selected && (
                                                <Input
                                                    type="number" step="0.01" min={0}
                                                    className="h-8 w-28 shrink-0 text-xs"
                                                    placeholder="Override"
                                                    value={selection.override}
                                                    onChange={e => setItemOverride(item.id, e.target.value)}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={closeDialog}>Cancel</Button>
                            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editing ? 'Update' : 'Create'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Benefit Band</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ─── Net-to-Gross calculator ────────────────────────────────────────────────
function NetToGrossTab() {
    const fmt = useCurrency();
    const [configs, setConfigs] = useState<TaxConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);

    const [desiredNet, setDesiredNet] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [result, setResult] = useState<number | null>(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getTaxConfigs();
            const sorted = [...data].sort((a, b) => a.step - b.step);
            setConfigs(sorted);
            setSelected(new Set(sorted.filter(c => c.is_active).map(c => c.id)));
        } catch (err) {
            handleErrorMessage(err, 'Failed to load tax configuration');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const toggle = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelected(new Set(configs.map(c => c.id)));
    const selectAllEmployee = () => setSelected(new Set(configs.filter(c => c.bearer === 'employee').map(c => c.id)));
    const deselectAll = () => setSelected(new Set());

    const handleCalculate = async () => {
        const target = Number(desiredNet);
        if (!target || target <= 0) { toast.error('Enter a valid desired net salary'); return; }
        setCalculating(true);
        setResult(null);
        try {
            const res = await calculateNetToGross({ desired_net_salary: target, tax_config_ids: [...selected] });
            setResult(res.required_gross_salary);
        } catch (err) {
            handleErrorMessage(err, 'Failed to calculate gross salary');
        } finally {
            setCalculating(false);
        }
    };

    if (loading) {
        return (
            <div className="mt-6 max-w-2xl space-y-4">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="gap-0 p-0">
                <CardHeader className="border-b px-6 py-4">
                    <CardTitle className="text-sm font-semibold">Net-to-Gross Calculator</CardTitle>
                    <p className="text-muted-foreground text-xs">
                        Calculate the required gross salary to achieve a desired net take-home pay, factoring in applicable tax configurations. Doesn&apos;t factor in an employee&apos;s specific benefits.
                    </p>
                </CardHeader>
                <CardContent className="space-y-5 px-6 py-6">
                    <div className="space-y-1.5">
                        <Label>Desired Net Salary (GHS) *</Label>
                        <Input type="number" step="0.01" min={0} value={desiredNet} onChange={e => setDesiredNet(e.target.value)} placeholder="e.g. 4725.00" />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Applicable Tax Configurations</Label>
                            <div className="flex items-center gap-1">
                                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={selectAll}>Select All</Button>
                                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={selectAllEmployee}>Select All Employee Taxes</Button>
                                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={deselectAll}>Deselect All</Button>
                            </div>
                        </div>
                        <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border p-2">
                            {configs.length === 0 && (
                                <p className="text-muted-foreground px-2 py-3 text-center text-sm">
                                    No tax configs yet — add some in the Tax Config tab first.
                                </p>
                            )}
                            {configs.map(cfg => (
                                <label key={cfg.id} className="hover:bg-muted/50 flex cursor-pointer items-center justify-between rounded-md px-2 py-2">
                                    <div className="flex items-center gap-2.5">
                                        <Checkbox checked={selected.has(cfg.id)} onCheckedChange={() => toggle(cfg.id)} />
                                        <div>
                                            <p className="text-foreground text-sm font-medium">{cfg.name}</p>
                                            <p className="text-muted-foreground text-xs">({(cfg.rate * 100).toFixed(1)}%)</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={cn('rounded-full text-xs', cfg.bearer === 'employee' ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground')}>
                                        {cfg.bearer === 'employee' ? 'Employee' : 'Employer'}
                                    </Badge>
                                </label>
                            ))}
                        </div>
                    </div>

                    <Button onClick={handleCalculate} disabled={calculating} className="w-full gap-1.5">
                        <Wand2 className="size-4" /> {calculating ? 'Calculating…' : 'Calculate'}
                    </Button>
                </CardContent>
            </Card>

            <Card className="gap-0 p-0">
                <CardHeader className="border-b px-6 py-4">
                    <CardTitle className="text-sm font-semibold">Result</CardTitle>
                </CardHeader>
                <CardContent className="px-6 py-6">
                    {result == null ? (
                        <div className="text-muted-foreground flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center text-sm">
                            <Calculator className="size-8 opacity-40" />
                            Enter a desired net salary and calculate to see the required gross pay.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="border-primary/20 bg-primary/5 rounded-lg border p-4">
                                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Required Gross Salary</p>
                                <p className="text-foreground mt-1 text-2xl font-bold">{fmt(result)}</p>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Desired Net Salary</span>
                                <span className="text-success font-semibold">{fmt(Number(desiredNet))}</span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
