"use client";

import { useEffect, useState } from "react";
import {
    Plus, MoreHorizontal, Pencil, Trash2, RefreshCcw, CalendarClock, Play, Power, Clock,
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
import { toast } from "sonner";
import dayjs from "dayjs";
import PageHeader from "@/components/(shared-components)/PageHeader";
import { cn } from "@/lib/utils";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import { getOrganizationUsers } from "@/(api-handlers)/userHandler";
import {
    GetReportSchedules, CreateReportSchedule, UpdateReportSchedule,
    DeleteReportSchedule, RunReportScheduleNow, GetCustomReports,
} from "@/(api-handlers)/analyticsHandler";
import { UserResponse } from "@/interfaces/loginInterface";
import {
    ReportSchedule, ScheduleSource, StandardReportType, FileFormat, CustomReportDefinition,
} from "@/interfaces/analytics";

const STD_TYPES: { value: StandardReportType; label: string }[] = [
    { value: "daily_sales", label: "Daily sales" },
    { value: "monthly_financial", label: "Monthly financial" },
    { value: "inventory", label: "Inventory" },
    { value: "employee_performance", label: "Employee performance" },
    { value: "customer_analytics", label: "Customer analytics" },
    { value: "consolidated", label: "Consolidated (multi-shop)" },
];
const FORMATS: FileFormat[] = ["pdf", "excel", "csv", "json"];
const CRON_PRESETS: { label: string; cron: string }[] = [
    { label: "Every day, 06:00", cron: "0 6 * * *" },
    { label: "Weekdays, 07:00", cron: "0 7 * * 1-5" },
    { label: "Every Monday, 08:00", cron: "0 8 * * 1" },
    { label: "1st of month, 06:00", cron: "0 6 1 * *" },
    { label: "Every hour", cron: "0 * * * *" },
];
const CRON_CUSTOM = "__custom__";

interface FormState {
    name: string;
    source: ScheduleSource;
    report_type: StandardReportType;
    custom_report_id: string;
    file_format: FileFormat;
    cronPreset: string;
    cron: string;
    window_days: string;
    recipient_user_ids: number[];
    auto_approve: boolean;
    is_active: boolean;
}
const blank: FormState = {
    name: "", source: "standard", report_type: "daily_sales", custom_report_id: "",
    file_format: "pdf", cronPreset: "0 6 * * *", cron: "0 6 * * *", window_days: "1",
    recipient_user_ids: [], auto_approve: true, is_active: true,
};

export default function ReportSchedulesPage() {
    const [rows, setRows] = useState<ReportSchedule[]>([]);
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [customReports, setCustomReports] = useState<CustomReportDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ReportSchedule | null>(null);
    const [form, setForm] = useState<FormState>(blank);
    const [submitting, setSubmitting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<ReportSchedule | null>(null);
    const [runningId, setRunningId] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        try { setRows(await GetReportSchedules()); }
        catch (e) { handleErrorMessage(e, "Failed to load schedules"); }
        finally { setLoading(false); }
    };
    useEffect(() => {
        load();
        getOrganizationUsers().then(setUsers).catch(() => setUsers([]));
        GetCustomReports().then(setCustomReports).catch(() => setCustomReports([]));
    }, []);

    const userName = (id: number) => {
        const u = users.find((x) => x.id === id);
        return u ? `${u.first_name} ${u.last_name}`.trim() || u.email : `User #${id}`;
    };
    const reportLabel = (s: ReportSchedule) =>
        s.source === "custom"
            ? customReports.find((c) => c.id === s.custom_report_id)?.name ?? "Custom report"
            : STD_TYPES.find((t) => t.value === s.report_type)?.label ?? s.report_type ?? "—";
    const cronHint = (cron: string) => CRON_PRESETS.find((p) => p.cron === cron)?.label ?? cron;

    const openCreate = () => { setEditing(null); setForm(blank); setDialogOpen(true); };
    const openEdit = (s: ReportSchedule) => {
        setEditing(s);
        const presetMatch = CRON_PRESETS.find((p) => p.cron === s.cron);
        setForm({
            name: s.name, source: s.source,
            report_type: (s.report_type as StandardReportType) ?? "daily_sales",
            custom_report_id: s.custom_report_id != null ? String(s.custom_report_id) : "",
            file_format: s.file_format,
            cronPreset: presetMatch ? s.cron : CRON_CUSTOM,
            cron: s.cron,
            window_days: String(s.window_days),
            recipient_user_ids: s.recipient_user_ids ?? [],
            auto_approve: s.auto_approve, is_active: s.is_active,
        });
        setDialogOpen(true);
    };

    const submit = async () => {
        if (!form.name.trim()) return toast.error("Give the schedule a name");
        if (form.source === "custom" && !form.custom_report_id) return toast.error("Pick a custom report");
        if (!form.cron.trim()) return toast.error("Enter a cron expression");
        const payload = {
            name: form.name.trim(),
            source: form.source,
            report_type: form.source === "standard" ? form.report_type : null,
            custom_report_id: form.source === "custom" ? Number(form.custom_report_id) : null,
            file_format: form.file_format,
            cron: form.cron.trim(),
            window_days: Number(form.window_days) || 1,
            recipient_user_ids: form.recipient_user_ids,
            auto_approve: form.auto_approve,
            is_active: form.is_active,
        };
        setSubmitting(true);
        try {
            if (editing) { await UpdateReportSchedule(editing.id, payload); toast.success("Schedule updated"); }
            else { await CreateReportSchedule(payload); toast.success("Schedule created"); }
            setDialogOpen(false);
            load();
        } catch (e) {
            handleErrorMessage(e, "Failed to save schedule");
        } finally {
            setSubmitting(false);
        }
    };

    const runNow = async (s: ReportSchedule) => {
        setRunningId(s.id);
        try {
            const updated = await RunReportScheduleNow(s.id);
            toast.success(updated.last_status === "completed" ? "Report generated" : `Run: ${updated.last_status ?? "done"}`);
            load();
        } catch (e) {
            handleErrorMessage(e, "Run failed");
        } finally {
            setRunningId(null);
        }
    };
    const toggleActive = async (s: ReportSchedule) => {
        try { await UpdateReportSchedule(s.id, { is_active: !s.is_active }); load(); }
        catch (e) { handleErrorMessage(e, "Failed"); }
    };
    const remove = async () => {
        if (!deleteTarget) return;
        try { await DeleteReportSchedule(deleteTarget.id); toast.success("Schedule deleted"); setDeleteTarget(null); load(); }
        catch (e) { handleErrorMessage(e, "Failed to delete"); }
    };

    const toggleRecipient = (id: number) =>
        setForm((f) => ({
            ...f,
            recipient_user_ids: f.recipient_user_ids.includes(id)
                ? f.recipient_user_ids.filter((x) => x !== id)
                : [...f.recipient_user_ids, id],
        }));

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Report Schedules"
                description="Generate a report on a cron schedule and deliver it to recipients."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-9" onClick={load} disabled={loading} aria-label="Refresh">
                            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                        <Button onClick={openCreate}><Plus className="mr-2 size-4" /> New Schedule</Button>
                    </div>
                }
            />

            <Card className="border-info/30 bg-info-muted/40 flex items-start gap-3 rounded-xl border p-3 text-xs">
                <Clock className="text-info mt-0.5 size-4 shrink-0" />
                <p className="text-muted-foreground">
                    Schedules only fire when the reporting scheduler is running — either <code className="text-foreground">SCHEDULER_ENABLED=true</code> on the
                    API, or an external cron hitting <code className="text-foreground">POST /analytics/scheduler/tick</code>. &ldquo;Run now&rdquo; always works.
                </p>
            </Card>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Schedule</TableHead>
                                <TableHead>Report</TableHead>
                                <TableHead>Cadence</TableHead>
                                <TableHead>Recipients</TableHead>
                                <TableHead>Next run</TableHead>
                                <TableHead>Last run</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[60px] pr-6 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 8 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-muted-foreground py-16 text-center text-sm">
                                        No schedules yet.
                                    </TableCell>
                                </TableRow>
                            ) : rows.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell className="pl-6">
                                        <p className="text-foreground font-medium">{s.name}</p>
                                        <p className="text-muted-foreground text-xs uppercase">{s.file_format}</p>
                                    </TableCell>
                                    <TableCell className="text-sm">{reportLabel(s)}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        <span className="text-foreground">{cronHint(s.cron)}</span>
                                        <p className="font-mono text-[10px]">{s.cron} · {s.window_days}d window</p>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {s.recipient_user_ids.length === 0 ? "creator only"
                                            : s.recipient_user_ids.length === 1 ? userName(s.recipient_user_ids[0])
                                            : `${s.recipient_user_ids.length} people`}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {s.next_run_at ? dayjs(s.next_run_at).format("MMM D, HH:mm") : "—"}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {s.last_run_at ? (
                                            <>
                                                <span className="text-muted-foreground">{dayjs(s.last_run_at).format("MMM D, HH:mm")}</span>
                                                {s.last_status && (
                                                    <p className={cn(
                                                        "text-[10px]",
                                                        s.last_status === "completed" ? "text-success"
                                                            : s.last_status.startsWith("error") || s.last_status === "failed" ? "text-destructive"
                                                            : "text-muted-foreground",
                                                    )}>{s.last_status}</p>
                                                )}
                                            </>
                                        ) : <span className="text-muted-foreground">never</span>}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "rounded-full text-xs",
                                            s.is_active ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground",
                                        )}>{s.is_active ? "Active" : "Paused"}</Badge>
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${s.name}`}>
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-40">
                                                <DropdownMenuItem disabled={runningId === s.id} onClick={() => runNow(s)}>
                                                    <Play className="size-4" /> {runningId === s.id ? "Running…" : "Run now"}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="size-4" /> Edit</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => toggleActive(s)}>
                                                    <Power className="size-4" /> {s.is_active ? "Pause" : "Activate"}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(s)}>
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

            <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
                <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit schedule" : "New schedule"}</DialogTitle>
                        <DialogDescription><CalendarClock className="mr-1 inline size-3.5" />Cron is evaluated in UTC.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-1">
                        <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Weekly sales digest" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Source</Label>
                                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as ScheduleSource })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="standard">Standard report</SelectItem>
                                        <SelectItem value="custom">Saved custom report</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Format</Label>
                                <Select value={form.file_format} onValueChange={(v) => setForm({ ...form, file_format: v as FileFormat })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{FORMATS.map((f) => <SelectItem key={f} value={f} className="uppercase">{f}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        {form.source === "standard" ? (
                            <div className="space-y-1.5">
                                <Label>Report type</Label>
                                <Select value={form.report_type} onValueChange={(v) => setForm({ ...form, report_type: v as StandardReportType })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{STD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <Label>Custom report</Label>
                                <Select value={form.custom_report_id} onValueChange={(v) => setForm({ ...form, custom_report_id: v })}>
                                    <SelectTrigger><SelectValue placeholder="Pick a saved report" /></SelectTrigger>
                                    <SelectContent>
                                        {customReports.length === 0 && <SelectItem value="none" disabled>No custom reports saved</SelectItem>}
                                        {customReports.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Cadence</Label>
                                <Select
                                    value={form.cronPreset}
                                    onValueChange={(v) => setForm({ ...form, cronPreset: v, cron: v === CRON_CUSTOM ? form.cron : v })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CRON_PRESETS.map((p) => <SelectItem key={p.cron} value={p.cron}>{p.label}</SelectItem>)}
                                        <SelectItem value={CRON_CUSTOM}>Custom cron…</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Window (days)</Label>
                                <Input type="number" value={form.window_days} onChange={(e) => setForm({ ...form, window_days: e.target.value })} />
                            </div>
                        </div>
                        {form.cronPreset === CRON_CUSTOM && (
                            <div className="space-y-1.5">
                                <Label>Cron expression</Label>
                                <Input className="font-mono" value={form.cron} onChange={(e) => setForm({ ...form, cron: e.target.value })} placeholder="min hour dom mon dow" />
                                <p className="text-muted-foreground text-xs">5 fields, UTC. e.g. <code>30 5 * * 1-5</code> = weekdays 05:30.</p>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label>Recipients <span className="text-muted-foreground font-normal">({form.recipient_user_ids.length || "creator only"})</span></Label>
                            <div className="border-border max-h-40 overflow-y-auto rounded-lg border p-2">
                                {users.length === 0 ? (
                                    <p className="text-muted-foreground p-2 text-xs">No users loaded.</p>
                                ) : users.map((u) => (
                                    <label key={u.id} className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                                        <Checkbox checked={form.recipient_user_ids.includes(u.id)} onCheckedChange={() => toggleRecipient(u.id)} />
                                        <span className="truncate">{`${u.first_name} ${u.last_name}`.trim() || u.email}</span>
                                        <span className="text-muted-foreground ml-auto text-[10px] capitalize">{u.role}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Auto-approve &amp; generate</Label>
                                <p className="text-muted-foreground text-xs">Off = create as a pending report for admin approval.</p>
                            </div>
                            <Switch checked={form.auto_approve} onCheckedChange={(c) => setForm({ ...form, auto_approve: c })} />
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

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
                        <AlertDialogDescription><strong>{deleteTarget?.name}</strong> will stop running. Past generated reports are kept.</AlertDialogDescription>
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
