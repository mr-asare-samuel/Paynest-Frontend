"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Plus, MoreHorizontal, Pencil, Trash2, Search, RefreshCcw, TicketPercent, Power,
} from "lucide-react";
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
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { toast } from "sonner";
import PageHeader from "@/components/(shared-components)/PageHeader";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { useCurrency } from "@/hooks/useCurrency";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import {
    GetPromoCodes, CreatePromoCode, UpdatePromoCode, DeletePromoCode,
} from "@/(api-handlers)/promoCodesHandler";
import { GetProducts } from "@/(api-handlers)/productsHandler";
import { GetProductCategories } from "@/(api-handlers)/productCategoriesHandler";
import { PromoCodeResponse } from "@/interfaces/promoCodes";
import { ProductResponse } from "@/interfaces/products";
import { ProductCategoriesResponse } from "@/interfaces/productCategories";

type Scope = "all" | "product" | "category";
type DType = "percentage" | "amount_off";

interface FormState {
    code: string;
    description: string;
    discount_type: DType;
    discount_value: string;
    scope: Scope;
    product_id: string;
    category_id: string;
    min_order_amount: string;
    max_discount_amount: string;
    usage_limit: string;
    per_customer_limit: string;
    starts_at: string;
    ends_at: string;
    is_active: boolean;
}

const blank: FormState = {
    code: "", description: "", discount_type: "percentage", discount_value: "",
    scope: "all", product_id: "", category_id: "",
    min_order_amount: "", max_discount_amount: "", usage_limit: "", per_customer_limit: "",
    starts_at: "", ends_at: "", is_active: true,
};

const numOrNull = (s: string): number | null => (s.trim() === "" ? null : Number(s));

export default function PromoCodesPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const fmt = useCurrency();
    const role = (user?.role || "attendant").toLowerCase();
    const isAllowed = role === "manager" || role === "admin" || role === "superadmin";

    const [rows, setRows] = useState<PromoCodeResponse[]>([]);
    const [products, setProducts] = useState<ProductResponse[]>([]);
    const [categories, setCategories] = useState<ProductCategoriesResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<PromoCodeResponse | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<PromoCodeResponse | null>(null);
    const [form, setForm] = useState<FormState>(blank);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user && !isAllowed) router.replace("/dashboard");
    }, [user, isAllowed, router]);

    const load = async () => {
        setLoading(true);
        try {
            const [pc, prods, cats] = await Promise.all([
                GetPromoCodes(),
                GetProducts().catch(() => []),
                GetProductCategories().catch(() => []),
            ]);
            setRows(pc);
            setProducts(prods);
            setCategories(cats);
        } catch (e) {
            handleErrorMessage(e, "Failed to load promo codes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAllowed) load();
    }, [isAllowed]);

    const productName = (id: number | null) => products.find((p) => p.id === id)?.name ?? `#${id}`;
    const categoryName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? `#${id}`;

    const openCreate = () => {
        setEditing(null);
        setForm(blank);
        setDialogOpen(true);
    };

    const openEdit = (row: PromoCodeResponse) => {
        setEditing(row);
        setForm({
            code: row.code,
            description: row.description ?? "",
            discount_type: row.discount_type,
            discount_value: String(row.discount_value),
            scope: row.scope,
            product_id: row.product_id ? String(row.product_id) : "",
            category_id: row.category_id ? String(row.category_id) : "",
            min_order_amount: row.min_order_amount != null ? String(row.min_order_amount) : "",
            max_discount_amount: row.max_discount_amount != null ? String(row.max_discount_amount) : "",
            usage_limit: row.usage_limit != null ? String(row.usage_limit) : "",
            per_customer_limit: row.per_customer_limit != null ? String(row.per_customer_limit) : "",
            starts_at: row.starts_at ?? "",
            ends_at: row.ends_at ?? "",
            is_active: row.is_active,
        });
        setDialogOpen(true);
    };

    const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async () => {
        if (!form.code.trim()) return toast.error("Code is required");
        const dv = Number(form.discount_value);
        if (!dv || dv <= 0) return toast.error("Discount value must be positive");
        if (form.scope === "product" && !form.product_id) return toast.error("Pick a product for a product-scoped code");
        if (form.scope === "category" && !form.category_id) return toast.error("Pick a category for a category-scoped code");

        const body = {
            description: form.description || undefined,
            discount_type: form.discount_type,
            discount_value: dv,
            scope: form.scope,
            product_id: form.scope === "product" ? Number(form.product_id) : null,
            category_id: form.scope === "category" ? Number(form.category_id) : null,
            min_order_amount: numOrNull(form.min_order_amount),
            max_discount_amount: numOrNull(form.max_discount_amount),
            usage_limit: numOrNull(form.usage_limit),
            per_customer_limit: numOrNull(form.per_customer_limit),
            starts_at: form.starts_at || null,
            ends_at: form.ends_at || null,
            is_active: form.is_active,
        };

        setSubmitting(true);
        try {
            if (editing) {
                await UpdatePromoCode(editing.id, body);
                toast.success("Promo code updated");
            } else {
                await CreatePromoCode({ ...body, code: form.code.trim() });
                toast.success("Promo code created");
            }
            setDialogOpen(false);
            load();
        } catch (e) {
            handleErrorMessage(e, editing ? "Failed to update promo code" : "Failed to create promo code");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (row: PromoCodeResponse) => {
        try {
            await UpdatePromoCode(row.id, { is_active: !row.is_active });
            toast.success(row.is_active ? "Deactivated" : "Activated");
            load();
        } catch (e) {
            handleErrorMessage(e, "Failed to update status");
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await DeletePromoCode(deleteTarget.id);
            toast.success("Promo code deleted");
            setDeleteTarget(null);
            load();
        } catch (e) {
            handleErrorMessage(e, "Failed to delete promo code");
        }
    };

    const filtered = useMemo(
        () => rows.filter((r) => r.code.toLowerCase().includes(search.toLowerCase())
            || (r.description ?? "").toLowerCase().includes(search.toLowerCase())),
        [rows, search],
    );

    const fmtDiscount = (r: PromoCodeResponse) =>
        r.discount_type === "percentage" ? `${r.discount_value}% off` : `${fmt(r.discount_value)} off`;

    if (!user || !isAllowed) {
        return (
            <div className="flex items-center justify-center py-24">
                <Skeleton className="size-6 rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Promo Codes"
                description="Coupon codes customers enter at checkout. Usage limits, date windows and scope are enforced by the backend."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-9" onClick={load} disabled={loading} aria-label="Refresh">
                            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                        <Button onClick={openCreate}>
                            <Plus className="mr-2 size-4" /> New Code
                        </Button>
                    </div>
                }
            />

            <div className="relative max-w-sm">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input placeholder="Search codes…" className="h-9 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Code</TableHead>
                                <TableHead>Discount</TableHead>
                                <TableHead>Scope</TableHead>
                                <TableHead>Limits</TableHead>
                                <TableHead>Window</TableHead>
                                <TableHead className="w-[100px]">Status</TableHead>
                                <TableHead className="w-[60px] pr-6 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-20 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <TicketPercent className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-foreground font-semibold">No promo codes</p>
                                        <p className="text-muted-foreground mt-1 text-sm">Create one to run a coupon campaign.</p>
                                    </TableCell>
                                </TableRow>
                            ) : filtered.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell className="pl-6">
                                        <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm font-semibold">{r.code}</span>
                                        {r.description && <p className="text-muted-foreground mt-1 text-xs">{r.description}</p>}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">{fmtDiscount(r)}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {r.scope === "all" ? "Whole order"
                                            : r.scope === "product" ? `Product: ${productName(r.product_id)}`
                                                : `Category: ${categoryName(r.category_id)}`}
                                        {r.min_order_amount != null && <div>min {fmt(r.min_order_amount)}</div>}
                                        {r.max_discount_amount != null && <div>cap {fmt(r.max_discount_amount)}</div>}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        <div>used {r.times_used}{r.usage_limit != null ? ` / ${r.usage_limit}` : ""}</div>
                                        {r.per_customer_limit != null && <div>{r.per_customer_limit}/customer</div>}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {r.starts_at ? new Date(r.starts_at).toLocaleDateString() : "—"}
                                        {" → "}
                                        {r.ends_at ? new Date(r.ends_at).toLocaleDateString() : "—"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "rounded-full text-xs",
                                            r.is_active ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground",
                                        )}>
                                            {r.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8" aria-label="Actions">
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEdit(r)}>
                                                    <Pencil className="mr-2 size-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => toggleActive(r)}>
                                                    <Power className="mr-2 size-4" /> {r.is_active ? "Deactivate" : "Activate"}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(r)}>
                                                    <Trash2 className="mr-2 size-4" /> Delete
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
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit Promo Code" : "New Promo Code"}</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[70vh] space-y-4 overflow-y-auto pt-2 pr-1">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Code <span className="text-destructive">*</span></Label>
                                <Input
                                    value={form.code}
                                    onChange={(e) => set("code", e.target.value.toUpperCase())}
                                    placeholder="SAVE10"
                                    disabled={!!editing}
                                    className="font-mono"
                                />
                            </div>
                            <div className="flex items-end gap-2 pb-1">
                                <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} id="active" />
                                <Label htmlFor="active">Active</Label>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Launch week coupon" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Discount type</Label>
                                <Select value={form.discount_type} onValueChange={(v) => set("discount_type", v as DType)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percentage">Percentage off</SelectItem>
                                        <SelectItem value="amount_off">Fixed amount off</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Value <span className="text-destructive">*</span></Label>
                                <Input type="number" min={0} step="0.01" value={form.discount_value}
                                    onChange={(e) => set("discount_value", e.target.value)}
                                    placeholder={form.discount_type === "percentage" ? "10" : "5.00"} />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Applies to</Label>
                            <Select value={form.scope} onValueChange={(v) => set("scope", v as Scope)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Whole order</SelectItem>
                                    <SelectItem value="product">A single product</SelectItem>
                                    <SelectItem value="category">A category</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {form.scope === "product" && (
                            <div className="space-y-1.5">
                                <Label>Product</Label>
                                <Select value={form.product_id} onValueChange={(v) => set("product_id", v)}>
                                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                                    <SelectContent>
                                        {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {form.scope === "category" && (
                            <div className="space-y-1.5">
                                <Label>Category</Label>
                                <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
                                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                    <SelectContent>
                                        {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Min order amount</Label>
                                <Input type="number" min={0} step="0.01" value={form.min_order_amount}
                                    onChange={(e) => set("min_order_amount", e.target.value)} placeholder="optional" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Max discount (cap)</Label>
                                <Input type="number" min={0} step="0.01" value={form.max_discount_amount}
                                    onChange={(e) => set("max_discount_amount", e.target.value)} placeholder="optional" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Total uses limit</Label>
                                <Input type="number" min={1} value={form.usage_limit}
                                    onChange={(e) => set("usage_limit", e.target.value)} placeholder="unlimited" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Uses per customer</Label>
                                <Input type="number" min={1} value={form.per_customer_limit}
                                    onChange={(e) => set("per_customer_limit", e.target.value)} placeholder="unlimited" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Starts</Label>
                                <DatePicker
                                    showTime
                                    className="w-full"
                                    format="DD MMM YYYY HH:mm"
                                    value={form.starts_at ? dayjs(form.starts_at) : null}
                                    onChange={(d) => set("starts_at", d ? d.toISOString() : "")}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Ends</Label>
                                <DatePicker
                                    showTime
                                    className="w-full"
                                    format="DD MMM YYYY HH:mm"
                                    value={form.ends_at ? dayjs(form.ends_at) : null}
                                    onChange={(d) => set("ends_at", d ? d.toISOString() : "")}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={submit} disabled={submitting}>
                            {submitting ? "Saving…" : editing ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete promo code “{deleteTarget?.code}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This can’t be undone. Past redemptions are kept for the record.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
