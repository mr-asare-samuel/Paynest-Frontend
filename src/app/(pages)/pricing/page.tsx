"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
    Plus, Pencil, Trash2, RefreshCcw, Tag, Clock, UserCog, Power, MoreHorizontal,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { DatePicker, TimePicker } from "antd";
import dayjs from "dayjs";
import { toast } from "sonner";
import PageHeader from "@/components/(shared-components)/PageHeader";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { useCurrency } from "@/hooks/useCurrency";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import {
    GetPriceTiers, CreatePriceTier, UpdatePriceTier, DeletePriceTier,
    GetScheduledDiscounts, CreateScheduledDiscount, UpdateScheduledDiscount, DeleteScheduledDiscount,
    GetCustomerPrices, CreateCustomerPrice, UpdateCustomerPrice, DeleteCustomerPrice,
} from "@/(api-handlers)/pricingHandler";
import { GetProducts } from "@/(api-handlers)/productsHandler";
import { GetProductCategories } from "@/(api-handlers)/productCategoriesHandler";
import { GetAllCustomers } from "@/(api-handlers)/customersHandler";
import { getOrganizationShops } from "@/(api-handlers)/organizationShopsHandler";
import {
    PriceTierResponse, ScheduledDiscountResponse, CustomerPriceResponse,
    DiscountType,
} from "@/interfaces/pricing";
import { ProductResponse } from "@/interfaces/products";
import { ProductCategoriesResponse } from "@/interfaces/productCategories";
import { CustomerResponse } from "@/interfaces/customers";
import { OrganizationShopResponse } from "@/interfaces/organizationShops";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));

function discountLabel(type: DiscountType, value: number, fmt: (n: number) => string) {
    if (type === "percentage") return `${value}% off`;
    if (type === "fixed_price") return `${fmt(value)} flat`;
    return `${fmt(value)} off`;
}

// Shared refs the forms need
interface Refs {
    products: ProductResponse[];
    categories: ProductCategoriesResponse[];
    customers: CustomerResponse[];
    shops: OrganizationShopResponse[];
}

export default function PricingRulesPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const fmt = useCurrency();
    const role = (user?.role || "attendant").toLowerCase();
    const isAllowed = role === "manager" || role === "admin" || role === "superadmin";

    const [refs, setRefs] = useState<Refs>({ products: [], categories: [], customers: [], shops: [] });
    const [tiers, setTiers] = useState<PriceTierResponse[]>([]);
    const [schedules, setSchedules] = useState<ScheduledDiscountResponse[]>([]);
    const [custPrices, setCustPrices] = useState<CustomerPriceResponse[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && !isAllowed) router.replace("/dashboard");
    }, [user, isAllowed, router]);

    const load = async () => {
        setLoading(true);
        try {
            const [t, s, c, prods, cats, custs, shops] = await Promise.all([
                GetPriceTiers(),
                GetScheduledDiscounts(),
                GetCustomerPrices(),
                GetProducts().catch(() => []),
                GetProductCategories().catch(() => []),
                GetAllCustomers(undefined, 0, 200).then((r) => r.items).catch(() => []),
                getOrganizationShops().catch(() => []),
            ]);
            setTiers(t);
            setSchedules(s);
            setCustPrices(c);
            setRefs({ products: prods, categories: cats, customers: custs, shops });
        } catch (e) {
            handleErrorMessage(e, "Failed to load pricing rules");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAllowed) load();
    }, [isAllowed]);

    const pName = (id: number | null) => refs.products.find((p) => p.id === id)?.name ?? `#${id}`;
    const cName = (id: number | null) => refs.categories.find((c) => c.id === id)?.name ?? `#${id}`;
    const custName = (id: number | null) => {
        const c = refs.customers.find((x) => x.id === id);
        return c ? `${c.first_name} ${c.last_name}` : `#${id}`;
    };
    const sName = (id: number | null) => (id == null ? "All shops" : refs.shops.find((s) => s.id === id)?.name ?? `#${id}`);

    if (!user || !isAllowed) {
        return <div className="flex items-center justify-center py-24"><Skeleton className="size-6 rounded-full" /></div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Pricing Rules"
                description="Volume breaks, timed promotions and customer pricing. All applied automatically at checkout — lowest price wins per line."
                actions={
                    <Button variant="outline" size="icon" className="size-9" onClick={load} disabled={loading} aria-label="Refresh">
                        <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                    </Button>
                }
            />

            <Tabs defaultValue="tiers">
                <TabsList>
                    <TabsTrigger value="tiers"><Tag className="mr-1.5 size-4" /> Volume Tiers</TabsTrigger>
                    <TabsTrigger value="schedule"><Clock className="mr-1.5 size-4" /> Scheduled</TabsTrigger>
                    <TabsTrigger value="customer"><UserCog className="mr-1.5 size-4" /> Customer</TabsTrigger>
                </TabsList>

                <TabsContent value="tiers" className="mt-4">
                    <TiersTab
                        rows={tiers} loading={loading} refs={refs} fmt={fmt} reload={load}
                        pName={pName} cName={cName} sName={sName}
                    />
                </TabsContent>
                <TabsContent value="schedule" className="mt-4">
                    <SchedulesTab
                        rows={schedules} loading={loading} refs={refs} fmt={fmt} reload={load}
                        pName={pName} cName={cName} sName={sName}
                    />
                </TabsContent>
                <TabsContent value="customer" className="mt-4">
                    <CustomerPricesTab
                        rows={custPrices} loading={loading} refs={refs} fmt={fmt} reload={load}
                        pName={pName} cName={cName} custName={custName}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ── Generic table shell ────────────────────────────────────────────────────

function TableShell({
    headers, loading, empty, children, onNew, count,
}: {
    headers: string[]; loading: boolean; empty: ReactNode; children: ReactNode;
    onNew: () => void; count: number;
}) {
    return (
        <Card className="gap-0 overflow-hidden p-0">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
                <span className="text-muted-foreground text-xs">{count} rule{count !== 1 ? "s" : ""}</span>
                <Button size="sm" onClick={onNew}><Plus className="mr-1.5 size-4" /> New</Button>
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {headers.map((h) => <TableHead key={h} className={h === headers[0] ? "pl-6" : ""}>{h}</TableHead>)}
                            <TableHead className="w-[60px] pr-6 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <TableRow key={i}>
                                    {Array.from({ length: headers.length + 1 }).map((_, j) => (
                                        <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : count === 0 ? (
                            <TableRow><TableCell colSpan={headers.length + 1} className="py-16 text-center">{empty}</TableCell></TableRow>
                        ) : children}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
}

function RowActions({ onEdit, onToggle, isActive, onDelete }: {
    onEdit: () => void; onToggle: () => void; isActive: boolean; onDelete: () => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label="Actions"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}><Pencil className="mr-2 size-4" /> Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={onToggle}><Power className="mr-2 size-4" /> {isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={onDelete}><Trash2 className="mr-2 size-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ActiveBadge({ active }: { active: boolean }) {
    return (
        <Badge variant="outline" className={cn("rounded-full text-xs",
            active ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground")}>
            {active ? "Active" : "Inactive"}
        </Badge>
    );
}

function DiscountFields({
    type, value, onType, onValue, allowFixedPrice = true,
}: {
    type: DiscountType; value: string; onType: (t: DiscountType) => void; onValue: (v: string) => void;
    allowFixedPrice?: boolean;
}) {
    return (
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <Label>Discount type</Label>
                <Select value={type} onValueChange={(v) => onType(v as DiscountType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="percentage">Percentage off</SelectItem>
                        <SelectItem value="amount_off">Amount off</SelectItem>
                        {allowFixedPrice && <SelectItem value="fixed_price">Fixed unit price</SelectItem>}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label>Value</Label>
                <Input type="number" min={0} step="0.01" value={value} onChange={(e) => onValue(e.target.value)} />
            </div>
        </div>
    );
}

function ScopeFields({
    scope, productId, categoryId, onScope, onProduct, onCategory, refs, includeAll,
}: {
    scope: string; productId: string; categoryId: string;
    onScope: (s: string) => void; onProduct: (v: string) => void; onCategory: (v: string) => void;
    refs: Refs; includeAll: boolean;
}) {
    return (
        <>
            <div className="space-y-1.5">
                <Label>Applies to</Label>
                <Select value={scope} onValueChange={onScope}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {includeAll && <SelectItem value="all">Everything</SelectItem>}
                        <SelectItem value="product">A product</SelectItem>
                        <SelectItem value="category">A category</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {scope === "product" && (
                <div className="space-y-1.5">
                    <Label>Product</Label>
                    <Select value={productId} onValueChange={onProduct}>
                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>
                            {refs.products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {scope === "category" && (
                <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={categoryId} onValueChange={onCategory}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                            {refs.categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </>
    );
}

function ShopField({ value, onChange, refs }: { value: string; onChange: (v: string) => void; refs: Refs }) {
    return (
        <div className="space-y-1.5">
            <Label>Shop</Label>
            <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All shops</SelectItem>
                    {refs.shops.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
    );
}

// ── Volume tiers tab ───────────────────────────────────────────────────────

type NameFn = (id: number | null) => string;

function TiersTab({ rows, loading, refs, fmt, reload, pName, cName, sName }: {
    rows: PriceTierResponse[]; loading: boolean; refs: Refs; fmt: (n: number) => string; reload: () => void;
    pName: NameFn; cName: NameFn; sName: NameFn;
}) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<PriceTierResponse | null>(null);
    const [del, setDel] = useState<PriceTierResponse | null>(null);
    const [f, setF] = useState({
        scope: "product", product_id: "", category_id: "", shop_id: "",
        min_quantity: "", discount_type: "percentage" as DiscountType, discount_value: "", is_active: true,
    });
    const [busy, setBusy] = useState(false);

    const openNew = () => { setEditing(null); setF({ scope: "product", product_id: "", category_id: "", shop_id: "", min_quantity: "", discount_type: "percentage", discount_value: "", is_active: true }); setOpen(true); };
    const openEdit = (r: PriceTierResponse) => {
        setEditing(r);
        setF({
            scope: r.scope, product_id: r.product_id ? String(r.product_id) : "",
            category_id: r.category_id ? String(r.category_id) : "", shop_id: r.shop_id ? String(r.shop_id) : "",
            min_quantity: String(r.min_quantity), discount_type: r.discount_type,
            discount_value: String(r.discount_value), is_active: r.is_active,
        });
        setOpen(true);
    };

    const save = async () => {
        const mq = Number(f.min_quantity), dv = Number(f.discount_value);
        if (!mq || mq < 1) return toast.error("Min quantity must be ≥ 1");
        if (Number.isNaN(dv) || dv < 0) return toast.error("Discount value is invalid");
        if (f.scope === "product" && !f.product_id) return toast.error("Pick a product");
        if (f.scope === "category" && !f.category_id) return toast.error("Pick a category");
        const body = {
            scope: f.scope as "product" | "category",
            product_id: f.scope === "product" ? Number(f.product_id) : null,
            category_id: f.scope === "category" ? Number(f.category_id) : null,
            shop_id: num(f.shop_id),
            min_quantity: mq, discount_type: f.discount_type, discount_value: dv, is_active: f.is_active,
        };
        setBusy(true);
        try {
            if (editing) { await UpdatePriceTier(editing.id, body); toast.success("Tier updated"); }
            else { await CreatePriceTier(body); toast.success("Tier created"); }
            setOpen(false); reload();
        } catch (e) { handleErrorMessage(e, "Failed to save tier"); }
        finally { setBusy(false); }
    };

    const toggle = async (r: PriceTierResponse) => {
        try { await UpdatePriceTier(r.id, { is_active: !r.is_active }); reload(); }
        catch (e) { handleErrorMessage(e, "Failed"); }
    };
    const remove = async () => {
        if (!del) return;
        try { await DeletePriceTier(del.id); toast.success("Deleted"); setDel(null); reload(); }
        catch (e) { handleErrorMessage(e, "Failed to delete"); }
    };

    return (
        <>
            <TableShell
                headers={["Target", "From qty", "Discount", "Shop", "Status"]}
                loading={loading} count={rows.length} onNew={openNew}
                empty={<p className="text-muted-foreground text-sm">No volume tiers. Add “from 12 units, 15% off”.</p>}
            >
                {rows.map((r) => (
                    <TableRow key={r.id}>
                        <TableCell className="pl-6">{r.scope === "product" ? pName(r.product_id) : `Category: ${cName(r.category_id)}`}</TableCell>
                        <TableCell>{r.min_quantity}</TableCell>
                        <TableCell>{discountLabel(r.discount_type, r.discount_value, fmt)}</TableCell>
                        <TableCell className="text-muted-foreground">{sName(r.shop_id)}</TableCell>
                        <TableCell><ActiveBadge active={r.is_active} /></TableCell>
                        <TableCell className="pr-6 text-right">
                            <RowActions onEdit={() => openEdit(r)} onToggle={() => toggle(r)} isActive={r.is_active} onDelete={() => setDel(r)} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableShell>

            <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editing ? "Edit Volume Tier" : "New Volume Tier"}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <ScopeFields
                            scope={f.scope} productId={f.product_id} categoryId={f.category_id}
                            onScope={(s) => setF({ ...f, scope: s })} onProduct={(v) => setF({ ...f, product_id: v })}
                            onCategory={(v) => setF({ ...f, category_id: v })} refs={refs} includeAll={false}
                        />
                        <div className="space-y-1.5">
                            <Label>From quantity</Label>
                            <Input type="number" min={1} value={f.min_quantity} onChange={(e) => setF({ ...f, min_quantity: e.target.value })} />
                        </div>
                        <DiscountFields type={f.discount_type} value={f.discount_value}
                            onType={(t) => setF({ ...f, discount_type: t })} onValue={(v) => setF({ ...f, discount_value: v })} />
                        <ShopField value={f.shop_id} onChange={(v) => setF({ ...f, shop_id: v })} refs={refs} />
                        <div className="flex items-center gap-2">
                            <Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} id="t-active" />
                            <Label htmlFor="t-active">Active</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Update" : "Create"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete this tier?</AlertDialogTitle>
                        <AlertDialogDescription>This can’t be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// ── Scheduled discounts tab ────────────────────────────────────────────────

function SchedulesTab({ rows, loading, refs, fmt, reload, pName, cName, sName }: {
    rows: ScheduledDiscountResponse[]; loading: boolean; refs: Refs; fmt: (n: number) => string; reload: () => void;
    pName: NameFn; cName: NameFn; sName: NameFn;
}) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<ScheduledDiscountResponse | null>(null);
    const [del, setDel] = useState<ScheduledDiscountResponse | null>(null);
    const blank = {
        name: "", scope: "all", product_id: "", category_id: "", shop_id: "",
        discount_type: "percentage" as DiscountType, discount_value: "",
        days: [] as number[], start_time: "", end_time: "", starts_on: "", ends_on: "", is_active: true,
    };
    const [f, setF] = useState(blank);
    const [busy, setBusy] = useState(false);

    const maskToDays = (mask: number | null) => {
        if (!mask) return [];
        return DOW.map((_, i) => i).filter((i) => (mask >> i) & 1);
    };
    const daysToMask = (days: number[]) => (days.length === 0 ? null : days.reduce((m, d) => m | (1 << d), 0));

    const openNew = () => { setEditing(null); setF(blank); setOpen(true); };
    const openEdit = (r: ScheduledDiscountResponse) => {
        setEditing(r);
        setF({
            name: r.name, scope: r.scope, product_id: r.product_id ? String(r.product_id) : "",
            category_id: r.category_id ? String(r.category_id) : "", shop_id: r.shop_id ? String(r.shop_id) : "",
            discount_type: r.discount_type, discount_value: String(r.discount_value),
            days: maskToDays(r.day_of_week_mask), start_time: r.start_time ?? "", end_time: r.end_time ?? "",
            starts_on: r.starts_on ?? "", ends_on: r.ends_on ?? "", is_active: r.is_active,
        });
        setOpen(true);
    };

    const save = async () => {
        if (!f.name.trim()) return toast.error("Name is required");
        const dv = Number(f.discount_value);
        if (Number.isNaN(dv) || dv < 0) return toast.error("Discount value is invalid");
        if (f.scope === "product" && !f.product_id) return toast.error("Pick a product");
        if (f.scope === "category" && !f.category_id) return toast.error("Pick a category");
        const body = {
            name: f.name.trim(), scope: f.scope as "product" | "category" | "all",
            product_id: f.scope === "product" ? Number(f.product_id) : null,
            category_id: f.scope === "category" ? Number(f.category_id) : null,
            shop_id: num(f.shop_id), discount_type: f.discount_type, discount_value: dv,
            day_of_week_mask: daysToMask(f.days),
            start_time: f.start_time || null, end_time: f.end_time || null,
            starts_on: f.starts_on || null, ends_on: f.ends_on || null, is_active: f.is_active,
        };
        setBusy(true);
        try {
            if (editing) { await UpdateScheduledDiscount(editing.id, body); toast.success("Updated"); }
            else { await CreateScheduledDiscount(body); toast.success("Created"); }
            setOpen(false); reload();
        } catch (e) { handleErrorMessage(e, "Failed to save"); }
        finally { setBusy(false); }
    };

    const toggle = async (r: ScheduledDiscountResponse) => {
        try { await UpdateScheduledDiscount(r.id, { is_active: !r.is_active }); reload(); }
        catch (e) { handleErrorMessage(e, "Failed"); }
    };
    const remove = async () => {
        if (!del) return;
        try { await DeleteScheduledDiscount(del.id); toast.success("Deleted"); setDel(null); reload(); }
        catch (e) { handleErrorMessage(e, "Failed to delete"); }
    };

    const windowText = (r: ScheduledDiscountResponse) => {
        const parts: string[] = [];
        if (r.day_of_week_mask) parts.push(maskToDays(r.day_of_week_mask).map((i) => DOW[i]).join(","));
        if (r.start_time && r.end_time) parts.push(`${r.start_time}–${r.end_time}`);
        if (r.starts_on || r.ends_on) parts.push(`${r.starts_on ?? "…"}→${r.ends_on ?? "…"}`);
        return parts.join(" · ") || "Always";
    };

    return (
        <>
            <TableShell
                headers={["Name", "Target", "Discount", "Window", "Shop", "Status"]}
                loading={loading} count={rows.length} onNew={openNew}
                empty={<p className="text-muted-foreground text-sm">No scheduled discounts. Add a happy-hour or weekend sale.</p>}
            >
                {rows.map((r) => (
                    <TableRow key={r.id}>
                        <TableCell className="pl-6 font-medium">{r.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                            {r.scope === "all" ? "Everything" : r.scope === "product" ? pName(r.product_id) : `Cat: ${cName(r.category_id)}`}
                        </TableCell>
                        <TableCell>{discountLabel(r.discount_type, r.discount_value, fmt)}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{windowText(r)}</TableCell>
                        <TableCell className="text-muted-foreground">{sName(r.shop_id)}</TableCell>
                        <TableCell><ActiveBadge active={r.is_active} /></TableCell>
                        <TableCell className="pr-6 text-right">
                            <RowActions onEdit={() => openEdit(r)} onToggle={() => toggle(r)} isActive={r.is_active} onDelete={() => setDel(r)} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableShell>

            <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editing ? "Edit Scheduled Discount" : "New Scheduled Discount"}</DialogTitle></DialogHeader>
                    <div className="max-h-[70vh] space-y-4 overflow-y-auto pt-2 pr-1">
                        <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Friday Happy Hour" />
                        </div>
                        <ScopeFields
                            scope={f.scope} productId={f.product_id} categoryId={f.category_id}
                            onScope={(s) => setF({ ...f, scope: s })} onProduct={(v) => setF({ ...f, product_id: v })}
                            onCategory={(v) => setF({ ...f, category_id: v })} refs={refs} includeAll
                        />
                        <DiscountFields type={f.discount_type} value={f.discount_value}
                            onType={(t) => setF({ ...f, discount_type: t })} onValue={(v) => setF({ ...f, discount_value: v })} />
                        <div className="space-y-1.5">
                            <Label>Days of week <span className="text-muted-foreground text-xs">(none = every day)</span></Label>
                            <div className="flex flex-wrap gap-1.5">
                                {DOW.map((d, i) => (
                                    <button
                                        key={d} type="button"
                                        onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i] })}
                                        className={cn("rounded-md border px-2.5 py-1 text-xs",
                                            f.days.includes(i) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5"><Label>Start time</Label>
                                <TimePicker
                                    className="w-full" format="HH:mm" minuteStep={15}
                                    value={f.start_time ? dayjs(f.start_time, "HH:mm") : null}
                                    onChange={(t) => setF({ ...f, start_time: t ? t.format("HH:mm") : "" })}
                                /></div>
                            <div className="space-y-1.5"><Label>End time</Label>
                                <TimePicker
                                    className="w-full" format="HH:mm" minuteStep={15}
                                    value={f.end_time ? dayjs(f.end_time, "HH:mm") : null}
                                    onChange={(t) => setF({ ...f, end_time: t ? t.format("HH:mm") : "" })}
                                /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5"><Label>Starts on</Label>
                                <DatePicker
                                    className="w-full" format="DD MMM YYYY"
                                    value={f.starts_on ? dayjs(f.starts_on) : null}
                                    onChange={(d) => setF({ ...f, starts_on: d ? d.format("YYYY-MM-DD") : "" })}
                                /></div>
                            <div className="space-y-1.5"><Label>Ends on</Label>
                                <DatePicker
                                    className="w-full" format="DD MMM YYYY"
                                    value={f.ends_on ? dayjs(f.ends_on) : null}
                                    onChange={(d) => setF({ ...f, ends_on: d ? d.format("YYYY-MM-DD") : "" })}
                                /></div>
                        </div>
                        <ShopField value={f.shop_id} onChange={(v) => setF({ ...f, shop_id: v })} refs={refs} />
                        <div className="flex items-center gap-2">
                            <Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} id="s-active" />
                            <Label htmlFor="s-active">Active</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Update" : "Create"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete “{del?.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>This can’t be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// ── Customer pricing tab ───────────────────────────────────────────────────

const LOYALTY_TIERS = ["bronze", "silver", "gold", "platinum"];

function CustomerPricesTab({ rows, loading, refs, fmt, reload, pName, cName, custName }: {
    rows: CustomerPriceResponse[]; loading: boolean; refs: Refs; fmt: (n: number) => string; reload: () => void;
    pName: NameFn; cName: NameFn; custName: NameFn;
}) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<CustomerPriceResponse | null>(null);
    const [del, setDel] = useState<CustomerPriceResponse | null>(null);
    const blank = {
        target: "tier", customer_id: "", loyalty_tier: "gold",
        scope: "product", product_id: "", category_id: "",
        discount_type: "percentage" as DiscountType, discount_value: "", is_active: true,
    };
    const [f, setF] = useState(blank);
    const [busy, setBusy] = useState(false);

    const openNew = () => { setEditing(null); setF(blank); setOpen(true); };
    const openEdit = (r: CustomerPriceResponse) => {
        setEditing(r);
        setF({
            target: r.customer_id ? "customer" : "tier",
            customer_id: r.customer_id ? String(r.customer_id) : "",
            loyalty_tier: r.loyalty_tier ?? "gold",
            scope: r.scope, product_id: r.product_id ? String(r.product_id) : "",
            category_id: r.category_id ? String(r.category_id) : "",
            discount_type: r.discount_type, discount_value: String(r.discount_value), is_active: r.is_active,
        });
        setOpen(true);
    };

    const save = async () => {
        const dv = Number(f.discount_value);
        if (Number.isNaN(dv) || dv < 0) return toast.error("Discount value is invalid");
        if (f.target === "customer" && !f.customer_id) return toast.error("Pick a customer");
        if (f.scope === "product" && !f.product_id) return toast.error("Pick a product");
        if (f.scope === "category" && !f.category_id) return toast.error("Pick a category");
        const body = {
            customer_id: f.target === "customer" ? Number(f.customer_id) : null,
            loyalty_tier: f.target === "tier" ? f.loyalty_tier : null,
            scope: f.scope as "product" | "category",
            product_id: f.scope === "product" ? Number(f.product_id) : null,
            category_id: f.scope === "category" ? Number(f.category_id) : null,
            discount_type: f.discount_type, discount_value: dv, is_active: f.is_active,
        };
        setBusy(true);
        try {
            if (editing) { await UpdateCustomerPrice(editing.id, body); toast.success("Updated"); }
            else { await CreateCustomerPrice(body); toast.success("Created"); }
            setOpen(false); reload();
        } catch (e) { handleErrorMessage(e, "Failed to save"); }
        finally { setBusy(false); }
    };

    const toggle = async (r: CustomerPriceResponse) => {
        try { await UpdateCustomerPrice(r.id, { is_active: !r.is_active }); reload(); }
        catch (e) { handleErrorMessage(e, "Failed"); }
    };
    const remove = async () => {
        if (!del) return;
        try { await DeleteCustomerPrice(del.id); toast.success("Deleted"); setDel(null); reload(); }
        catch (e) { handleErrorMessage(e, "Failed to delete"); }
    };

    return (
        <>
            <TableShell
                headers={["Who", "Target", "Discount", "Status"]}
                loading={loading} count={rows.length} onNew={openNew}
                empty={<p className="text-muted-foreground text-sm">No customer pricing. Set a gold-tier rate or a per-customer price.</p>}
            >
                {rows.map((r) => (
                    <TableRow key={r.id}>
                        <TableCell className="pl-6">
                            {r.customer_id ? custName(r.customer_id) : <span className="capitalize">{r.loyalty_tier} tier</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                            {r.scope === "product" ? pName(r.product_id) : `Category: ${cName(r.category_id)}`}
                        </TableCell>
                        <TableCell>{discountLabel(r.discount_type, r.discount_value, fmt)}</TableCell>
                        <TableCell><ActiveBadge active={r.is_active} /></TableCell>
                        <TableCell className="pr-6 text-right">
                            <RowActions onEdit={() => openEdit(r)} onToggle={() => toggle(r)} isActive={r.is_active} onDelete={() => setDel(r)} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableShell>

            <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editing ? "Edit Customer Price" : "New Customer Price"}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label>For</Label>
                            <Select value={f.target} onValueChange={(v) => setF({ ...f, target: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="tier">A loyalty tier</SelectItem>
                                    <SelectItem value="customer">One customer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {f.target === "tier" ? (
                            <div className="space-y-1.5">
                                <Label>Loyalty tier</Label>
                                <Select value={f.loyalty_tier} onValueChange={(v) => setF({ ...f, loyalty_tier: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {LOYALTY_TIERS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <Label>Customer</Label>
                                <Select value={f.customer_id} onValueChange={(v) => setF({ ...f, customer_id: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                                    <SelectContent>
                                        {refs.customers.map((c) => (
                                            <SelectItem key={c.id} value={String(c.id)}>{c.first_name} {c.last_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <ScopeFields
                            scope={f.scope} productId={f.product_id} categoryId={f.category_id}
                            onScope={(s) => setF({ ...f, scope: s })} onProduct={(v) => setF({ ...f, product_id: v })}
                            onCategory={(v) => setF({ ...f, category_id: v })} refs={refs} includeAll={false}
                        />
                        <DiscountFields type={f.discount_type} value={f.discount_value}
                            onType={(t) => setF({ ...f, discount_type: t })} onValue={(v) => setF({ ...f, discount_value: v })} />
                        <div className="flex items-center gap-2">
                            <Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} id="c-active" />
                            <Label htmlFor="c-active">Active</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Update" : "Create"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete this customer price?</AlertDialogTitle>
                        <AlertDialogDescription>This can’t be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
