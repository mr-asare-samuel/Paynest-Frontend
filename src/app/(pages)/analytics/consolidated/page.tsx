"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCcw, Download, Building2, TrendingUp, AlertTriangle } from "lucide-react";
import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import PageHeader from "@/components/(shared-components)/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { GetConsolidated } from "@/(api-handlers)/analyticsHandler";
import { ConsolidatedReport, ConsolidatedShopRow } from "@/interfaces/analytics";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import { downloadCsv } from "@/lib/exportCsv";
import { cn } from "@/lib/utils";

export default function ConsolidatedPage() {
    const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, "day"), dayjs()]);
    const [data, setData] = useState<ConsolidatedReport | null>(null);
    const [loading, setLoading] = useState(true);

    const startStr = range[0].format("YYYY-MM-DD");
    const endStr = range[1].format("YYYY-MM-DD");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await GetConsolidated({ start: startStr, end: endStr }));
        } catch (e) {
            handleErrorMessage(e, "Failed to load consolidated report");
        } finally {
            setLoading(false);
        }
    }, [startStr, endStr]);

    useEffect(() => { load(); }, [load]);

    const cur = data?.currency ?? "GHS";
    const money = (n: number) => `${cur} ${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const exportCsv = () => {
        if (!data) return;
        const rows = [...data.shops, data.totals].map((r) => ({
            Shop: r.shop_name,
            Orders: r.orders,
            "Paid orders": r.paid_orders,
            Revenue: r.revenue,
            COGS: r.cogs,
            "Gross profit": r.gross_profit,
            Expenses: r.expenses,
            "Net profit": r.net_profit,
            "Avg order value": r.avg_order_value,
            "Inventory value": r.inventory_value,
            "Out of stock": r.out_of_stock,
            "Low stock": r.low_stock,
            "Cash discrepancy": r.cash_discrepancy_abs,
            Closures: r.closures,
        }));
        downloadCsv(`consolidated-${startStr}_to_${endStr}.csv`, rows);
    };

    const t = data?.totals;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Consolidated Report"
                description="Every metric, broken down by shop, side by side."
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <DatePicker.RangePicker
                            value={range}
                            onChange={(d) => { if (d?.[0] && d?.[1]) setRange([d[0], d[1]]); }}
                            format="DD MMM YYYY"
                            allowClear={false}
                            disabledDate={(d) => !!d && d.isAfter(dayjs(), "day")}
                            className="h-9"
                        />
                        <Button variant="outline" size="icon" className="size-9" onClick={load} disabled={loading} aria-label="Refresh">
                            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                        <Button variant="outline" onClick={exportCsv} disabled={!data}>
                            <Download className="mr-2 size-4" /> CSV
                        </Button>
                    </div>
                }
            />

            {/* summary strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { icon: Building2, label: "Shops", value: data ? String(data.shops.length) : "—" },
                    { icon: TrendingUp, label: "Total revenue", value: t ? money(t.revenue) : "—" },
                    { icon: TrendingUp, label: "Net profit", value: t ? money(t.net_profit) : "—" },
                    { icon: AlertTriangle, label: "Out of stock", value: t ? String(t.out_of_stock) : "—" },
                ].map(({ icon: Icon, label, value }) => (
                    <Card key={label} className="flex flex-row items-center gap-3 p-4">
                        <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                            <Icon className="text-muted-foreground size-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-muted-foreground truncate text-xs">{label}</p>
                            {loading ? <Skeleton className="mt-1 h-5 w-16" />
                                : <p className="text-foreground num-tabular truncate text-base font-bold">{value}</p>}
                        </div>
                    </Card>
                ))}
            </div>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Shop</TableHead>
                                <TableHead className="text-right">Orders</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                                <TableHead className="text-right">COGS</TableHead>
                                <TableHead className="text-right">Gross profit</TableHead>
                                <TableHead className="text-right">Expenses</TableHead>
                                <TableHead className="text-right">Net profit</TableHead>
                                <TableHead className="text-right">AOV</TableHead>
                                <TableHead className="text-right">Inv. value</TableHead>
                                <TableHead className="pr-6 text-right">Out / Low</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 10 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : !data || data.shops.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-muted-foreground py-16 text-center text-sm">
                                        No shop activity in this period.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {data.shops.map((r: ConsolidatedShopRow) => (
                                        <TableRow key={r.shop_id}>
                                            <TableCell className="text-foreground pl-6 font-medium">{r.shop_name}</TableCell>
                                            <TableCell className="num-tabular text-right">{r.orders.toLocaleString()}</TableCell>
                                            <TableCell className="num-tabular text-right">{money(r.revenue)}</TableCell>
                                            <TableCell className="num-tabular text-muted-foreground text-right">{money(r.cogs)}</TableCell>
                                            <TableCell className="num-tabular text-right font-medium">{money(r.gross_profit)}</TableCell>
                                            <TableCell className="num-tabular text-muted-foreground text-right">{money(r.expenses)}</TableCell>
                                            <TableCell className={cn("num-tabular text-right font-semibold", r.net_profit < 0 ? "text-destructive" : "text-success")}>{money(r.net_profit)}</TableCell>
                                            <TableCell className="num-tabular text-right">{money(r.avg_order_value)}</TableCell>
                                            <TableCell className="num-tabular text-muted-foreground text-right">{money(r.inventory_value)}</TableCell>
                                            <TableCell className="pr-6 text-right">
                                                <span className={cn(r.out_of_stock > 0 && "text-destructive font-semibold")}>{r.out_of_stock}</span>
                                                <span className="text-muted-foreground"> / </span>
                                                <span className={cn(r.low_stock > 0 && "text-warning-foreground")}>{r.low_stock}</span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {t && (
                                        <TableRow className="bg-muted/40 font-semibold">
                                            <TableCell className="pl-6">{t.shop_name}</TableCell>
                                            <TableCell className="num-tabular text-right">{t.orders.toLocaleString()}</TableCell>
                                            <TableCell className="num-tabular text-right">{money(t.revenue)}</TableCell>
                                            <TableCell className="num-tabular text-right">{money(t.cogs)}</TableCell>
                                            <TableCell className="num-tabular text-right">{money(t.gross_profit)}</TableCell>
                                            <TableCell className="num-tabular text-right">{money(t.expenses)}</TableCell>
                                            <TableCell className={cn("num-tabular text-right", t.net_profit < 0 ? "text-destructive" : "text-success")}>{money(t.net_profit)}</TableCell>
                                            <TableCell className="num-tabular text-right">{money(t.avg_order_value)}</TableCell>
                                            <TableCell className="num-tabular text-right">{money(t.inventory_value)}</TableCell>
                                            <TableCell className="pr-6 text-right">{t.out_of_stock} / {t.low_stock}</TableCell>
                                        </TableRow>
                                    )}
                                </>
                            )}
                        </TableBody>
                    </Table>
                </div>
                {data && (
                    <div className="border-border bg-muted/30 text-muted-foreground border-t px-6 py-3 text-xs">
                        {data.period_start} to {data.period_end} · cash discrepancy total {money(data.totals.cash_discrepancy_abs)} across {data.totals.closures} closures
                    </div>
                )}
            </Card>
        </div>
    );
}
