"use client"

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/(zustand-store)/authStore';
import {
    getSalaryStructures, createSalaryStructure,
    getEmployeeBenefitsSummary, assignBenefitBand, addExtraBenefitItem, removeExtraBenefitItem,
    getBenefitBands, getBenefitItems,
} from '@/(api-handlers)/payrollHandler';
import { getUserByID } from '@/(api-handlers)/userHandler';
import {
    SalaryStructure, EmployeeBenefitsSummary, ExtraBenefitItem,
    BenefitBand, BenefitItem, BenefitCategory, WageType,
} from '@/interfaces/payroll';
import { UserResponse } from '@/interfaces/loginInterface';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import PageHeader from '@/components/(shared-components)/PageHeader';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronLeft, Plus, Trash2, Wallet, Gift, Layers, PackageOpen } from 'lucide-react';
import { DatePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { cn } from '@/lib/utils';

const CATEGORY_BADGE: Record<BenefitCategory, string> = {
    allowance: 'border-success/30 bg-success/10 text-success',
    deduction: 'border-destructive/30 bg-destructive/10 text-destructive',
};

function getInitials(first?: string, last?: string) {
    return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

const WAGE_TYPE_LABEL: Record<WageType, string> = { salaried: 'Salaried', hourly: 'Hourly', commission: 'Commission' };

export default function EmployeePayrollDetailPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const employeeProfileId = Number(params.id);
    const userId = searchParams.get('user_id');
    const fmt = useCurrency();

    const formatWage = (s: SalaryStructure) => {
        if (s.wage_type === 'hourly') return `${fmt(s.hourly_rate ?? 0)}/hr`;
        if (s.wage_type === 'commission') {
            const pct = `${((s.commission_rate ?? 0) * 100).toFixed(1)}% of sales`;
            return s.base_amount > 0 ? `${pct} + ${fmt(s.base_amount)}` : pct;
        }
        return fmt(s.base_amount);
    };

    const [employee, setEmployee] = useState<UserResponse | null>(null);
    const [salaryHistory, setSalaryHistory] = useState<SalaryStructure[]>([]);
    const [benefitsSummary, setBenefitsSummary] = useState<EmployeeBenefitsSummary | null>(null);
    const [bands, setBands] = useState<BenefitBand[]>([]);
    const [items, setItems] = useState<BenefitItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
    const [salaryForm, setSalaryForm] = useState<{
        wageType: WageType; amount: string; hourlyRate: string; commissionRate: string; baseRetainer: string; effectiveDate: Dayjs | null;
    }>({ wageType: 'salaried', amount: '', hourlyRate: '', commissionRate: '', baseRetainer: '', effectiveDate: dayjs() });
    const [savingSalary, setSavingSalary] = useState(false);

    const [bandDialogOpen, setBandDialogOpen] = useState(false);
    const [bandForm, setBandForm] = useState<{ bandId: string; effectiveDate: Dayjs | null }>({ bandId: '', effectiveDate: dayjs() });
    const [savingBand, setSavingBand] = useState(false);

    const [extraDialogOpen, setExtraDialogOpen] = useState(false);
    const [extraForm, setExtraForm] = useState<{ itemId: string; effectiveDate: Dayjs | null; overrideValue: string }>({
        itemId: '', effectiveDate: dayjs(), overrideValue: '',
    });
    const [savingExtra, setSavingExtra] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<ExtraBenefitItem | null>(null);

    useEffect(() => {
        if (user && user.role !== 'admin') router.replace('/dashboard');
    }, [user, router]);

    const fetchAll = useCallback(async () => {
        if (!employeeProfileId) return;
        setLoading(true);
        try {
            const [salary, summary, bandsData, itemsData] = await Promise.all([
                getSalaryStructures(employeeProfileId),
                getEmployeeBenefitsSummary(employeeProfileId),
                getBenefitBands(),
                getBenefitItems(),
            ]);
            setSalaryHistory(salary);
            setBenefitsSummary(summary);
            setBands(bandsData.filter(b => b.is_active));
            setItems(itemsData.filter(i => i.is_active));
            if (userId) {
                try { setEmployee(await getUserByID(userId)); } catch { setEmployee(null); }
            }
        } catch (err) {
            handleErrorMessage(err, 'Failed to load employee payroll data');
        } finally {
            setLoading(false);
        }
    }, [employeeProfileId, userId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const activeSalary = salaryHistory.find(s => s.end_date == null) ?? salaryHistory[0] ?? null;

    const handleSetSalary = async (e: React.FormEvent) => {
        e.preventDefault();
        const { wageType, amount, hourlyRate, commissionRate, baseRetainer, effectiveDate } = salaryForm;
        if (!effectiveDate) { toast.error('Pick an effective date'); return; }
        if (wageType === 'salaried' && !amount) { toast.error('Enter a base amount'); return; }
        if (wageType === 'hourly' && !hourlyRate) { toast.error('Enter an hourly rate'); return; }
        if (wageType === 'commission' && !commissionRate) { toast.error('Enter a commission rate'); return; }

        setSavingSalary(true);
        try {
            await createSalaryStructure({
                employee_profile_id: employeeProfileId,
                wage_type: wageType,
                base_amount: wageType === 'salaried' ? Number(amount) : wageType === 'commission' ? Number(baseRetainer || 0) : 0,
                hourly_rate: wageType === 'hourly' ? Number(hourlyRate) : undefined,
                commission_rate: wageType === 'commission' ? Number(commissionRate) / 100 : undefined,
                effective_date: effectiveDate.format('YYYY-MM-DD'),
            });
            toast.success('Salary updated');
            setSalaryDialogOpen(false);
            setSalaryForm({ wageType: 'salaried', amount: '', hourlyRate: '', commissionRate: '', baseRetainer: '', effectiveDate: dayjs() });
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, 'Failed to set salary');
        } finally {
            setSavingSalary(false);
        }
    };

    const handleAssignBand = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bandForm.bandId || !bandForm.effectiveDate) { toast.error('Pick a band and effective date'); return; }
        setSavingBand(true);
        try {
            await assignBenefitBand({
                employee_profile_id: employeeProfileId,
                benefit_band_id: Number(bandForm.bandId),
                effective_date: bandForm.effectiveDate.format('YYYY-MM-DD'),
            });
            toast.success('Benefit band assigned');
            setBandDialogOpen(false);
            setBandForm({ bandId: '', effectiveDate: dayjs() });
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, 'Failed to assign benefit band');
        } finally {
            setSavingBand(false);
        }
    };

    const handleAddExtra = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!extraForm.itemId || !extraForm.effectiveDate) { toast.error('Pick an item and effective date'); return; }
        setSavingExtra(true);
        try {
            await addExtraBenefitItem({
                employee_profile_id: employeeProfileId,
                benefit_item_id: Number(extraForm.itemId),
                effective_date: extraForm.effectiveDate.format('YYYY-MM-DD'),
                override_value: extraForm.overrideValue ? Number(extraForm.overrideValue) : null,
            });
            toast.success('Extra item added');
            setExtraDialogOpen(false);
            setExtraForm({ itemId: '', effectiveDate: dayjs(), overrideValue: '' });
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, 'Failed to add extra item');
        } finally {
            setSavingExtra(false);
        }
    };

    const handleRemoveExtra = async () => {
        if (!removeTarget) return;
        try {
            await removeExtraBenefitItem(removeTarget.id);
            toast.success('Extra item removed');
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, 'Failed to remove extra item');
        } finally {
            setRemoveTarget(null);
        }
    };

    if (!user || user.role !== 'admin') {
        return (
            <div className="flex items-center justify-center py-24">
                <Skeleton className="size-6 rounded-full" />
            </div>
        );
    }

    const currentBand = benefitsSummary?.benefit_band?.benefit_band ?? null;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/payroll/employees')} className="size-9 shrink-0">
                    <ChevronLeft className="size-5" />
                </Button>
                {employee ? (
                    <div className="flex items-center gap-3">
                        <Avatar className="size-11 rounded-lg">
                            <AvatarImage src={employee.profile_pic ?? undefined} alt={`${employee.first_name} ${employee.last_name}`} className="object-cover" />
                            <AvatarFallback className="rounded-lg bg-muted text-sm font-bold text-muted-foreground">
                                {getInitials(employee.first_name, employee.last_name)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-foreground text-xl font-bold leading-tight">{employee.first_name} {employee.last_name}</h1>
                            <p className="text-muted-foreground text-sm">
                                {employee.employee_profile?.job_title || 'Employee'}
                                {employee.employee_profile?.department ? ` · ${employee.employee_profile.department}` : ''}
                            </p>
                        </div>
                    </div>
                ) : (
                    <PageHeader title="Employee Payroll" description="Manage salary and benefits for this employee." separator={false} />
                )}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Salary card */}
                <Card className="gap-0 p-0">
                    <CardHeader className="border-b px-6 py-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                                <Wallet className="size-4" /> Salary
                            </CardTitle>
                            <Button size="sm" onClick={() => setSalaryDialogOpen(true)}>
                                <Plus className="mr-1.5 size-3.5" /> Set New Salary
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="px-6 py-5">
                        {loading ? (
                            <Skeleton className="h-16 w-full" />
                        ) : activeSalary ? (
                            <div className="border-primary/20 bg-primary/5 mb-4 rounded-lg border p-4">
                                <div className="flex items-center gap-2">
                                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Current Salary</p>
                                    <Badge variant="outline" className="rounded-full text-[10px]">{WAGE_TYPE_LABEL[activeSalary.wage_type]}</Badge>
                                </div>
                                <p className="text-foreground mt-1 text-2xl font-bold">{formatWage(activeSalary)}</p>
                                <p className="text-muted-foreground mt-1 text-xs">
                                    Effective {new Date(activeSalary.effective_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                        ) : (
                            <p className="text-muted-foreground mb-4 text-sm">No salary set yet.</p>
                        )}

                        {salaryHistory.length > 0 && (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Wage</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Effective</TableHead>
                                        <TableHead>Ended</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {salaryHistory.map(s => (
                                        <TableRow key={s.id}>
                                            <TableCell className="text-sm font-medium">{formatWage(s)}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{WAGE_TYPE_LABEL[s.wage_type]}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(s.effective_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {s.end_date ? new Date(s.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : (
                                                    <Badge variant="outline" className="border-success/30 bg-success/10 text-success rounded-full text-xs">Active</Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Benefits card */}
                <Card className="gap-0 p-0">
                    <CardHeader className="border-b px-6 py-4">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <Gift className="size-4" /> Benefits
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 px-6 py-5">
                        {loading ? (
                            <Skeleton className="h-32 w-full" />
                        ) : (
                            <>
                                {/* Current band */}
                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                                            <Layers className="size-3.5" /> Benefit Band
                                        </p>
                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBandDialogOpen(true)}>
                                            {currentBand ? 'Change Band' : 'Assign Band'}
                                        </Button>
                                    </div>
                                    {currentBand ? (
                                        <div className="border-primary/20 bg-primary/5 rounded-lg border p-4">
                                            <p className="text-foreground text-sm font-semibold">{currentBand.name}</p>
                                            {currentBand.description && <p className="text-muted-foreground text-xs">{currentBand.description}</p>}
                                            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                                <span>{benefitsSummary?.band_item_count ?? 0} band item{benefitsSummary?.band_item_count !== 1 ? 's' : ''}</span>
                                                {(benefitsSummary?.tax_relief_total ?? 0) > 0 && <span>· {fmt(benefitsSummary!.tax_relief_total)} tax relief</span>}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm">
                                            <PackageOpen className="size-4 shrink-0" /> No band assigned yet.
                                        </div>
                                    )}
                                </div>

                                {/* Extra items */}
                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Extra Items</p>
                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setExtraDialogOpen(true)}>
                                            <Plus className="mr-1 size-3.5" /> Add Extra
                                        </Button>
                                    </div>
                                    {(benefitsSummary?.extra_items.length ?? 0) === 0 ? (
                                        <p className="text-muted-foreground py-3 text-center text-sm">No extra items assigned.</p>
                                    ) : (
                                        <div className="divide-border/60 divide-y">
                                            {benefitsSummary!.extra_items.map(item => (
                                                <div key={item.id} className="flex items-center justify-between py-2.5">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-foreground truncate text-sm font-medium">{item.benefit_item.name}</p>
                                                            <Badge variant="outline" className={cn('rounded-full text-xs capitalize', CATEGORY_BADGE[item.benefit_item.category])}>
                                                                {item.benefit_item.category}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-muted-foreground mt-0.5 text-xs">
                                                            {item.benefit_item.calculation_type === 'percentage_of_base'
                                                                ? `${((item.override_value ?? item.benefit_item.value) * 100).toFixed(1)}% of base`
                                                                : fmt(item.override_value ?? item.benefit_item.value)}
                                                            {item.override_value != null && ' · overridden'}
                                                        </p>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8 shrink-0" onClick={() => setRemoveTarget(item)} aria-label="Remove extra item">
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Set salary dialog */}
            <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Set New Salary</DialogTitle></DialogHeader>
                    <form onSubmit={handleSetSalary} className="space-y-5 pt-2">
                        <div className="space-y-1.5">
                            <Label>Wage Type</Label>
                            <Select value={salaryForm.wageType} onValueChange={v => setSalaryForm(f => ({ ...f, wageType: v as WageType }))}>
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="salaried">Salaried</SelectItem>
                                    <SelectItem value="hourly">Hourly</SelectItem>
                                    <SelectItem value="commission">Commission</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {salaryForm.wageType === 'salaried' && (
                            <div className="space-y-1.5">
                                <Label>Base Amount</Label>
                                <Input type="number" step="0.01" min={0} value={salaryForm.amount} onChange={e => setSalaryForm(f => ({ ...f, amount: e.target.value }))} required />
                            </div>
                        )}
                        {salaryForm.wageType === 'hourly' && (
                            <div className="space-y-1.5">
                                <Label>Hourly Rate</Label>
                                <Input type="number" step="0.01" min={0} value={salaryForm.hourlyRate} onChange={e => setSalaryForm(f => ({ ...f, hourlyRate: e.target.value }))} required />
                                <p className="text-muted-foreground text-xs">Pay is calculated from approved timesheet hours for the run&apos;s pay period.</p>
                            </div>
                        )}
                        {salaryForm.wageType === 'commission' && (
                            <>
                                <div className="space-y-1.5">
                                    <Label>Commission Rate (%)</Label>
                                    <Input type="number" step="0.01" min={0} max={100} value={salaryForm.commissionRate} onChange={e => setSalaryForm(f => ({ ...f, commissionRate: e.target.value }))} required />
                                    <p className="text-muted-foreground text-xs">Applied to this employee&apos;s attributed sales for the run&apos;s pay period.</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Base Retainer (optional)</Label>
                                    <Input type="number" step="0.01" min={0} value={salaryForm.baseRetainer} onChange={e => setSalaryForm(f => ({ ...f, baseRetainer: e.target.value }))} />
                                </div>
                            </>
                        )}
                        <div className="space-y-1.5">
                            <Label>Effective Date</Label>
                            <DatePicker
                                className="h-9 w-full"
                                value={salaryForm.effectiveDate}
                                onChange={date => setSalaryForm(f => ({ ...f, effectiveDate: date }))}
                                format="DD MMM YYYY"
                            />
                        </div>
                        {activeSalary && (
                            <p className="text-muted-foreground text-xs">
                                This automatically ends the current {formatWage(activeSalary)} salary the day before this new effective date.
                            </p>
                        )}
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setSalaryDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={savingSalary}>{savingSalary ? 'Saving…' : 'Set Salary'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Assign/change band dialog */}
            <Dialog open={bandDialogOpen} onOpenChange={setBandDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{currentBand ? 'Change Benefit Band' : 'Assign Benefit Band'}</DialogTitle></DialogHeader>
                    <form onSubmit={handleAssignBand} className="space-y-5 pt-2">
                        <div className="space-y-1.5">
                            <Label>Benefit Band</Label>
                            <Select value={bandForm.bandId} onValueChange={v => setBandForm(f => ({ ...f, bandId: v }))}>
                                <SelectTrigger className="w-full"><SelectValue placeholder="Select a band…" /></SelectTrigger>
                                <SelectContent>
                                    {bands.map(b => (
                                        <SelectItem key={b.id} value={String(b.id)}>{b.name} ({(b.band_items ?? []).length} items)</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Effective Date</Label>
                            <DatePicker
                                className="h-9 w-full"
                                value={bandForm.effectiveDate}
                                onChange={date => setBandForm(f => ({ ...f, effectiveDate: date }))}
                                format="DD MMM YYYY"
                            />
                        </div>
                        {currentBand && (
                            <p className="text-muted-foreground text-xs">
                                This replaces the current &quot;{currentBand.name}&quot; band as of the effective date.
                            </p>
                        )}
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setBandDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={savingBand}>{savingBand ? 'Saving…' : 'Assign Band'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Add extra item dialog */}
            <Dialog open={extraDialogOpen} onOpenChange={setExtraDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Add Extra Item</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddExtra} className="space-y-5 pt-2">
                        <div className="space-y-1.5">
                            <Label>Benefit Item</Label>
                            <Select value={extraForm.itemId} onValueChange={v => setExtraForm(f => ({ ...f, itemId: v }))}>
                                <SelectTrigger className="w-full"><SelectValue placeholder="Select an item…" /></SelectTrigger>
                                <SelectContent>
                                    {items.map(i => (
                                        <SelectItem key={i.id} value={String(i.id)}>
                                            {i.name} ({i.category === 'allowance' ? '+' : '-'}{i.calculation_type === 'percentage_of_base' ? `${(i.value * 100).toFixed(1)}%` : i.value})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Effective Date</Label>
                            <DatePicker
                                className="h-9 w-full"
                                value={extraForm.effectiveDate}
                                onChange={date => setExtraForm(f => ({ ...f, effectiveDate: date }))}
                                format="DD MMM YYYY"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Override Value (optional)</Label>
                            <Input
                                type="number" step="0.01" min={0}
                                value={extraForm.overrideValue}
                                onChange={e => setExtraForm(f => ({ ...f, overrideValue: e.target.value }))}
                                placeholder="Leave blank to use the catalog value"
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setExtraDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={savingExtra}>{savingExtra ? 'Saving…' : 'Add Extra'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Remove extra item confirm */}
            <AlertDialog open={!!removeTarget} onOpenChange={open => !open && setRemoveTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Extra Item</AlertDialogTitle>
                        <AlertDialogDescription>
                            Remove <strong>{removeTarget?.benefit_item.name}</strong> from this employee? This unassigns it entirely — it won&apos;t appear in future payslips.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleRemoveExtra}>
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
