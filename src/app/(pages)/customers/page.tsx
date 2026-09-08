"use client"

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
    Search, Pencil, Trash2, Mail, Phone, MapPin, Copy, Cake, MoreHorizontal,
    Download, RefreshCcw, UserPlus, Star, AlertTriangle, ShoppingBag, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { GetAllCustomers, DeleteCustomer } from '@/(api-handlers)/customersHandler';
import { getOrganizationShops } from '@/(api-handlers)/organizationShopsHandler';
import { useAuthStore } from '@/(zustand-store)/authStore';
import { CustomerResponse } from '@/interfaces/customers';
import { OrganizationShopResponse } from '@/interfaces/organizationShops';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import PageHeader from '@/components/(shared-components)/PageHeader';
import Pagination from '@/components/(shared-components)/Pagination';
import { StatusPill } from '@/components/(shared-components)/StatusPill';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { downloadCsv } from '@/lib/exportCsv';

const TIERS = ['standard', 'silver', 'gold', 'platinum'];

function tierStyle(tier: string) {
    switch (tier?.toLowerCase()) {
        case 'gold':     return 'border-warning/30 bg-warning/10 text-warning-foreground';
        case 'silver':   return 'border-muted bg-muted text-muted-foreground';
        case 'platinum': return 'border-info/30 bg-info/10 text-info';
        default:         return 'border-primary/20 bg-primary/10 text-primary';
    }
}

function daysToBirthday(dob?: string): number | null {
    if (!dob) return null;
    const d = dayjs(dob);
    if (!d.isValid()) return null;
    const now = dayjs().startOf('day');
    let next = d.year(now.year()).startOf('day');
    if (next.isBefore(now)) next = next.add(1, 'year');
    return next.diff(now, 'day');
}

function fmtDate(iso?: string) {
    if (!iso) return null;
    const d = dayjs(iso);
    return d.isValid() ? d.format('MMM D, YYYY') : null;
}

function CustomerAvatar({ firstName, lastName }: Readonly<{ firstName: string; lastName: string }>) {
    const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
    return (
        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
            {initials}
        </div>
    );
}

const PAGE_SIZE = 20;

export default function CustomerListPage() {
    const router = useRouter();
    const [customers, setCustomers] = useState<CustomerResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    const [statusFilter, setStatusFilter] = useState('all');
    const [tierFilter, setTierFilter] = useState('all');
    const [birthdayFilter, setBirthdayFilter] = useState('all');

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const { user } = useAuthStore();
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [selectedShopId, setSelectedShopId] = useState('all');
    const isAdmin = ['admin', 'superadmin'].includes((user?.role ?? '').toLowerCase());

    useEffect(() => {
        if (!isAdmin) return;
        getOrganizationShops().then(setShops).catch(console.error);
    }, [isAdmin]);

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const shopId = selectedShopId === 'all' ? undefined : Number(selectedShopId);
            const data = await GetAllCustomers(shopId, (page - 1) * PAGE_SIZE, PAGE_SIZE);
            setCustomers(data.items);
            setTotal(data.total);
        } catch (error) {
            handleErrorMessage(error, 'Failed to fetch customers');
        } finally {
            setLoading(false);
        }
    }, [selectedShopId, page]);

    useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await DeleteCustomer(deleteTarget.id);
            toast.success('Customer deleted');
            setDeleteTarget(null);
            fetchCustomers();
        } catch (error) {
            handleErrorMessage(error, 'Failed to delete customer');
        } finally {
            setDeleting(false);
        }
    };

    const filtered = useMemo(() => customers.filter(c => {
        const matchesSearch =
            `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.customer_code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all'
            || (statusFilter === 'active' ? c.is_active : !c.is_active);
        const matchesTier = tierFilter === 'all'
            || (c.loyalty_tier || 'standard').toLowerCase() === tierFilter;
        const dtb = daysToBirthday(c.date_of_birth);
        const matchesBirthday = birthdayFilter === 'all'
            || (dtb !== null && dtb <= (birthdayFilter === 'week' ? 7 : 30));
        return matchesSearch && matchesStatus && matchesTier && matchesBirthday;
    }), [customers, searchTerm, statusFilter, tierFilter, birthdayFilter]);

    const activeFilters = (statusFilter !== 'all' ? 1 : 0)
        + (tierFilter !== 'all' ? 1 : 0)
        + (birthdayFilter !== 'all' ? 1 : 0);
    const clearFilters = () => {
        setStatusFilter('all');
        setTierFilter('all');
        setBirthdayFilter('all');
    };

    const copy = (label: string, value?: string) => {
        if (!value) return toast.error(`No ${label} on file`);
        navigator.clipboard.writeText(value);
        toast.success(`${label} copied`);
    };

    const handleExport = () => {
        downloadCsv(`customers-${new Date().toISOString().split('T')[0]}.csv`, filtered.map(c => ({
            'ID':               c.id,
            'Code':             c.customer_code,
            'First Name':       c.first_name,
            'Last Name':        c.last_name,
            'Email':            c.email,
            'Phone':            c.phone,
            'City':             c.city ?? '',
            'Country':          c.country ?? '',
            'Status':           c.is_active ? 'Active' : 'Inactive',
            'Loyalty Tier':     c.loyalty_tier ?? '',
            'Loyalty Points':   c.loyalty_points ?? 0,
            'Payment Method':   c.preferred_payment_method ?? '',
            'Joined':           fmtDate(c.created_at) ?? '',
        })));
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Customers"
                description="Manage your client base, loyalty programs, and contact information."
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleExport} disabled={loading || filtered.length === 0}>
                            <Download data-icon="inline-start" /> Export
                        </Button>
                        <Button onClick={() => router.push('/customers/create')}>
                            <UserPlus data-icon="inline-start" /> Add Customer
                        </Button>
                    </div>
                }
            />

            <Card className="gap-0 overflow-hidden p-0">
                {/* Toolbar */}
                <div className="border-border bg-muted/30 flex flex-col gap-3 border-b px-4 py-3 sm:px-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                placeholder="Search by name, email or code…"
                                className="h-9 pl-9"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {isAdmin && (
                            <Select value={selectedShopId} onValueChange={v => { setSelectedShopId(v); setPage(1); }}>
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
                        )}
                        <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={fetchCustomers} aria-label="Refresh customers">
                            <RefreshCcw className={cn('size-4', loading && 'animate-spin')} />
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Any status</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={tierFilter} onValueChange={setTierFilter}>
                            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Any tier</SelectItem>
                                {TIERS.map(t => (
                                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={birthdayFilter} onValueChange={setBirthdayFilter}>
                            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Any birthday</SelectItem>
                                <SelectItem value="week">Birthday ≤ 7 days</SelectItem>
                                <SelectItem value="month">Birthday ≤ 30 days</SelectItem>
                            </SelectContent>
                        </Select>
                        {activeFilters > 0 && (
                            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={clearFilters}>
                                <X className="size-3.5" /> Clear ({activeFilters})
                            </Button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Customer</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Loyalty</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[70px] pr-6 text-right">Actions</TableHead>
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
                                            <UserPlus className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-muted-foreground text-sm">
                                            {searchTerm || activeFilters > 0
                                                ? 'No customers match your search or filters.'
                                                : 'No customers yet.'}
                                        </p>
                                        {!searchTerm && activeFilters === 0 && (
                                            <Button className="mt-4" onClick={() => router.push('/customers/create')}>
                                                Add first customer
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ) : filtered.map(c => {
                                const dtb = daysToBirthday(c.date_of_birth);
                                const name = `${c.first_name} ${c.last_name}`;
                                return (
                                    <TableRow
                                        key={c.id}
                                        className="hover:bg-muted/40 cursor-pointer"
                                        onClick={() => router.push(`/customers/edit/${c.id}`)}
                                    >
                                        <TableCell className="pl-6">
                                            <div className="flex items-center gap-3">
                                                <CustomerAvatar firstName={c.first_name} lastName={c.last_name} />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="text-foreground truncate font-semibold leading-tight">{name}</p>
                                                        {dtb !== null && dtb <= 7 && (
                                                            <span className="text-warning-foreground bg-warning/15 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                                                                <Cake className="size-3" />{dtb === 0 ? 'today' : `${dtb}d`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-muted-foreground font-mono text-[10px]">{c.customer_code}</p>
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                                                <span className="flex items-center gap-1.5">
                                                    <Mail className="size-3 shrink-0" /> {c.email}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Phone className="size-3 shrink-0" /> {c.phone}
                                                </span>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                                <MapPin className="size-3 shrink-0" />
                                                {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                                            </span>
                                        </TableCell>

                                        <TableCell>
                                            <Badge variant="outline" className={cn('rounded-full text-[10px] font-bold uppercase', tierStyle(c.loyalty_tier))}>
                                                {c.loyalty_tier || 'Standard'}
                                            </Badge>
                                            <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px] font-bold uppercase">
                                                <Star className="fill-warning text-warning size-3" />
                                                {c.loyalty_points.toLocaleString()} pts
                                            </p>
                                        </TableCell>

                                        <TableCell className="text-muted-foreground text-xs">
                                            {fmtDate(c.created_at) ?? '—'}
                                        </TableCell>

                                        <TableCell>
                                            <StatusPill status={c.is_active ? 'active' : 'inactive'} />
                                        </TableCell>

                                        <TableCell className="pr-6 text-right" onClick={e => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${name}`}>
                                                        <MoreHorizontal className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">{name}</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => router.push(`/customers/edit/${c.id}`)}>
                                                        <Pencil className="size-4" /> Edit customer
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => copy('Email', c.email)}>
                                                        <Copy className="size-4" /> Copy email
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => copy('Phone', c.phone)}>
                                                        <Copy className="size-4" /> Copy phone
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onClick={() => setDeleteTarget({ id: c.id, name })}
                                                    >
                                                        <Trash2 className="size-4" /> Delete customer
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {!loading && filtered.length > 0 && (
                    <div className="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3">
                        <span className="text-muted-foreground text-xs">
                            {searchTerm || activeFilters > 0
                                ? `${filtered.length} match${filtered.length !== 1 ? 'es' : ''} on this page · ${total} total`
                                : `Showing ${customers.length} of ${total} customer${total !== 1 ? 's' : ''}`}
                        </span>
                        {totalPages > 1 && (
                            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} isLoading={loading} total={total} />
                        )}
                    </div>
                )}
            </Card>

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <div className="bg-destructive/10 mx-auto mb-2 flex size-12 items-center justify-center rounded-full">
                            <AlertTriangle className="text-destructive size-6" />
                        </div>
                        <AlertDialogTitle>Delete customer?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to delete <strong>{deleteTarget?.name}</strong>. This action cannot be undone.
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
