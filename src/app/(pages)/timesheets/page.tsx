"use client"

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/(zustand-store)/authStore';
import {
    clockIn, clockOut, createManualTimesheet, getTimesheets, updateTimesheet, deleteTimesheet, approveTimesheet,
} from '@/(api-handlers)/timesheetHandler';
import { getOrganizationUsers } from '@/(api-handlers)/userHandler';
import { Timesheet, TimesheetStatus } from '@/interfaces/timesheet';
import { UserResponse } from '@/interfaces/loginInterface';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import PageHeader from '@/components/(shared-components)/PageHeader';
import Pagination from '@/components/(shared-components)/Pagination';
import EmptyState from '@/components/(shared-components)/EmptyState';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Clock, ListChecks, LogIn, LogOut, Plus, Pencil, Trash2, Check, X, CheckCircle2, XCircle,
} from 'lucide-react';
import { DatePicker } from 'antd';
import { type Dayjs } from 'dayjs';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

const STATUS_CONFIG: Record<TimesheetStatus, { label: string; cls: string; icon: React.ElementType }> = {
    pending: { label: 'Pending', cls: 'border-warning/30 bg-warning/10 text-warning-foreground', icon: Clock },
    approved: { label: 'Approved', cls: 'border-success/30 bg-success/10 text-success', icon: CheckCircle2 },
    rejected: { label: 'Rejected', cls: 'border-destructive/30 bg-destructive/10 text-destructive', icon: XCircle },
};

function TimesheetStatusBadge({ status }: { status: TimesheetStatus }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    return (
        <Badge variant="outline" className={cn('rounded-full text-xs', cfg.cls)}>
            <Icon className="mr-1 size-3" /> {cfg.label}
        </Badge>
    );
}

function formatDateTime(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function TimesheetsPage() {
    const { user } = useAuthStore();
    const role = user?.role;
    const isPrivileged = role === 'admin' || role === 'manager' || role === 'superadmin';
    const employeeProfileId = user?.employee_profile?.id;

    if (!user) {
        return (
            <div className="flex items-center justify-center py-24">
                <Skeleton className="size-6 rounded-full" />
            </div>
        );
    }

    const defaultTab = employeeProfileId ? 'my' : isPrivileged ? 'approvals' : 'my';

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Timesheets" description="Clock in and out, and manage attendance approvals." />

            <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList>
                    <TabsTrigger value="my"><Clock className="mr-1.5 size-4" /> My Timesheets</TabsTrigger>
                    {isPrivileged && (
                        <TabsTrigger value="approvals"><ListChecks className="mr-1.5 size-4" /> Approvals</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="my">
                    {employeeProfileId ? (
                        <MyTimesheetsTab employeeProfileId={employeeProfileId} />
                    ) : (
                        <div className="mt-6">
                            <EmptyState
                                title="No employee profile yet"
                                description="You need an employee profile to clock in and out."
                                icon={Clock}
                            />
                        </div>
                    )}
                </TabsContent>
                {isPrivileged && (
                    <TabsContent value="approvals">
                        <ApprovalsTab ownEmployeeProfileId={employeeProfileId} />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}

// ─── My Timesheets ───────────────────────────────────────────────────────────
function MyTimesheetsTab({ employeeProfileId }: { employeeProfileId: number }) {
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [acting, setActing] = useState(false);

    const [editTarget, setEditTarget] = useState<Timesheet | null>(null);
    const [editNotes, setEditNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Timesheet | null>(null);

    const fetchTimesheets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getTimesheets({
                employee_profile_id: employeeProfileId,
                skip: (currentPage - 1) * ITEMS_PER_PAGE,
                limit: ITEMS_PER_PAGE,
            });
            setTimesheets(res.items);
            setTotal(res.total);
        } catch (err) {
            handleErrorMessage(err, 'Failed to load timesheets');
        } finally {
            setLoading(false);
        }
    }, [employeeProfileId, currentPage]);

    useEffect(() => { fetchTimesheets(); }, [fetchTimesheets]);

    const openEntry = currentPage === 1 ? timesheets.find(t => t.clock_out == null) : undefined;

    const handleClockIn = async () => {
        setActing(true);
        try {
            await clockIn();
            toast.success('Clocked in');
            fetchTimesheets();
        } catch (err) {
            handleErrorMessage(err, 'Failed to clock in');
        } finally {
            setActing(false);
        }
    };

    const handleClockOut = async () => {
        if (!openEntry) return;
        setActing(true);
        try {
            await clockOut(openEntry.id);
            toast.success('Clocked out');
            fetchTimesheets();
        } catch (err) {
            handleErrorMessage(err, 'Failed to clock out');
        } finally {
            setActing(false);
        }
    };

    const openEdit = (t: Timesheet) => { setEditTarget(t); setEditNotes(t.notes ?? ''); };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;
        setSaving(true);
        try {
            await updateTimesheet(editTarget.id, { notes: editNotes });
            toast.success('Timesheet updated');
            setEditTarget(null);
            fetchTimesheets();
        } catch (err) {
            handleErrorMessage(err, 'Failed to update timesheet');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteTimesheet(deleteTarget.id);
            toast.success('Timesheet deleted');
            fetchTimesheets();
        } catch (err) {
            handleErrorMessage(err, 'Failed to delete timesheet');
        } finally {
            setDeleteTarget(null);
        }
    };

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    return (
        <div className="mt-6 flex flex-col gap-4">
            <Card className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
                <div>
                    <p className="text-foreground text-sm font-semibold">
                        {openEntry ? 'You are currently clocked in' : 'You are currently clocked out'}
                    </p>
                    {openEntry && (
                        <p className="text-muted-foreground text-xs">Since {formatDateTime(openEntry.clock_in)}</p>
                    )}
                </div>
                {openEntry ? (
                    <Button onClick={handleClockOut} disabled={acting} variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                        <LogOut className="mr-2 size-4" /> Clock Out
                    </Button>
                ) : (
                    <Button onClick={handleClockIn} disabled={acting}>
                        <LogIn className="mr-2 size-4" /> Clock In
                    </Button>
                )}
            </Card>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Clock In</TableHead>
                                <TableHead>Clock Out</TableHead>
                                <TableHead>Hours</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="pr-6 w-[90px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 5 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : timesheets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-20 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <Clock className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-foreground font-semibold">No timesheets yet</p>
                                        <p className="text-muted-foreground mt-1 text-sm">Clock in above to start tracking your hours.</p>
                                    </TableCell>
                                </TableRow>
                            ) : timesheets.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell className="pl-6 text-sm">{formatDateTime(t.clock_in)}</TableCell>
                                    <TableCell className="text-sm">{formatDateTime(t.clock_out)}</TableCell>
                                    <TableCell className="text-sm">{t.actual_hours}</TableCell>
                                    <TableCell><TimesheetStatusBadge status={t.status} /></TableCell>
                                    <TableCell className="pr-6 text-right">
                                        {t.status === 'pending' && (
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(t)} aria-label="Edit timesheet">
                                                    <Pencil className="size-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8"
                                                    onClick={() => setDeleteTarget(t)}
                                                    aria-label="Delete timesheet"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {!loading && total > ITEMS_PER_PAGE && (
                    <div className="border-border border-t px-6 py-3">
                        <Pagination page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} total={total} isLoading={loading} />
                    </div>
                )}
            </Card>

            <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Edit Timesheet Notes</DialogTitle></DialogHeader>
                    <form onSubmit={handleSaveEdit} className="space-y-5 pt-2">
                        <div className="space-y-1.5">
                            <Label>Notes</Label>
                            <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="min-h-[80px] resize-none" />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setEditTarget(null)}>Cancel</Button>
                            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Timesheet</AlertDialogTitle>
                        <AlertDialogDescription>Delete this timesheet entry? This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ─── Approvals ────────────────────────────────────────────────────────────────
function ApprovalsTab({ ownEmployeeProfileId }: { ownEmployeeProfileId?: number }) {
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [employeeFilter, setEmployeeFilter] = useState('all');

    const [approveTarget, setApproveTarget] = useState<Timesheet | null>(null);
    const [approving, setApproving] = useState(false);
    const [rejectTarget, setRejectTarget] = useState<Timesheet | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejecting, setRejecting] = useState(false);

    const [manualDialogOpen, setManualDialogOpen] = useState(false);
    const [manualForm, setManualForm] = useState<{ employeeProfileId: string; clockIn: Dayjs | null; clockOut: Dayjs | null; notes: string }>({
        employeeProfileId: '', clockIn: null, clockOut: null, notes: '',
    });
    const [submittingManual, setSubmittingManual] = useState(false);

    const userByProfileId = useMemo(() => {
        const map = new Map<number, UserResponse>();
        users.forEach(u => { if (u.employee_profile) map.set(u.employee_profile.id, u); });
        return map;
    }, [users]);

    useEffect(() => {
        getOrganizationUsers().then(setUsers).catch(err => handleErrorMessage(err, 'Failed to load employees'));
    }, []);

    const fetchTimesheets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getTimesheets({
                status: statusFilter === 'all' ? undefined : (statusFilter as TimesheetStatus),
                employee_profile_id: employeeFilter === 'all' ? undefined : Number(employeeFilter),
                skip: (currentPage - 1) * ITEMS_PER_PAGE,
                limit: ITEMS_PER_PAGE,
            });
            setTimesheets(res.items);
            setTotal(res.total);
        } catch (err) {
            handleErrorMessage(err, 'Failed to load timesheets');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, employeeFilter, currentPage]);

    useEffect(() => { fetchTimesheets(); }, [fetchTimesheets]);
    useEffect(() => { setCurrentPage(1); }, [statusFilter, employeeFilter]);

    const handleApprove = async () => {
        if (!approveTarget) return;
        setApproving(true);
        try {
            await approveTimesheet(approveTarget.id, { approved: true });
            toast.success('Timesheet approved');
            fetchTimesheets();
        } catch (err) {
            handleErrorMessage(err, 'Failed to approve timesheet');
        } finally {
            setApproving(false);
            setApproveTarget(null);
        }
    };

    const openReject = (t: Timesheet) => { setRejectTarget(t); setRejectReason(''); };

    const handleReject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rejectTarget) return;
        setRejecting(true);
        try {
            await approveTimesheet(rejectTarget.id, { approved: false, rejection_reason: rejectReason || undefined });
            toast.success('Timesheet rejected');
            setRejectTarget(null);
            fetchTimesheets();
        } catch (err) {
            handleErrorMessage(err, 'Failed to reject timesheet');
        } finally {
            setRejecting(false);
        }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { employeeProfileId, clockIn, clockOut, notes } = manualForm;
        if (!employeeProfileId || !clockIn) { toast.error('Pick an employee and clock-in time'); return; }
        setSubmittingManual(true);
        try {
            await createManualTimesheet({
                employee_profile_id: Number(employeeProfileId),
                work_date: clockIn.format('YYYY-MM-DD'),
                clock_in: clockIn.toISOString(),
                clock_out: clockOut ? clockOut.toISOString() : undefined,
                notes: notes || undefined,
            });
            toast.success('Timesheet entry added');
            setManualDialogOpen(false);
            setManualForm({ employeeProfileId: '', clockIn: null, clockOut: null, notes: '' });
            fetchTimesheets();
        } catch (err) {
            handleErrorMessage(err, 'Failed to add timesheet entry');
        } finally {
            setSubmittingManual(false);
        }
    };

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    return (
        <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Employees" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Employees</SelectItem>
                            {users.filter(u => !!u.employee_profile).map(u => (
                                <SelectItem key={u.employee_profile!.id} value={String(u.employee_profile!.id)}>
                                    {u.first_name} {u.last_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={() => setManualDialogOpen(true)}>
                    <Plus className="mr-2 size-4" /> Add Entry
                </Button>
            </div>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Employee</TableHead>
                                <TableHead>Clock In</TableHead>
                                <TableHead>Clock Out</TableHead>
                                <TableHead>Hours</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="pr-6 w-[140px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : timesheets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-20 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <ListChecks className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-foreground font-semibold">No timesheets found</p>
                                        <p className="text-muted-foreground mt-1 text-sm">Try adjusting the filters above.</p>
                                    </TableCell>
                                </TableRow>
                            ) : timesheets.map(t => {
                                const emp = userByProfileId.get(t.employee_profile_id);
                                const isOwn = ownEmployeeProfileId != null && t.employee_profile_id === ownEmployeeProfileId;
                                const canDecide = t.status === 'pending' && t.clock_out != null && !isOwn;
                                return (
                                    <TableRow key={t.id}>
                                        <TableCell className="pl-6 text-sm">
                                            {emp ? `${emp.first_name} ${emp.last_name}` : `#${t.employee_profile_id}`}
                                            {isOwn && <span className="text-muted-foreground"> (You)</span>}
                                        </TableCell>
                                        <TableCell className="text-sm">{formatDateTime(t.clock_in)}</TableCell>
                                        <TableCell className="text-sm">{formatDateTime(t.clock_out)}</TableCell>
                                        <TableCell className="text-sm">{t.actual_hours}</TableCell>
                                        <TableCell><TimesheetStatusBadge status={t.status} /></TableCell>
                                        <TableCell className="pr-6 text-right">
                                            {t.status !== 'pending' ? null : t.clock_out == null ? (
                                                <span className="text-muted-foreground text-xs">Not clocked out</span>
                                            ) : isOwn ? (
                                                <span className="text-muted-foreground text-xs">Needs another approver</span>
                                            ) : canDecide ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="text-success hover:text-success hover:bg-success/10 size-8"
                                                        onClick={() => setApproveTarget(t)}
                                                        aria-label="Approve timesheet"
                                                    >
                                                        <Check className="size-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8"
                                                        onClick={() => openReject(t)}
                                                        aria-label="Reject timesheet"
                                                    >
                                                        <X className="size-4" />
                                                    </Button>
                                                </div>
                                            ) : null}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {!loading && total > ITEMS_PER_PAGE && (
                    <div className="border-border border-t px-6 py-3">
                        <Pagination page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} total={total} isLoading={loading} />
                    </div>
                )}
            </Card>

            <AlertDialog open={!!approveTarget} onOpenChange={open => !open && setApproveTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve Timesheet</AlertDialogTitle>
                        <AlertDialogDescription>
                            Approve this timesheet ({approveTarget?.actual_hours} hours)?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleApprove} disabled={approving}>
                            {approving ? 'Approving…' : 'Approve'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={!!rejectTarget} onOpenChange={open => !open && setRejectTarget(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Reject Timesheet</DialogTitle></DialogHeader>
                    <form onSubmit={handleReject} className="space-y-5 pt-2">
                        <div className="space-y-1.5">
                            <Label>Rejection Reason</Label>
                            <Textarea
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                placeholder="Explain why this timesheet is being rejected"
                                className="min-h-[80px] resize-none"
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setRejectTarget(null)}>Cancel</Button>
                            <Button type="submit" variant="destructive" disabled={rejecting}>
                                {rejecting ? 'Rejecting…' : 'Reject Timesheet'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={manualDialogOpen} onOpenChange={open => !open && setManualDialogOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Add Timesheet Entry</DialogTitle></DialogHeader>
                    <form onSubmit={handleManualSubmit} className="space-y-5 pt-2">
                        <div className="space-y-1.5">
                            <Label>Employee</Label>
                            <Select value={manualForm.employeeProfileId} onValueChange={v => setManualForm(f => ({ ...f, employeeProfileId: v }))}>
                                <SelectTrigger className="w-full"><SelectValue placeholder="Select an employee" /></SelectTrigger>
                                <SelectContent>
                                    {users.filter(u => !!u.employee_profile).map(u => (
                                        <SelectItem key={u.employee_profile!.id} value={String(u.employee_profile!.id)}>
                                            {u.first_name} {u.last_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Clock In</Label>
                            <DatePicker
                                showTime className="h-9 w-full"
                                value={manualForm.clockIn}
                                onChange={date => setManualForm(f => ({ ...f, clockIn: date }))}
                                format="DD MMM YYYY HH:mm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Clock Out (optional)</Label>
                            <DatePicker
                                showTime className="h-9 w-full"
                                value={manualForm.clockOut}
                                onChange={date => setManualForm(f => ({ ...f, clockOut: date }))}
                                format="DD MMM YYYY HH:mm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Notes (optional)</Label>
                            <Textarea value={manualForm.notes} onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} className="min-h-[60px] resize-none" />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setManualDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={submittingManual}>{submittingManual ? 'Adding…' : 'Add Entry'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
