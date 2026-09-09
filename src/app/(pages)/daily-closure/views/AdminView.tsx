import { useState, useEffect } from "react";
import {
    Banknote, Calculator, Calendar, FileText,
    RefreshCcw, ClipboardCheck, Receipt, CheckCircle2,
    AlertCircle, Eye, CheckCircle, XCircle, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DailyClosureResponse } from "@/interfaces/dailyClosure";
import { GetAllClosures } from "@/(api-handlers)/dailyClosureHandler";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { safeFormat } from "@/lib/safeFormat";
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import Pagination from "@/components/(shared-components)/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { useRouter } from "next/navigation";

interface AdminViewProps {
    closure: DailyClosureResponse | null;
    isActionLoading: boolean;
    handleVerifyClosure: (status: 'verified' | 'rejected', closureId?: number) => Promise<void>;
    discrepancyReason: string;
    setDiscrepancyReason: (val: string) => void;
    activeShopId?: number;
}

interface PendingAction {
    type: 'approve' | 'reject';
    closureId?: number;
    label: string;
}

function StatusBadge({ status }: { status: string }) {
    const configs: Record<string, { label: string; cls: string }> = {
        verified:  { label: 'Verified',   cls: 'border-success/30 bg-success/10 text-success' },
        submitted: { label: 'Submitted',  cls: 'border-warning/30 bg-warning/10 text-warning-foreground' },
        rejected:  { label: 'Rejected',   cls: 'border-destructive/30 bg-destructive/10 text-destructive' },
        opened:    { label: 'Opened',     cls: 'border-primary/20 bg-primary/10 text-primary' },
        open:      { label: 'Open',       cls: 'border-primary/20 bg-primary/10 text-primary' },
    };
    const { label, cls } = configs[status] ?? { label: status.toUpperCase(), cls: 'border-border bg-muted text-muted-foreground' };
    return <Badge variant="outline" className={cn("rounded-full text-xs uppercase", cls)}>{label}</Badge>;
}

export default function AdminView({
    closure,
    isActionLoading,
    handleVerifyClosure,
    discrepancyReason,
    setDiscrepancyReason,
    activeShopId,
}: Readonly<AdminViewProps>) {
    const fmt = useCurrency();
    const router = useRouter();
    const status = closure?.status?.toLowerCase() || "";
    const [history, setHistory] = useState<DailyClosureResponse[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const pg = usePagination(history, 10);

    useEffect(() => {
        if (activeShopId) fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeShopId]);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await GetAllClosures(
                activeShopId!,
                startDate || undefined,
                endDate || undefined,
            );
            setHistory(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const confirmAction = async () => {
        if (!pendingAction) return;
        await handleVerifyClosure(
            pendingAction.type === 'approve' ? 'verified' : 'rejected',
            pendingAction.closureId,
        );
        if (pendingAction.closureId) fetchHistory();
        setPendingAction(null);
    };

    /* ---- Current Closure Tab ---- */
    const renderCurrentClosure = () => {
        if (!closure) {
            return (
                <Card className="mt-6 border-dashed border-2">
                    <CardHeader className="text-center py-12">
                        <div className="bg-muted mx-auto mb-6 flex size-20 items-center justify-center rounded-3xl">
                            <AlertCircle className="text-muted-foreground size-10" />
                        </div>
                        <CardTitle className="text-2xl font-bold">No Active Closure</CardTitle>
                        <CardDescription className="mt-2 text-base max-w-sm mx-auto">
                            Waiting for an attendant to open the closure for today.
                        </CardDescription>
                    </CardHeader>
                </Card>
            );
        }

        return (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Stats strip */}
                    <Card className="overflow-hidden p-0">
                        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
                            {(
                                [
                                    { label: "Total Orders", value: String(closure.total_orders),    icon: Receipt,    iconCls: "bg-primary/10 text-primary" },
                                    { label: "Total Items",  value: String(closure.total_items),     icon: Calculator, iconCls: "bg-info/10 text-info" },
                                    { label: "Customers",   value: String(closure.total_customers), icon: Users,      iconCls: "bg-warning/10 text-warning-foreground" },
                                    { label: "Net Sales",   value: fmt(closure.net_sales),          icon: Banknote,   iconCls: "bg-success/10 text-success" },
                                ] as { label: string; value: string; icon: LucideIcon; iconCls: string }[]
                            ).map(({ label, value, icon: Icon, iconCls }) => (
                                <div key={label} className="flex items-center gap-3 px-5 py-4">
                                    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", iconCls)}>
                                        <Icon className="size-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-muted-foreground truncate text-xs font-medium">{label}</p>
                                        <p className="text-foreground truncate text-lg font-bold leading-tight num-tabular">{value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Financial Reconciliation */}
                    <Card className="overflow-hidden">
                        <div className="border-b px-6 py-4">
                            <h3 className="text-foreground flex items-center gap-2 font-semibold">
                                <ClipboardCheck className="text-primary size-5" />
                                Financial Reconciliation
                            </h3>
                        </div>
                        <CardContent className="p-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                                <div className="p-8 space-y-4">
                                    <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Expected Revenue</h3>
                                    {[
                                        ['Cash Revenue', closure.cash_total],
                                        ['Card Payments', closure.card_total],
                                        ['Mobile Money', closure.mobile_total],
                                        ['Store Credit', closure.credit_total],
                                    ].map(([label, val]) => (
                                        <div key={String(label)} className="flex justify-between items-center">
                                            <span className="text-muted-foreground text-sm">{label}</span>
                                            <span className="text-foreground font-semibold text-sm">{fmt(Number(val))}</span>
                                        </div>
                                    ))}
                                    <div className="border-border flex justify-between items-center border-t pt-4">
                                        <span className="text-foreground font-bold">Gross Sales</span>
                                        <span className="text-foreground text-lg font-extrabold">{fmt(closure.gross_sales)}</span>
                                    </div>
                                </div>

                                <div className="bg-muted/30 p-8 space-y-4">
                                    <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Cash Summary</h3>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground text-sm">Opening Balance</span>
                                        <span className="text-foreground font-semibold text-sm">{fmt(closure.opening_balance)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground text-sm">Expected Cash</span>
                                        <span className="text-primary text-lg font-bold">{fmt(closure.expected_cash)}</span>
                                    </div>
                                    {['submitted', 'verified', 'rejected', 'discrepancy'].includes(status) && (
                                        <>
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground text-sm">Actual Cash Submitted</span>
                                                <span className="text-foreground font-semibold text-sm">{fmt(closure.actual_cash)}</span>
                                            </div>
                                            <div className="border-border flex justify-between items-center border-t pt-4">
                                                <span className="text-foreground font-bold">Difference</span>
                                                <span className={cn(
                                                    "text-lg font-extrabold",
                                                    closure.cash_difference < 0 ? "text-destructive" : "text-success"
                                                )}>
                                                    {closure.cash_difference > 0 ? '+' : ''}{fmt(closure.cash_difference)}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right sidebar */}
                <div className="space-y-8">
                    {/* Action card */}
                    {(status === 'submitted' || status === 'discrepancy') && (
                        <Card className="overflow-hidden border-warning/30">
                            <div className="bg-warning h-1.5" />
                            <CardHeader>
                                <CardTitle>Verify Closure</CardTitle>
                                <CardDescription>Review the submitted data and approve or reject.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 space-y-3">
                                    <p className="text-warning-foreground text-xs font-bold uppercase tracking-widest">Attendant Submission</p>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-muted-foreground text-sm">Actual Cash:</span>
                                        <span className="text-foreground text-xl font-extrabold">{fmt(closure.actual_cash)}</span>
                                    </div>
                                    <div className="border-warning/20 border-t pt-2">
                                        <p className="text-muted-foreground text-xs italic">&quot;{closure.notes || 'No notes provided'}&quot;</p>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-semibold">Verification Comments</Label>
                                    <Textarea
                                        placeholder="Reason for discrepancy or approval notes..."
                                        className="min-h-[100px] resize-none"
                                        value={discrepancyReason}
                                        onChange={e => setDiscrepancyReason(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex flex-col gap-3">
                                <Button
                                    className="w-full bg-success text-success-foreground hover:bg-success/90 font-bold"
                                    disabled={isActionLoading}
                                    onClick={() => setPendingAction({ type: 'approve', label: 'Approve & Verify this closure?' })}
                                >
                                    <CheckCircle2 className="mr-2 size-5" /> Approve & Verify
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 font-bold"
                                    disabled={isActionLoading}
                                    onClick={() => setPendingAction({ type: 'reject', label: 'Reject this submission?' })}
                                >
                                    <AlertCircle className="mr-2 size-4" /> Reject Submission
                                </Button>
                            </CardFooter>
                        </Card>
                    )}

                    {(status === 'opened' || status === 'open') && (
                        <Card className="border-primary/20 bg-primary/5">
                            <CardContent className="pt-6 text-center space-y-4">
                                <div className="bg-primary/10 mx-auto flex size-12 items-center justify-center rounded-full">
                                    <RefreshCcw className="text-primary size-6" />
                                </div>
                                <div>
                                    <h4 className="text-primary font-bold">Actively Trading</h4>
                                    <p className="text-muted-foreground mt-1 text-sm">Awaiting end-of-day submission from the attendant.</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {status === 'verified' && (
                        <Card className="overflow-hidden border-success/30">
                            <div className="bg-success h-1.5" />
                            <CardContent className="pt-8 text-center space-y-4">
                                <div className="bg-success/10 mx-auto flex size-16 items-center justify-center rounded-3xl">
                                    <CheckCircle2 className="text-success size-8" />
                                </div>
                                <div>
                                    <h4 className="text-foreground text-xl font-extrabold">Verified & Closed</h4>
                                    <p className="text-muted-foreground text-sm">
                                        Reconciled on {safeFormat(closure.closed_at, 'PPP')}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {status === 'rejected' && (
                        <Card className="overflow-hidden border-destructive/30">
                            <div className="bg-destructive h-1.5" />
                            <CardContent className="pt-8 text-center space-y-4">
                                <div className="bg-destructive/10 mx-auto flex size-16 items-center justify-center rounded-3xl">
                                    <AlertCircle className="text-destructive size-8" />
                                </div>
                                <div>
                                    <h4 className="text-foreground text-xl font-extrabold">Submission Rejected</h4>
                                    <p className="text-muted-foreground text-sm">Wait for the attendant to revise the records.</p>
                                </div>
                                {closure.discrepancy_reason && (
                                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                                        <p className="text-destructive text-xs font-bold uppercase tracking-widest mb-1">Rejection Reason</p>
                                        <p className="text-muted-foreground text-sm italic">&quot;{closure.discrepancy_reason}&quot;</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Metadata */}
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex items-start gap-3">
                                <Calendar className="text-muted-foreground mt-0.5 size-5" />
                                <div>
                                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Opening Time</p>
                                    <p className="text-foreground text-sm font-semibold">{safeFormat(closure.opened_at, 'ppp')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <FileText className="text-muted-foreground mt-0.5 size-5" />
                                <div>
                                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Reference No.</p>
                                    <p className="text-foreground text-sm font-semibold">#{closure.closure_number}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    };

    /* ---- History Tab ---- */
    const renderHistory = () => (
        <div className="mt-6 space-y-4">
            {/* Date filter */}
            <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs">From</Label>
                    <DatePicker
                        value={startDate ? dayjs(startDate) : null}
                        onChange={(date) => setStartDate(date ? date.format('YYYY-MM-DD') : '')}
                        format="DD MMM YYYY"
                        className="h-9 w-40"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs">To</Label>
                    <DatePicker
                        value={endDate ? dayjs(endDate) : null}
                        onChange={(date) => setEndDate(date ? date.format('YYYY-MM-DD') : '')}
                        format="DD MMM YYYY"
                        className="h-9 w-40"
                    />
                </div>
                <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loadingHistory}>
                    <RefreshCcw className={cn("mr-2 size-4", loadingHistory && "animate-spin")} />
                    Filter
                </Button>
            </div>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Date</TableHead>
                                <TableHead>Ref No.</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Net Sales</TableHead>
                                <TableHead>Tax</TableHead>
                                <TableHead>Cash Diff</TableHead>
                                <TableHead className="pr-6 w-[100px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingHistory ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-16 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <FileText className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-foreground font-semibold">No history found</p>
                                        <p className="text-muted-foreground mt-1 text-sm">Try adjusting the date range filter.</p>
                                    </TableCell>
                                </TableRow>
                            ) : pg.pageItems.map(rec => (
                                <TableRow key={rec.id}>
                                    <TableCell className="pl-6 text-sm">{safeFormat(rec.closure_date, 'MMM d, yyyy')}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm font-mono">{rec.closure_number}</TableCell>
                                    <TableCell><StatusBadge status={rec.status} /></TableCell>
                                    <TableCell className="text-sm">{fmt(rec.net_sales)}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{fmt(rec.total_tax)}</TableCell>
                                    <TableCell>
                                        <span className={cn(
                                            "text-sm font-medium",
                                            (rec.cash_difference ?? 0) < 0 ? "text-destructive" : (rec.cash_difference ?? 0) > 0 ? "text-success" : "text-muted-foreground"
                                        )}>
                                            {(rec.cash_difference ?? 0) > 0 ? '+' : ''}{(rec.cash_difference ?? 0).toFixed(2)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                onClick={() => router.push(`/daily-closure/${rec.id}`)}
                                            >
                                                <Eye className="size-4" />
                                            </Button>
                                            {rec.status === 'submitted' && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 text-success hover:text-success hover:bg-success/10"
                                                        onClick={() => setPendingAction({ type: 'approve', closureId: rec.id, label: `Approve closure #${rec.closure_number}?` })}
                                                    >
                                                        <CheckCircle className="size-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => setPendingAction({ type: 'reject', closureId: rec.id, label: `Reject closure #${rec.closure_number}?` })}
                                                    >
                                                        <XCircle className="size-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {!loadingHistory && history.length > 0 && (
                    <div className="border-border bg-muted/30 border-t px-4 py-3">
                        <Pagination page={pg.page} totalPages={pg.totalPages} onPageChange={pg.setPage} total={pg.total} pageSize={pg.pageSize} onPageSizeChange={pg.setPageSize} />
                    </div>
                )}
            </Card>
        </div>
    );

    return (
        <>
            <Tabs defaultValue="current" className="w-full">
                <TabsList>
                    <TabsTrigger value="current">Current Reconciliation</TabsTrigger>
                    <TabsTrigger value="history">Closure History</TabsTrigger>
                </TabsList>
                <TabsContent value="current">{renderCurrentClosure()}</TabsContent>
                <TabsContent value="history">{renderHistory()}</TabsContent>
            </Tabs>

            {/* Confirm action dialog */}
            <AlertDialog open={!!pendingAction} onOpenChange={open => !open && setPendingAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingAction?.type === 'approve' ? 'Approve Closure' : 'Reject Submission'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingAction?.label}
                            {pendingAction?.type === 'approve'
                                ? ' This action will close the record for this period.'
                                : ' The record will be sent back for correction.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className={cn(
                                pendingAction?.type === 'reject'
                                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                    : ''
                            )}
                            onClick={confirmAction}
                        >
                            {pendingAction?.type === 'approve' ? 'Yes, Approve' : 'Reject'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
