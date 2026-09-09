"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Plus, MoreHorizontal, Pencil, Trash2, Search, RefreshCcw, Sparkles, Power, X,
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import PageHeader from "@/components/(shared-components)/PageHeader";
import Pagination from "@/components/(shared-components)/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { useCurrency } from "@/hooks/useCurrency";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import {
    GetBundles, CreateBundle, UpdateBundle, DeleteBundle,
} from "@/(api-handlers)/bundlesHandler";
import { GetProducts } from "@/(api-handlers)/productsHandler";
import { getOrganizationShops } from "@/(api-handlers)/organizationShopsHandler";
import { BundleResponse } from "@/interfaces/bundles";
import { ProductResponse } from "@/interfaces/products";
import { OrganizationShopResponse } from "@/interfaces/organizationShops";

interface ItemRow { product_id: string; quantity: string; }
interface FormState {
    name: string;
    shop_id: string;
    sku: string;
    description: string;
    bundle_price: string;
    is_active: boolean;
    items: ItemRow[];
}

const blank: FormState = {
    name: "", shop_id: "", sku: "", description: "", bundle_price: "", is_active: true,
    items: [{ product_id: "", quantity: "1" }],
};

export default function BundlesPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const fmt = useCurrency();
    const role = (user?.role || "attendant").toLowerCase();
    const isAllowed = role === "manager" || role === "admin" || role === "superadmin";

    const [rows, setRows] = useState<BundleResponse[]>([]);
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [productsByShop, setProductsByShop] = useState<Record<number, ProductResponse[]>>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<BundleResponse | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<BundleResponse | null>(null);
    const [form, setForm] = useState<FormState>(blank);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user && !isAllowed) router.replace("/dashboard");
    }, [user, isAllowed, router]);

    const load = async () => {
        setLoading(true);
        try {
            const [bundles, shopList] = await Promise.all([
                GetBundles(),
                getOrganizationShops().catch(() => []),
            ]);
            setRows(bundles);
            setShops(shopList);
        } catch (e) {
            handleErrorMessage(e, "Failed to load bundles");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAllowed) load();
    }, [isAllowed]);

    const loadProducts = async (shopId: number) => {
        if (productsByShop[shopId]) return;
        try {
            const p = await GetProducts(shopId);
            setProductsByShop((m) => ({ ...m, [shopId]: p }));
        } catch {
            toast.error("Failed to load products for this shop");
        }
    };

    const openCreate = () => {
        setEditing(null);
        setForm(blank);
        setDialogOpen(true);
    };

    const openEdit = (b: BundleResponse) => {
        setEditing(b);
        setForm({
            name: b.name,
            shop_id: String(b.shop_id),
            sku: b.sku ?? "",
            description: b.description ?? "",
            bundle_price: String(b.bundle_price),
            is_active: b.is_active,
            items: b.items.length
                ? b.items.map((i) => ({ product_id: String(i.product_id), quantity: String(i.quantity) }))
                : [{ product_id: "", quantity: "1" }],
        });
        loadProducts(b.shop_id);
        setDialogOpen(true);
    };

    const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
    const setItem = (idx: number, patch: Partial<ItemRow>) =>
        setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
    const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { product_id: "", quantity: "1" }] }));
    const removeItem = (idx: number) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

    const shopProducts = useMemo(
        () => (form.shop_id ? (productsByShop[Number(form.shop_id)] ?? []) : []),
        [form.shop_id, productsByShop],
    );

    const listPrice = useMemo(() => {
        return form.items.reduce((sum, it) => {
            const p = shopProducts.find((x) => x.id === Number(it.product_id));
            return sum + (p ? p.selling_price * (Number(it.quantity) || 0) : 0);
        }, 0);
    }, [form.items, shopProducts]);

    const submit = async () => {
        if (!form.name.trim()) return toast.error("Name is required");
        if (!form.shop_id) return toast.error("Pick a shop");
        const price = Number(form.bundle_price);
        if (Number.isNaN(price) || price < 0) return toast.error("Bundle price is invalid");
        const items = form.items
            .filter((it) => it.product_id)
            .map((it) => ({ product_id: Number(it.product_id), quantity: Math.max(1, Number(it.quantity) || 1) }));
        if (items.length === 0) return toast.error("Add at least one product");

        setSubmitting(true);
        try {
            if (editing) {
                await UpdateBundle(editing.id, {
                    name: form.name.trim(),
                    sku: form.sku || undefined,
                    description: form.description || undefined,
                    bundle_price: price,
                    is_active: form.is_active,
                    items,
                });
                toast.success("Bundle updated");
            } else {
                await CreateBundle({
                    name: form.name.trim(),
                    shop_id: Number(form.shop_id),
                    sku: form.sku || undefined,
                    description: form.description || undefined,
                    bundle_price: price,
                    is_active: form.is_active,
                    items,
                });
                toast.success("Bundle created");
            }
            setDialogOpen(false);
            load();
        } catch (e) {
            handleErrorMessage(e, editing ? "Failed to update bundle" : "Failed to create bundle");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (b: BundleResponse) => {
        try {
            await UpdateBundle(b.id, { is_active: !b.is_active });
            toast.success(b.is_active ? "Deactivated" : "Activated");
            load();
        } catch (e) {
            handleErrorMessage(e, "Failed to update status");
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await DeleteBundle(deleteTarget.id);
            toast.success("Bundle deleted");
            setDeleteTarget(null);
            load();
        } catch (e) {
            handleErrorMessage(e, "Failed to delete bundle");
        }
    };

    const shopName = (id: number) => shops.find((s) => s.id === id)?.name ?? `Shop #${id}`;
    const filtered = rows.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
    const pg = usePagination(filtered, 10);

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
                title="Bundles"
                description="Fixed-price combos. Selling a bundle at the POS explodes it into its component lines and deducts each product's stock."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-9" onClick={load} disabled={loading} aria-label="Refresh">
                            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                        <Button onClick={openCreate}>
                            <Plus className="mr-2 size-4" /> New Bundle
                        </Button>
                    </div>
                }
            />

            <div className="relative max-w-sm">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input placeholder="Search bundles…" className="h-9 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Bundle</TableHead>
                                <TableHead>Shop</TableHead>
                                <TableHead>Components</TableHead>
                                <TableHead className="w-[120px]">Price</TableHead>
                                <TableHead className="w-[100px]">Status</TableHead>
                                <TableHead className="w-[60px] pr-6 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-20 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <Sparkles className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-foreground font-semibold">No bundles yet</p>
                                        <p className="text-muted-foreground mt-1 text-sm">Combine products into a single fixed-price offer.</p>
                                    </TableCell>
                                </TableRow>
                            ) : pg.pageItems.map((b) => (
                                <TableRow key={b.id}>
                                    <TableCell className="pl-6 font-semibold">
                                        {b.name}
                                        {b.sku && <span className="text-muted-foreground ml-2 font-mono text-xs">{b.sku}</span>}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{shopName(b.shop_id)}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {b.items.map((i) => `${i.quantity}× ${i.product_name ?? `#${i.product_id}`}`).join(", ")}
                                    </TableCell>
                                    <TableCell className="font-medium">{fmt(b.bundle_price)}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "rounded-full text-xs",
                                            b.is_active ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground",
                                        )}>
                                            {b.is_active ? "Active" : "Inactive"}
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
                                                <DropdownMenuItem onClick={() => openEdit(b)}>
                                                    <Pencil className="mr-2 size-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => toggleActive(b)}>
                                                    <Power className="mr-2 size-4" /> {b.is_active ? "Deactivate" : "Activate"}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(b)}>
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
                {!loading && filtered.length > 0 && (
                    <div className="border-border bg-muted/30 border-t px-4 py-3">
                        <Pagination page={pg.page} totalPages={pg.totalPages} onPageChange={pg.setPage} total={pg.total} pageSize={pg.pageSize} onPageSizeChange={pg.setPageSize} />
                    </div>
                )}
            </Card>

            <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit Bundle" : "New Bundle"}</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[70vh] space-y-4 overflow-y-auto pt-2 pr-1">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Name <span className="text-destructive">*</span></Label>
                                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Lunch Combo" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>SKU</Label>
                                <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="optional" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Shop <span className="text-destructive">*</span></Label>
                            <Select
                                value={form.shop_id}
                                onValueChange={(v) => { set("shop_id", v); set("items", [{ product_id: "", quantity: "1" }]); loadProducts(Number(v)); }}
                                disabled={!!editing}
                            >
                                <SelectTrigger><SelectValue placeholder="Select shop" /></SelectTrigger>
                                <SelectContent>
                                    {shops.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="min-h-[60px] resize-none" />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Components</Label>
                                <Button type="button" variant="ghost" size="sm" onClick={addItem} disabled={!form.shop_id}>
                                    <Plus className="mr-1 size-3.5" /> Add
                                </Button>
                            </div>
                            {form.items.map((it, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <Select value={it.product_id} onValueChange={(v) => setItem(idx, { product_id: v })} disabled={!form.shop_id}>
                                        <SelectTrigger className="flex-1"><SelectValue placeholder="Product" /></SelectTrigger>
                                        <SelectContent>
                                            {shopProducts.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        type="number" min={1} className="w-20"
                                        value={it.quantity}
                                        onChange={(e) => setItem(idx, { quantity: e.target.value })}
                                    />
                                    <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0"
                                        onClick={() => removeItem(idx)} disabled={form.items.length === 1}>
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Bundle price <span className="text-destructive">*</span></Label>
                                <Input type="number" min={0} step="0.01" value={form.bundle_price}
                                    onChange={(e) => set("bundle_price", e.target.value)} />
                            </div>
                            <div className="flex flex-col justify-end pb-1 text-xs">
                                <span className="text-muted-foreground">Component list value</span>
                                <span className="font-medium">{fmt(listPrice)}</span>
                                {Number(form.bundle_price) > 0 && listPrice > 0 && (
                                    <span className={cn("mt-0.5", Number(form.bundle_price) < listPrice ? "text-success" : "text-muted-foreground")}>
                                        {Number(form.bundle_price) < listPrice
                                            ? `saves ${fmt(listPrice - Number(form.bundle_price))}`
                                            : "no saving vs. list"}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} id="b-active" />
                            <Label htmlFor="b-active">Active</Label>
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
                        <AlertDialogTitle>Delete bundle “{deleteTarget?.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>This can’t be undone.</AlertDialogDescription>
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
