"use client"

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/(zustand-store)/authStore';
import {
    getPayrollRunById, getRunPayslips,
    submitPayrollRun, approvePayrollRun, processPayrollRun, updatePayslipBonus,
} from '@/(api-handlers)/payrollHandler';
import { getOrganizationUsers } from '@/(api-handlers)/userHandler';
import { PayrollRun, PayrollRunStatus, Payslip } from '@/interfaces/payroll';
import { UserResponse } from '@/interfaces/loginInterface';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import StatsGrid from '@/components/(shared-components)/StatsGrid';
import EmptyState from '@/components/(shared-components)/EmptyState';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    ChevronLeft, Eye, Send, CheckCircle2, XCircle, PlayCircle,
    Clock, FileSearch, ReceiptText, Users, Gift,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<PayrollRunStatus, { label: string; cls: string; icon: React.ElementType }> = {
    draft:     { label: 'Draft',     cls: 'border-border bg-muted text-muted-foreground', icon: Clock },
    review:    { label: 'In Review', cls: 'border-warning/30 bg-warning/10 text-warning-foreground', icon: FileSearch },
    approved:  { label: 'Approved',  cls: 'border-info/30 bg-info/10 text-info', icon: CheckCircle2 },
    processed: { label: 'Processed', cls: 'border-success/30 bg-success/10 text-success', icon: PlayCircle },
    rejected:  { label: 'Rejected',  cls: 'border-destructive/30 bg-destructive/10 text-destructive', icon: XCircle },
};

function getInitials(first?: string, last?: string) {
    return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

export default function PayrollRunDetailPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const params = useParams();
    const runId = Number(params.id);
    const fmt = useCurrency();

    const [run, setRun] = useState<PayrollRun | null>(null);
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [employees, setEmployees] = useState<Record<number, UserResponse>>({});
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(false);

    const [submitOpen, setSubmitOpen] = useState(false);
    const [submitNotes, setSubmitNotes] = useState('');
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [approveOpen, setApproveOpen] = useState(false);
    const [processOpen, setProcessOpen] = useState(false);
    const [bonusTarget, setBonusTarget] = useState<Payslip | null>(null);
    const [bonusAmount, setBonusAmount] = useState('');
    const [bonusReason, setBonusReason] = useState('');

    useEffect(() => {
        if (user && user.role !== 'admin') router.replace('/dashboard');
    }, [user, router]);

    const fetchAll = useCallback(async () => {
        if (!runId) return;
        setLoading(true);
        try {
            const [runData, payslipData] = await Promise.all([
                getPayrollRunById(runId),
                getRunPayslips(runId),
            ]);
            setRun(runData);
            setPayslips(payslipData);

            const users = await getOrganizationUsers();
            setEmployees(Object.fromEntries(users.map(u => [u.id, u])));
        } catch (err) {
            handleErrorMessage(err, 'Failed to load payroll run');
        } finally {
            setLoading(false);
        }
    }, [runId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleSubmit = async () => {
        if (!run) return;
        setActing(true);
        try {
            await submitPayrollRun(run.id, submitNotes || undefined);
            toast.success('Run submitted for review');
            setSubmitOpen(false);
            setSubmitNotes('');
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, 'Failed to submit run');
        } finally {
            setActing(false);
        }
    };

    const handleApprove = async () => {
        if (!run) return;
        setActing(true);
        try {
            await approvePayrollRun(run.id, { approved: true });
            toast.success('Run approved');
            setApproveOpen(false);
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, 'Failed to approve run');
        } finally {
            setActing(false);
        }
    };

    const handleReject = async () => {
        if (!run || !rejectReason.trim()) { toast.error('A rejection reason is required'); return; }
        setActing(true);
        try {
            await approvePayrollRun(run.id, { approved: false, rejection_reason: rejectReason });
            toast.success('Run rejected');
            setRejectOpen(false);
            setRejectReason('');
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, 'Failed to reject run');
        } finally {
            setActing(false);
        }
    };

    const openBonusDialog = (slip: Payslip) => {
        setBonusTarget(slip);
        setBonusAmount(slip.bonus_amount ? String(slip.bonus_amount) : '');
        setBonusReason('');
    };

    const handleBonusSave = async () => {
        if (!run || !bonusTarget) return;
        const amount = Number(bonusAmount);
        if (Number.isNaN(amount) || amount < 0) { toast.error('Enter a valid bonus amount'); return; }
        setActing(true);
        try {
            await updatePayslipBonus(run.id, bonusTarget.id, { bonus_amount: amount, reason: bonusReason || undefined });
            toast.success('Bonus updated');
            setBonusTarget(null);
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, 'Failed to update bonus');
        } finally {
            setActing(false);
        }
    };

    const handleProcess = async () => {
        if (!run) return;
        setActing(true);
        try {
            await processPayrollRun(run.id);
            toast.success('Payroll processed — payslips are being generated');
            setProcessOpen(false);
            fetchAll();
        } catch (err) {
            handleErrorMessage(err, 'Failed to process run');
        } finally {
            setActing(false);
        }
    };

    if (!user || user.role !== 'admin') {
        return (
            <div className="flex items-center justify-center py-24">
                <Skeleton className="size-6 rounded-full" />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col gap-6">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    if (!run) {
        return (
            <div className="flex flex-col gap-6">
                <EmptyState icon={ReceiptText} title="Run not found" description="This payroll run doesn't exist or you don't have access to it." />
            </div>
        );
    }

    const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.draft;
    const StatusIcon = cfg.icon;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/payroll')} className="size-9 shrink-0">
                        <ChevronLeft className="size-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-foreground text-xl font-bold">{run.run_number}</h1>
                            <Badge variant="outline" className={cn('rounded-full text-xs', cfg.cls)}>
                                <StatusIcon className="mr-1 size-3" /> {cfg.label}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            {new Date(run.period_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' – '}
                            {new Date(run.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' · Pay date '}
                            {new Date(run.pay_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {(run.status === 'draft' || run.status === 'rejected') && (
                        <Button onClick={() => setSubmitOpen(true)} disabled={acting}>
                            <Send className="mr-2 size-4" /> Submit for Review
                        </Button>
                    )}
                    {run.status === 'review' && (
                        <>
                            <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setRejectOpen(true)} disabled={acting}>
                                <XCircle className="mr-2 size-4" /> Reject
                            </Button>
                            <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => setApproveOpen(true)} disabled={acting}>
                                <CheckCircle2 className="mr-2 size-4" /> Approve
                            </Button>
                        </>
                    )}
                    {run.status === 'approved' && (
                        <Button onClick={() => setProcessOpen(true)} disabled={acting}>
                            <PlayCircle className="mr-2 size-4" /> Process Payroll
                        </Button>
                    )}
                </div>
            </div>

            {run.rejection_reason && (
                <Card className="border-destructive/30 bg-destructive/5 p-0">
                    <CardContent className="px-5 py-4">
                        <p className="text-destructive text-xs font-bold uppercase tracking-widest mb-1">Rejection Reason</p>
                        <p className="text-muted-foreground text-sm italic">&quot;{run.rejection_reason}&quot;</p>
                    </CardContent>
                </Card>
            )}

            <StatsGrid
                columns={5}
                stats={[
                    { name: 'Gross Pay', value: fmt(run.total_gross_pay) },
                    { name: 'Employee Tax', value: fmt(run.total_employee_tax) },
                    { name: 'Employer Cost', value: fmt(run.total_employer_cost) },
                    { name: 'Total Deductions', value: fmt(run.total_deductions) },
                    { name: 'Net Pay', value: fmt(run.total_net_pay) },
                ]}
            />

            <Card className="gap-0 p-0">
                <CardHeader className="border-b px-6 py-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Users className="size-4" /> Payslips ({payslips.length})
                    </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Employee</TableHead>
                                <TableHead>Gross Pay</TableHead>
                                <TableHead>Deductions</TableHead>
                                <TableHead>Net Pay</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="pr-6 w-[110px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payslips.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-16 text-center">
                                        <p className="text-foreground font-semibold">No payslips yet</p>
                                        <p className="text-muted-foreground mt-1 text-sm">Payslips appear once the run has been calculated.</p>
                                    </TableCell>
                                </TableRow>
                            ) : payslips.map(slip => {
                                const emp = employees[slip.user_id];
                                return (
                                    <TableRow key={slip.id}>
                                        <TableCell className="pl-6">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="size-8 shrink-0 rounded-lg">
                                                    <AvatarImage src={emp?.profile_pic ?? undefined} alt={emp ? `${emp.first_name} ${emp.last_name}` : ''} className="object-cover" />
                                                    <AvatarFallback className="rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                                                        {getInitials(emp?.first_name, emp?.last_name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm font-medium text-foreground">
                                                    {emp ? `${emp.first_name} ${emp.last_name}` : `User #${slip.user_id}`}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="num-tabular text-sm">{fmt(slip.gross_pay)}</TableCell>
                                        <TableCell className="num-tabular text-sm text-muted-foreground">{fmt(slip.total_deductions)}</TableCell>
                                        <TableCell className="num-tabular text-sm font-semibold">
                                            {fmt(slip.net_pay)}
                                            {slip.bonus_amount > 0 && (
                                                <Badge variant="outline" className="ml-2 rounded-full border-success/30 bg-success/10 text-[10px] text-success">
                                                    +{fmt(slip.bonus_amount)} bonus
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="rounded-full text-xs capitalize">{slip.status}</Badge>
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            {(run.status === 'draft' || run.status === 'rejected') && (
                                                <Button
                                                    variant="ghost" size="icon" className="size-8" aria-label="Add or edit bonus"
                                                    onClick={() => openBonusDialog(slip)}
                                                >
                                                    <Gift className="size-4" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="size-8" asChild aria-label="View payslip">
                                                <Link href={`/payroll/payslips/${slip.id}`}><Eye className="size-4" /></Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Submit dialog */}
            <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Submit for Review</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label>Notes (optional)</Label>
                            <Textarea value={submitNotes} onChange={e => setSubmitNotes(e.target.value)} className="min-h-[80px] resize-none" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={acting}>{acting ? 'Submitting…' : 'Submit'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject dialog */}
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Reject Run</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label>Rejection Reason <span className="text-destructive">*</span></Label>
                            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="min-h-[80px] resize-none" required />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={acting}>{acting ? 'Rejecting…' : 'Reject Run'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bonus dialog */}
            <Dialog open={!!bonusTarget} onOpenChange={open => { if (!open) setBonusTarget(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Add / Edit Bonus</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label>Bonus Amount</Label>
                            <Input type="number" min={0} step="0.01" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Reason (optional)</Label>
                            <Textarea value={bonusReason} onChange={e => setBonusReason(e.target.value)} className="min-h-[80px] resize-none" />
                        </div>
                        <p className="text-muted-foreground text-xs">
                            Any Bonus-targeted tax rules configured in Settings → Payroll will be applied automatically.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBonusTarget(null)}>Cancel</Button>
                        <Button onClick={handleBonusSave} disabled={acting}>{acting ? 'Saving…' : 'Save Bonus'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approve confirm */}
            <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve Payroll Run</AlertDialogTitle>
                        <AlertDialogDescription>
                            This moves the run to Approved and unlocks processing. Continue?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={acting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleApprove} disabled={acting}>
                            {acting ? 'Approving…' : 'Yes, Approve'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Process confirm */}
            <AlertDialog open={processOpen} onOpenChange={setProcessOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Process Payroll</AlertDialogTitle>
                        <AlertDialogDescription>
                            This generates payslip PDFs and emails every employee their payslip. This cannot be undone. Continue?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={acting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleProcess} disabled={acting}>
                            {acting ? 'Processing…' : 'Yes, Process'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
