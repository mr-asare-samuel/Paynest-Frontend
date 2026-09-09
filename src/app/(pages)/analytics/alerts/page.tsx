"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Plus, MoreHorizontal, Pencil, Trash2, RefreshCcw, BellRing, FlaskConical, History, Power,
} from "lucide-react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import dayjs from "dayjs";
import PageHeader from "@/components/(shared-components)/PageHeader";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import { getOrganizationShops } from "@/(api-handlers)/organizationShopsHandler";
import {
    GetKpiAlerts, CreateKpiAlert, UpdateKpiAlert, DeleteKpiAlert,
    GetKpiAlertEvents, TestKpiAlert,
} from "@/(api-handlers)/analyticsHandler";
import { OrganizationShopResponse } from "@/interfaces/organizationShops";
import {
    KpiAlertRule, KpiAlertEvent, KpiMetric, KpiComparison, KpiWindow,
} from "@/interfaces/analytics";

const METRICS: { value: KpiMetric; label: string; money: boolean }[] = [
    { value: "revenue", label: "Revenue", money: true },
    { value: "gross_profit", label: "Gross profit", money: true },
    { value: "net_profit", label: "Net profit", money: true },
    { value: "orders_count", label: "Order count", money: false },
    { value: "avg_order_value", label: "Avg order value", money: true },
    { value: "discounts", label: "Discounts given", money: true },
    { value: "refunds", label: "Refunds", money: true },
    { value: "expenses_total", label: "Approved expenses", money: true },
    { value: "out_of_stock_count", label: "Out-of-stock products", money: false },
    { value: "low_stock_count", label: "Low-stock products", money: false },
    { value: "cash_discrepancy_abs", label: "Cash discrepancy (abs)", money: true },
];
const CMP: { value: KpiComparison; label: string }[] = [
    { value: "lt", label: "is below" },
    { value: "lte", label: "is at or below" },
    { value: "gt", label: "is above" },
    { value: "gte", label: "is at or above" },
];
const WINDOWS: { value: KpiWindow; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "last_7d", label: "Last 7 days" },
    { value: "last_30d", label: "Last 30 days" },
    { value: "mtd", label: "Month to date" },
    { value: "current", label: "Current snapshot" },
];
const metricMeta = (m: KpiMetric) => METRICS.find((x) => x.value === m)!;
const NO_SHOP = "__org__";

interface FormState {
    name: string;
    metric: KpiMetric;
    comparison: KpiComparison;
    threshold: string;
    window: KpiWindow;
    shop_id: string;
    channel_in_app: boolean;
    channel_email: boolean;
    cooldown_minutes: string;
    is_active: boolean;
}
const blank: FormState = {
    name: "", metric: "revenue", comparison: "lt", threshold: "",
    window: "today", shop_id: NO_SHOP, channel_in_app: true, channel_email: false,
    cooldown_minutes: "720", is_active: true,
};

export default function KpiAlertsPage() {
    const fmt = useCurrency();
    const [rows, setRows] = useState<KpiAlertRule[]>([]);
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [loading, setLoading] = useState(true);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<KpiAlertRule | null>(null);
    const [form, setForm] = useState<FormState>(blank);
    const [submitting, setSubmitting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<KpiAlertRule | null>(null);

    const [eventsFor, setEventsFor] = useState<KpiAlertRule | null>(null);
    const [events, setEvents] = useState<KpiAlertEvent[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            setRows(await GetKpiAlerts());
        } catch (e) {
            handleErrorMessage(e, "Failed to load alert rules");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); getOrganizationShops().then(setShops).catch(() => setShops([])); }, []);

    const shopName = (id: number | null) => (id == null ? "Organization" : shops.find((s) => s.id === id)?.name ?? `Shop #${id}`);

    const openCreate = () => { setEditing(null); setForm(blank); setDialogOpen(true); };
    const openEdit = (r: KpiAlertRule) => {
        setEditing(r);
        setForm({
            name: r.name, metric: r.metric, comparison: r.comparison, threshold: String(r.threshold),
            window: r.window, shop_id: r.shop_id != null ? String(r.shop_id) : NO_SHOP,
            channel_in_app: r.channels.includes("in_app"), channel_email: r.channels.includes("email"),
            cooldown_minutes: String(r.cooldown_minutes), is_active: r.is_active,
        });
        setDialogOpen(true);
    };

    const submit = async () => {
        if (!form.name.trim()) return toast.error("Give the rule a name");
        if (form.threshold.trim() === "" || Number.isNaN(Number(form.threshold))) return toast.error("Enter a numeric threshold");
        const channels = [
            ...(form.channel_in_app ? ["in_app"] : []),
            ...(form.channel_email ? ["email"] : []),
        ];
        if (channels.length === 0) return toast.error("Pick at least one channel");
        const payload = {
            name: form.name.trim(),
            metric: form.metric,
            comparison: form.comparison,
            threshold: Number(form.threshold),
            window: form.window,
            shop_id: form.shop_id === NO_SHOP ? null : Number(form.shop_id),
            channels,
            cooldown_minutes: Number(form.cooldown_minutes) || 0,
            is_active: form.is_active,
        };
        setSubmitting(true);
        try {
            if (editing) { await UpdateKpiAlert(editing.id, payload); toast.success("Rule updated"); }
            else { await CreateKpiAlert(payload); toast.success("Rule created"); }
            setDialogOpen(false);
            load();
        } catch (e) {
            handleErrorMessage(e, "Failed to save rule");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (r: KpiAlertRule) => {
        try { await UpdateKpiAlert(r.id, { is_active: !r.is_active }); load(); }
        catch (e) { handleErrorMessage(e, "Failed"); }
    };
    const remove = async () => {
        if (!deleteTarget) return;
        try { await DeleteKpiAlert(deleteTarget.id); toast.success("Rule deleted"); setDeleteTarget(null); load(); }
        catch (e) { handleErrorMessage(e, "Failed to delete"); }
    };
    const runTest = async (r: KpiAlertRule) => {
        try {
            const res = await TestKpiAlert(r.id);
            const meta = metricMeta(r.metric);
            const v = meta.money ? fmt(res.observed_value) : res.observed_value.toLocaleString();
            const th = meta.money ? fmt(res.threshold) : res.threshold.toLocaleString();
            toast[res.breached ? "warning" : "success"](
                res.breached ? `Breached: ${v} vs threshold ${th}` : `OK: ${v} (threshold ${th})`,
            );
        } catch (e) {
            handleErrorMessage(e, "Test failed");
        }
    };
    const openEvents = async (r: KpiAlertRule) => {
        setEventsFor(r);
        setEventsLoading(true);
        try { setEvents(await GetKpiAlertEvents(r.id, 50)); }
        catch (e) { handleErrorMessage(e, "Failed to load events"); }
        finally { setEventsLoading(false); }
    };

    const fmtThreshold = (r: KpiAlertRule) =>
        metricMeta(r.metric).money ? fmt(r.threshold) : r.threshold.toLocaleString();

    const activeCount = useMemo(() => rows.filter((r) => r.is_active).length, [rows]);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="KPI Alerts"
                description="Get notified when a metric crosses a threshold. Evaluated on the reporting scheduler tick."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-9" onClick={load} disabled={loading} aria-label="Refresh">
                            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                        <Button onClick={openCreate}><Plus className="mr-2 size-4" /> New Rule</Button>
                    </div>
                }
            />

            <Card className="gap-0 overflow-hidden p-0">
                <div className="border-border bg-muted/30 flex items-center gap-2 border-b px-5 py-2.5 text-xs">
                    <BellRing className="text-muted-foreground size-3.5" />
                    <span className="text-muted-foreground">{rows.length} rule{rows.length !== 1 ? "s" : ""} · {activeCount} active</span>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Rule</TableHead>
                                <TableHead>Condition</TableHead>
                                <TableHead>Window</TableHead>
                                <TableHead>Scope</TableHead>
                                <TableHead>Last value</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[60px] pr-6 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-muted-foreground py-16 text-center text-sm">
                                        No alert rules yet. Create one — e.g. &ldquo;Revenue is below 500 today&rdquo;.
                                    </TableCell>
                                </TableRow>
                            ) : rows.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell className="pl-6">
                                        <p className="text-foreground font-medium">{r.name}</p>
                                        <p className="text-muted-foreground text-xs">{metricMeta(r.metric).label}</p>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {CMP.find((c) => c.value === r.comparison)?.label}{" "}
                                        <span className="text-foreground num-tabular font-semibold">{fmtThreshold(r)}</span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {WINDOWS.find((w) => w.value === r.window)?.label}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{shopName(r.shop_id)}</TableCell>
                                    <TableCell className="text-sm">
                                        {r.last_value != null ? (
                                            <>
                                                <span className="num-tabular">{metricMeta(r.metric).money ? fmt(r.last_value) : r.last_value.toLocaleString()}</span>
                                                {r.last_triggered_at && (
                                                    <p className="text-muted-foreground text-[10px]">
                                                        fired {dayjs(r.last_triggered_at).format("MMM D, HH:mm")}
                                                    </p>
                                                )}
                                            </>
                                        ) : <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "rounded-full text-xs",
                                            r.is_active ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground",
                                        )}>
                                            {r.is_active ? "Active" : "Paused"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${r.name}`}>
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-44">
                                                <DropdownMenuItem onClick={() => runTest(r)}><FlaskConical className="size-4" /> Test now</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openEvents(r)}><History className="size-4" /> View events</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openEdit(r)}><Pencil className="size-4" /> Edit</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => toggleActive(r)}>
                                                    <Power className="size-4" /> {r.is_active ? "Pause" : "Activate"}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(r)}>
                                                    <Trash2 className="size-4" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Create / edit */}
            <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit alert rule" : "New alert rule"}</DialogTitle>
                        <DialogDescription>Notify org admins &amp; managers when the condition is met.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-1">
                        <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Low revenue day" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Metric</Label>
                                <Select value={form.metric} onValueChange={(v) => setForm({ ...form, metric: v as KpiMetric })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{METRICS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Window</Label>
                                <Select value={form.window} onValueChange={(v) => setForm({ ...form, window: v as KpiWindow })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{WINDOWS.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Condition</Label>
                                <Select value={form.comparison} onValueChange={(v) => setForm({ ...form, comparison: v as KpiComparison })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{CMP.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Threshold</Label>
                                <Input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} placeholder="0" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Scope</Label>
                                <Select value={form.shop_id} onValueChange={(v) => setForm({ ...form, shop_id: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NO_SHOP}>Whole organization</SelectItem>
                                        {shops.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Cooldown (min)</Label>
                                <Input type="number" value={form.cooldown_minutes} onChange={(e) => setForm({ ...form, cooldown_minutes: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Notify via</Label>
                            <div className="flex items-center gap-5">
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox checked={form.channel_in_app} onCheckedChange={(c) => setForm({ ...form, channel_in_app: !!c })} /> In-app
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox checked={form.channel_email} onCheckedChange={(c) => setForm({ ...form, channel_email: !!c })} /> Email
                                </label>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Active</Label>
                            <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={submit} disabled={submitting}>{submitting ? "Saving…" : editing ? "Save" : "Create"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Events */}
            <Dialog open={!!eventsFor} onOpenChange={(o) => !o && setEventsFor(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Alert history — {eventsFor?.name}</DialogTitle>
                        <DialogDescription>Every time this rule fired.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[50vh]">
                        {eventsLoading ? (
                            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
                        ) : events.length === 0 ? (
                            <p className="text-muted-foreground py-8 text-center text-sm">This rule has never fired.</p>
                        ) : (
                            <ul className="divide-border/70 divide-y">
                                {events.map((ev) => (
                                    <li key={ev.id} className="py-3">
                                        <p className="text-foreground text-sm">{ev.message}</p>
                                        <p className="text-muted-foreground mt-0.5 text-[11px]">{dayjs(ev.created_at).format("MMM D, YYYY HH:mm")}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* Delete */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete alert rule?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>{deleteTarget?.name}</strong> and its event history will be removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={remove}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
