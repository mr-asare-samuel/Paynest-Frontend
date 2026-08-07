"use client"

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/(zustand-store)/authStore';
import { getPayrollTrends } from '@/(api-handlers)/payrollHandler';
import { PayrollTrendPoint } from '@/interfaces/payroll';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import PageHeader from '@/components/(shared-components)/PageHeader';
import StatsGrid from '@/components/(shared-components)/StatsGrid';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Dynamically import recharts to avoid SSR issues (matches dashboard/views/AdminView.tsx convention)
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

const CHART_PRIMARY = 'var(--primary)';
const CHART_INFO = 'var(--info)';

function ChartTooltip({ active, payload, label, currency }: {
    active?: boolean;
    payload?: { value: number; name: string }[];
    label?: string;
    currency: (n: number) => string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-card border-border rounded-xl border p-3 shadow-lg text-xs">
            <p className="text-foreground mb-2 font-semibold">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex justify-between gap-6">
                    <span className="text-muted-foreground capitalize">{p.name.replace(/_/g, ' ')}</span>
                    <span className="text-foreground font-semibold num-tabular">
                        {p.name === 'employee_count' ? p.value : currency(p.value)}
                    </span>
                </div>
            ))}
        </div>
    );
}

function ChartCard({
    title, subtitle, children, loading, empty, className,
}: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    loading?: boolean;
    empty?: boolean;
    className?: string;
}) {
    return (
        <Card className={cn('gap-0 overflow-hidden', className)}>
            <CardHeader className="border-border border-b px-6 py-4">
                <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                {subtitle && <CardDescription className="text-xs">{subtitle}</CardDescription>}
            </CardHeader>
            <CardContent className="p-6">
                {loading ? (
                    <Skeleton className="h-64 w-full rounded-lg" />
                ) : empty ? (
                    <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
                        No processed payroll runs yet
                    </div>
                ) : children}
            </CardContent>
        </Card>
    );
}

export default function PayrollHistoryPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const fmt = useCurrency();

    const [trends, setTrends] = useState<PayrollTrendPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && user.role !== 'admin') router.replace('/dashboard');
    }, [user, router]);

    const fetchTrends = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getPayrollTrends(12);
            setTrends(res.items);
        } catch (err) {
            handleErrorMessage(err, 'Failed to load payroll history');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTrends(); }, [fetchTrends]);

    if (!user || user.role !== 'admin') {
        return (
            <div className="flex items-center justify-center py-24">
                <Skeleton className="size-6 rounded-full" />
            </div>
        );
    }

    const latest = trends[trends.length - 1];
    const axisStyle = { fontSize: 10, fill: 'var(--muted-foreground)' };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Payroll History" description="Trends across your organization's past payroll runs." />

            {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
            ) : latest ? (
                <StatsGrid
                    columns={5}
                    stats={[
                        { name: 'Latest Gross Pay', value: fmt(latest.total_gross_pay) },
                        { name: 'Latest Employee Tax', value: fmt(latest.total_employee_tax) },
                        { name: 'Latest Employer Cost', value: fmt(latest.total_employer_cost) },
                        { name: 'Latest Net Pay', value: fmt(latest.total_net_pay) },
                        { name: 'Employees Paid', value: String(latest.employee_count) },
                    ]}
                />
            ) : null}

            <ChartCard
                title="Net Pay Over Time"
                subtitle="Total net pay per payroll run"
                loading={loading}
                empty={!loading && trends.length === 0}
            >
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trends} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="netPayGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.18} />
                                    <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="period_label" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis
                                tick={axisStyle}
                                axisLine={false}
                                tickLine={false}
                                width={52}
                                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                            />
                            <Tooltip content={<ChartTooltip currency={fmt} />} />
                            <Area
                                type="monotone"
                                dataKey="total_net_pay"
                                name="net pay"
                                stroke={CHART_PRIMARY}
                                strokeWidth={2}
                                fill="url(#netPayGrad)"
                                dot={false}
                                activeDot={{ r: 4, fill: CHART_PRIMARY, strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            <ChartCard
                title="Employees Paid Per Run"
                subtitle="Headcount included in each payroll run"
                loading={loading}
                empty={!loading && trends.length === 0}
            >
                <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trends} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={24}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="period_label" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                            <Tooltip content={<ChartTooltip currency={fmt} />} cursor={{ fill: 'hsl(var(--muted))' }} />
                            <Bar dataKey="employee_count" name="employee_count" fill={CHART_INFO} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>
        </div>
    );
}
