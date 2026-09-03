"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCcw, Boxes, AlertTriangle } from "lucide-react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import PageHeader from "@/components/(shared-components)/PageHeader";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { useCurrency } from "@/hooks/useCurrency";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import {
    GetBatches, GetExpiringBatches, CreateBatch,
} from "@/(api-handlers)/inventoryTrackingHandler";
import { GetProducts } from "@/(api-handlers)/productsHandler";
import { getOrganizationShops } from "@/(api-handlers)/organizationShopsHandler";
import { BatchResponse } from "@/interfaces/inventoryTracking";
import { ProductResponse } from "@/interfaces/products";
import { OrganizationShopResponse } from "@/interfaces/organizationShops";

function daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const d = new Date(dateStr + "T00:00:00");
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export default function BatchesPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const fmt = useCurrency();
    const role = (user?.role || "attendant").toLowerCase();
    const isAllowed = role === "manager" || role === "admin" || role === "superadmin";

    const [view, setView] = useState<"all" | "expiring">("all");
    const [rows, setRows] = useState<BatchResponse[]>([]);
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [shopId, setShopId] = useState<string>("all");
    const [productsByShop, setProductsByShop] = useState<Record<number, ProductResponse[]>>({});
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const blank = { shop_id: "", product_id: "", batch_number: "", quantity: "", unit_cost: "", expiry_date: "", received_date: "" };
    const [f, setF] = useState(blank);

    useEffect(() => {
        if (user && !isAllowed) router.replace("/dashboard");
    }, [user, isAllowed, router]);

    const load = async () => {
        setLoading(true);
        try {
            const params = shopId === "all" ? {} : { shop_id: Number(shopId) };
            const [batches, shopList] = await Promise.all([
                view === "expiring" ? GetExpiringBatches({ days: 30, ...params }) : GetBatches({ active_only: true, ...params }),
                shops.length ? Promise.resolve(shops) : getOrganizationShops().catch(() => []),
            ]);
            setRows(batches);
            if (!shops.length) setShops(shopList);
        } catch (e) {
            handleErrorMessage(e, "Failed to load batches");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAllowed) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAllowed, view, shopId]);

    const loadProducts = async (sid: number) => {
        if (productsByShop[sid]) return;
        try {
            const prods = await GetProducts(sid);
            setProductsByShop((m) => ({ ...m, [sid]: prods }));
        } catch {
            toast.error("Failed to load products");
        }
    };

    const shopName = (id: number) => shops.find((s) => s.id === id)?.name ?? `#${id}`;
    const formProducts = f.shop_id ? (productsByShop[Number(f.shop_id)] ?? []) : [];
    const productName = useMemo(() => {
        const all = Object.values(productsByShop).flat();
        return (id: number) => all.find((p) => p.id === id)?.name ?? `#${id}`;
    }, [productsByShop]);

    const openNew = () => { setF(blank); setDialogOpen(true); };

    const save = async () => {
        if (!f.shop_id) return toast.error("Pick a shop");
        if (!f.product_id) return toast.error("Pick a product");
        if (!f.batch_number.trim()) return toast.error("Batch number is required");
        const qty = Number(f.quantity);
        if (!qty || qty <= 0) return toast.error("Quantity must be positive");
        setBusy(true);
        try {
            await CreateBatch({
                product_id: Number(f.product_id),
                shop_id: Number(f.shop_id),
                batch_number: f.batch_number.trim(),
                quantity: qty,
                unit_cost: f.unit_cost ? Number(f.unit_cost) : 0,
                expiry_date: f.expiry_date || null,
                received_date: f.received_date || null,
            });
            toast.success("Batch added — product is now batch-tracked");
            setDialogOpen(false);
            load();
        } catch (e) {
            handleErrorMessage(e, "Failed to add batch");
        } finally {
            setBusy(false);
        }
    };

    if (!user || !isAllowed) {
        return <div className="flex items-center justify-center py-24"><Skeleton className="size-6 rounded-full" /></div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Batches & Expiry"
                description="Received lots for batch-tracked products. Sales deduct the earliest-expiring batch first (FEFO)."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-9" onClick={load} disabled={loading} aria-label="Refresh">
                            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                        <Button onClick={openNew}><Plus className="mr-2 size-4" /> Add Batch</Button>
                    </div>
                }
            />

            <div className="flex flex-wrap items-center gap-3">
                <Tabs value={view} onValueChange={(v) => setView(v as "all" | "expiring")}>
                    <TabsList>
                        <TabsTrigger value="all">Active batches</TabsTrigger>
                        <TabsTrigger value="expiring"><AlertTriangle className="mr-1.5 size-4" /> Expiring ≤ 30d</TabsTrigger>
                    </TabsList>
                </Tabs>
                <Select value={shopId} onValueChange={setShopId}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All shops</SelectItem>
                        {shops.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Batch</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Shop</TableHead>
                                <TableHead className="text-right">Remaining</TableHead>
                                <TableHead className="text-right">Unit cost</TableHead>
                                <TableHead>Expiry</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-16 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <Boxes className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-foreground font-semibold">
                                            {view === "expiring" ? "Nothing expiring soon" : "No batches"}
                                        </p>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            Add a batch or receive a batch-tracked product on a purchase order.
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : rows.map((b) => {
                                const d = daysUntil(b.expiry_date);
                                return (
                                    <TableRow key={b.id}>
                                        <TableCell className="pl-6 font-mono text-sm">{b.batch_number}</TableCell>
                                        <TableCell className="font-medium">{productName(b.product_id)}</TableCell>
                                        <TableCell className="text-muted-foreground">{shopName(b.shop_id)}</TableCell>
                                        <TableCell className="text-right">{b.quantity} / {b.initial_quantity}</TableCell>
                                        <TableCell className="text-right">{fmt(b.unit_cost)}</TableCell>
                                        <TableCell>
                                            {b.expiry_date ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">{new Date(b.expiry_date).toLocaleDateString()}</span>
                                                    {d != null && (
                                                        <Badge variant="outline" className={cn(
                                                            "rounded-full text-xs",
                                                            d < 0 ? "border-destructive/40 bg-destructive/10 text-destructive"
                                                                : d <= 7 ? "border-destructive/30 bg-destructive/5 text-destructive"
                                                                    : d <= 30 ? "border-warning/30 bg-warning/10 text-warning"
                                                                        : "border-border bg-muted text-muted-foreground",
                                                        )}>
                                                            {d < 0 ? `expired ${-d}d ago` : `${d}d left`}
                                                        </Badge>
                                                    )}
                                                </div>
                                            ) : <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Add Batch</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label>Shop</Label>
                            <Select value={f.shop_id} onValueChange={(v) => { setF({ ...f, shop_id: v, product_id: "" }); loadProducts(Number(v)); }}>
                                <SelectTrigger><SelectValue placeholder="Select shop" /></SelectTrigger>
                                <SelectContent>
                                    {shops.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Product</Label>
                            <Select value={f.product_id} onValueChange={(v) => setF({ ...f, product_id: v })} disabled={!f.shop_id}>
                                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                                <SelectContent>
                                    {formProducts.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Batch number</Label>
                                <Input value={f.batch_number} onChange={(e) => setF({ ...f, batch_number: e.target.value })} placeholder="LOT-2026-04" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Quantity</Label>
                                <Input type="number" min={1} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Unit cost</Label>
                                <Input type="number" min={0} step="0.01" value={f.unit_cost} onChange={(e) => setF({ ...f, unit_cost: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Expiry date</Label>
                                <Input type="date" value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Received date</Label>
                            <Input type="date" value={f.received_date} onChange={(e) => setF({ ...f, received_date: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Add Batch"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
