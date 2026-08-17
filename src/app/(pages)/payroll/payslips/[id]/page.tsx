"use client"

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPayslip, downloadPayslip } from '@/(api-handlers)/payrollHandler';
import { Payslip } from '@/interfaces/payroll';
import { getErrorMessage } from '@/utils/handleErrorMessage';
import EmptyState from '@/components/(shared-components)/EmptyState';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';
import axios from 'axios';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Download, ReceiptText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PayslipDetailPage() {
    const router = useRouter();
    const params = useParams();
    const payslipId = Number(params.id);
    const fmt = useCurrency();

    const [payslip, setPayslip] = useState<Payslip | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const fetchPayslip = useCallback(async () => {
        if (!payslipId) return;
        setLoading(true);
        setNotFound(false);
        try {
            setPayslip(await getPayslip(payslipId));
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 404) setNotFound(true);
            else toast.error(getErrorMessage(err, 'Failed to load payslip'));
        } finally {
            setLoading(false);
        }
    }, [payslipId]);

    useEffect(() => { fetchPayslip(); }, [fetchPayslip]);

    const handleDownload = async () => {
        if (!payslip) return;
        setDownloading(true);
        try {
            await downloadPayslip(payslip.id, `${payslip.payslip_number}.pdf`);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 404) {
                toast.error("This payslip's PDF is still generating — try again in a moment.");
            } else {
                toast.error(getErrorMessage(err, 'Failed to download payslip'));
            }
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-6">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-96 w-full max-w-2xl rounded-xl" />
            </div>
        );
    }

    if (notFound || !payslip) {
        return (
            <div className="flex flex-col gap-6">
                <EmptyState
                    icon={ReceiptText}
                    title="Payslip not found"
                    description="This payslip doesn't exist, or you don't have permission to view it."
                    actions={<Button variant="outline" onClick={() => router.back()}><ChevronLeft className="mr-2 size-4" /> Go Back</Button>}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="size-9 shrink-0">
                    <ChevronLeft className="size-5" />
                </Button>
                <div>
                    <h1 className="text-foreground text-xl font-bold">Payslip {payslip.payslip_number}</h1>
                    <p className="text-muted-foreground text-sm">
                        Generated {new Date(payslip.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                </div>
                <Badge variant="outline" className="rounded-full text-xs capitalize ml-auto">{payslip.status}</Badge>
            </div>

            {(payslip.organization_name || payslip.organization_logo_url) && (
                <div className="flex max-w-2xl items-center gap-3 rounded-lg border p-3">
                    {payslip.organization_logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={payslip.organization_logo_url}
                            alt={`${payslip.organization_name ?? 'Organization'} logo`}
                            className="size-10 shrink-0 rounded-md border border-border bg-muted object-contain"
                        />
                    ) : null}
                    {payslip.organization_name && (
                        <p className="text-foreground text-sm font-semibold">{payslip.organization_name}</p>
                    )}
                </div>
            )}

            <Card className="max-w-2xl gap-0 overflow-hidden p-0">
                <CardHeader className="bg-primary text-primary-foreground border-b px-6 py-5">
                    <CardTitle className="flex items-center justify-between text-base font-semibold">
                        <span>Net Pay</span>
                        <span className="text-2xl font-bold">{fmt(payslip.net_pay)}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 px-6 py-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                                Base Pay
                                {payslip.wage_type === 'hourly' && payslip.hours_worked != null && (
                                    <span className="ml-1.5 text-xs">({payslip.hours_worked} hrs × {fmt((payslip.base_pay || 0) / (payslip.hours_worked || 1))}/hr)</span>
                                )}
                                {payslip.wage_type === 'commission' && payslip.commission_base != null && (
                                    <span className="ml-1.5 text-xs">({fmt(payslip.commission_base)} in sales)</span>
                                )}
                            </span>
                            <span className="text-foreground font-medium">{fmt(payslip.base_pay)}</span>
                        </div>
                        {payslip.unpaid_leave_days > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Unpaid Leave ({payslip.unpaid_leave_days} days)</span>
                                <span className="text-destructive font-medium">-{fmt(payslip.unpaid_leave_deduction)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total Allowances</span>
                            <span className="text-success font-medium">+{fmt(payslip.total_allowances)}</span>
                        </div>
                        <div className="border-border flex justify-between border-t pt-2 text-sm font-semibold">
                            <span className="text-foreground">Gross Pay</span>
                            <span className="text-foreground">{fmt(payslip.gross_pay)}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Deductions</p>
                        {payslip.tax_breakdown.filter(t => t.bearer === 'employee').map((t, i) => (
                            <div key={i} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{t.name}</span>
                                <span className="text-destructive font-medium">-{fmt(t.amount)}</span>
                            </div>
                        ))}
                        {payslip.benefits_breakdown.filter(b => b.category === 'deduction').map((b, i) => (
                            <div key={i} className="flex justify-between text-sm">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    {b.name}
                                    <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px] capitalize">{b.source}</Badge>
                                </span>
                                <span className="text-destructive font-medium">-{fmt(b.amount)}</span>
                            </div>
                        ))}
                        <div className="border-border flex justify-between border-t pt-2 text-sm font-semibold">
                            <span className="text-foreground">Total Deductions</span>
                            <span className="text-foreground">{fmt(payslip.total_deductions)}</span>
                        </div>
                    </div>

                    {payslip.benefits_breakdown.filter(b => b.category === 'allowance').length > 0 && (
                        <div className="space-y-2">
                            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Allowances Breakdown</p>
                            {payslip.benefits_breakdown.filter(b => b.category === 'allowance').map((b, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        {b.name}
                                        <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px] capitalize">{b.source}</Badge>
                                    </span>
                                    <span className="text-success font-medium">+{fmt(b.amount)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {payslip.tax_breakdown.some(t => t.bearer === 'employer') && (
                        <div className="bg-muted/30 space-y-2 rounded-lg p-3">
                            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Employer Cost (informational only)</p>
                            {payslip.tax_breakdown.filter(t => t.bearer === 'employer').map((t, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t.name}</span>
                                    <span className="text-foreground font-medium">{fmt(t.amount)}</span>
                                </div>
                            ))}
                            <div className="border-border flex justify-between border-t pt-2 text-xs font-semibold">
                                <span className="text-muted-foreground">Total Employer Cost</span>
                                <span className="text-foreground">{fmt(payslip.total_employer_cost)}</span>
                            </div>
                        </div>
                    )}

                    {payslip.bonus_amount > 0 && (
                        <div className="flex justify-between border-t pt-3 text-sm">
                            <span className="text-muted-foreground">Bonus (added after deductions)</span>
                            <span className="text-success font-medium">+{fmt(payslip.bonus_amount)}</span>
                        </div>
                    )}

                    {payslip.tax_relief_total > 0 && (
                        <div className="flex justify-between border-t pt-3 text-xs text-muted-foreground">
                            <span>Tax Relief Total</span>
                            <span>{fmt(payslip.tax_relief_total)}</span>
                        </div>
                    )}

                    <div className={cn("rounded-lg border p-4 flex items-center justify-between", "border-success/30 bg-success/5")}>
                        <div>
                            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Net Pay</p>
                            <p className="text-foreground text-xl font-bold">{fmt(payslip.net_pay)}</p>
                        </div>
                        <Button onClick={handleDownload} disabled={downloading}>
                            {downloading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
                            {downloading ? 'Downloading…' : 'Download PDF'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
