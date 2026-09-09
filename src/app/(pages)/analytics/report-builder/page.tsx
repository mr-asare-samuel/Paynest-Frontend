"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Plus, MoreHorizontal, Pencil, Trash2, RefreshCcw, Play, Download, X, Wrench,
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import PageHeader from "@/components/(shared-components)/PageHeader";
import { cn } from "@/lib/utils";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import { getOrganizationShops } from "@/(api-handlers)/organizationShopsHandler";
import { downloadReport } from "@/(api-handlers)/reportHandler";
import {
    GetDatasets, GetCustomReports, CreateCustomReport, UpdateCustomReport,
    DeleteCustomReport, RunCustomReport, ExportCustomReport,
} from "@/(api-handlers)/analyticsHandler";
import { OrganizationShopResponse } from "@/interfaces/organizationShops";
import {
    DatasetInfo, CustomReportDefinition, CustomReportResult,
    ReportDataset, ReportFilter, ReportAggregation, FilterOp, AggFn, FileFormat,
} from "@/interfaces/analytics";

const SHOP_ALL = "all";
const NEW_ROW: ReportAggregation = { field: "", fn: "sum", label: "" };

type Mode = "detail" | "grouped";

interface Builder {
    name: string;
    description: string;
    dataset: ReportDataset;
    mode: Mode;
    columns: string[];
    group_by: string[];
    aggregations: ReportAggregation[];
    filters: ReportFilter[];
    sortField: string;
    sortDir: "asc" | "desc";
    row_limit: string;
    default_range_days: string;
}
const emptyBuilder: Builder = {
    name: "", description: "", dataset: "orders", mode: "detail",
    columns: [], group_by: [], aggregations: [], filters: [],
    sortField: "", sortDir: "desc", row_limit: "1000", default_range_days: "30",
};

export default function ReportBuilderPage() {
    const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
    const [defs, setDefs] = useState<CustomReportDefinition[]>([]);
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [loading, setLoading] = useState(true);

    const [builderOpen, setBuilderOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [b, setB] = useState<Builder>(emptyBuilder);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<CustomReportDefinition | null>(null);

    const [runFor, setRunFor] = useState<CustomReportDefinition | null>(null);
    const [runRange, setRunRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, "day"), dayjs()]);
    const [runShop, setRunShop] = useState(SHOP_ALL);
    const [result, setResult] = useState<CustomReportResult | null>(null);
    const [running, setRunning] = useState(false);
    const [exporting, setExporting] = useState<FileFormat | null>(null);

    const loadDefs = async () => {
        setLoading(true);
        try { setDefs(await GetCustomReports()); }
        catch (e) { handleErrorMessage(e, "Failed to load reports"); }
        finally { setLoading(false); }
    };
    useEffect(() => {
        loadDefs();
        GetDatasets().then(setDatasets).catch((e) => handleErrorMessage(e, "Failed to load datasets"));
        getOrganizationShops().then(setShops).catch(() => setShops([]));
    }, []);

    const dsInfo = (name: ReportDataset) => datasets.find((d) => d.dataset === name);
    const currentDs = dsInfo(b.dataset);
    const allFields = currentDs?.fields ?? [];
    const aggFields = allFields.filter((f) => f.aggregatable);
    const ops: FilterOp[] = currentDs?.operators ?? ["eq", "ne", "gt", "gte", "lt", "lte", "in", "contains"];
    const aggFns: AggFn[] = currentDs?.aggregations ?? ["sum", "avg", "min", "max", "count"];

    const openNew = () => { setEditingId(null); setB(emptyBuilder); setBuilderOpen(true); };
    const openEdit = (d: CustomReportDefinition) => {
        setEditingId(d.id);
        setB({
            name: d.name, description: d.description ?? "", dataset: d.dataset,
            mode: d.group_by.length > 0 ? "grouped" : "detail",
            columns: d.columns, group_by: d.group_by, aggregations: d.aggregations,
            filters: d.filters, sortField: d.sort?.field ?? "", sortDir: d.sort?.dir ?? "desc",
            row_limit: String(d.row_limit), default_range_days: String(d.default_range_days),
        });
        setBuilderOpen(true);
    };

    const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

    const save = async () => {
        if (!b.name.trim()) return toast.error("Name the report");
        if (b.mode === "detail" && b.columns.length === 0) return toast.error("Pick at least one column");
        if (b.mode === "grouped" && (b.group_by.length === 0 || b.aggregations.filter((a) => a.field).length === 0))
            return toast.error("Grouped reports need a group-by and at least one aggregation");
        const payload = {
            name: b.name.trim(),
            description: b.description.trim() || null,
            dataset: b.dataset,
            columns: b.mode === "detail" ? b.columns : [],
            group_by: b.mode === "grouped" ? b.group_by : [],
            aggregations: b.mode === "grouped" ? b.aggregations.filter((a) => a.field).map((a) => ({
                field: a.field, fn: a.fn, label: a.label?.trim() || null,
            })) : [],
            filters: b.filters.filter((f) => f.field),
            sort: b.sortField ? { field: b.sortField, dir: b.sortDir } : null,
            row_limit: Math.max(1, Number(b.row_limit) || 1000),
            default_range_days: Math.max(1, Number(b.default_range_days) || 30),
        };
        setSaving(true);
        try {
            if (editingId) { await UpdateCustomReport(editingId, payload); toast.success("Report saved"); }
            else { await CreateCustomReport(payload); toast.success("Report created"); }
            setBuilderOpen(false);
            loadDefs();
        } catch (e) {
            handleErrorMessage(e, "Failed to save report");
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!deleteTarget) return;
        try { await DeleteCustomReport(deleteTarget.id); toast.success("Deleted"); setDeleteTarget(null); loadDefs(); }
        catch (e) { handleErrorMessage(e, "Failed to delete"); }
    };

    const openRun = (d: CustomReportDefinition) => {
        setRunFor(d);
        setResult(null);
        setRunRange([dayjs().subtract(d.default_range_days || 30, "day"), dayjs()]);
        setRunShop(SHOP_ALL);
    };
    const doRun = async () => {
        if (!runFor) return;
        setRunning(true);
        try {
            setResult(await RunCustomReport(runFor.id, {
                start: runRange[0].format("YYYY-MM-DD"),
                end: runRange[1].format("YYYY-MM-DD"),
                shop_id: runShop === SHOP_ALL ? undefined : Number(runShop),
            }));
        } catch (e) {
            handleErrorMessage(e, "Run failed");
        } finally {
            setRunning(false);
        }
    };
    const doExport = async (fmt: FileFormat) => {
        if (!runFor) return;
        setExporting(fmt);
        try {
            const rep = await ExportCustomReport(runFor.id, {
                file_format: fmt,
                start: runRange[0].format("YYYY-MM-DD"),
                end: runRange[1].format("YYYY-MM-DD"),
                shop_id: runShop === SHOP_ALL ? undefined : Number(runShop),
            });
            const ext = fmt === "excel" ? "xlsx" : fmt;
            await downloadReport(rep.id, `${runFor.name.replace(/\s+/g, "_")}.${ext}`);
        } catch (e) {
            handleErrorMessage(e, "Export failed");
        } finally {
            setExporting(null);
        }
    };

    const supportsDate = currentDs?.supports_date_range ?? true;
    const runSupportsDate = runFor ? (dsInfo(runFor.dataset)?.supports_date_range ?? true) : true;
    const runSupportsShop = runFor ? (dsInfo(runFor.dataset)?.supports_shop_filter ?? false) : false;

    const summaryEntries = useMemo(() => Object.entries(result?.summary ?? {}), [result]);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Report Builder"
                description="Build ad-hoc reports over your data — pick a dataset, columns, filters and grouping."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-9" onClick={loadDefs} disabled={loading} aria-label="Refresh">
                            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                        <Button onClick={openNew} disabled={datasets.length === 0}><Plus className="mr-2 size-4" /> New Report</Button>
                    </div>
                }
            />

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Report</TableHead>
                                <TableHead>Dataset</TableHead>
                                <TableHead>Shape</TableHead>
                                <TableHead>Updated</TableHead>
                                <TableHead className="w-[60px] pr-6 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 5 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : defs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-muted-foreground py-16 text-center text-sm">
                                        No saved reports yet.
                                    </TableCell>
                                </TableRow>
                            ) : defs.map((d) => (
                                <TableRow key={d.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => openRun(d)}>
                                    <TableCell className="pl-6">
                                        <p className="text-foreground font-medium">{d.name}</p>
                                        {d.description && <p className="text-muted-foreground truncate text-xs">{d.description}</p>}
                                    </TableCell>
                                    <TableCell><Badge variant="outline" className="rounded-full text-xs capitalize">{d.dataset.replace("_", " ")}</Badge></TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {d.group_by.length > 0
                                            ? `grouped by ${d.group_by.join(", ")} · ${d.aggregations.length} agg`
                                            : `${d.columns.length} columns`}
                                        {d.filters.length > 0 && ` · ${d.filters.length} filter${d.filters.length !== 1 ? "s" : ""}`}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {dayjs(d.updated_at ?? d.created_at).format("MMM D, YYYY")}
                                    </TableCell>
                                    <TableCell className="pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${d.name}`}>
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-40">
                                                <DropdownMenuItem onClick={() => openRun(d)}><Play className="size-4" /> Run</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openEdit(d)}><Pencil className="size-4" /> Edit</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(d)}>
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

            {/* ── Builder dialog ─────────────────────────────────────── */}
            <Dialog open={builderOpen} onOpenChange={(o) => !o && setBuilderOpen(false)}>
                <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit report" : "New report"}</DialogTitle>
                        <DialogDescription><Wrench className="mr-1 inline size-3.5" />Only whitelisted fields; values are always parameter-bound.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-1">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Name</Label>
                                <Input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder="Revenue by shop" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Dataset</Label>
                                <Select value={b.dataset} onValueChange={(v) => setB({ ...b, dataset: v as ReportDataset, columns: [], group_by: [], aggregations: [], filters: [], sortField: "" })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{datasets.map((d) => <SelectItem key={d.dataset} value={d.dataset}>{d.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Textarea rows={2} className="resize-none" value={b.description} onChange={(e) => setB({ ...b, description: e.target.value })} />
                        </div>

                        {/* mode */}
                        <div className="flex gap-0.5 rounded-lg border bg-muted/40 p-0.5">
                            {(["detail", "grouped"] as Mode[]).map((m) => (
                                <button key={m} onClick={() => setB({ ...b, mode: m })}
                                    className={cn("flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                                        b.mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                                    {m === "detail" ? "Detail rows" : "Grouped + aggregated"}
                                </button>
                            ))}
                        </div>

                        {b.mode === "detail" ? (
                            <div className="space-y-1.5">
                                <Label>Columns ({b.columns.length})</Label>
                                <div className="border-border grid max-h-44 grid-cols-2 gap-1 overflow-y-auto rounded-lg border p-2">
                                    {allFields.map((f) => (
                                        <label key={f.name} className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm">
                                            <Checkbox checked={b.columns.includes(f.name)} onCheckedChange={() => setB({ ...b, columns: toggleIn(b.columns, f.name) })} />
                                            <span className="truncate">{f.name}</span>
                                            <span className="text-muted-foreground ml-auto text-[10px]">{f.type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-1.5">
                                    <Label>Group by ({b.group_by.length})</Label>
                                    <div className="border-border grid max-h-32 grid-cols-2 gap-1 overflow-y-auto rounded-lg border p-2">
                                        {allFields.map((f) => (
                                            <label key={f.name} className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm">
                                                <Checkbox checked={b.group_by.includes(f.name)} onCheckedChange={() => setB({ ...b, group_by: toggleIn(b.group_by, f.name) })} />
                                                <span className="truncate">{f.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label>Aggregations</Label>
                                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setB({ ...b, aggregations: [...b.aggregations, { ...NEW_ROW }] })}>
                                            <Plus className="size-3.5" /> Add
                                        </Button>
                                    </div>
                                    {b.aggregations.length === 0 && <p className="text-muted-foreground text-xs">e.g. sum of total_amount, count of id.</p>}
                                    <div className="space-y-2">
                                        {b.aggregations.map((a, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <Select value={a.fn} onValueChange={(v) => setB({ ...b, aggregations: b.aggregations.map((x, j) => j === i ? { ...x, fn: v as AggFn } : x) })}>
                                                    <SelectTrigger className="h-8 w-[90px] text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{aggFns.map((fn) => <SelectItem key={fn} value={fn}>{fn}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <Select value={a.field || undefined} onValueChange={(v) => setB({ ...b, aggregations: b.aggregations.map((x, j) => j === i ? { ...x, field: v } : x) })}>
                                                    <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="field" /></SelectTrigger>
                                                    <SelectContent>{(a.fn === "count" ? allFields : aggFields).map((f) => <SelectItem key={f.name} value={f.name}>{f.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <Input className="h-8 w-28 text-xs" placeholder="label" value={a.label ?? ""}
                                                    onChange={(e) => setB({ ...b, aggregations: b.aggregations.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
                                                <Button variant="ghost" size="icon" className="size-8" onClick={() => setB({ ...b, aggregations: b.aggregations.filter((_, j) => j !== i) })}>
                                                    <X className="size-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* filters */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label>Filters</Label>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setB({ ...b, filters: [...b.filters, { field: "", op: "eq", value: "" }] })}>
                                    <Plus className="size-3.5" /> Add
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {b.filters.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <Select value={f.field || undefined} onValueChange={(v) => setB({ ...b, filters: b.filters.map((x, j) => j === i ? { ...x, field: v } : x) })}>
                                            <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="field" /></SelectTrigger>
                                            <SelectContent>{allFields.map((fld) => <SelectItem key={fld.name} value={fld.name}>{fld.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <Select value={f.op} onValueChange={(v) => setB({ ...b, filters: b.filters.map((x, j) => j === i ? { ...x, op: v as FilterOp } : x) })}>
                                            <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>{ops.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <Input className="h-8 flex-1 text-xs" placeholder="value" value={String(f.value ?? "")}
                                            onChange={(e) => setB({ ...b, filters: b.filters.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} />
                                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setB({ ...b, filters: b.filters.filter((_, j) => j !== i) })}>
                                            <X className="size-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Sort by</Label>
                                <div className="flex gap-2">
                                    <Select value={b.sortField || "none"} onValueChange={(v) => setB({ ...b, sortField: v === "none" ? "" : v })}>
                                        <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="—" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No sort</SelectItem>
                                            {(b.mode === "grouped"
                                                ? [...b.group_by, ...b.aggregations.filter((a) => a.field).map((a) => a.label?.trim() || `${a.fn}_${a.field}`)]
                                                : b.columns
                                            ).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select value={b.sortDir} onValueChange={(v) => setB({ ...b, sortDir: v as "asc" | "desc" })}>
                                        <SelectTrigger className="h-9 w-[90px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="desc">desc</SelectItem>
                                            <SelectItem value="asc">asc</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                    <Label>Row limit</Label>
                                    <Input type="number" value={b.row_limit} onChange={(e) => setB({ ...b, row_limit: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Default range (d)</Label>
                                    <Input type="number" disabled={!supportsDate} value={b.default_range_days} onChange={(e) => setB({ ...b, default_range_days: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBuilderOpen(false)}>Cancel</Button>
                        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editingId ? "Save" : "Create"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Run dialog ─────────────────────────────────────────── */}
            <Dialog open={!!runFor} onOpenChange={(o) => !o && setRunFor(null)}>
                <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{runFor?.name}</DialogTitle>
                        {runFor?.description && <DialogDescription>{runFor.description}</DialogDescription>}
                    </DialogHeader>

                    <div className="flex flex-wrap items-center gap-2">
                        {runSupportsDate && (
                            <DatePicker.RangePicker
                                value={runRange}
                                onChange={(d) => { if (d?.[0] && d?.[1]) setRunRange([d[0], d[1]]); }}
                                format="DD MMM YYYY" allowClear={false}
                                disabledDate={(d) => !!d && d.isAfter(dayjs(), "day")} className="h-9"
                            />
                        )}
                        {runSupportsShop && (
                            <Select value={runShop} onValueChange={setRunShop}>
                                <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={SHOP_ALL}>All shops</SelectItem>
                                    {shops.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                        <Button onClick={doRun} disabled={running}>
                            <Play className={cn("mr-2 size-4", running && "animate-pulse")} /> {running ? "Running…" : "Run"}
                        </Button>
                        <div className="ml-auto flex items-center gap-1.5">
                            {(["pdf", "excel", "csv", "json"] as FileFormat[]).map((f) => (
                                <Button key={f} variant="outline" size="sm" className="h-9 uppercase" disabled={exporting !== null} onClick={() => doExport(f)}>
                                    <Download className={cn("mr-1.5 size-3.5", exporting === f && "animate-bounce")} /> {f === "excel" ? "xlsx" : f}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {summaryEntries.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {summaryEntries.map(([k, v]) => (
                                <span key={k} className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs">
                                    <span className="capitalize">{k.replace(/_/g, " ")}</span>: <span className="text-foreground font-semibold">{String(v)}</span>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="border-border overflow-x-auto rounded-lg border">
                        {running ? (
                            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
                        ) : !result ? (
                            <p className="text-muted-foreground p-10 text-center text-sm">Run the report to see results.</p>
                        ) : result.rows.length === 0 ? (
                            <p className="text-muted-foreground p-10 text-center text-sm">No rows for this period.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>{result.headers.map((h) => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow>
                                </TableHeader>
                                <TableBody>
                                    {result.rows.slice(0, 500).map((row, i) => (
                                        <TableRow key={i}>
                                            {row.map((cell, j) => (
                                                <TableCell key={j} className="num-tabular whitespace-nowrap text-sm">
                                                    {cell === null ? "—" : typeof cell === "number" ? cell.toLocaleString() : String(cell)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                    {result && (
                        <p className="text-muted-foreground text-xs">
                            {result.row_count} row{result.row_count !== 1 ? "s" : ""}{result.row_count > 500 && " (showing first 500)"} · {result.period}
                        </p>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete report?</AlertDialogTitle>
                        <AlertDialogDescription><strong>{deleteTarget?.name}</strong> will be removed. Schedules using it will break.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={remove}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
