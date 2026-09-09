"use client"

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import {
    RefreshCcw, CalendarDays, TrendingUp, TrendingDown, ArrowUpRight,
    Package, AlertTriangle, ShoppingBag, Clock, Truck, CheckCircle2,
    CircleDot, PackageCheck, Boxes, ListFilter,
} from 'lucide-react';
import { GetFinanceOverview } from '@/(api-handlers)/financeHandler';
import { GetInventoryStatistics } from '@/(api-handlers)/inventoryHandler';
import { GetWalkinOrdersList } from '@/(api-handlers)/orders_walkinsHandler';
import { FinanceOverviewResponse } from '@/interfaces/finance';
import { InventoryStats } from '@/interfaces/inventory';
import { OrderWalkInsResponse, OrderStatus } from '@/interfaces/orders_walkins';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/(zustand-store)/authStore';
import { useCurrency, useOrgCurrency } from '@/hooks/useCurrency';

// recharts — client only
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });

// ─────────────────────────────────────────────────────────────────────────────

const PERIODS = [
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
];

const ORDER_STATUS: Record<OrderStatus, { label: string; icon: typeof Clock; cls: string }> = {
    initiated:   { label: 'Initiated',   icon: CircleDot,    cls: 'text-muted-foreground bg-muted' },
    preparing:   { label: 'Preparing',   icon: Clock,        cls: 'text-warning bg-warning-muted' },
    ready:       { label: 'Ready',       icon: PackageCheck, cls: 'text-info bg-info-muted' },
    transported: { label: 'On the way',  icon: Truck,        cls: 'text-info bg-info-muted' },
    delivered:   { label: 'Delivered',   icon: CheckCircle2, cls: 'text-success bg-success-muted' },
};

const deltaPct = (cur: number, prev: number) =>
    prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;

// ─── Delta chip ──────────────────────────────────────────────────────────────
function Delta({ pct, suffix = 'vs prev period' }: { pct: number; suffix?: string }) {
    const up = pct >= 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
        <span className="inline-flex items-center gap-1 text-xs">
            <span className={cn('inline-flex items-center gap-0.5 font-semibold', up ? 'text-success' : 'text-destructive')}>
                <Icon className="size-3.5" />
                {up ? '+' : ''}{pct.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">{suffix}</span>
        </span>
    );
}

// ─── KPI card with sparkline ─────────────────────────────────────────────────
function KpiCard({
    label, value, sub, pct, spark, tone = 'primary', loading,
}: {
    label: string; value: string; sub?: string; pct: number;
    spark: number[]; tone?: 'primary' | 'success' | 'info'; loading?: boolean;
}) {
    const stroke = tone === 'success' ? 'var(--success)' : tone === 'info' ? 'var(--info)' : 'var(--primary)';
    const data = spark.map((v, i) => ({ i, v }));
    return (
        <Card className="gap-0 overflow-hidden p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-muted-foreground text-xs font-medium">{label}</p>
                    {loading ? (
                        <Skeleton className="mt-2 h-7 w-24" />
                    ) : (
                        <p className="text-foreground mt-1.5 text-2xl font-bold leading-none tracking-tight num-tabular">
                            {value}
                        </p>
                    )}
                </div>
                <div className="h-10 w-24 shrink-0">
                    {!loading && data.length > 1 && (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                                        <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.75}
                                    fill={`url(#spark-${label})`} dot={false} isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
            <div className="mt-3">
                {loading ? <Skeleton className="h-4 w-32" /> : <Delta pct={pct} suffix={sub ?? 'vs prev period'} />}
            </div>
        </Card>
    );
}

// ─── Overview bar (custom shape) ─────────────────────────────────────────────
type BarShapeProps = {
    x?: number; y?: number; width?: number; height?: number; index?: number;
};
function renderOverviewBar(props: BarShapeProps, activeIndex: number) {
    const { x = 0, y = 0, width = 0, height = 0, index = 0 } = props;
    const active = index === activeIndex;
    const r = Math.min(6, width / 2);
    return (
        <rect
            x={x} y={y} width={width} height={Math.max(height, 2)} rx={r} ry={r}
            fill={active ? 'var(--primary)' : 'url(#barHatch)'}
            stroke={active ? 'transparent' : 'var(--border)'}
            strokeWidth={active ? 0 : 1}
            className="transition-[fill] duration-150"
        />
    );
}

// ─── Overview tooltip pill ──────────────────────────────────────────────────
function OverviewTip({ active, payload, label, fmt }: {
    active?: boolean;
    payload?: { value: number; payload: { orders: number } }[];
    label?: string;
    fmt: (n: number) => string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-foreground text-background rounded-xl px-3 py-2 text-center shadow-xl">
            <p className="text-background/60 text-[10px] font-medium uppercase tracking-wide">{label}</p>
            <p className="mt-0.5 text-sm font-bold num-tabular">{fmt(payload[0].value)}</p>
            <p className="text-background/60 mt-0.5 text-[10px]">{payload[0].payload.orders} orders</p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
export const AdminView = () => {
    const router = useRouter();
    const firstName = useAuthStore(s => s.user?.first_name) ?? 'there';
    const fmt = useCurrency();
    const currency = useOrgCurrency();

    const [period, setPeriod] = useState('30');
    const [loading, setLoading] = useState(true);
    const [cur, setCur] = useState<FinanceOverviewResponse | null>(null);
    const [prev, setPrev] = useState<FinanceOverviewResponse | null>(null);
    const [inv, setInv] = useState<InventoryStats | null>(null);
    const [orders, setOrders] = useState<OrderWalkInsResponse[]>([]);

    const [hoverBar, setHoverBar] = useState<number | null>(null);
    const [pinnedBar, setPinnedBar] = useState<number | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
    const [selected, setSelected] = useState<Set<number>>(new Set());

    const days = Number(period);

    const load = useCallback(async (d: number) => {
        setLoading(true);
        try {
            const iso = (x: dayjs.Dayjs) => x.format('YYYY-MM-DD');
            const end = dayjs();
            const start = end.subtract(d, 'day');
            const prevEnd = start.subtract(1, 'day');
            const prevStart = prevEnd.subtract(d, 'day');
            const [c, p, i, o] = await Promise.all([
                GetFinanceOverview(undefined, iso(start), iso(end)),
                GetFinanceOverview(undefined, iso(prevStart), iso(prevEnd)),
                GetInventoryStatistics().catch(() => null),
                GetWalkinOrdersList(undefined, 0, 50).catch(() => ({ items: [], total: 0 })),
            ]);
            setCur(c);
            setPrev(p);
            setInv(i);
            setOrders(o.items ?? []);
        } catch {
            // dashboard is informational — fail quiet
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(days); }, [load, days]);

    const fmtShort = useCallback((n: number) => {
        if (Math.abs(n) >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
        if (Math.abs(n) >= 1_000) return `${currency} ${(n / 1_000).toFixed(1)}K`;
        return fmt(n);
    }, [currency, fmt]);

    const s = cur?.summary;
    const ps = prev?.summary;
    const margin = s && s.total_revenue > 0 ? s.gross_profit / s.total_revenue : 0;
    const aov = s && s.total_orders > 0 ? s.total_revenue / s.total_orders : 0;
    const prevAov = ps && ps.total_orders > 0 ? ps.total_revenue / ps.total_orders : 0;

    const trends = useMemo(() => cur?.trends ?? [], [cur]);
    const revSpark = trends.map(t => t.revenue);
    const ordSpark = trends.map(t => t.orders);
    const profitSpark = trends.map(t => t.revenue * margin);
    const aovSpark = trends.map(t => (t.orders > 0 ? t.revenue / t.orders : 0));

    // Bucket the daily trend into ≤ 12 fat bars for the overview chart
    const buckets = useMemo(() => {
        if (!trends.length) return [] as { label: string; value: number; orders: number }[];
        const count = Math.min(12, trends.length);
        const size = Math.max(1, Math.ceil(trends.length / count));
        const out: { label: string; value: number; orders: number }[] = [];
        for (let i = 0; i < trends.length; i += size) {
            const slice = trends.slice(i, i + size);
            out.push({
                label: dayjs(slice[0].date).format(size > 1 ? 'MMM D' : 'ddd D'),
                value: Number(slice.reduce((a, t) => a + t.revenue, 0).toFixed(2)),
                orders: slice.reduce((a, t) => a + t.orders, 0),
            });
        }
        return out;
    }, [trends]);

    const maxBucket = useMemo(() => {
        if (!buckets.length) return 0;
        let mi = 0;
        buckets.forEach((b, i) => { if (b.value > buckets[mi].value) mi = i; });
        return mi;
    }, [buckets]);

    const activeBar = hoverBar ?? pinnedBar ?? maxBucket;
    const avgPerDay = s ? s.total_revenue / days : 0;
    const revenueDelta = deltaPct(s?.total_revenue ?? 0, ps?.total_revenue ?? 0);

    const filteredOrders = useMemo(
        () => (statusFilter === 'all' ? orders : orders.filter(o => o.order_status === statusFilter)),
        [orders, statusFilter],
    );
    const tableRows = filteredOrders.slice(0, 8);

    const toggleRow = (id: number) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const allChecked = tableRows.length > 0 && tableRows.every(o => selected.has(o.id));
    const toggleAll = () => setSelected(prev => {
        if (allChecked) { const n = new Set(prev); tableRows.forEach(o => n.delete(o.id)); return n; }
        return new Set([...prev, ...tableRows.map(o => o.id)]);
    });

    const custName = (o: OrderWalkInsResponse) =>
        o.customer ? `${o.customer.first_name ?? ''} ${o.customer.last_name ?? ''}`.trim() || 'Walk-in' : 'Walk-in';

    const invSeverity = !inv ? 'none'
        : inv.out_of_stock_items > 0 ? 'bad'
        : inv.low_stock_items > 0 ? 'warn'
        : 'ok';

    return (
        <div className="flex flex-col gap-6">
            {/* ── Greeting ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-h2 text-foreground flex items-center gap-2">
                        Welcome, {firstName}
                        <motion.span
                            aria-hidden
                            animate={{ rotate: [0, 16, -8, 16, 0] }}
                            transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
                            style={{ display: 'inline-block', transformOrigin: '70% 70%' }}
                        >
                            👋
                        </motion.span>
                    </h1>
                    <p className="text-body-sm text-muted-foreground mt-1">
                        Here&apos;s how your shops are performing — sales, orders and stock in one place.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="h-9 w-[168px]">
                            <CalendarDays className="text-muted-foreground mr-1 size-4" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                            {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" className="size-9" onClick={() => load(days)} aria-label="Refresh">
                        <RefreshCcw className={cn('size-4', loading && 'animate-spin')} />
                    </Button>
                </div>
            </div>

            {/* ── Inventory strip ──────────────────────────────────── */}
            {inv && (
                <Link
                    href="/inventory"
                    className={cn(
                        'group flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                        invSeverity === 'bad' && 'border-destructive/30 bg-destructive/[0.04] hover:bg-destructive/[0.07]',
                        invSeverity === 'warn' && 'border-warning/30 bg-warning-muted/50 hover:bg-warning-muted',
                        (invSeverity === 'ok' || invSeverity === 'none') && 'border-border bg-muted/30 hover:bg-muted/50',
                    )}
                >
                    <div className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                        invSeverity === 'bad' ? 'bg-destructive/10 text-destructive'
                            : invSeverity === 'warn' ? 'bg-warning/15 text-warning'
                            : 'bg-primary/10 text-foreground',
                    )}>
                        {invSeverity === 'ok' || invSeverity === 'none' ? <Boxes className="size-4.5" /> : <AlertTriangle className="size-4.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-foreground text-sm font-semibold">
                            {inv.total_items.toLocaleString()} items tracked · {fmtShort(inv.total_inventory_value)} at cost
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {inv.out_of_stock_items > 0 && (
                                <Badge className="bg-destructive/10 text-destructive border-transparent text-[11px]">{inv.out_of_stock_items} out of stock</Badge>
                            )}
                            {inv.low_stock_items > 0 && (
                                <Badge className="bg-warning-muted text-warning-foreground border-transparent text-[11px]">{inv.low_stock_items} low stock</Badge>
                            )}
                            {inv.needs_reorder_items > 0 && (
                                <Badge className="bg-info-muted text-info border-transparent text-[11px]">{inv.needs_reorder_items} to reorder</Badge>
                            )}
                            {inv.out_of_stock_items === 0 && inv.low_stock_items === 0 && (
                                <span className="text-muted-foreground text-xs">All products above their reorder point</span>
                            )}
                        </div>
                    </div>
                    <ArrowUpRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
            )}

            {/* ── KPI row ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard loading={loading} label="Total revenue"
                    value={s ? fmtShort(s.total_revenue) : fmt(0)}
                    pct={revenueDelta} spark={revSpark} tone="primary" />
                <KpiCard loading={loading} label="Orders"
                    value={s ? s.total_orders.toLocaleString() : '0'}
                    pct={deltaPct(s?.total_orders ?? 0, ps?.total_orders ?? 0)} spark={ordSpark} tone="info" />
                <KpiCard loading={loading} label="Gross profit"
                    value={s ? fmtShort(s.gross_profit) : fmt(0)}
                    sub={`${(margin * 100).toFixed(1)}% margin`}
                    pct={deltaPct(s?.gross_profit ?? 0, ps?.gross_profit ?? 0)} spark={profitSpark} tone="success" />
                <KpiCard loading={loading} label="Avg order value"
                    value={fmtShort(aov)}
                    pct={deltaPct(aov, prevAov)} spark={aovSpark} tone="primary" />
            </div>

            {/* ── Overview + recent activity ───────────────────────── */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                {/* Overview chart */}
                <Card className="gap-0 overflow-hidden p-5 xl:col-span-8">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-foreground text-sm font-semibold">Revenue overview</p>
                            <p className="text-muted-foreground mt-0.5 text-xs">Avg per day</p>
                            <div className="mt-1.5 flex items-center gap-2">
                                {loading ? <Skeleton className="h-8 w-32" /> : (
                                    <span className="text-foreground text-2xl font-bold tracking-tight num-tabular">
                                        {fmtShort(avgPerDay)}
                                    </span>
                                )}
                                {!loading && (
                                    <span className={cn(
                                        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold',
                                        revenueDelta >= 0 ? 'bg-success-muted text-success' : 'bg-destructive/10 text-destructive',
                                    )}>
                                        {revenueDelta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                                        {Math.abs(revenueDelta).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </div>
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                                {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="mt-4 h-64" onMouseLeave={() => setHoverBar(null)}>
                        {loading ? (
                            <Skeleton className="h-full w-full rounded-lg" />
                        ) : buckets.length === 0 ? (
                            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                                No revenue in this period
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={buckets} margin={{ top: 24, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
                                    <defs>
                                        <pattern id="barHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                                            <rect width="6" height="6" fill="var(--muted)" />
                                            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--border)" strokeWidth="3" />
                                        </pattern>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="label" tickLine={false} axisLine={false}
                                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} interval="preserveStartEnd" />
                                    <Tooltip cursor={false} isAnimationActive={false}
                                        content={<OverviewTip fmt={fmt} />} />
                                    <Bar
                                        dataKey="value"
                                        onMouseEnter={(_: unknown, i: number) => setHoverBar(i)}
                                        onClick={(_: unknown, i: number) => setPinnedBar(i === pinnedBar ? null : i)}
                                        shape={(p: BarShapeProps) => renderOverviewBar(p, activeBar)}
                                        isAnimationActive={false}
                                        className="cursor-pointer"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                {/* Recent orders list */}
                <Card className="gap-0 overflow-hidden xl:col-span-4">
                    <div className="border-border flex items-center justify-between border-b px-5 py-4">
                        <p className="text-foreground text-sm font-semibold">Recent orders</p>
                        <Link href="/orders" className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:opacity-80">
                            View all <ArrowUpRight className="size-3" />
                        </Link>
                    </div>
                    <ScrollArea className="h-[300px]">
                        {loading ? (
                            <div className="space-y-3 p-5">
                                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm">
                                No orders yet
                            </div>
                        ) : (
                            <ul className="divide-border/70 divide-y">
                                {orders.slice(0, 8).map(o => {
                                    const st = ORDER_STATUS[o.order_status] ?? ORDER_STATUS.initiated;
                                    const Icon = st.icon;
                                    return (
                                        <li key={o.id}>
                                            <Link href={`/orders/${o.id}`}
                                                className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 transition-colors">
                                                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', st.cls)}>
                                                    <Icon className="size-4" />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-foreground truncate text-sm font-semibold">{o.order_number}</p>
                                                    <p className="text-muted-foreground truncate text-xs">{custName(o)}</p>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <p className="text-foreground num-tabular text-sm font-semibold">{fmt(o.total_amount ?? 0)}</p>
                                                    <p className="text-muted-foreground text-[11px]">{o.created_at ? dayjs(o.created_at).format('MMM D') : '—'}</p>
                                                </div>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </ScrollArea>
                </Card>
            </div>

            {/* ── Orders table ─────────────────────────────────────── */}
            <Card className="gap-0 overflow-hidden">
                <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                    <div className="flex items-center gap-3">
                        <p className="text-foreground text-sm font-semibold">Latest orders</p>
                        {selected.size > 0 && (
                            <span className="text-muted-foreground text-xs">{selected.size} selected</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <ListFilter className="text-muted-foreground size-4" />
                        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as 'all' | OrderStatus)}>
                            <SelectTrigger className="h-8 w-[150px] text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                                <SelectItem value="all">All statuses</SelectItem>
                                {(Object.keys(ORDER_STATUS) as OrderStatus[]).map(k => (
                                    <SelectItem key={k} value={k}>{ORDER_STATUS[k].label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-muted-foreground border-border border-b text-left text-xs">
                                <th className="w-10 py-3 pl-5"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" /></th>
                                <th className="py-3 pr-4 font-medium">Order</th>
                                <th className="py-3 pr-4 font-medium">Customer</th>
                                <th className="py-3 pr-4 text-right font-medium">Total</th>
                                <th className="py-3 pr-4 font-medium">Payment</th>
                                <th className="py-3 pr-4 font-medium">Date</th>
                                <th className="py-3 pr-5 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="border-border/60 border-b">
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <td key={j} className="px-4 py-3.5"><Skeleton className="h-4 w-full" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : tableRows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-muted-foreground py-16 text-center text-sm">
                                        <ShoppingBag className="mx-auto mb-3 size-8 opacity-40" />
                                        No orders match this filter
                                    </td>
                                </tr>
                            ) : tableRows.map(o => {
                                const st = ORDER_STATUS[o.order_status] ?? ORDER_STATUS.initiated;
                                const Icon = st.icon;
                                const checked = selected.has(o.id);
                                return (
                                    <tr key={o.id}
                                        onClick={() => router.push(`/orders/${o.id}`)}
                                        className={cn(
                                            'border-border/60 hover:bg-muted/40 cursor-pointer border-b transition-colors',
                                            checked && 'bg-muted/30',
                                        )}>
                                        <td className="py-3.5 pl-5" onClick={e => e.stopPropagation()}>
                                            <Checkbox checked={checked} onCheckedChange={() => toggleRow(o.id)} aria-label={`Select ${o.order_number}`} />
                                        </td>
                                        <td className="text-foreground py-3.5 pr-4 font-semibold">{o.order_number}</td>
                                        <td className="text-muted-foreground py-3.5 pr-4">{custName(o)}</td>
                                        <td className="text-foreground num-tabular py-3.5 pr-4 text-right font-semibold">{fmt(o.total_amount ?? 0)}</td>
                                        <td className="py-3.5 pr-4">
                                            <span className={cn(
                                                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                                                o.payment_status === 'paid' ? 'bg-success-muted text-success'
                                                    : o.payment_status === 'failed' ? 'bg-destructive/10 text-destructive'
                                                    : 'bg-warning-muted text-warning-foreground',
                                            )}>
                                                {o.payment_status ?? 'unpaid'}
                                            </span>
                                        </td>
                                        <td className="text-muted-foreground py-3.5 pr-4 text-xs">
                                            {o.created_at ? dayjs(o.created_at).format('MMM D, YYYY') : '—'}
                                        </td>
                                        <td className="py-3.5 pr-5">
                                            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium', st.cls)}>
                                                <Icon className="size-3" /> {st.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* ── Shop performance ─────────────────────────────────── */}
            {!loading && (cur?.shop_breakdown?.length ?? 0) > 0 && (
                <Card className="gap-0 overflow-hidden">
                    <div className="border-border border-b px-5 py-4">
                        <p className="text-foreground text-sm font-semibold">Shop performance</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">Revenue, orders and profit by location</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-border border-b text-left text-xs">
                                    <th className="py-3 pl-5 font-medium">Shop</th>
                                    <th className="py-3 pr-4 text-right font-medium">Revenue</th>
                                    <th className="py-3 pr-4 text-right font-medium">Orders</th>
                                    <th className="py-3 pr-4 text-right font-medium">Profit</th>
                                    <th className="py-3 pr-5 text-right font-medium">Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(cur?.shop_breakdown ?? []).map((sh, i) => {
                                    const m = sh.revenue > 0 ? (sh.profit / sh.revenue) * 100 : 0;
                                    const share = (s?.total_revenue ?? 0) > 0 ? (sh.revenue / (s?.total_revenue ?? 1)) * 100 : 0;
                                    return (
                                        <tr key={sh.shop_id ?? i} className="border-border/60 border-b">
                                            <td className="text-foreground py-3.5 pl-5 font-semibold">{sh.shop_name}</td>
                                            <td className="py-3.5 pr-4 text-right">
                                                <p className="text-foreground num-tabular font-semibold">{fmt(sh.revenue)}</p>
                                                <p className="text-muted-foreground text-[10px]">{share.toFixed(1)}% of total</p>
                                            </td>
                                            <td className="text-foreground num-tabular py-3.5 pr-4 text-right">{sh.orders_count.toLocaleString()}</td>
                                            <td className="text-info num-tabular py-3.5 pr-4 text-right font-semibold">{fmt(sh.profit)}</td>
                                            <td className="py-3.5 pr-5 text-right">
                                                <Badge variant="outline" className={cn(
                                                    'rounded-full text-xs font-semibold',
                                                    m >= 30 ? 'border-success/30 bg-success-muted text-success'
                                                        : m >= 15 ? 'border-info/30 bg-info/10 text-info'
                                                        : 'border-warning/30 bg-warning-muted text-warning-foreground',
                                                )}>{m.toFixed(1)}%</Badge>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {!loading && !cur && (
                <Card className="flex flex-col items-center gap-3 py-16 text-center">
                    <div className="bg-muted flex size-14 items-center justify-center rounded-full">
                        <Package className="text-muted-foreground size-7" />
                    </div>
                    <div>
                        <p className="text-foreground font-medium">No data yet</p>
                        <p className="text-muted-foreground mt-1 text-sm">Metrics appear once orders are processed</p>
                    </div>
                </Card>
            )}
        </div>
    );
};
