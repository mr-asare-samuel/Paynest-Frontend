"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Plus, Pencil, RefreshCcw, Power, MoreHorizontal, Blocks, Package, Building2, Trash2,
    GripVertical,
} from "lucide-react";
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { toast } from "sonner";
import PageHeader from "@/components/(shared-components)/PageHeader";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import {
    GetModules, CreateModule, UpdateModule, ReorderModules, SetPlanModules,
    GetOrgModuleGrants, CreateOrgModuleGrant, DeleteOrgModuleGrant,
    GetEntitlementStats, GetExpiringSubscriptions, GrandfatherOrgs,
    type EntitlementStats, type ExpiringOrg,
} from "@/(api-handlers)/entitlementsHandler";
import { getSubscriptionPlans } from "@/(api-handlers)/subscriptionPlansHandler";
import { getAllOrganizations, changeOrganizationSubscriptionPlan } from "@/(api-handlers)/organizationHandler";
import { ModuleResponse, ModuleGrantResponse } from "@/interfaces/entitlements";
import { SubscriptionPlanResponse } from "@/interfaces/subscriptionPlan";
import { OrganizationResponse } from "@/interfaces/organization";

// Sidebar section labels a module's pages can live under (mirrors AppShell NAV_GROUPS).
const NAV_SECTIONS = [
    "Overview", "Operate", "Catalog", "Pricing & Discounts", "Procurement",
    "Customers", "Reports & Finance", "Payroll", "My Pay", "Leave & HR",
    "Scheduling", "Administration", "Account",
];
const NONE = "__none__";

export default function ModulesAdminPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const isSuper = (user?.role || "").toLowerCase() === "superadmin";

    const [modules, setModules] = useState<ModuleResponse[]>([]);
    const [plans, setPlans] = useState<SubscriptionPlanResponse[]>([]);
    const [orgs, setOrgs] = useState<OrganizationResponse[]>([]);
    const [stats, setStats] = useState<EntitlementStats | null>(null);
    const [expiring, setExpiring] = useState<ExpiringOrg[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && !isSuper) router.replace("/dashboard");
    }, [user, isSuper, router]);

    const load = async () => {
        setLoading(true);
        try {
            const [m, p, o, s, e] = await Promise.all([
                GetModules(true),
                getSubscriptionPlans({ limit: 100 }),
                getAllOrganizations().catch(() => []),
                GetEntitlementStats().catch(() => null),
                GetExpiringSubscriptions(30).then((r) => r.organizations).catch(() => []),
            ]);
            setModules(m);
            setPlans(p);
            setOrgs(o);
            setStats(s);
            setExpiring(e);
        } catch (e) {
            handleErrorMessage(e, "Failed to load module data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSuper) load();
    }, [isSuper]);

    if (!user || !isSuper) {
        return <div className="flex items-center justify-center py-24"><Skeleton className="size-6 rounded-full" /></div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Modules & Entitlements"
                description="The feature-module catalog, which modules each plan grants, and per-organisation overrides."
                actions={
                    <Button variant="outline" size="icon" className="size-9" onClick={load} disabled={loading} aria-label="Refresh">
                        <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                    </Button>
                }
            />

            <Tabs defaultValue="catalog">
                <TabsList>
                    <TabsTrigger value="catalog"><Blocks className="mr-1.5 size-4" /> Catalog</TabsTrigger>
                    <TabsTrigger value="plans"><Package className="mr-1.5 size-4" /> Plans</TabsTrigger>
                    <TabsTrigger value="orgs"><Building2 className="mr-1.5 size-4" /> Organisations</TabsTrigger>
                </TabsList>

                <TabsContent value="catalog" className="mt-4">
                    <CatalogTab modules={modules} stats={stats} loading={loading} reload={load} />
                </TabsContent>
                <TabsContent value="plans" className="mt-4">
                    <PlansTab modules={modules} plans={plans} loading={loading} reload={load} />
                </TabsContent>
                <TabsContent value="orgs" className="mt-4">
                    <OrgsTab modules={modules} plans={plans} orgs={orgs} expiring={expiring} loading={loading} reloadOrgs={load} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ── Catalog tab ────────────────────────────────────────────────────────────

const CATALOG_GRID = "grid grid-cols-[24px_1.2fr_1.6fr_1fr_80px_100px_72px] items-center gap-3";

function SortableModuleRow({ id, children }: {
    id: number;
    children: (drag: {
        attributes: ReturnType<typeof useSortable>["attributes"];
        listeners: ReturnType<typeof useSortable>["listeners"];
    }) => React.ReactNode;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 10 : undefined,
        position: "relative",
        background: isDragging ? "var(--card)" : undefined,
    };
    return (
        <div ref={setNodeRef} style={style} className={cn(CATALOG_GRID, "border-border border-b px-4 py-2.5 last:border-b-0")}>
            {children({ attributes, listeners })}
        </div>
    );
}

function CatalogTab({ modules, stats, loading, reload }: {
    modules: ModuleResponse[]; stats: EntitlementStats | null; loading: boolean; reload: () => void;
}) {
    const usage = new Map((stats?.modules ?? []).map((m) => [m.code, m]));
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<ModuleResponse | null>(null);
    const [f, setF] = useState({ code: "", name: "", description: "", group: "", is_core: false });
    const [busy, setBusy] = useState(false);

    // Local working order; drag mutates this, "Save order" persists it.
    const [rows, setRows] = useState<ModuleResponse[]>(modules);
    const [savingOrder, setSavingOrder] = useState(false);
    useEffect(() => { setRows(modules); }, [modules]);
    const dirty = rows.map((r) => r.id).join(",") !== modules.map((r) => r.id).join(",");

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    const onDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const from = rows.findIndex((r) => r.id === active.id);
        const to = rows.findIndex((r) => r.id === over.id);
        if (from === -1 || to === -1) return;
        setRows(arrayMove(rows, from, to));
    };
    const saveOrder = async () => {
        setSavingOrder(true);
        try {
            await ReorderModules(rows.map((r) => r.id));
            toast.success("Order saved");
            reload();
        } catch (e) {
            handleErrorMessage(e, "Couldn't save the new order");
        } finally {
            setSavingOrder(false);
        }
    };

    const openNew = () => {
        setEditing(null);
        setF({ code: "", name: "", description: "", group: "", is_core: false });
        setOpen(true);
    };
    const openEdit = (m: ModuleResponse) => {
        setEditing(m);
        setF({ code: m.code, name: m.name, description: m.description ?? "", group: m.group ?? "", is_core: m.is_core });
        setOpen(true);
    };

    const save = async () => {
        if (!f.name.trim()) return toast.error("Name is required");
        if (!editing && !f.code.trim()) return toast.error("Code is required");
        setBusy(true);
        try {
            const body = {
                name: f.name.trim(), description: f.description || undefined,
                group: f.group || undefined, is_core: f.is_core,
            };
            if (editing) await UpdateModule(editing.id, body);
            else await CreateModule({ ...body, code: f.code.trim().toLowerCase() });  // no sort_order -> appended
            toast.success(editing ? "Module updated" : "Module created");
            setOpen(false);
            reload();
        } catch (e) {
            handleErrorMessage(e, "Failed to save module");
        } finally {
            setBusy(false);
        }
    };

    const toggleActive = async (m: ModuleResponse) => {
        try {
            await UpdateModule(m.id, { is_active: !m.is_active });
            reload();
        } catch (e) {
            handleErrorMessage(e, "Failed");
        }
    };

    const usageLabel = (code: string) => {
        const u = usage.get(code);
        if (!u) return "—";
        return `${u.entitled_orgs} org${u.entitled_orgs !== 1 ? "s" : ""} · ${u.plans_including} plan${u.plans_including !== 1 ? "s" : ""}`;
    };

    return (
        <Card className="gap-0 overflow-hidden p-0">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
                <span className="text-muted-foreground text-xs">
                    {modules.length} modules{dirty && " · unsaved order"}
                </span>
                <div className="flex items-center gap-2">
                    {dirty && (
                        <>
                            <Button size="sm" variant="ghost" onClick={() => setRows(modules)} disabled={savingOrder}>Discard</Button>
                            <Button size="sm" variant="outline" onClick={saveOrder} disabled={savingOrder}>
                                {savingOrder ? "Saving…" : "Save order"}
                            </Button>
                        </>
                    )}
                    <Button size="sm" onClick={openNew}><Plus className="mr-1.5 size-4" /> New Module</Button>
                </div>
            </div>

            <div className={cn(CATALOG_GRID, "text-muted-foreground border-b px-4 py-2 text-xs font-medium")}>
                <span />
                <span>Code</span><span>Name</span><span>Group</span>
                <span className="text-right">Usage</span><span>Status</span><span className="text-right">Actions</span>
            </div>

            {loading ? (
                <div className="space-y-2 p-4">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                        {rows.map((m) => (
                            <SortableModuleRow key={m.id} id={m.id}>
                                {({ attributes, listeners }) => (
                                    <>
                                        <button type="button" {...attributes} {...listeners}
                                            className="text-muted-foreground hover:text-foreground flex cursor-grab items-center justify-center active:cursor-grabbing"
                                            aria-label="Drag to reorder">
                                            <GripVertical className="size-4" />
                                        </button>
                                        <span className="truncate font-mono text-xs">{m.code}</span>
                                        <div className="min-w-0">
                                            <p className="text-foreground truncate text-sm font-medium">{m.name}</p>
                                            {m.description && <p className="text-muted-foreground truncate text-xs">{m.description}</p>}
                                        </div>
                                        <span className="text-muted-foreground truncate text-sm">{m.group || "—"}</span>
                                        <span className="text-muted-foreground text-right text-xs" title="entitled orgs · plans including">
                                            {usageLabel(m.code)}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <Badge variant="outline" className={cn("rounded-full text-[10px]",
                                                m.is_core ? "border-info/30 bg-info/10 text-info" : "border-border")}>
                                                {m.is_core ? "core" : "gated"}
                                            </Badge>
                                            {!m.is_active && (
                                                <Badge variant="outline" className="border-border bg-muted text-muted-foreground rounded-full text-[10px]">off</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-end">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openEdit(m)}><Pencil className="mr-2 size-4" /> Edit</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => toggleActive(m)}>
                                                        <Power className="mr-2 size-4" /> {m.is_active ? "Deactivate" : "Activate"}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </>
                                )}
                            </SortableModuleRow>
                        ))}
                    </SortableContext>
                </DndContext>
            )}

            <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editing ? "Edit Module" : "New Module"}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label>Code</Label>
                            <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })}
                                disabled={!!editing} className="font-mono" placeholder="loyalty" />
                            <p className="text-muted-foreground text-xs">
                                {editing
                                    ? "The identifier used in code (require_module, nav tags) — can't be changed."
                                    : "Lowercase identifier wired into code later. Can't be changed after creation. New modules are added at the bottom — drag to reposition."}
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Loyalty & Rewards" />
                            <p className="text-muted-foreground text-xs">Shown to users — in menus, plan checkboxes, and the “not in your plan” screen.</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Group</Label>
                            <Select
                                value={f.group || NONE}
                                onValueChange={(v) => setF({ ...f, group: v === NONE ? "" : v })}
                            >
                                <SelectTrigger><SelectValue placeholder="Pick a section" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>— None —</SelectItem>
                                    {NAV_SECTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                    {f.group && !NAV_SECTIONS.includes(f.group) && (
                                        <SelectItem value={f.group}>{f.group} (custom)</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            <p className="text-muted-foreground text-xs">Which sidebar section this module’s pages sit in. Informational — keeps the catalog organised.</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })}
                                placeholder="What this module unlocks" />
                            <p className="text-muted-foreground text-xs">Optional note describing what the module covers.</p>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <Switch checked={f.is_core} onCheckedChange={(v) => setF({ ...f, is_core: v })} id="core" />
                                <Label htmlFor="core">Core (always available to every org)</Label>
                            </div>
                            <p className="text-muted-foreground text-xs">Core modules can’t be gated — they’re hidden from the Plans and per-org override screens.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Update" : "Create"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

// ── Plans tab ──────────────────────────────────────────────────────────────

function PlansTab({ modules, plans, loading, reload }: {
    modules: ModuleResponse[]; plans: SubscriptionPlanResponse[]; loading: boolean; reload: () => void;
}) {
    const gated = useMemo(() => modules.filter((m) => !m.is_core && m.is_active), [modules]);
    const [planId, setPlanId] = useState<string>("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);

    const plan = plans.find((p) => String(p.id) === planId) ?? null;

    useEffect(() => {
        if (plan) setSelected(new Set(plan.modules));
    }, [planId]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggle = (code: string) =>
        setSelected((s) => {
            const n = new Set(s);
            if (n.has(code)) n.delete(code);
            else n.add(code);
            return n;
        });

    const save = async () => {
        if (!plan) return;
        setBusy(true);
        try {
            await SetPlanModules(plan.id, [...selected]);
            toast.success(`${plan.name} modules updated`);
            reload();
        } catch (e) {
            handleErrorMessage(e, "Failed to update plan modules");
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <Card className="p-6"><Skeleton className="h-40 w-full" /></Card>;

    return (
        <div className="flex flex-col gap-4">
            <div className="max-w-xs space-y-1.5">
                <Label>Plan</Label>
                <Select value={planId} onValueChange={setPlanId}>
                    <SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger>
                    <SelectContent>
                        {plans.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                                {p.name}{p.is_custom ? " (custom)" : ""}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {plan && (
                <Card className="p-4">
                    <p className="text-muted-foreground mb-3 text-xs">
                        Core modules are always included. Tick the extra modules <b>{plan.name}</b> grants.
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {gated.map((m) => (
                            <label key={m.code} className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm",
                                selected.has(m.code) ? "border-primary bg-primary/5" : "border-border",
                            )}>
                                <input
                                    type="checkbox"
                                    checked={selected.has(m.code)}
                                    onChange={() => toggle(m.code)}
                                    className="accent-primary size-4"
                                />
                                <span className="flex-1">
                                    {m.name}
                                    <span className="text-muted-foreground ml-1.5 font-mono text-xs">{m.code}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save modules"}</Button>
                    </div>
                </Card>
            )}
        </div>
    );
}

// ── Organisations tab ──────────────────────────────────────────────────────

function OrgsTab({ modules, plans, orgs, expiring, loading, reloadOrgs }: {
    modules: ModuleResponse[]; plans: SubscriptionPlanResponse[];
    orgs: OrganizationResponse[]; expiring: ExpiringOrg[]; loading: boolean; reloadOrgs: () => void;
}) {
    const gated = useMemo(() => modules.filter((m) => !m.is_core && m.is_active), [modules]);
    const [orgId, setOrgId] = useState<string>("");
    const [grandfathering, setGrandfathering] = useState(false);
    const [confirmGrandfather, setConfirmGrandfather] = useState(false);

    const runGrandfather = async () => {
        setConfirmGrandfather(false);
        setGrandfathering(true);
        try {
            const r = await GrandfatherOrgs({ strategy: "grant_all" });
            toast.success(`${r.grants_added ?? 0} grants added across ${r.organizations} orgs`);
            reloadOrgs();
        } catch (e) {
            handleErrorMessage(e, "Grandfather run failed");
        } finally {
            setGrandfathering(false);
        }
    };
    const [grants, setGrants] = useState<ModuleGrantResponse[]>([]);
    const [loadingGrants, setLoadingGrants] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [f, setF] = useState<{ module_code: string; effect: "grant" | "revoke"; expires_at: string; reason: string }>(
        { module_code: "", effect: "grant", expires_at: "", reason: "" },
    );
    const [busy, setBusy] = useState(false);

    const org = orgs.find((o) => String(o.id) === orgId) ?? null;

    const loadGrants = async (id: number) => {
        setLoadingGrants(true);
        try {
            setGrants(await GetOrgModuleGrants(id));
        } catch (e) {
            handleErrorMessage(e, "Failed to load grants");
        } finally {
            setLoadingGrants(false);
        }
    };

    useEffect(() => {
        if (orgId) loadGrants(Number(orgId));
        else setGrants([]);
    }, [orgId]);

    const changePlan = async (planIdStr: string) => {
        if (!org) return;
        try {
            await changeOrganizationSubscriptionPlan(org.id, Number(planIdStr));
            toast.success("Plan updated");
            reloadOrgs();
        } catch (e) {
            handleErrorMessage(e, "Failed to change plan");
        }
    };

    const addGrant = async () => {
        if (!org || !f.module_code) return toast.error("Pick a module");
        setBusy(true);
        try {
            await CreateOrgModuleGrant(org.id, {
                module_code: f.module_code, effect: f.effect,
                expires_at: f.expires_at || null, reason: f.reason || null,
            });
            toast.success("Override saved");
            setAddOpen(false);
            setF({ module_code: "", effect: "grant", expires_at: "", reason: "" });
            loadGrants(org.id);
        } catch (e) {
            handleErrorMessage(e, "Failed to save override");
        } finally {
            setBusy(false);
        }
    };

    const removeGrant = async (id: number) => {
        if (!org) return;
        try {
            await DeleteOrgModuleGrant(org.id, id);
            loadGrants(org.id);
        } catch (e) {
            handleErrorMessage(e, "Failed to remove override");
        }
    };

    if (loading) return <Card className="p-6"><Skeleton className="h-40 w-full" /></Card>;

    return (
        <div className="flex flex-col gap-4">
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="text-xs">
                    <p className="text-foreground font-medium">Enforcement rollout</p>
                    <p className="text-muted-foreground">
                        Grandfather every active org before flipping <code className="font-mono">MODULE_ENFORCEMENT_ENABLED</code>.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setConfirmGrandfather(true)} disabled={grandfathering}>
                    {grandfathering ? "Working…" : "Grandfather all active orgs"}
                </Button>
            </Card>

            <AlertDialog open={confirmGrandfather} onOpenChange={setConfirmGrandfather}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Grandfather every active organisation?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Adds a permanent <b>grant</b> for every gated module each active org isn&apos;t already
                            entitled to, so turning on enforcement doesn&apos;t remove anyone&apos;s access.
                            Run this once, just before flipping <code className="font-mono">MODULE_ENFORCEMENT_ENABLED</code>.
                            Existing grants are left untouched.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={runGrandfather}>Grandfather all orgs</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {expiring.length > 0 && (
                <Card className="border-warning/30 bg-warning/5 p-4">
                    <p className="text-warning-foreground mb-2 text-xs font-medium">
                        Subscriptions expiring / expired ({expiring.length})
                    </p>
                    <div className="flex flex-col gap-1 text-xs">
                        {expiring.slice(0, 12).map((o) => (
                            <div key={o.organization_id} className="flex justify-between">
                                <span>{o.name} <span className="text-muted-foreground">· {o.plan_name ?? "no plan"}</span></span>
                                <span className={o.expired ? "text-destructive" : "text-muted-foreground"}>
                                    {o.expired ? "expired" : `${o.days_left}d left`} — {new Date(o.expires_at).toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <div className="flex flex-wrap items-end gap-4">
                <div className="w-64 space-y-1.5">
                    <Label>Organisation</Label>
                    <Select value={orgId} onValueChange={setOrgId}>
                        <SelectTrigger><SelectValue placeholder="Select an organisation" /></SelectTrigger>
                        <SelectContent>
                            {orgs.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {org && (
                    <div className="w-56 space-y-1.5">
                        <Label>Plan</Label>
                        <Select value={org.subscription_plan ? String(org.subscription_plan.id) : ""} onValueChange={changePlan}>
                            <SelectTrigger><SelectValue placeholder="No plan" /></SelectTrigger>
                            <SelectContent>
                                {plans.map((p) => (
                                    <SelectItem key={p.id} value={String(p.id)}>
                                        {p.name}{p.is_custom ? " (custom)" : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {org && (
                <Card className="gap-0 overflow-hidden p-0">
                    <div className="flex items-center justify-between border-b px-4 py-2.5">
                        <span className="text-muted-foreground text-xs">
                            Per-org overrides on top of {org.subscription_plan?.name ?? "no plan"}
                        </span>
                        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1.5 size-4" /> Add override</Button>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-6">Module</TableHead>
                                    <TableHead>Effect</TableHead>
                                    <TableHead>Expires</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead className="w-[50px] pr-6 text-right"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingGrants ? (
                                    <TableRow><TableCell colSpan={5} className="py-8 text-center">
                                        <Skeleton className="mx-auto h-5 w-40" />
                                    </TableCell></TableRow>
                                ) : grants.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="text-muted-foreground py-10 text-center text-sm">
                                        No overrides — this org gets exactly its plan&apos;s modules.
                                    </TableCell></TableRow>
                                ) : grants.map((g) => (
                                    <TableRow key={g.id}>
                                        <TableCell className="pl-6 font-mono text-xs">{g.module_code}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("rounded-full text-xs",
                                                g.effect === "grant" ? "border-success/30 bg-success/10 text-success"
                                                    : "border-destructive/30 bg-destructive/10 text-destructive")}>
                                                {g.effect}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {g.expires_at ? new Date(g.expires_at).toLocaleDateString() : "never"}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{g.reason || "—"}</TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <Button variant="ghost" size="icon" className="size-8" onClick={() => removeGrant(g.id)}>
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Add override</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label>Module</Label>
                            <Select value={f.module_code} onValueChange={(v) => setF({ ...f, module_code: v })}>
                                <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
                                <SelectContent>
                                    {gated.map((m) => <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Effect</Label>
                            <Select value={f.effect} onValueChange={(v) => setF({ ...f, effect: v as "grant" | "revoke" })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="grant">Grant (add on top of plan)</SelectItem>
                                    <SelectItem value="revoke">Revoke (remove from plan)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Expires <span className="text-muted-foreground text-xs">(optional — for trials)</span></Label>
                            <DatePicker
                                showTime className="w-full" format="DD MMM YYYY HH:mm"
                                value={f.expires_at ? dayjs(f.expires_at) : null}
                                onChange={(d) => setF({ ...f, expires_at: d ? d.toISOString() : "" })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Reason</Label>
                            <Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. 30-day trial" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                        <Button onClick={addGrant} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
