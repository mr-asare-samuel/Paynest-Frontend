"use client"

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, Filter, Plus, RefreshCcw, ShoppingBag, Truck } from 'lucide-react';
import PageHeader from '@/components/(shared-components)/PageHeader';
import Pagination from '@/components/(shared-components)/Pagination';
import EmptyState from '@/components/(shared-components)/EmptyState';
import { StatusPill } from '@/components/(shared-components)/StatusPill';
import PurchaseOrderDetailDialog from '@/components/purchasing/PurchaseOrderDetailDialog';
import { GetPurchaseOrders } from '@/(api-handlers)/purchaseOrdersHandler';
import { GetVendors } from '@/(api-handlers)/vendorsHandler';
import { getOrganizationShops } from '@/(api-handlers)/organizationShopsHandler';
import { useAuthStore } from '@/(zustand-store)/authStore';
import { PurchaseOrderResponse, PurchaseOrderStatus } from '@/interfaces/purchaseOrders';
import { VendorResponse } from '@/interfaces/vendors';
import { OrganizationShopResponse } from '@/interfaces/organizationShops';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

export default function PurchaseOrdersPage() {
    const { user } = useAuthStore();
    const role = (user?.role || "attendant").toLowerCase();
    const canCreate = role === "manager" || role === "admin" || role === "superadmin";

    const [orders, setOrders] = useState<PurchaseOrderResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<PurchaseOrderStatus | 'all'>('all');
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [selectedShopId, setSelectedShopId] = useState('all');
    const [vendors, setVendors] = useState<VendorResponse[]>([]);
    const [selectedPoId, setSelectedPoId] = useState<number | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const shopName = (id: number) => shops.find((s) => s.id === id)?.name || `Shop #${id}`;
    const vendorName = (id: number) => vendors.find((v) => v.id === id)?.name || `Vendor #${id}`;

    useEffect(() => {
        getOrganizationShops().then(setShops).catch(console.error);
        GetVendors({ limit: 200 }).then((data) => setVendors(data.items)).catch(console.error);
    }, []);

    const fetchOrders = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const data = await GetPurchaseOrders({
                status: filterStatus === 'all' ? undefined : filterStatus,
                shop_id: selectedShopId === 'all' ? undefined : Number(selectedShopId),
                skip: (p - 1) * PAGE_SIZE,
                limit: PAGE_SIZE,
            });
            setOrders(data.items);
            setTotal(data.total);
        } catch (error) {
            handleErrorMessage(error, 'Failed to fetch purchase orders');
        } finally {
            setLoading(false);
        }
    }, [filterStatus, selectedShopId]);

    useEffect(() => { fetchOrders(page); }, [page, fetchOrders]);

    useEffect(() => { setPage(1); }, [filterStatus, selectedShopId]);

    const openDetail = (id: number) => {
        setSelectedPoId(id);
        setDetailOpen(true);
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Purchase Orders"
                description="Order stock from vendors and track delivery + invoicing."
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => fetchOrders(page)} disabled={loading} aria-label="Refresh purchase orders">
                            <RefreshCcw className={cn('size-4', loading && 'animate-spin')} />
                        </Button>
                        {canCreate && (
                            <Button asChild>
                                <Link href="/purchase-orders/create">
                                    <Plus className="mr-2 size-4" />
                                    New Purchase Order
                                </Link>
                            </Button>
                        )}
                    </div>
                }
            />

            <Card className="gap-0 overflow-hidden p-0">
                <div className="border-border bg-muted/30 flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as PurchaseOrderStatus | 'all')}>
                            <SelectTrigger className="h-9 w-[170px]">
                                <div className="flex items-center gap-2">
                                    <Filter className="text-muted-foreground size-3.5" />
                                    <SelectValue placeholder="All statuses" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="partially_received">Partially Received</SelectItem>
                                <SelectItem value="received">Received</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={selectedShopId} onValueChange={setSelectedShopId}>
                            <SelectTrigger className="h-9 w-[170px]">
                                <div className="flex items-center gap-2">
                                    <ShoppingBag className="text-muted-foreground size-3.5" />
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
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">PO #</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Shop</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="pr-6 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={7} className="px-6 py-4">
                                            <Skeleton className="h-6 w-full" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : orders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="p-0">
                                        <EmptyState
                                            icon={Truck}
                                            title="No purchase orders found"
                                            description="Orders you place with vendors will show up here."
                                            actions={canCreate ? (
                                                <Button asChild>
                                                    <Link href="/purchase-orders/create">New Purchase Order</Link>
                                                </Button>
                                            ) : undefined}
                                            className="border-none"
                                        />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                orders.map((po) => (
                                    <TableRow key={po.id} className="cursor-pointer" onClick={() => openDetail(po.id)}>
                                        <TableCell className="pl-6 font-medium">{po.po_number}</TableCell>
                                        <TableCell className="text-sm">{vendorName(po.vendor_id)}</TableCell>
                                        <TableCell className="text-sm">{shopName(po.shop_id)}</TableCell>
                                        <TableCell>
                                            <StatusPill status={po.status} />
                                        </TableCell>
                                        <TableCell className="text-right text-sm">GHS {Number(po.total_amount).toFixed(2)}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {format(new Date(po.created_at), 'MMM d, yyyy · HH:mm')}
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                aria-label="View purchase order"
                                                onClick={(e) => { e.stopPropagation(); openDetail(po.id); }}
                                            >
                                                <Eye className="size-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} isLoading={loading} total={total} />

            <PurchaseOrderDetailDialog
                poId={selectedPoId}
                open={detailOpen}
                onOpenChange={setDetailOpen}
                onChanged={() => fetchOrders(page)}
            />
        </div>
    );
}
