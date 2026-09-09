"use client"

import { useCallback, useEffect, useState } from 'react';
import {
    Plus, Search, RefreshCcw, FileUp,
    Package, AlertTriangle, XCircle, DollarSign, Building2,
    TrendingUp, Loader2, Pencil, MoreVertical,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import PageHeader from '@/components/(shared-components)/PageHeader';
import Pagination from '@/components/(shared-components)/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { StatusPill } from '@/components/(shared-components)/StatusPill';
import { BulkImportDialog } from '@/components/(shared-components)/BulkImportDialog';
import {
    GetAllInventory, GetInventoryStatistics, AdjustInventoryStock, UpdateInventory,
    BulkImportInventory, DownloadInventoryImportTemplate,
} from '@/(api-handlers)/inventoryHandler';
import { GetTransfers } from '@/(api-handlers)/inventoryTransfersHandler';
import type { LucideIcon } from 'lucide-react';
import { InventoryResponse, InventoryStats } from '@/interfaces/inventory';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import { getOrganizationShops } from '@/(api-handlers)/organizationShopsHandler';
import { useAuthStore } from '@/(zustand-store)/authStore';
import { OrganizationShopResponse } from '@/interfaces/organizationShops';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

interface EditForm {
    minimum_stock: string;
    maximum_stock: string;
    reorder_point: string;
    reorder_quantity: string;
    unit_of_measurement: string;
    aisle: string;
    shelf: string;
    bin_location: string;
    on_sale: boolean;
    is_active: boolean;
}

export default function InventoryPage() {
    const fmt = useCurrency();
    const router = useRouter();
    const [inventory, setInventory] = useState<InventoryResponse[]>([]);
    const [stats, setStats] = useState<InventoryStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState({ lowStock: false, outOfStock: false, needsReorder: false });

    // Restock
    const [restockTarget, setRestockTarget] = useState<InventoryResponse | null>(null);
    const [restockQty, setRestockQty] = useState('');
    const [restockReason, setRestockReason] = useState('');
    const [restocking, setRestocking] = useState(false);

    // Edit
    const [editTarget, setEditTarget] = useState<InventoryResponse | null>(null);
    const [editForm, setEditForm] = useState<EditForm | null>(null);
    const [saving, setSaving] = useState(false);

    const { user } = useAuthStore();
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [selectedShopId, setSelectedShopId] = useState('all');
    const isAdmin = ['admin', 'superadmin'].includes((user?.role ?? '').toLowerCase());
    const [incoming, setIncoming] = useState<Map<string, number>>(new Map());

    useEffect(() => {
        if (!isAdmin) return;
        getOrganizationShops().then(setShops).catch(console.error);
    }, [isAdmin]);

    useEffect(() => {
        GetTransfers({ status: 'shipped', limit: 200 })
            .then((data) => {
                const map = new Map<string, number>();
                data.items.forEach((transfer) => {
                    transfer.items.forEach((item) => {
                        const key = `${transfer.destination_shop_id}_${item.destination_product_id}`;
                        map.set(key, (map.get(key) ?? 0) + item.quantity);
                    });
                });
                setIncoming(map);
            })
            .catch(console.error);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const shopId = selectedShopId === 'all' ? undefined : Number(selectedShopId);
            const [inv, st] = await Promise.all([
                GetAllInventory(filter.lowStock, filter.outOfStock, filter.needsReorder, shopId),
                GetInventoryStatistics(shopId),
            ]);
            setInventory(inv);
            setStats(st);
        } catch (error) {
            handleErrorMessage(error, 'Failed to fetch inventory');
        } finally {
            setLoading(false);
        }
    }, [filter, selectedShopId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = inventory.filter(item =>
        (item.product_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_id.toString().includes(searchTerm)
    );
    const pg = usePagination(filtered, 10);

    const activeFilterCount = Object.values(filter).filter(Boolean).length;

    // ── Restock ──────────────────────────────────────────────
    const openRestock = (item: InventoryResponse) => {
        setRestockTarget(item);
        setRestockQty('');
        setRestockReason('');
    };

    const handleRestock = async () => {
        if (!restockTarget) return;
        const qty = Number(restockQty);
        if (!qty || qty <= 0) { toast.error('Enter a quantity greater than 0'); return; }
        setRestocking(true);
        try {
            await AdjustInventoryStock(restockTarget.id, {
                adjustment_quantity: qty,
                reason: restockReason || 'Manual restock',
            });
            toast.success(`Restocked ${qty} units of ${restockTarget.product_name ?? 'product'}`);
            setRestockTarget(null);
            fetchData();
        } catch (error) {
            handleErrorMessage(error, 'Restock failed');
        } finally {
            setRestocking(false);
        }
    };

    // ── Edit ─────────────────────────────────────────────────
    const openEdit = (item: InventoryResponse) => {
        setEditTarget(item);
        setEditForm({
            minimum_stock: String(item.minimum_stock),
            maximum_stock: String(item.maximum_stock ?? ''),
            reorder_point: String(item.reorder_point),
            reorder_quantity: String(item.reorder_quantity),
            unit_of_measurement: item.unit_of_measurement,
            aisle: item.aisle ?? '',
            shelf: item.shelf ?? '',
            bin_location: item.bin_location ?? '',
            on_sale: item.on_sale,
            is_active: item.is_active,
        });
    };

    const handleSave = async () => {
        if (!editTarget || !editForm) return;
        setSaving(true);
        try {
            await UpdateInventory(editTarget.id, {
                minimum_stock: Number(editForm.minimum_stock),
                maximum_stock: editForm.maximum_stock !== '' ? Number(editForm.maximum_stock) : undefined,
                reorder_point: Number(editForm.reorder_point),
                reorder_quantity: Number(editForm.reorder_quantity),
                unit_of_measurement: editForm.unit_of_measurement,
                aisle: editForm.aisle,
                shelf: editForm.shelf,
                bin_location: editForm.bin_location,
                on_sale: editForm.on_sale,
                is_active: editForm.is_active,
            });
            toast.success(`${editTarget.product_name ?? 'Inventory'} updated`);
            setEditTarget(null);
            fetchData();
        } catch (error) {
            handleErrorMessage(error, 'Failed to update inventory');
        } finally {
            setSaving(false);
        }
    };

    const setField = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
        setEditForm(prev => prev ? { ...prev, [key]: value } : prev);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Inventory"
                description="Monitor stock levels, manage reorders, and optimise inventory performance."
                actions={
                    <div className="flex gap-2">
                        <BulkImportDialog
                            trigger={<Button variant="outline"><FileUp data-icon="inline-start" /> Import CSV</Button>}
                            title="Bulk import stock levels"
                            description="Set current stock and reorder settings by SKU or barcode against existing products. Logs a stock movement on any change."
                            templateFilename="inventory-import-template.csv"
                            onDownloadTemplate={DownloadInventoryImportTemplate}
                            onImport={(file) => BulkImportInventory(file, selectedShopId === 'all' ? {} : { shop_id: Number(selectedShopId) })}
                            onDone={fetchData}
                        />
                        <Button onClick={() => router.push('/inventory/create')}>
                            <Plus data-icon="inline-start" /> Stock Product
                        </Button>
                    </div>
                }
            />

            {/* Stats strip */}
            <Card className="overflow-hidden p-0">
                <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
                    {(
                        [
                            {
                                label: 'Total Items',
                                value: stats ? stats.total_items.toLocaleString() : '—',
                                icon: Package,
                                sub: 'tracked products',
                                iconCls: 'bg-primary/10 text-primary',
                            },
                            {
                                label: 'Low Stock',
                                value: stats ? stats.low_stock_items.toLocaleString() : '—',
                                icon: AlertTriangle,
                                sub: stats ? `${stats.needs_reorder_items} need reorder` : 'need reorder',
                                iconCls: (stats?.low_stock_items ?? 0) > 0 ? 'bg-warning/10 text-warning-foreground' : 'bg-success/10 text-success',
                            },
                            {
                                label: 'Out of Stock',
                                value: stats ? stats.out_of_stock_items.toLocaleString() : '—',
                                icon: XCircle,
                                sub: (stats?.out_of_stock_items ?? 0) > 0 ? 'critical — restock now' : 'all items stocked',
                                iconCls: (stats?.out_of_stock_items ?? 0) > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success',
                            },
                            {
                                label: 'Inventory Value',
                                value: stats ? fmt(stats.total_inventory_value) : '—',
                                icon: DollarSign,
                                sub: 'at cost price',
                                iconCls: 'bg-info/10 text-info',
                            },
                        ] as { label: string; value: string; icon: LucideIcon; sub: string; iconCls: string }[]
                    ).map(({ label, value, icon: Icon, sub, iconCls }) => (
                        <div key={label} className="flex items-center gap-3 px-5 py-4">
                            <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', iconCls)}>
                                <Icon className="size-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-muted-foreground truncate text-xs font-medium">{label}</p>
                                {loading ? (
                                    <Skeleton className="mt-1 h-5 w-16" />
                                ) : (
                                    <p className="text-foreground truncate text-lg font-bold leading-tight num-tabular">{value}</p>
                                )}
                                <p className="text-muted-foreground truncate text-[10px]">{sub}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <Card className="gap-0 overflow-hidden p-0">
                {/* Toolbar */}
                <div className="border-border bg-muted/30 flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-6">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            placeholder="Search products…"
                            className="h-9 pl-9"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {([
                            { key: 'lowStock' as const, label: 'Low stock' },
                            { key: 'outOfStock' as const, label: 'Out of stock' },
                            { key: 'needsReorder' as const, label: 'Needs reorder' },
                        ]).map(({ key, label }) => (
                            <label
                                key={key}
                                className={cn(
                                    'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                                    filter[key]
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'border-border bg-card hover:bg-accent',
                                )}
                            >
                                <Checkbox
                                    checked={filter[key]}
                                    onCheckedChange={() => setFilter(p => ({ ...p, [key]: !p[key] }))}
                                    className="sr-only"
                                />
                                {label}
                                {filter[key] && activeFilterCount > 0 && ' ✓'}
                            </label>
                        ))}

                        {isAdmin && (
                            <Select value={selectedShopId} onValueChange={setSelectedShopId}>
                                <SelectTrigger className="h-9 w-[160px]">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="text-muted-foreground size-3.5" />
                                        <SelectValue placeholder="All shops" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All shops</SelectItem>
                                    {shops.map(s => (
                                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <Button variant="outline" size="icon" className="size-9" onClick={fetchData} aria-label="Refresh inventory">
                            <RefreshCcw className={cn('size-4', loading && 'animate-spin')} />
                        </Button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Product</TableHead>
                                <TableHead className="min-w-[180px]">Stock level</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Reorder point</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="pr-6 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-20 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <Package className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-muted-foreground text-sm">No inventory items found.</p>
                                    </TableCell>
                                </TableRow>
                            ) : pg.pageItems.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="pl-6">
                                        <p className="text-foreground font-semibold">{item.product_name ?? 'Unknown'}</p>
                                        <p className="text-muted-foreground font-mono text-[10px]">ID #{item.product_id}</p>
                                    </TableCell>

                                    <TableCell>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-foreground num-tabular text-sm font-semibold">
                                                    {item.current_stock} {item.unit_of_measurement}
                                                </span>
                                                <div className="flex gap-1">
                                                    {item.is_out_of_stock && <StatusPill status="failed" label="Out" showIcon={false} />}
                                                    {item.is_low_stock && !item.is_out_of_stock && <StatusPill status="warning" label="Low" showIcon={false} />}
                                                    {item.needs_reorder && <StatusPill status="info" label="Reorder" showIcon={false} />}
                                                    {!!incoming.get(`${item.shop_id}_${item.product_id}`) && (
                                                        <StatusPill
                                                            status="info"
                                                            label={`+${incoming.get(`${item.shop_id}_${item.product_id}`)} incoming`}
                                                            showIcon={false}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                                                <div
                                                    className={cn(
                                                        'h-full transition-all duration-500',
                                                        item.is_out_of_stock ? 'bg-destructive w-0'
                                                            : item.is_low_stock ? 'bg-warning'
                                                                : 'bg-success',
                                                    )}
                                                    style={{ width: `${Math.min((item.current_stock / (item.maximum_stock || 100)) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell>
                                        <p className="text-foreground text-xs font-medium">{item.aisle || 'N/A'} — {item.shelf || 'N/A'}</p>
                                        <p className="text-muted-foreground text-xs">{item.bin_location || 'No bin'}</p>
                                    </TableCell>

                                    <TableCell>
                                        <Badge variant="outline" className="border-info/30 bg-info/10 text-info rounded-full font-semibold">
                                            {item.reorder_point} {item.unit_of_measurement}
                                        </Badge>
                                    </TableCell>

                                    <TableCell>
                                        <StatusPill status={item.is_active ? 'active' : 'inactive'} />
                                    </TableCell>

                                    <TableCell className="pr-6 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8" aria-label="Actions">
                                                    <MoreVertical className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-40">
                                                <DropdownMenuItem className="text-xs" onClick={() => openRestock(item)}>
                                                    <TrendingUp className="size-3.5" /> Restock
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-xs" onClick={() => openEdit(item)}>
                                                    <Pencil className="size-3.5" /> Edit Inventory
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {!loading && filtered.length > 0 && (
                    <div className="border-border bg-muted/30 border-t px-4 py-3">
                        <Pagination page={pg.page} totalPages={pg.totalPages} onPageChange={pg.setPage} total={pg.total} pageSize={pg.pageSize} onPageSizeChange={pg.setPageSize} />
                    </div>
                )}
            </Card>

            {/* ── Restock dialog ── */}
            <Dialog open={!!restockTarget} onOpenChange={open => !open && setRestockTarget(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <div className="bg-success/10 mb-1 inline-flex size-10 items-center justify-center rounded-xl">
                            <TrendingUp className="text-success size-5" />
                        </div>
                        <DialogTitle>Restock Product</DialogTitle>
                    </DialogHeader>

                    {restockTarget && (
                        <div className="space-y-4 pt-1">
                            <div className="bg-muted/50 rounded-xl border p-3">
                                <p className="text-foreground text-sm font-semibold">{restockTarget.product_name ?? 'Product'}</p>
                                <p className="text-muted-foreground mt-0.5 text-xs">
                                    Current stock:{' '}
                                    <span className={cn(
                                        'font-semibold',
                                        restockTarget.current_stock === 0 ? 'text-destructive'
                                            : restockTarget.is_low_stock ? 'text-warning-foreground'
                                                : 'text-success',
                                    )}>
                                        {restockTarget.current_stock} {restockTarget.unit_of_measurement}
                                    </span>
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Quantity to add <span className="text-destructive">*</span></Label>
                                <Input
                                    type="number"
                                    min="1"
                                    placeholder="e.g. 50"
                                    value={restockQty}
                                    onChange={e => setRestockQty(e.target.value)}
                                    autoFocus
                                />
                                {restockQty && Number(restockQty) > 0 && (
                                    <p className="text-muted-foreground text-xs">
                                        New stock will be{' '}
                                        <span className="text-foreground font-semibold">
                                            {restockTarget.current_stock + Number(restockQty)} {restockTarget.unit_of_measurement}
                                        </span>
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label>Reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
                                <Textarea
                                    placeholder="e.g. New delivery from supplier"
                                    rows={2}
                                    className="resize-none"
                                    value={restockReason}
                                    onChange={e => setRestockReason(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRestockTarget(null)} disabled={restocking}>Cancel</Button>
                        <Button onClick={handleRestock} disabled={restocking || !restockQty || Number(restockQty) <= 0}>
                            {restocking ? <><Loader2 className="size-4 animate-spin" /> Restocking…</> : <><TrendingUp className="size-4" /> Restock</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Edit inventory dialog ── */}
            <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="bg-primary/10 mb-1 inline-flex size-10 items-center justify-center rounded-xl">
                            <Pencil className="text-primary size-5" />
                        </div>
                        <DialogTitle>Edit Inventory — {editTarget?.product_name}</DialogTitle>
                    </DialogHeader>

                    {editForm && (
                        <div className="space-y-5 pt-1">
                            {/* Stock thresholds */}
                            <div className="space-y-3">
                                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Stock thresholds</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Min. stock</Label>
                                        <Input
                                            type="number" min="0"
                                            value={editForm.minimum_stock}
                                            onChange={e => setField('minimum_stock', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Max. stock</Label>
                                        <Input
                                            type="number" min="0"
                                            placeholder="Unlimited"
                                            value={editForm.maximum_stock}
                                            onChange={e => setField('maximum_stock', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Reorder point</Label>
                                        <Input
                                            type="number" min="0"
                                            value={editForm.reorder_point}
                                            onChange={e => setField('reorder_point', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Reorder quantity</Label>
                                        <Input
                                            type="number" min="0"
                                            value={editForm.reorder_quantity}
                                            onChange={e => setField('reorder_quantity', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Unit */}
                            <div className="space-y-1.5">
                                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Unit of measurement</p>
                                <Select value={editForm.unit_of_measurement} onValueChange={v => setField('unit_of_measurement', v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="units">Units / Pieces</SelectItem>
                                        <SelectItem value="kg">Kilograms (kg)</SelectItem>
                                        <SelectItem value="liters">Liters (L)</SelectItem>
                                        <SelectItem value="packs">Packs</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Location */}
                            <div className="space-y-3">
                                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Storage location</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Aisle</Label>
                                        <Input placeholder="e.g. A4" value={editForm.aisle} onChange={e => setField('aisle', e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Shelf</Label>
                                        <Input placeholder="e.g. B2" value={editForm.shelf} onChange={e => setField('shelf', e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Bin</Label>
                                        <Input placeholder="e.g. BIN-09" value={editForm.bin_location} onChange={e => setField('bin_location', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            {/* Toggles */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-muted/40 flex items-center justify-between rounded-xl border p-3">
                                    <div>
                                        <p className="text-foreground text-sm font-semibold">On sale</p>
                                        <p className="text-muted-foreground text-xs">Listed in POS</p>
                                    </div>
                                    <Switch checked={editForm.on_sale} onCheckedChange={v => setField('on_sale', v)} />
                                </div>
                                <div className="bg-muted/40 flex items-center justify-between rounded-xl border p-3">
                                    <div>
                                        <p className="text-foreground text-sm font-semibold">Active</p>
                                        <p className="text-muted-foreground text-xs">Track this item</p>
                                    </div>
                                    <Switch checked={editForm.is_active} onCheckedChange={v => setField('is_active', v)} />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : <><Pencil className="size-4" /> Save changes</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
