"use client"

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    getSuperAdminDashboard,
    getSuperAdminSystemHealth,
    getSuperAdminTopProducts,
    getSuperAdminUsersWithoutProfile,
} from '@/(api-handlers)/superadminHandler';
import {
    SuperAdminDashboardResponse,
    OrgMetrics,
    SystemHealth,
    TopProduct,
    UserWithoutProfile,
} from '@/interfaces/superadminDashboard';
import {
    Building2, Users, Store, ShoppingCart, DollarSign,
    TrendingUp, TrendingDown, Activity, RefreshCcw,
    ArrowUpRight, UserPlus, BadgeCheck, CheckCircle2, CalendarDays,
    XCircle, Medal, Server, Database, Clock, Wifi,
    Package, AlertCircle, UserX, AlertTriangle,
    BarChart2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatsGrid from '@/components/(shared-components)/StatsGrid';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currency';
import { DatePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

// Recharts — dynamically imported to avoid SSR
const AreaChart           = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area                = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });
const BarChart            = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar                 = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const PieChart            = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie                 = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell                = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const XAxis               = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis               = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid       = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip             = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

// ─── Constants ───────────────────────────────────────────────────────────────
const PERIODS = [
    { value: '7',  label: 'Last 7 days'  },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
    { value: 'custom', label: 'Custom range' },
];

const CHART_INFO = 'var(--info)';

const deltaPct = (cur: number, prev: number) =>
    prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;

const PIE_PALETTE = [
    'var(--muted-foreground)',
    'var(--info)',
    'var(--primary)',
    'var(--warning)',
];

const PLAN_ORDER = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];

const PLAN_BADGE: Record<string, string> = {
    free:       'border-border bg-muted text-muted-foreground',
    basic:      'border-info/30 bg-info/10 text-info',
    pro:        'border-primary/30 bg-primary/10 text-primary',
    enterprise: 'border-warning/30 bg-warning/10 text-warning-foreground',
};

const fmt      = (n: number) => formatCurrency(n, 'GHS');
const fmtShort = (n: number) => {
    if (n >= 1_000_000) return `GHS ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `GHS ${(n / 1_000).toFixed(1)}K`;
    return fmt(n);
};

const axisStyle = { fontSize: 10, fill: 'var(--muted-foreground)' };

// ─── Pie Tooltip ─────────────────────────────────────────────────────────────
function PieTooltip({ active, payload }: {
    active?: boolean;
    payload?: { name: string; value: number; payload: { color: string } }[];
}) {
    if (!active || !payload?.length) return null;
    const entry = payload[0];
    return (
        <div className="bg-card border-border rounded-xl border p-3 shadow-lg text-xs">
            <div className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.payload.color }} />
                <span className="text-foreground font-semibold">{entry.name}</span>
                <span className="text-muted-foreground">— {entry.value} {entry.value === 1 ? 'org' : 'orgs'}</span>
            </div>
        </div>
    );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: { value: number; name: string }[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-card border-border rounded-xl border p-3 shadow-lg text-xs">
            <p className="text-foreground mb-2 font-semibold">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex justify-between gap-6">
                    <span className="text-muted-foreground capitalize">{p.name}</span>
                    <span className="text-foreground font-semibold num-tabular">
                        {p.name === 'revenue' ? fmtShort(p.value) : p.value.toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    );
}

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

// ─── KPI card with optional sparkline ────────────────────────────────────────
function KpiCard({
    icon: Icon, label, value, sub, pct, spark, tone = 'primary', loading,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    sub?: string;
    pct?: number;
    spark?: number[];
    tone?: 'primary' | 'success' | 'info';
    loading?: boolean;
}) {
    const stroke = tone === 'success' ? 'var(--success)' : tone === 'info' ? 'var(--info)' : 'var(--primary)';
    const data = (spark ?? []).map((v, i) => ({ i, v }));
    return (
        <Card className="gap-0 overflow-hidden p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                        <Icon className="size-3.5 shrink-0" /> {label}
                    </p>
                    {loading
                        ? <Skeleton className="mt-2 h-7 w-24" />
                        : <p className="text-foreground mt-1.5 text-2xl font-bold leading-none tracking-tight num-tabular">{value}</p>}
                </div>
                {!loading && data.length > 1 && (
                    <div className="h-10 w-24 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={`sa-spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                                        <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.75}
                                    fill={`url(#sa-spark-${label})`} dot={false} isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
            <div className="mt-3">
                {loading
                    ? <Skeleton className="h-4 w-32" />
                    : pct !== undefined
                        ? <Delta pct={pct} suffix={sub ?? 'vs prev period'} />
                        : sub && <span className="text-muted-foreground text-xs">{sub}</span>}
            </div>
        </Card>
    );
}

// ─── Interactive overview bar shape + tooltip ────────────────────────────────
type BarShapeProps = { x?: number; y?: number; width?: number; height?: number; index?: number };
function renderOverviewBar(props: BarShapeProps, activeIndex: number) {
    const { x = 0, y = 0, width = 0, height = 0, index = 0 } = props;
    const active = index === activeIndex;
    const r = Math.min(6, width / 2);
    return (
        <rect
            x={x} y={y} width={width} height={Math.max(height, 2)} rx={r} ry={r}
            fill={active ? 'var(--primary)' : 'url(#saBarHatch)'}
            stroke={active ? 'transparent' : 'var(--border)'}
            strokeWidth={active ? 0 : 1}
        />
    );
}

function OverviewTip({ active, payload, label }: {
    active?: boolean;
    payload?: { value: number; payload: { orders: number } }[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-foreground text-background rounded-xl px-3 py-2 text-center shadow-xl">
            <p className="text-background/60 text-[10px] font-medium uppercase tracking-wide">{label}</p>
            <p className="mt-0.5 text-sm font-bold num-tabular">{fmtShort(payload[0].value)}</p>
            <p className="text-background/60 mt-0.5 text-[10px]">{payload[0].payload.orders.toLocaleString()} orders</p>
        </div>
    );
}

// ─── Top Orgs ranked list ──────────────────────────────────────────────────────
function TopOrgsList({
    orgs, loading,
}: {
    orgs: { name: string; revenue: number; orders: number }[];
    loading: boolean;
}) {
    const maxRev = Math.max(...orgs.map(o => o.revenue), 1);

    return (
        <Card className="gap-0 overflow-hidden flex flex-col">
            <CardHeader className="border-b px-5 py-4 shrink-0">
                <CardTitle className="text-sm font-semibold">Top Orgs</CardTitle>
                <CardDescription className="text-xs">By revenue this period</CardDescription>
            </CardHeader>
            <CardContent className="px-5 py-4 flex-1">
                {loading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="space-y-1.5">
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-1.5 w-full rounded-full" />
                            </div>
                        ))}
                    </div>
                ) : orgs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                        No data for this period
                    </div>
                ) : (
                    <div className="space-y-3.5">
                        {orgs.map((org, i) => (
                            <div key={i} className="space-y-1.5 group">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={cn(
                                            'size-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0',
                                            i === 0 ? 'bg-warning/10 text-warning-foreground' :
                                            i === 1 ? 'bg-muted-foreground/10 text-muted-foreground' :
                                            i === 2 ? 'bg-primary/10 text-primary' :
                                            'bg-muted text-muted-foreground',
                                        )}>
                                            {i + 1}
                                        </span>
                                        <span className="text-foreground font-medium truncate">{org.name}</span>
                                    </div>
                                    <span className="text-foreground font-semibold shrink-0">{fmtShort(org.revenue)}</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            'h-full rounded-full transition-all duration-700',
                                            i === 0 ? 'bg-warning/70' :
                                            i === 1 ? 'bg-muted-foreground/50' :
                                            i === 2 ? 'bg-primary/60' :
                                            'bg-primary/40',
                                        )}
                                        style={{ width: `${(org.revenue / maxRev) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_STYLES = {
    healthy:  { dot: 'bg-success',     text: 'text-success',     label: 'Healthy' },
    degraded: { dot: 'bg-warning',     text: 'text-warning-foreground', label: 'Degraded' },
    down:     { dot: 'bg-destructive', text: 'text-destructive', label: 'Down' },
};

// ─── System Health card ───────────────────────────────────────────────────────
function SystemHealthCard({ health, loading }: { health: SystemHealth | null; loading: boolean }) {
    const apiSt  = health ? STATUS_STYLES[health.api_status] : null;
    const dbSt   = health ? STATUS_STYLES[health.db_status]  : null;

    const metrics = health ? [
        { icon: Wifi,     label: 'API',              value: health.api_status,     style: apiSt!,  isStatus: true },
        { icon: Database, label: 'Database',          value: health.db_status,      style: dbSt!,   isStatus: true },
        { icon: Clock,    label: 'Avg Response',      value: `${health.avg_response_time_ms} ms`, style: null, isStatus: false },
        { icon: Activity, label: 'Uptime',            value: `${health.uptime_percent.toFixed(2)}%`, style: null, isStatus: false },
        { icon: BarChart2,label: 'Requests Today',    value: health.total_requests_today.toLocaleString(), style: null, isStatus: false },
        { icon: AlertTriangle, label: 'Error Rate',   value: `${health.error_rate_percent.toFixed(2)}%`, style: health.error_rate_percent > 5 ? STATUS_STYLES.degraded : health.error_rate_percent > 15 ? STATUS_STYLES.down : STATUS_STYLES.healthy, isStatus: true },
    ] : [];

    return (
        <Card className="gap-0 overflow-hidden p-0">
            <CardHeader className="border-b px-6 py-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                            <Server className="size-3.5 text-info" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-semibold">System Health</CardTitle>
                            <CardDescription className="text-xs">
                                {health ? `Last checked ${new Date(health.last_checked).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Live status'}
                            </CardDescription>
                        </div>
                    </div>
                    {health && (
                        <Badge
                            variant="outline"
                            className={cn(
                                'text-xs font-medium',
                                health.api_status === 'healthy' && health.db_status === 'healthy'
                                    ? 'border-success/30 bg-success/10 text-success'
                                    : 'border-warning/30 bg-warning/10 text-warning-foreground',
                            )}
                        >
                            <span className={cn('size-1.5 rounded-full mr-1.5 inline-block',
                                health.api_status === 'healthy' && health.db_status === 'healthy'
                                    ? 'bg-success animate-pulse' : 'bg-warning')}
                            />
                            {health.api_status === 'healthy' && health.db_status === 'healthy' ? 'All Systems Operational' : 'Issues Detected'}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="px-6 py-5">
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-5 w-16" />
                            </div>
                        ))}
                    </div>
                ) : !health ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                        <AlertCircle className="size-4 shrink-0" />
                        Health endpoint unavailable — check backend connectivity
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 divide-x-0 lg:divide-x lg:divide-border/50">
                        {metrics.map((m, i) => {
                            const Icon = m.icon;
                            return (
                                <div key={i} className="flex flex-col gap-1.5 lg:px-4 first:pl-0 last:pr-0">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Icon className="size-3.5 shrink-0" />
                                        {m.label}
                                    </div>
                                    {m.isStatus && m.style ? (
                                        <div className="flex items-center gap-1.5">
                                            <span className={cn('size-2 rounded-full shrink-0 animate-pulse', m.style.dot)} />
                                            <span className={cn('text-sm font-semibold capitalize', m.style.text)}>
                                                {m.style.label}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-sm font-semibold text-foreground">{m.value}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Top Products card ────────────────────────────────────────────────────────
function TopProductsCard({ products, loading }: { products: TopProduct[]; loading: boolean }) {
    const maxQty = Math.max(...products.map(p => p.total_quantity_sold), 1);

    return (
        <Card className="gap-0 overflow-hidden p-0 flex flex-col">
            <CardHeader className="border-b px-5 py-4 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="size-3.5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-semibold">Top Products</CardTitle>
                        <CardDescription className="text-xs">Most purchased across all organizations</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-0 py-0 flex-1">
                {loading ? (
                    <div className="space-y-0 divide-y divide-border/50">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                                <Skeleton className="size-6 rounded-md shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-3 w-40" />
                                    <Skeleton className="h-2 w-full rounded-full" />
                                </div>
                                <Skeleton className="h-3 w-16 shrink-0" />
                            </div>
                        ))}
                    </div>
                ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                        <Package className="size-8 opacity-30" />
                        <p className="text-sm">No product data for this period</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/50">
                        {products.map((p, i) => (
                            <div key={p.product_id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                                <span className={cn(
                                    'size-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0',
                                    i === 0 ? 'bg-warning/10 text-warning-foreground' :
                                    i === 1 ? 'bg-muted-foreground/10 text-muted-foreground' :
                                    i === 2 ? 'bg-primary/10 text-primary' :
                                    'bg-muted text-muted-foreground',
                                )}>
                                    {i + 1}
                                </span>
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-medium text-foreground truncate">{p.product_name}</span>
                                        <span className="text-xs text-muted-foreground shrink-0">{p.total_quantity_sold.toLocaleString()} units</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={cn(
                                                    'h-full rounded-full transition-all duration-700',
                                                    i === 0 ? 'bg-warning/70' : i === 1 ? 'bg-muted-foreground/50' : i === 2 ? 'bg-primary/60' : 'bg-primary/35',
                                                )}
                                                style={{ width: `${(p.total_quantity_sold / maxQty) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-[11px] text-muted-foreground shrink-0 w-24 text-right">{fmtShort(p.total_revenue)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Advanced metrics mini-cards ──────────────────────────────────────────────
function AdvancedMetrics({ data, loading }: { data: SuperAdminDashboardResponse | null; loading: boolean }) {
    const s = data?.summary;

    const metrics = s ? [
        {
            name: 'Avg Revenue / Org',
            value: s.active_organizations > 0 ? fmtShort(s.total_revenue / s.active_organizations) : '—',
            change: 'Active orgs only',
        },
        {
            name: 'Avg Shops / Org',
            value: s.total_organizations > 0 ? (s.total_shops / s.total_organizations).toFixed(1) : '—',
            change: 'All organizations',
        },
        {
            name: 'Avg Users / Org',
            value: s.total_organizations > 0 ? (s.total_users / s.total_organizations).toFixed(1) : '—',
            change: 'All organizations',
        },
        {
            name: 'New Orgs (Period)',
            value: s.new_orgs_in_period.toLocaleString(),
            change: `of ${s.total_organizations} total`,
        },
    ] as const : [];

    if (loading) {
        return (
            <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} className="p-4">
                        <Skeleton className="h-3 w-24 mb-3" />
                        <Skeleton className="h-6 w-20 mb-1" />
                        <Skeleton className="h-2.5 w-16" />
                    </Card>
                ))}
            </div>
        );
    }

    return <StatsGrid columns={2} stats={metrics.map(m => ({ ...m, changeType: 'neutral' as const }))} />;
}

// ─── Users Without Profile table ──────────────────────────────────────────────
function UsersWithoutProfileCard({ users, loading }: { users: UserWithoutProfile[]; loading: boolean }) {
    return (
        <Card className="gap-0 overflow-hidden p-0">
            <CardHeader className="border-b px-6 py-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                            <UserX className="size-3.5 text-warning-foreground" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-semibold">Users Without Employee Profile</CardTitle>
                            <CardDescription className="text-xs">
                                Registered users who haven&apos;t set up an employee profile yet
                            </CardDescription>
                        </div>
                    </div>
                    {!loading && users.length > 0 && (
                        <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning-foreground text-xs">
                            {users.length} {users.length === 1 ? 'user' : 'users'} pending
                        </Badge>
                    )}
                </div>
            </CardHeader>
            {loading ? (
                <div className="p-6 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                </div>
            ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-2 text-muted-foreground">
                    <div className="size-12 rounded-full bg-success/10 flex items-center justify-center mb-1">
                        <CheckCircle2 className="size-6 text-success" />
                    </div>
                    <p className="text-sm font-medium text-foreground">All users have employee profiles</p>
                    <p className="text-xs">No action required</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Organization</TableHead>
                                <TableHead>Registered</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map(u => (
                                <TableRow key={u.user_id} className="hover:bg-muted/40 transition-colors">
                                    <TableCell>
                                        <div className="flex items-center gap-2.5">
                                            <div className="size-8 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                                                <UserX className="size-3.5 text-warning-foreground" />
                                            </div>
                                            <span className="font-medium text-sm text-foreground">{u.full_name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn('capitalize text-xs', PLAN_BADGE[u.role.toLowerCase()] ?? 'border-border bg-muted text-muted-foreground')}>
                                            {u.role.toLowerCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                                            <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                                            {u.org_name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {new Date(u.registered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link
                                            href={`/users/setup-employee-profile?user_id=${u.user_id}`}
                                            className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium transition-colors"
                                        >
                                            Set up profile <ArrowUpRight className="size-3" />
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </Card>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const SuperAdminView = () => {
    const [data, setData]             = useState<SuperAdminDashboardResponse | null>(null);
    const [prev, setPrev]             = useState<SuperAdminDashboardResponse | null>(null);
    const [loading, setLoading]       = useState(true);
    const [period, setPeriod]         = useState('30');
    const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);

    const [health, setHealth]                   = useState<SystemHealth | null>(null);
    const [healthLoading, setHealthLoading]     = useState(true);
    const [topProducts, setTopProducts]         = useState<TopProduct[]>([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [usersNoProfile, setUsersNoProfile]   = useState<UserWithoutProfile[]>([]);
    const [usersLoading, setUsersLoading]       = useState(true);

    const [hoverBar, setHoverBar]   = useState<number | null>(null);
    const [pinnedBar, setPinnedBar] = useState<number | null>(null);

    // Effective window (strings keep the effect stable)
    const { startStr, endStr, spanDays } = useMemo(() => {
        const end   = period === 'custom' && customRange ? customRange[1] : dayjs();
        const start = period === 'custom' && customRange ? customRange[0] : dayjs().subtract(Number(period) || 30, 'day');
        return {
            startStr: start.format('YYYY-MM-DD'),
            endStr:   end.format('YYYY-MM-DD'),
            spanDays: Math.max(1, end.diff(start, 'day')),
        };
    }, [period, customRange]);

    const loadHealthAndUsers = useCallback(() => {
        setHealthLoading(true);
        getSuperAdminSystemHealth().then(setHealth).catch(() => setHealth(null)).finally(() => setHealthLoading(false));
        setUsersLoading(true);
        getSuperAdminUsersWithoutProfile().then(setUsersNoProfile).catch(() => setUsersNoProfile([])).finally(() => setUsersLoading(false));
    }, []);

    const load = useCallback(async (sStr: string, eStr: string) => {
        setLoading(true);
        setProductsLoading(true);
        try {
            const start = dayjs(sStr), end = dayjs(eStr);
            const span = Math.max(1, end.diff(start, 'day'));
            const prevEnd = start.subtract(1, 'day');
            const prevStart = prevEnd.subtract(span, 'day');
            const iso = (d: Dayjs) => d.format('YYYY-MM-DD');
            const [cur, prv, products] = await Promise.allSettled([
                getSuperAdminDashboard(sStr, eStr),
                getSuperAdminDashboard(iso(prevStart), iso(prevEnd)),
                getSuperAdminTopProducts(sStr, eStr, 10),
            ]);
            setData(cur.status === 'fulfilled' ? cur.value : null);
            setPrev(prv.status === 'fulfilled' ? prv.value : null);
            setTopProducts(products.status === 'fulfilled' ? products.value : []);
        } catch {
            // best-effort — dashboard is informational
        } finally {
            setLoading(false);
            setProductsLoading(false);
        }
    }, []);

    useEffect(() => { load(startStr, endStr); }, [load, startStr, endStr]);
    useEffect(() => { loadHealthAndUsers(); }, [loadHealthAndUsers]);

    const onPeriodChange = (v: string) => {
        setPeriod(v);
        if (v === 'custom' && !customRange) setCustomRange([dayjs().subtract(30, 'day'), dayjs()]);
    };

    const s = data?.summary;
    const ps = prev?.summary;
    const range = spanDays;

    // ── Trend data ─────────────────────────────────────────────────────────────
    const trends = useMemo(() => (data?.platform_trends ?? []).map(t => ({
        date: new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        revenue: Number(t.revenue.toFixed(2)),
        orders: t.orders,
    })), [data]);

    const visibleTrend = spanDays > 30
        ? trends.filter((_, i) => i % 3 === 0)
        : spanDays > 14
            ? trends.filter((_, i) => i % 2 === 0)
            : trends;

    const revSpark = trends.map(t => t.revenue);
    const ordSpark = trends.map(t => t.orders);

    // Bucket daily trend into ≤ 12 fat bars for the interactive overview
    const buckets = useMemo(() => {
        const src = data?.platform_trends ?? [];
        if (!src.length) return [] as { label: string; value: number; orders: number }[];
        const count = Math.min(12, src.length);
        const size = Math.max(1, Math.ceil(src.length / count));
        const out: { label: string; value: number; orders: number }[] = [];
        for (let i = 0; i < src.length; i += size) {
            const slice = src.slice(i, i + size);
            out.push({
                label: dayjs(slice[0].date).format(size > 1 ? 'MMM D' : 'ddd D'),
                value: Number(slice.reduce((a, t) => a + t.revenue, 0).toFixed(2)),
                orders: slice.reduce((a, t) => a + t.orders, 0),
            });
        }
        return out;
    }, [data]);

    const maxBucket = useMemo(() => {
        if (!buckets.length) return 0;
        let mi = 0;
        buckets.forEach((b, i) => { if (b.value > buckets[mi].value) mi = i; });
        return mi;
    }, [buckets]);
    const activeBar = hoverBar ?? pinnedBar ?? maxBucket;

    const revenueDelta = deltaPct(s?.total_revenue ?? 0, ps?.total_revenue ?? 0);
    const avgPerDay = s ? s.total_revenue / spanDays : 0;
    const avgOrderValue = s && s.total_orders > 0 ? fmtShort(s.total_revenue / s.total_orders) : '—';

    // ── Plan distribution ──────────────────────────────────────────────────────
    const planData = PLAN_ORDER.map((plan, i) => {
        const found = (data?.plan_distribution ?? []).find(p => p.plan === plan);
        return {
            name:  plan.charAt(0) + plan.slice(1).toLowerCase(),
            count: found?.count ?? 0,
            color: PIE_PALETTE[i],
        };
    }).filter(p => p.count > 0);

    // ── Top orgs (ranked list) ─────────────────────────────────────────────────
    const topOrgs = (data?.org_metrics ?? []).slice(0, 7).map(o => ({
        name:    o.org_name.length > 20 ? o.org_name.slice(0, 18) + '…' : o.org_name,
        revenue: Number(o.total_revenue.toFixed(2)),
        orders:  o.total_orders,
    }));

    const periodControls = (
        <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={onPeriodChange}>
                <SelectTrigger className="h-9 w-[168px]">
                    <CalendarDays className="text-muted-foreground mr-1 size-4" />
                    <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                    {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
            </Select>
            {period === 'custom' && (
                <DatePicker.RangePicker
                    value={customRange}
                    onChange={d => { if (d?.[0] && d?.[1]) setCustomRange([d[0], d[1]]); }}
                    format="DD MMM YYYY"
                    allowClear={false}
                    disabledDate={d => !!d && d.isAfter(dayjs(), 'day')}
                    className="h-9"
                />
            )}
            <Button
                variant="outline"
                size="icon"
                className="size-9"
                onClick={() => { load(startStr, endStr); loadHealthAndUsers(); }}
                aria-label="Refresh dashboard"
            >
                <RefreshCcw className={cn('size-4', loading && 'animate-spin')} />
            </Button>
        </div>
    );

    return (
        <div className="flex flex-col gap-6">
            {/* ── Greeting ───────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-h2 text-foreground flex items-center gap-2">
                        Platform overview
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
                        Revenue, orders and system health across every organization on Paynest.
                    </p>
                </div>
                {periodControls}
            </div>

            {/* ── KPI row ────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard icon={DollarSign} loading={loading} label="Platform revenue"
                    value={s ? fmtShort(s.total_revenue) : '—'} pct={revenueDelta} spark={revSpark} tone="primary" />
                <KpiCard icon={ShoppingCart} loading={loading} label="Orders"
                    value={s ? s.total_orders.toLocaleString() : '—'}
                    pct={deltaPct(s?.total_orders ?? 0, ps?.total_orders ?? 0)} spark={ordSpark} tone="info" />
                <KpiCard icon={Building2} loading={loading} label="Organizations"
                    value={s ? s.total_organizations.toLocaleString() : '—'}
                    pct={deltaPct(s?.new_orgs_in_period ?? 0, ps?.new_orgs_in_period ?? 0)}
                    sub={s ? `${s.active_organizations} active · +${s.new_orgs_in_period} new` : 'new orgs vs prev'}
                    tone="success" />
                <KpiCard icon={Users} loading={loading} label="Users"
                    value={s ? s.total_users.toLocaleString() : '—'}
                    pct={deltaPct(s?.new_users_in_period ?? 0, ps?.new_users_in_period ?? 0)}
                    sub={s ? `${s.active_users} active · +${s.new_users_in_period} new` : 'new users vs prev'}
                    tone="primary" />
            </div>

            {/* ── Quick facts ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { icon: Store, label: 'Total shops', value: s ? s.total_shops.toLocaleString() : '—' },
                    { icon: ShoppingCart, label: 'Avg order value', value: avgOrderValue },
                    { icon: Building2, label: 'Avg revenue / org', value: s && s.active_organizations > 0 ? fmtShort(s.total_revenue / s.active_organizations) : '—' },
                    { icon: Users, label: 'Avg users / org', value: s && s.total_organizations > 0 ? (s.total_users / s.total_organizations).toFixed(1) : '—' },
                ].map(({ icon: Icon, label, value }) => (
                    <Card key={label} className="flex flex-row items-center gap-3 p-4">
                        <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                            <Icon className="text-muted-foreground size-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-muted-foreground truncate text-xs">{label}</p>
                            {loading
                                ? <Skeleton className="mt-1 h-5 w-16" />
                                : <p className="text-foreground num-tabular truncate text-base font-bold">{value}</p>}
                        </div>
                    </Card>
                ))}
            </div>

            {/* ── Interactive revenue overview ───────────────────────────────── */}
            <Card className="gap-0 overflow-hidden p-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-foreground text-sm font-semibold">Revenue overview</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">Avg per day</p>
                        <div className="mt-1.5 flex items-center gap-2">
                            {loading ? <Skeleton className="h-8 w-32" /> : (
                                <span className="text-foreground text-2xl font-bold tracking-tight num-tabular">{fmtShort(avgPerDay)}</span>
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
                    <Select value={period} onValueChange={onPeriodChange}>
                        <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent align="end">
                            {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="mt-4 h-64" onMouseLeave={() => setHoverBar(null)}>
                    {loading ? (
                        <Skeleton className="h-full w-full rounded-lg" />
                    ) : buckets.length === 0 ? (
                        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No revenue in this period</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={buckets} margin={{ top: 24, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
                                <defs>
                                    <pattern id="saBarHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                                        <rect width="6" height="6" fill="var(--muted)" />
                                        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--border)" strokeWidth="3" />
                                    </pattern>
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="label" tickLine={false} axisLine={false}
                                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} interval="preserveStartEnd" />
                                <Tooltip cursor={false} isAnimationActive={false} content={<OverviewTip />} />
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

            {/* ── Secondary row: Plan donut · Daily orders · Top orgs ────────── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

                {/* Plan Distribution donut */}
                <Card className="gap-0 overflow-hidden p-0">
                    <CardHeader className="border-b px-5 py-4">
                        <CardTitle className="text-sm font-semibold">Plan Distribution</CardTitle>
                        <CardDescription className="text-xs">Organizations by subscription tier</CardDescription>
                    </CardHeader>
                    <CardContent className="px-5 py-4">
                        {loading ? (
                            <Skeleton className="h-52 w-full rounded-xl" />
                        ) : planData.length === 0 ? (
                            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                                No data
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="h-44">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={planData}
                                                cx="50%" cy="50%"
                                                innerRadius={48} outerRadius={72}
                                                paddingAngle={3}
                                                dataKey="count"
                                                nameKey="name"
                                                startAngle={90}
                                                endAngle={-270}
                                            >
                                                {planData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<PieTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {planData.map((p, i) => (
                                        <span
                                            key={i}
                                            className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize', PLAN_BADGE[p.name.toLowerCase()])}
                                        >
                                            {p.name} · {p.count}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Daily Orders bar */}
                <Card className="gap-0 overflow-hidden p-0">
                    <CardHeader className="border-b px-5 py-4">
                        <CardTitle className="text-sm font-semibold">Daily Orders</CardTitle>
                        <CardDescription className="text-xs">Total orders processed per day</CardDescription>
                    </CardHeader>
                    <CardContent className="px-5 py-4">
                        {loading ? (
                            <Skeleton className="h-52 w-full rounded-xl" />
                        ) : visibleTrend.length === 0 ? (
                            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                                No data for this period
                            </div>
                        ) : (
                            <div className="h-52">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={visibleTrend}
                                        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                                        barSize={range <= 14 ? 18 : range <= 30 ? 9 : 5}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                        <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                        <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
                                        <Bar dataKey="orders" fill={CHART_INFO} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Top orgs ranked list */}
                <TopOrgsList orgs={topOrgs} loading={loading} />
            </div>

            {/* ── System Health ───────────────────────────────────────────────── */}
            <SystemHealthCard health={health} loading={healthLoading} />

            {/* ── Top Products + Advanced Metrics ─────────────────────────────── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <TopProductsCard products={topProducts} loading={productsLoading} />
                </div>
                <AdvancedMetrics data={data} loading={loading} />
            </div>

            {/* ── Users Without Employee Profile ───────────────────────────────── */}
            <UsersWithoutProfileCard users={usersNoProfile} loading={usersLoading} />

            {/* ── Organization Leaderboard ────────────────────────────────────── */}
            {!loading && (data?.org_metrics ?? []).length > 0 && (
                <OrgLeaderboard orgs={data!.org_metrics} />
            )}

            {/* ── Empty state ─────────────────────────────────────────────────── */}
            {!loading && !data && (
                <Card className="py-16 p-0">
                    <CardContent className="flex flex-col items-center gap-3 text-center">
                        <div className="bg-muted flex size-14 items-center justify-center rounded-full">
                            <Activity className="text-muted-foreground size-7" />
                        </div>
                        <div>
                            <p className="text-foreground font-medium">No platform data yet</p>
                            <p className="text-muted-foreground text-sm mt-1">
                                Data will appear once organizations are onboarded and orders are placed.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

// ─── Organization Leaderboard table ───────────────────────────────────────────
function OrgLeaderboard({ orgs }: { orgs: OrgMetrics[] }) {
    return (
        <Card className="gap-0 overflow-hidden p-0">
            <CardHeader className="border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="size-7 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                                <Medal className="size-3.5 text-warning-foreground" />
                            </div>
                            <CardTitle className="text-sm font-semibold">Organization Leaderboard</CardTitle>
                        </div>
                        <CardDescription className="text-xs mt-1 ml-9">
                            All organizations ranked by revenue in the selected period
                        </CardDescription>
                    </div>
                    <Link
                        href="/organizations"
                        className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium transition-colors"
                    >
                        Manage orgs <ArrowUpRight className="size-3" />
                    </Link>
                </div>
            </CardHeader>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-8 text-center">#</TableHead>
                            <TableHead>Organization</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                            <TableHead className="text-right">Shops</TableHead>
                            <TableHead className="text-right">Users</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Joined</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orgs.map((org, i) => (
                            <TableRow
                                key={org.org_id}
                                className="transition-colors hover:bg-muted/40"
                            >
                                <TableCell className="text-center">
                                    <span className={cn(
                                        'inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold',
                                        i === 0 ? 'bg-warning/10 text-warning-foreground' :
                                        i === 1 ? 'bg-muted-foreground/10 text-muted-foreground' :
                                        i === 2 ? 'bg-primary/10 text-primary' :
                                        'text-muted-foreground',
                                    )}>
                                        {i + 1}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2.5">
                                        <div className="bg-primary/10 flex size-8 shrink-0 items-center justify-center rounded-lg">
                                            <Building2 className="text-primary size-3.5" />
                                        </div>
                                        <span className="text-foreground font-medium text-sm">{org.org_name}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        className={cn('capitalize rounded-full text-xs font-medium', PLAN_BADGE[org.plan_type?.toLowerCase()])}
                                    >
                                        {org.plan_type === 'ENTERPRISE' && <BadgeCheck className="size-3 mr-1" />}
                                        {org.plan_type?.toLowerCase()}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <p className="text-success num-tabular font-semibold text-sm">
                                        {fmt(org.total_revenue)}
                                    </p>
                                </TableCell>
                                <TableCell className="text-right num-tabular font-medium text-sm">
                                    {org.total_orders.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right num-tabular font-medium text-sm">
                                    {org.total_shops}
                                </TableCell>
                                <TableCell className="text-right num-tabular font-medium text-sm">
                                    <span className="inline-flex items-center gap-1">
                                        <UserPlus className="size-3 text-muted-foreground" />
                                        {org.total_users}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {org.is_active ? (
                                        <span className="inline-flex items-center gap-1 text-success text-xs font-medium">
                                            <CheckCircle2 className="size-3.5" /> Active
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium">
                                            <XCircle className="size-3.5" /> Inactive
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                    {org.joined_at
                                        ? new Date(org.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : '—'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
}
