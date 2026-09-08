/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import {
    Plus, MoreHorizontal, Pencil, Trash2, Search, RefreshCcw,
    Banknote, FilterX, CreditCard, Smartphone, Building2,
    CheckCircle2, Receipt, ShoppingBag, AlertTriangle, Download,
    Check, ChevronsUpDown,
} from 'lucide-react';
import { downloadCsv } from '@/lib/exportCsv';
import {
    GetAllPayments, GetPaymentsByOrderId, CreatePayment, UpdatePayment, DeletePayment,
} from '@/(api-handlers)/paymentsHandler';
import { GetWalkinOrdersList } from '@/(api-handlers)/orders_walkinsHandler';
import { getOrganizationUsers } from '@/(api-handlers)/userHandler';
import { getOrganizationShops } from '@/(api-handlers)/organizationShopsHandler';
import { useAuthStore } from '@/(zustand-store)/authStore';
import { OrderWalkInsResponse } from '@/interfaces/orders_walkins';
import { PaymentResponse, PaymentRequest, PaymentUpdateRequest } from '@/interfaces/payments';
import { UserResponse } from '@/interfaces/loginInterface';
import { OrganizationShopResponse } from '@/interfaces/organizationShops';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import { toast } from 'sonner';
import PageHeader from '@/components/(shared-components)/PageHeader';
import Pagination from '@/components/(shared-components)/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { StatusPill } from '@/components/(shared-components)/StatusPill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useCurrency, useOrgCurrency } from '@/hooks/useCurrency';

type PaymentMethod = 'Cash' | 'Mobile Money' | 'Card' | 'Check' | 'Bank Transfer';

interface FormValues {
    order_id: string;
    payment_number: string;
    payment_method: PaymentMethod;
    amount: string;
    currency: string;
    exchange_rate: string;
    card_last_four: string;
    card_brand: string;
    authorization_code: string;
    mobile_provider: string;
    mobile_number: string;
    transaction_id: string;
    check_number: string;
    bank_name: string;
    collected_by: string;
    verified_by: string;
    status: string;
}

function statusBadgeClass(status: string) {
    switch (status?.toLowerCase()) {
        case 'verified': return 'border-success/30 bg-success/10 text-success';
        case 'pending':  return 'border-warning/30 bg-warning/10 text-warning-foreground';
        case 'failed':   return 'border-destructive/30 bg-destructive/10 text-destructive';
        default:         return 'border-border bg-muted text-muted-foreground';
    }
}

function MethodIcon({ method }: { method: string }) {
    switch (method?.toLowerCase()) {
        case 'card':          return <CreditCard className="size-3.5" />;
        case 'mobile money':  return <Smartphone className="size-3.5" />;
        case 'bank transfer':
        case 'check':         return <Building2 className="size-3.5" />;
        default:              return <Banknote className="size-3.5" />;
    }
}

export default function PaymentsPage() {
    const fmt = useCurrency();
    const orgCurrency = useOrgCurrency();
    const [payments, setPayments]           = useState<PaymentResponse[]>([]);
    const [orders, setOrders]               = useState<OrderWalkInsResponse[]>([]);
    const [users, setUsers]                 = useState<UserResponse[]>([]);
    const [selectedOrderId, setSelectedOrderId] = useState<string>('-1');
    const [loading, setLoading]             = useState(true);
    const [searchTerm, setSearchTerm]       = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [isModalOpen, setIsModalOpen]     = useState(false);
    const [editingPayment, setEditingPayment] = useState<PaymentResponse | null>(null);
    const [submitting, setSubmitting]       = useState(false);
    const [deleteTarget, setDeleteTarget]   = useState<PaymentResponse | null>(null);
    const [deleting, setDeleting]           = useState(false);
    const [orderPickerOpen, setOrderPickerOpen] = useState(false);

    const { user } = useAuthStore();
    const [shops, setShops]                 = useState<OrganizationShopResponse[]>([]);
    const [selectedShopId, setSelectedShopId] = useState('all');
    const isAdmin = ['admin', 'superadmin'].includes((user?.role ?? '').toLowerCase());

    const { register, handleSubmit, control, reset, setValue, formState: { errors } } = useForm<FormValues>({
        defaultValues: {
            payment_method: 'Cash',
            currency: orgCurrency,
            exchange_rate: '1',
        },
    });
    const watchedMethod = useWatch({ control, name: 'payment_method' });

    useEffect(() => {
        if (!isAdmin) return;
        getOrganizationShops().then(setShops).catch(console.error);
    }, [isAdmin]);

    const fetchOrders = useCallback(async () => {
        try {
            const shopId = selectedShopId === 'all' ? undefined : Number(selectedShopId);
            const data: any = await GetWalkinOrdersList(shopId);
            const list: OrderWalkInsResponse[] = data.items ?? data ?? [];
            setOrders(list);
        } catch { /* orders is optional context */ }
    }, [selectedShopId]);

    const fetchPayments = useCallback(async () => {
        setLoading(true);
        try {
            if (selectedOrderId && selectedOrderId !== '-1') {
                const data = await GetPaymentsByOrderId(Number(selectedOrderId));
                setPayments(Array.isArray(data) ? data : []);
            } else {
                const shopId = selectedShopId === 'all' ? undefined : Number(selectedShopId);
                const data: any = await GetAllPayments(shopId);
                setPayments(data.items ?? data ?? []);
            }
        } catch (error) {
            handleErrorMessage(error, 'Failed to load payments');
        } finally {
            setLoading(false);
        }
    }, [selectedOrderId, selectedShopId]);

    useEffect(() => {
        fetchOrders();
        getOrganizationUsers().then(setUsers).catch(console.error);
    }, [fetchOrders]);

    useEffect(() => { fetchPayments(); }, [fetchPayments]);

    const openModal = (payment: PaymentResponse | null = null) => {
        setEditingPayment(payment);
        if (payment) {
            reset({
                status:           payment.status ?? '',
                verified_by:      payment.verified_by?.toString() ?? '',
                card_last_four:   payment.card_last_four ?? '',
                card_brand:       payment.card_brand ?? '',
                authorization_code: payment.authorization_code ?? '',
                mobile_provider:  payment.mobile_provider ?? '',
                mobile_number:    payment.mobile_number ?? '',
                transaction_id:   payment.transaction_id ?? '',
                check_number:     payment.check_number ?? '',
                bank_name:        payment.bank_name ?? '',
                payment_method:   (payment.payment_method as PaymentMethod) ?? 'Cash',
            });
        } else {
            reset({
                payment_number:  `PAY-${Date.now().toString().slice(-6)}`,
                currency:        orgCurrency,
                exchange_rate:   '1',
                payment_method:  'Cash',
                order_id:        selectedOrderId !== '-1' ? selectedOrderId : '',
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingPayment(null);
        reset();
    };

    const onSubmit = async (values: FormValues) => {
        setSubmitting(true);
        try {
            if (editingPayment) {
                const updateData: PaymentUpdateRequest = {
                    status:             values.status || undefined,
                    verified_by:        values.verified_by ? Number(values.verified_by) : null,
                    card_last_four:     values.card_last_four || null,
                    card_brand:         values.card_brand || null,
                    authorization_code: values.authorization_code || null,
                    mobile_provider:    values.mobile_provider || null,
                    mobile_number:      values.mobile_number || null,
                    transaction_id:     values.transaction_id || null,
                    check_number:       values.check_number || null,
                    bank_name:          values.bank_name || null,
                };
                await UpdatePayment(editingPayment.id, updateData);
                toast.success('Payment updated');
            } else {
                const createData: PaymentRequest = {
                    order_id:           Number(values.order_id),
                    payment_number:     values.payment_number,
                    payment_method:     values.payment_method,
                    amount:             Number(values.amount),
                    currency:           values.currency || 'GHS',
                    exchange_rate:      Number(values.exchange_rate || 1),
                    card_last_four:     values.card_last_four || null,
                    card_brand:         values.card_brand || null,
                    authorization_code: values.authorization_code || null,
                    mobile_provider:    values.mobile_provider || null,
                    mobile_number:      values.mobile_number || null,
                    transaction_id:     values.transaction_id || null,
                    check_number:       values.check_number || null,
                    bank_name:          values.bank_name || null,
                    collected_by:       values.collected_by ? Number(values.collected_by) : null,
                };
                await CreatePayment(createData);
                toast.success('Payment recorded');
            }
            closeModal();
            fetchPayments();
        } catch (error) {
            handleErrorMessage(error, editingPayment ? 'Failed to update payment' : 'Failed to create payment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await DeletePayment(deleteTarget.id);
            toast.success('Payment deleted');
            setDeleteTarget(null);
            fetchPayments();
        } catch (error) {
            handleErrorMessage(error, 'Failed to delete payment');
        } finally {
            setDeleting(false);
        }
    };

    const hasFilters = searchTerm !== '' || selectedStatus !== 'all' || selectedShopId !== 'all';

    const filtered = payments
        .filter(p => {
            const ms = p.payment_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.payment_method?.toLowerCase().includes(searchTerm.toLowerCase());
            const mf = selectedStatus === 'all' || p.status?.toLowerCase() === selectedStatus;
            return ms && mf;
        })
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    const pg = usePagination(filtered, 10);

    const handleExport = () => {
        downloadCsv(`payments-${new Date().toISOString().split('T')[0]}.csv`, filtered.map(p => ({
            'Reference':      p.payment_number ?? '',
            'Order ID':       p.order_id ?? '',
            'Method':         p.payment_method ?? '',
            [`Amount (${orgCurrency})`]: p.amount ?? 0,
            'Currency':       p.currency ?? 'GHS',
            'Status':         p.status ?? '',
            'Transaction ID': p.transaction_id ?? '',
            'Created At':     p.created_at ?? '',
        })));
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Payments"
                description="Track and manage all financial transactions across your organisation."
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={fetchPayments} disabled={loading} aria-label="Refresh payments">
                            <RefreshCcw className={cn('size-4', loading && 'animate-spin')} />
                        </Button>
                        <Button variant="outline" onClick={handleExport} disabled={loading || filtered.length === 0}>
                            <Download data-icon="inline-start" /> Export
                        </Button>
                        <Button onClick={() => openModal()}>
                            <Plus data-icon="inline-start" /> New Payment
                        </Button>
                    </div>
                }
            />

            <Card className="gap-0 overflow-hidden p-0">
                {/* Toolbar */}
                <div className="border-border bg-muted/30 flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-6">
                    {/* Order filter */}
                    <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                        <SelectTrigger className="h-9 w-[220px]">
                            <div className="flex items-center gap-2">
                                <Receipt className="text-muted-foreground size-3.5" />
                                <SelectValue placeholder="All payments" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="-1">All payments</SelectItem>
                            {orders.map(o => (
                                <SelectItem key={o.id} value={o.id.toString()}>
                                    #{o.order_number || o.id} — {fmt(o.total_amount)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            placeholder="Search ref or method…"
                            className="h-9 pl-9"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger className="h-9 w-[140px]">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="verified">Verified</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                            </SelectContent>
                        </Select>

                        {isAdmin && (
                            <Select value={selectedShopId} onValueChange={setSelectedShopId}>
                                <SelectTrigger className="h-9 w-[160px]">
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
                        )}

                        {hasFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 text-muted-foreground"
                                onClick={() => { setSearchTerm(''); setSelectedStatus('all'); setSelectedShopId('all'); }}
                            >
                                <FilterX className="mr-1.5 size-3.5" /> Reset
                            </Button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Reference</TableHead>
                                <TableHead>Order</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Collected</TableHead>
                                <TableHead className="pr-6 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-20 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <Banknote className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-muted-foreground text-sm">No payments found.</p>
                                    </TableCell>
                                </TableRow>
                            ) : pg.pageItems.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="pl-6">
                                        <p className="text-foreground font-mono text-sm font-bold">{p.payment_number}</p>
                                        <p className="text-muted-foreground text-[10px]">ID #{p.id}</p>
                                    </TableCell>

                                    <TableCell>
                                        <Badge variant="secondary" className="font-mono text-xs">#{p.order_id}</Badge>
                                    </TableCell>

                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="bg-muted flex size-7 items-center justify-center rounded-md">
                                                <MethodIcon method={p.payment_method} />
                                            </div>
                                            <span className="text-foreground text-sm font-medium">{p.payment_method}</span>
                                        </div>
                                    </TableCell>

                                    <TableCell className="text-right">
                                        <p className="text-foreground num-tabular font-bold">
                                            {p.currency} {Number(p.amount).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                                        </p>
                                        {p.exchange_rate !== 1 && (
                                            <p className="text-muted-foreground text-[10px]">Rate: {p.exchange_rate}</p>
                                        )}
                                    </TableCell>

                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={cn('rounded-full text-xs font-medium capitalize', statusBadgeClass(p.status))}
                                        >
                                            {p.status || 'pending'}
                                        </Badge>
                                    </TableCell>

                                    <TableCell>
                                        <p className="text-foreground text-xs font-medium">
                                            {users.find(u => u.id === p.collected_by)?.first_name ?? 'System'}
                                        </p>
                                        <p className="text-muted-foreground text-[10px]">{p.payment_date} {p.payment_time}</p>
                                    </TableCell>

                                    <TableCell className="pr-6 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8" aria-label="Payment actions">
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-44">
                                                <DropdownMenuItem onClick={() => openModal(p)}>
                                                    <Pencil className="size-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => setDeleteTarget(p)}
                                                >
                                                    <Trash2 className="size-4" /> Delete
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

            {/* Payment Modal */}
            <Dialog open={isModalOpen} onOpenChange={open => !open && closeModal()}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="bg-primary/10 mb-1 inline-flex size-10 items-center justify-center rounded-xl">
                            {editingPayment ? <Pencil className="text-primary size-5" /> : <Plus className="text-primary size-5" />}
                        </div>
                        <DialogTitle>
                            {editingPayment ? `Edit Payment — ${editingPayment.payment_number}` : 'New Payment Transaction'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">
                        {/* Basic info */}
                        <div className="space-y-4">
                            <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                                <Receipt className="size-3.5" /> Transaction details
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                {!editingPayment && (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="order_id">Associated order <span className="text-destructive">*</span></Label>
                                            <Controller
                                                control={control}
                                                name="order_id"
                                                rules={{ required: true }}
                                                render={({ field }) => {
                                                    const selectedOrder = orders.find(o => o.id.toString() === field.value);
                                                    return (
                                                        <Popover open={orderPickerOpen} onOpenChange={setOrderPickerOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    role="combobox"
                                                                    aria-expanded={orderPickerOpen}
                                                                    className={cn(
                                                                        'h-9 w-full justify-between font-normal',
                                                                        !selectedOrder && 'text-muted-foreground',
                                                                        errors.order_id && 'border-destructive',
                                                                    )}
                                                                >
                                                                    <span className="truncate">
                                                                        {selectedOrder
                                                                            ? `#${selectedOrder.order_number || selectedOrder.id} — ${fmt(selectedOrder.total_amount)}`
                                                                            : 'Link to order…'}
                                                                    </span>
                                                                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                                                                <Command>
                                                                    <CommandInput placeholder="Search by order #…" />
                                                                    <CommandList>
                                                                        <CommandEmpty>No matching orders.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {orders.map(o => (
                                                                                <CommandItem
                                                                                    key={o.id}
                                                                                    value={`${o.order_number ?? ''} ${o.id}`}
                                                                                    onSelect={() => {
                                                                                        field.onChange(o.id.toString());
                                                                                        setOrderPickerOpen(false);
                                                                                    }}
                                                                                >
                                                                                    <Check className={cn('mr-2 size-4 shrink-0', field.value === o.id.toString() ? 'opacity-100' : 'opacity-0')} />
                                                                                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                                                                        <div className="min-w-0">
                                                                                            <p className="truncate text-sm font-medium">#{o.order_number || o.id}</p>
                                                                                            {o.order_date && (
                                                                                                <p className="text-muted-foreground text-xs">
                                                                                                    {new Date(o.order_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                                                </p>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex shrink-0 items-center gap-2">
                                                                                            <span className="num-tabular text-sm">{fmt(o.total_amount)}</span>
                                                                                            {o.payment_status && (
                                                                                                <Badge
                                                                                                    variant="outline"
                                                                                                    className={cn(
                                                                                                        'rounded-full text-[10px] capitalize',
                                                                                                        o.payment_status === 'paid'
                                                                                                            ? 'border-success/30 bg-success/10 text-success'
                                                                                                            : 'border-warning/30 bg-warning/10 text-warning-foreground',
                                                                                                    )}
                                                                                                >
                                                                                                    {o.payment_status}
                                                                                                </Badge>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    );
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="payment_number">Reference # <span className="text-destructive">*</span></Label>
                                            <Input
                                                id="payment_number"
                                                className="h-9"
                                                placeholder="PAY-XXXXXX"
                                                {...register('payment_number', { required: true })}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Amount <span className="text-destructive">*</span></Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                className="h-9"
                                                placeholder="0.00"
                                                {...register('amount', { required: true })}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Currency</Label>
                                            <Controller
                                                control={control}
                                                name="currency"
                                                render={({ field }) => (
                                                    <Select value={field.value} onValueChange={field.onChange}>
                                                        <SelectTrigger className="h-9 w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="GHS">GHS</SelectItem>
                                                            <SelectItem value="USD">USD</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="space-y-1.5">
                                    <Label>Payment method <span className="text-destructive">*</span></Label>
                                    <Controller
                                        control={control}
                                        name="payment_method"
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="h-9 w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Cash">Cash</SelectItem>
                                                    <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                                                    <SelectItem value="Card">Card</SelectItem>
                                                    <SelectItem value="Check">Check</SelectItem>
                                                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>

                                {editingPayment && (
                                    <div className="space-y-1.5">
                                        <Label>Status</Label>
                                        <Controller
                                            control={control}
                                            name="status"
                                            render={({ field }) => (
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-9 w-full">
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending">Pending</SelectItem>
                                                        <SelectItem value="verified">Verified</SelectItem>
                                                        <SelectItem value="failed">Failed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Card fields */}
                        {watchedMethod === 'Card' && (
                            <div className="bg-muted/40 space-y-3 rounded-xl border p-4">
                                <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                                    <CreditCard className="size-3.5" /> Card details
                                </p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Brand</Label>
                                        <Input className="h-8 text-sm" placeholder="Visa / Master" {...register('card_brand')} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Last 4 digits</Label>
                                        <Input className="h-8 text-sm" maxLength={4} placeholder="1234" {...register('card_last_four')} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Auth code</Label>
                                        <Input className="h-8 text-sm" placeholder="XXXXXX" {...register('authorization_code')} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Mobile money fields */}
                        {watchedMethod === 'Mobile Money' && (
                            <div className="bg-muted/40 space-y-3 rounded-xl border p-4">
                                <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                                    <Smartphone className="size-3.5" /> Mobile wallet
                                </p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Provider</Label>
                                        <Input className="h-8 text-sm" placeholder="MTN / Airtel" {...register('mobile_provider')} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Mobile #</Label>
                                        <Input className="h-8 text-sm" placeholder="024XXXXXXX" {...register('mobile_number')} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Transaction ID</Label>
                                        <Input className="h-8 text-sm" placeholder="TRX-XXXX" {...register('transaction_id')} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bank / check fields */}
                        {(watchedMethod === 'Check' || watchedMethod === 'Bank Transfer') && (
                            <div className="bg-muted/40 space-y-3 rounded-xl border p-4">
                                <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                                    <Building2 className="size-3.5" /> Bank details
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Bank name</Label>
                                        <Input className="h-8 text-sm" placeholder="e.g. EcoBank" {...register('bank_name')} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Ref / Check #</Label>
                                        <Input className="h-8 text-sm" placeholder="CHQ-XXXX" {...register('check_number')} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Institutional tracking */}
                        <div className="space-y-4">
                            <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                                <CheckCircle2 className="size-3.5" /> Institutional tracking
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Collected by</Label>
                                    <Controller
                                        control={control}
                                        name="collected_by"
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="h-9 w-full">
                                                    <SelectValue placeholder="Select staff…" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {users.map(u => (
                                                        <SelectItem key={u.id} value={u.id.toString()}>
                                                            {u.first_name} {u.last_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                                {editingPayment && (
                                    <div className="space-y-1.5">
                                        <Label>Verified by</Label>
                                        <Controller
                                            control={control}
                                            name="verified_by"
                                            render={({ field }) => (
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-9 w-full">
                                                        <SelectValue placeholder="Select verifier…" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {users.map(u => (
                                                            <SelectItem key={u.id} value={u.id.toString()}>
                                                                {u.first_name} {u.last_name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? 'Saving…' : 'Save payment'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <div className="bg-destructive/10 mx-auto mb-2 flex size-12 items-center justify-center rounded-full">
                            <AlertTriangle className="text-destructive size-6" />
                        </div>
                        <AlertDialogTitle>Delete payment?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Payment <strong>{deleteTarget?.payment_number}</strong> will be permanently removed. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
