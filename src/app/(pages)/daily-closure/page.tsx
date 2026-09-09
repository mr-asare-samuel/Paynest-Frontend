/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from 'react';
import {
    Banknote, RefreshCcw, AlertCircle, CheckCircle,
    Calendar, Clock, Building2, Wallet, Save,
} from 'lucide-react';
import { useAuthStore } from '@/(zustand-store)/authStore';
import {
    CreateDailyClosure, GetCurrentClosure, SubmitDailyClosure, VerifyDailyClosure,
} from '@/(api-handlers)/dailyClosureHandler';
import { getOrganizationShops } from '@/(api-handlers)/organizationShopsHandler';
import { DailyClosureResponse } from '@/interfaces/dailyClosure';
import { OrganizationShopResponse } from '@/interfaces/organizationShops';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import PageHeader from '@/components/(shared-components)/PageHeader';
import { format } from 'date-fns';
import { safeFormat } from '@/lib/safeFormat';
import AttendantView from './views/AttendantView';
import AdminView from './views/AdminView';
import { cn } from '@/lib/utils';
import { useOrgCurrency } from '@/hooks/useCurrency';

const statusConfig: Record<string, { badgeClass: string; Icon: any; label: string }> = {
    opened:      { badgeClass: 'border-primary/20 bg-primary/10 text-primary',                    Icon: Clock,         label: 'Opened' },
    open:        { badgeClass: 'border-primary/20 bg-primary/10 text-primary',                    Icon: Clock,         label: 'Opened' },
    submitted:   { badgeClass: 'border-warning/30 bg-warning/10 text-warning-foreground',         Icon: AlertCircle,   label: 'Pending Verification' },
    verified:    { badgeClass: 'border-success/30 bg-success/10 text-success',                    Icon: CheckCircle,   label: 'Verified' },
    rejected:    { badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive',        Icon: AlertCircle,   label: 'Rejected' },
    discrepancy: { badgeClass: 'border-warning/30 bg-warning/10 text-warning-foreground',         Icon: AlertCircle,   label: 'Pending Review (Discrepancy)' },
};

export default function DailyClosurePage() {
    const { user } = useAuthStore();
    const orgCurrency = useOrgCurrency();
    const [closure, setClosure]               = useState<DailyClosureResponse | null>(null);
    const [shops, setShops]                   = useState<OrganizationShopResponse[]>([]);
    const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
    const [isLoading, setIsLoading]           = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isModalOpen, setIsModalOpen]       = useState(false);

    const [openingBalance, setOpeningBalance] = useState('');
    const [openingNotes, setOpeningNotes]     = useState('');
    const [actualCash, setActualCash]         = useState('');
    const [notes, setNotes]                   = useState('');
    const [discrepancyReason, setDiscrepancyReason] = useState('');

    const role = (user?.role || 'attendant').toLowerCase();
    const isAdmin        = role === 'admin' || role === 'superadmin';
    const isInternalUser = role === 'attendant' || role === 'manager';
    const activeShopId   = selectedShopId || user?.employee_profile?.shop_id;

    const fetchShops = useCallback(async () => {
        if (!isAdmin) return;
        try {
            const data = await getOrganizationShops();
            setShops(data);
            if (user?.employee_profile?.shop_id) {
                setSelectedShopId(user.employee_profile.shop_id);
            } else if (data.length > 0) {
                setSelectedShopId(data[0].id);
            }
        } catch {
            toast.error('Failed to load shops');
        } finally {
            setIsLoading(false);
        }
    }, [isAdmin, user?.employee_profile?.shop_id]);

    useEffect(() => {
        if (isAdmin) {
            fetchShops();
        } else if (user?.employee_profile?.shop_id) {
            setSelectedShopId(user.employee_profile.shop_id);
            setIsLoading(false);
        } else {
            setIsLoading(false);
        }
    }, [isAdmin, fetchShops, user?.employee_profile?.shop_id]);

    const fetchCurrentClosure = useCallback(async () => {
        if (!activeShopId) { setClosure(null); return; }
        setIsLoading(true);
        try {
            const data = await GetCurrentClosure(activeShopId);
            setClosure(data);
            if (data) {
                setActualCash(data.actual_cash?.toString() || '');
                setNotes(data.notes || '');
                setDiscrepancyReason(data.discrepancy_reason || '');
            } else {
                setClosure(null);
                setActualCash('');
                setNotes('');
                setDiscrepancyReason('');
            }
        } catch {
            setClosure(null);
        } finally {
            setIsLoading(false);
        }
    }, [activeShopId]);

    useEffect(() => {
        if (activeShopId) fetchCurrentClosure();
    }, [activeShopId, fetchCurrentClosure]);

    const handleOpenClosure = async () => {
        if (!activeShopId) { toast.error('No shop selected'); return; }
        if (!openingBalance || parseFloat(openingBalance) < 0) {
            toast.error('Please enter a valid opening balance');
            return;
        }
        setIsActionLoading(true);
        try {
            await CreateDailyClosure({
                shop_id:         activeShopId,
                opening_balance: parseFloat(openingBalance) || 0,
                notes:           openingNotes,
                closure_date:    new Date().toISOString().split('T')[0],
            });
            toast.success('Daily closure opened');
            setOpeningBalance('');
            setOpeningNotes('');
            setIsModalOpen(false);
            await fetchCurrentClosure();
        } catch {
            toast.error('Failed to open daily closure');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleSubmitClosure = async () => {
        if (!closure) return;
        if (!actualCash) { toast.error('Please enter actual cash amount'); return; }
        setIsActionLoading(true);
        try {
            await SubmitDailyClosure(closure.id, { actual_cash: parseFloat(actualCash), notes });
            toast.success('Daily closure submitted for verification');
            await fetchCurrentClosure();
        } catch {
            toast.error('Failed to submit daily closure');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleVerifyClosure = async (status: 'verified' | 'rejected', closureId?: number) => {
        const id = closureId ?? closure?.id;
        if (!id) return;
        setIsActionLoading(true);
        try {
            await VerifyDailyClosure(id, { status, discrepancy_reason: discrepancyReason });
            toast.success(`Daily closure ${status}`);
            await fetchCurrentClosure();
        } catch {
            toast.error(`Failed to ${status} daily closure`);
        } finally {
            setIsActionLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
                <RefreshCcw className="text-primary size-10 animate-spin" />
                <p className="text-muted-foreground font-medium">Loading daily closure data…</p>
            </div>
        );
    }

    const activeCfg = closure ? (statusConfig[closure.status.toLowerCase()] ?? statusConfig.opened) : null;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Daily Closure"
                description="Manage and track your shop's daily financial reconciliation."
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        {isAdmin && (
                            <Select value={selectedShopId?.toString()} onValueChange={v => setSelectedShopId(Number(v))}>
                                <SelectTrigger className="h-9 w-[220px]">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="text-muted-foreground size-3.5" />
                                        <SelectValue placeholder="Select shop" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {shops.map(s => (
                                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <Button variant="outline" size="icon" className="size-9" onClick={fetchCurrentClosure} disabled={isLoading || !activeShopId}>
                            <RefreshCcw className={cn('size-4', isLoading && 'animate-spin')} />
                        </Button>
                    </div>
                }
            />

            {/* Active closure banner */}
            {closure && activeCfg && (
                <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-xl">
                            <Wallet className="text-primary size-5" />
                        </div>
                        <div>
                            <p className="text-foreground font-semibold leading-tight">{closure.closure_number}</p>
                            <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                                <span className="flex items-center gap-1">
                                    <Calendar className="size-3" />
                                    {safeFormat(closure.closure_date, 'MMM d, yyyy')}
                                </span>
                                {shops.find(s => s.id === activeShopId)?.name && (
                                    <span className="flex items-center gap-1">
                                        <Building2 className="size-3" />
                                        {shops.find(s => s.id === activeShopId)?.name}
                                    </span>
                                )}
                                {closure.opened_at && (
                                    <span className="flex items-center gap-1">
                                        <Clock className="size-3" />
                                        Opened {safeFormat(closure.opened_at, 'p')}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">Expected cash</p>
                            <p className="text-foreground num-tabular text-sm font-bold">{orgCurrency} {(closure.expected_cash ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <Badge
                            variant="outline"
                            className={cn('flex items-center gap-1.5 rounded-full px-3 py-1', activeCfg.badgeClass)}
                        >
                            <activeCfg.Icon className="size-3" />
                            {activeCfg.label}
                        </Badge>
                    </div>
                </Card>
            )}

            {/* Role views */}
            {isInternalUser ? (
                <AttendantView
                    closure={closure}
                    isActionLoading={isActionLoading}
                    handleSubmitClosure={handleSubmitClosure}
                    actualCash={actualCash}
                    setActualCash={setActualCash}
                    notes={notes}
                    setNotes={setNotes}
                    onOpenModal={() => setIsModalOpen(true)}
                />
            ) : isAdmin ? (
                <AdminView
                    closure={closure}
                    isActionLoading={isActionLoading}
                    handleVerifyClosure={handleVerifyClosure}
                    discrepancyReason={discrepancyReason}
                    setDiscrepancyReason={setDiscrepancyReason}
                    activeShopId={activeShopId || undefined}
                />
            ) : (
                <Card className="p-12 text-center">
                    <div className="bg-muted mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
                        <AlertCircle className="text-muted-foreground size-8" />
                    </div>
                    <p className="text-muted-foreground">You do not have permission to view this page.</p>
                </Card>
            )}

            {/* Open closure dialog */}
            <Dialog open={isModalOpen} onOpenChange={open => !open && setIsModalOpen(false)}>
                <DialogContent className="flex max-h-[90vh] max-w-md flex-col gap-0 overflow-hidden p-0">
                    {/* Header */}
                    <DialogHeader className="border-border flex-row items-center gap-3 border-b px-6 py-4 pr-14">
                        <div className="bg-success/10 flex size-10 shrink-0 items-center justify-center rounded-xl">
                            <Banknote className="text-success size-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base leading-tight">Open Daily Closure</DialogTitle>
                            <p className="text-muted-foreground text-xs">Set your opening float and notes for today.</p>
                        </div>
                    </DialogHeader>

                    {/* Body */}
                    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                        {/* Shop info */}
                        {shops.length > 0 && (
                            <div className="bg-muted/40 border-border flex items-center gap-3 rounded-lg border p-3">
                                <Building2 className="text-muted-foreground size-4 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-muted-foreground text-xs">Selected shop</p>
                                    <p className="text-foreground truncate text-sm font-medium">
                                        {shops.find(s => s.id === activeShopId)?.name ?? 'Unknown'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Opening balance */}
                        <div className="space-y-1.5">
                            <Label>Opening cash balance</Label>
                            <div className="relative">
                                <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium">
                                    {orgCurrency}
                                </span>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    className="pl-12"
                                    value={openingBalance}
                                    onChange={e => setOpeningBalance(e.target.value)}
                                />
                            </div>
                            <p className="text-muted-foreground text-xs">Initial cash amount in the register</p>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1.5">
                            <Label>Opening notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Textarea
                                placeholder="Shift start notes, float details…"
                                className="resize-none"
                                rows={3}
                                value={openingNotes}
                                onChange={e => setOpeningNotes(e.target.value)}
                            />
                        </div>

                        {/* Date / time */}
                        <div className="bg-muted/40 border-border flex items-center gap-3 rounded-lg border px-4 py-2.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <Calendar className="size-3.5" /> {format(new Date(), 'MMMM d, yyyy')}
                            </span>
                            <span className="bg-border h-3 w-px" />
                            <span className="flex items-center gap-1.5">
                                <Clock className="size-3.5" /> {format(new Date(), 'h:mm a')}
                            </span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-border flex shrink-0 justify-end gap-2 border-t px-6 py-4">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleOpenClosure} disabled={isActionLoading || !openingBalance}>
                            {isActionLoading
                                ? <><RefreshCcw className="size-4 animate-spin" /> Opening…</>
                                : <><Save className="size-4" /> Open Closure</>}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
