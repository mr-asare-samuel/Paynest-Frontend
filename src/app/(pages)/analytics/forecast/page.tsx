"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { RefreshCcw, TrendingUp, TrendingDown, PackageX } from "lucide-react";
import PageHeader from "@/components/(shared-components)/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getOrganizationShops } from "@/(api-handlers)/organizationShopsHandler";
import { GetSalesForecast, GetStockoutForecast } from "@/(api-handlers)/analyticsHandler";
import { OrganizationShopResponse } from "@/interfaces/organizationShops";
import { SalesForecast, StockoutForecast } from "@/interfaces/analytics";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import { useCurrency } from "@/hooks/useCurrency";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const ComposedChart = dynamic(() => import("recharts").then((m) => m.ComposedChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ReferenceLine = dynamic(() => import("recharts").then((m) => m.ReferenceLine), { ssr: false });

const SHOP_ALL = "all";

export default function ForecastPage() {
    const fmt = useCurrency();
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [shopId, setShopId] = useState(SHOP_ALL);

    const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
    const [lookback, setLookback] = useState("90");
    const [horizon, setHorizon] = useState("14");
    const [sales, setSales] = useState<SalesForecast | null>(null);
    const [salesLoading, setSalesLoading] = useState(true);

    const [soLookback, setSoLookback] = useState("30");
    const [stockouts, setStockouts] = useState<StockoutForecast | null>(null);
    const [soLoading, setSoLoading] = useState(true);

    useEffect(() => { getOrganizationShops().then(setShops).catch(() => setShops([])); }, []);

    const shopParam = shopId === SHOP_ALL ? undefined : Number(shopId);

    const loadSales = useCallback(async () => {
        setSalesLoading(true);
        try {
            setSales(await GetSalesForecast({
                metric, lookback: Number(lookback), horizon: Number(horizon), shop_id: shopParam,
            }));
        } catch (e) {
            handleErrorMessage(e, "Failed to load sales forecast");
        } finally {
            setSalesLoading(false);
        }
    }, [metric, lookback, horizon, shopParam]);

    const loadStockouts = useCallback(async () => {
        setSoLoading(true);
        try {
            setStockouts(await GetStockoutForecast({ lookback: Number(soLookback), shop_id: shopParam, limit: 100 }));
        } catch (e) {
            handleErrorMessage(e, "Failed to load stockout forecast");
        } finally {
            setSoLoading(false);
        }
    }, [soLookback, shopParam]);

    useEffect(() => { loadSales(); }, [loadSales]);
    useEffect(() => { loadStockouts(); }, [loadStockouts]);

    const chartData = useMemo(() => {
        if (!sales) return [];
        type Row = { date: string; actual?: number; forecast?: number; lower?: number; upper?: number };
        const hist: Row[] = sales.history.map((p) => ({ date: p.date, actual: p.value }));
        const fc: Row[] = sales.forecast.map((p) => ({ date: p.date, forecast: p.value, lower: p.lower, upper: p.upper }));
        // bridge the two lines at the seam so there's no visual gap
        if (hist.length && fc.length) fc[0].actual = hist[hist.length - 1].actual;
        return [...hist, ...fc];
    }, [sales]);

    const seamDate = sales?.history_end;
    const isMoney = metric === "revenue";
    const fmtVal = (n: number) => (isMoney ? fmt(n) : Math.round(n).toLocaleString());
    const s = sales?.summary;
    const changePct = s?.projected_change_pct ?? null;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Forecasting"
                description="Projected sales and per-product days-to-stockout from recent trends."
                actions={
                    <Select value={shopId} onValueChange={setShopId}>
                        <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="All shops" /></SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value={SHOP_ALL}>All shops</SelectItem>
                            {shops.map((sh) => <SelectItem key={sh.id} value={String(sh.id)}>{sh.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                }
            />

            {/* ── Sales forecast ─────────────────────────────────────── */}
            <Card className="gap-0 overflow-hidden p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-foreground text-sm font-semibold">Sales forecast</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                            {sales ? `${sales.method} · next ${sales.horizon_days} days from ${sales.lookback_days}-day history` : "…"}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={metric} onValueChange={(v) => setMetric(v as "revenue" | "orders")}>
                            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent align="end">
                                <SelectItem value="revenue">Revenue</SelectItem>
                                <SelectItem value="orders">Orders</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={lookback} onValueChange={setLookback}>
                            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent align="end">
                                {["30", "60", "90", "180", "365"].map((d) => <SelectItem key={d} value={d}>{d}d history</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={horizon} onValueChange={setHorizon}>
                            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent align="end">
                                {["7", "14", "30", "60", "90"].map((d) => <SelectItem key={d} value={d}>{d}d ahead</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" className="size-8" onClick={loadSales} disabled={salesLoading} aria-label="Refresh">
                            <RefreshCcw className={cn("size-4", salesLoading && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                {/* summary numbers */}
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                        { label: "Recent daily avg", value: s ? fmtVal(s.recent_daily_avg) : "—" },
                        { label: "Forecast daily avg", value: s ? fmtVal(s.forecast_daily_avg) : "—" },
                        { label: `Forecast total (${horizon}d)`, value: s ? fmtVal(s.forecast_total) : "—" },
                        { label: "Projected change", value: null },
                    ].map(({ label, value }) => (
                        <div key={label}>
                            <p className="text-muted-foreground text-xs">{label}</p>
                            {salesLoading ? <Skeleton className="mt-1 h-6 w-20" /> : value !== null ? (
                                <p className="text-foreground num-tabular text-lg font-bold">{value}</p>
                            ) : changePct === null ? (
                                <p className="text-muted-foreground text-lg font-bold">—</p>
                            ) : (
                                <p className={cn("inline-flex items-center gap-1 text-lg font-bold", changePct >= 0 ? "text-success" : "text-destructive")}>
                                    {changePct >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                                    {changePct > 0 ? "+" : ""}{changePct.toFixed(1)}%
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-4 h-72">
                    {salesLoading ? (
                        <Skeleton className="h-full w-full rounded-lg" />
                    ) : chartData.length < 2 ? (
                        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Not enough history to forecast</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="fcBand" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--info)" stopOpacity={0.18} />
                                        <stop offset="100%" stopColor="var(--info)" stopOpacity={0.04} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="date" tickLine={false} axisLine={false}
                                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                    tickFormatter={(d) => dayjs(d).format("MMM D")} minTickGap={28} />
                                <YAxis tickLine={false} axisLine={false} width={56}
                                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                    tickFormatter={(v) => (isMoney && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v)))} />
                                <Tooltip
                                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, background: "var(--card)" }}
                                    labelFormatter={(d) => dayjs(d as string).format("ddd, MMM D")}
                                    formatter={((v: unknown) => fmtVal(Number(v))) as never}
                                />
                                {seamDate && <ReferenceLine x={seamDate} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
                                <Area type="monotone"
                                    dataKey={((d: unknown) => {
                                        const r = d as { lower?: number; upper?: number };
                                        return r.lower != null && r.upper != null ? [r.lower, r.upper] : null;
                                    }) as never}
                                    name="range" stroke="none" fill="url(#fcBand)" isAnimationActive={false} connectNulls />
                                <Line type="monotone" dataKey="actual" name="actual" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                                <Line type="monotone" dataKey="forecast" name="forecast" stroke="var(--info)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </Card>

            {/* ── Stockout forecast ──────────────────────────────────── */}
            <Card className="gap-0 overflow-hidden p-0">
                <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                    <div className="flex items-center gap-2">
                        <PackageX className="text-muted-foreground size-4" />
                        <p className="text-foreground text-sm font-semibold">Days to stockout</p>
                        {stockouts && (
                            <Badge className="bg-destructive/10 text-destructive border-transparent text-[11px]">
                                {stockouts.at_risk_count} at risk (≤14d)
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={soLookback} onValueChange={setSoLookback}>
                            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent align="end">
                                {["14", "30", "60", "90"].map((d) => <SelectItem key={d} value={d}>{d}d sales rate</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" className="size-8" onClick={loadStockouts} disabled={soLoading} aria-label="Refresh">
                            <RefreshCcw className={cn("size-4", soLoading && "animate-spin")} />
                        </Button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Product</TableHead>
                                <TableHead>Shop</TableHead>
                                <TableHead className="text-right">On hand</TableHead>
                                <TableHead className="text-right">Sales / day</TableHead>
                                <TableHead className="text-right">Days left</TableHead>
                                <TableHead>Stockout date</TableHead>
                                <TableHead className="pr-6 text-right">Reorder qty</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {soLoading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : !stockouts || stockouts.items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-muted-foreground py-14 text-center text-sm">
                                        No products with a measurable sales rate in this window.
                                    </TableCell>
                                </TableRow>
                            ) : stockouts.items.map((it) => {
                                const d = it.days_to_stockout;
                                const shop = shops.find((sh) => sh.id === it.shop_id)?.name ?? `Shop #${it.shop_id}`;
                                return (
                                    <TableRow key={`${it.product_id}-${it.shop_id}`}>
                                        <TableCell className="pl-6">
                                            <p className="text-foreground font-medium">{it.product_name}</p>
                                            <p className="text-muted-foreground font-mono text-[10px]">{it.sku}</p>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{shop}</TableCell>
                                        <TableCell className="num-tabular text-right">{it.current_stock}</TableCell>
                                        <TableCell className="num-tabular text-muted-foreground text-right">{it.daily_sales_rate.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">
                                            <span className={cn(
                                                "num-tabular font-semibold",
                                                d != null && d <= 7 ? "text-destructive" : d != null && d <= 14 ? "text-warning-foreground" : "text-foreground",
                                            )}>
                                                {d != null ? d.toFixed(1) : "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {it.projected_stockout_date ? dayjs(it.projected_stockout_date).format("MMM D, YYYY") : "—"}
                                        </TableCell>
                                        <TableCell className="num-tabular pr-6 text-right">{it.suggested_reorder_qty}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
                {stockouts && (
                    <div className="border-border bg-muted/30 text-muted-foreground border-t px-6 py-3 text-xs">
                        As of {dayjs(stockouts.as_of).format("MMM D, YYYY")} · rate from last {stockouts.lookback_days} days
                    </div>
                )}
            </Card>
        </div>
    );
}
