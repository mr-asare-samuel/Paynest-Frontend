"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCcw, Barcode, MoreHorizontal } from "lucide-react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import PageHeader from "@/components/(shared-components)/PageHeader";
import Pagination from "@/components/(shared-components)/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import {
    GetSerials, AddSerials, UpdateSerialStatus,
} from "@/(api-handlers)/inventoryTrackingHandler";
import { GetProducts } from "@/(api-handlers)/productsHandler";
import { getOrganizationShops } from "@/(api-handlers)/organizationShopsHandler";
import { SerialResponse, SerialStatus } from "@/interfaces/inventoryTracking";
import { ProductResponse } from "@/interfaces/products";
import { OrganizationShopResponse } from "@/interfaces/organizationShops";

const STATUSES: SerialStatus[] = ["in_stock", "sold", "returned", "damaged"];
const STATUS_STYLE: Record<SerialStatus, string> = {
    in_stock: "border-success/30 bg-success/10 text-success",
    sold: "border-border bg-muted text-muted-foreground",
    returned: "border-warning/30 bg-warning/10 text-warning",
    damaged: "border-destructive/30 bg-destructive/10 text-destructive",
};

export default function SerialsPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const role = (user?.role || "attendant").toLowerCase();
    const isAllowed = role === "manager" || role === "admin" || role === "superadmin";

    const [rows, setRows] = useState<SerialResponse[]>([]);
    const [products, setProducts] = useState<ProductResponse[]>([]);
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [productFilter, setProductFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [f, setF] = useState({ product_id: "", shop_id: "", serials: "", notes: "" });

    useEffect(() => {
        if (user && !isAllowed) router.replace("/dashboard");
    }, [user, isAllowed, router]);

    const load = async () => {
        setLoading(true);
        try {
            const params: Record<string, string | number> = {};
            if (productFilter !== "all") params.product_id = Number(productFilter);
            if (statusFilter !== "all") params.status = statusFilter;
            const [serials, prods, shopList] = await Promise.all([
                GetSerials({ ...params, limit: 300 }),
                products.length ? Promise.resolve(products) : GetProducts().catch(() => []),
                shops.length ? Promise.resolve(shops) : getOrganizationShops().catch(() => []),
            ]);
            setRows(serials);
            if (!products.length) setProducts(prods);
            if (!shops.length) setShops(shopList);
        } catch (e) {
            handleErrorMessage(e, "Failed to load serials");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAllowed) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAllowed, productFilter, statusFilter]);

    const productName = useMemo(
        () => (id: number) => products.find((p) => p.id === id)?.name ?? `#${id}`,
        [products],
    );

    const openNew = () => { setF({ product_id: "", shop_id: "", serials: "", notes: "" }); setDialogOpen(true); };

    const save = async () => {
        if (!f.product_id) return toast.error("Pick a product");
        const list = f.serials.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
        if (list.length === 0) return toast.error("Enter at least one serial number");
        setBusy(true);
        try {
            await AddSerials({
                product_id: Number(f.product_id),
                shop_id: f.shop_id ? Number(f.shop_id) : undefined,
                serial_numbers: list,
                notes: f.notes || undefined,
            });
            toast.success(`${list.length} serial${list.length !== 1 ? "s" : ""} registered`);
            setDialogOpen(false);
            load();
        } catch (e) {
            handleErrorMessage(e, "Failed to register serials");
        } finally {
            setBusy(false);
        }
    };

    const changeStatus = async (row: SerialResponse, status: SerialStatus) => {
        try {
            await UpdateSerialStatus(row.id, { status });
            toast.success(`Marked ${status.replace("_", " ")}`);
            load();
        } catch (e) {
            handleErrorMessage(e, "Failed to update status");
        }
    };

    const pg = usePagination(rows, 10);

    if (!user || !isAllowed) {
        return <div className="flex items-center justify-center py-24"><Skeleton className="size-6 rounded-full" /></div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Serial Numbers"
                description="One row per physical unit of a serialised product. Serials are captured at the POS when the item is sold."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-9" onClick={load} disabled={loading} aria-label="Refresh">
                            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                        <Button onClick={openNew}><Plus className="mr-2 size-4" /> Add Serials</Button>
                    </div>
                }
            />

            <div className="flex flex-wrap items-center gap-3">
                <Select value={productFilter} onValueChange={setProductFilter}>
                    <SelectTrigger className="w-56"><SelectValue placeholder="All products" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All products</SelectItem>
                        {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="Any status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Any status</SelectItem>
                        {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Serial</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Received via</TableHead>
                                <TableHead>Sold</TableHead>
                                <TableHead className="w-[60px] pr-6 text-right">Actions</TableHead>
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
                                            <Barcode className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-foreground font-semibold">No serials</p>
                                        <p className="text-muted-foreground mt-1 text-sm">Register serials to start per-unit tracking for a product.</p>
                                    </TableCell>
                                </TableRow>
                            ) : pg.pageItems.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell className="pl-6 font-mono text-sm">{r.serial_number}</TableCell>
                                    <TableCell className="font-medium">{productName(r.product_id)}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("rounded-full text-xs capitalize", STATUS_STYLE[r.status])}>
                                            {r.status.replace("_", " ")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">{r.received_via || "—"}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {r.sold_at ? new Date(r.sold_at).toLocaleDateString() : "—"}
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8" aria-label="Actions"><MoreHorizontal className="size-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Set status</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {STATUSES.filter((s) => s !== r.status).map((s) => (
                                                    <DropdownMenuItem key={s} className="capitalize" onClick={() => changeStatus(r, s)}>
                                                        {s.replace("_", " ")}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {!loading && rows.length > 0 && (
                    <div className="border-border bg-muted/30 border-t px-4 py-3">
                        <Pagination page={pg.page} totalPages={pg.totalPages} onPageChange={pg.setPage} total={pg.total} pageSize={pg.pageSize} onPageSizeChange={pg.setPageSize} />
                    </div>
                )}
            </Card>

            <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Add Serial Numbers</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label>Product</Label>
                            <Select value={f.product_id} onValueChange={(v) => setF({ ...f, product_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                                <SelectContent>
                                    {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <p className="text-muted-foreground text-xs">The product is switched to serial-tracked on first add.</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Shop <span className="text-muted-foreground text-xs">(optional — defaults to yours)</span></Label>
                            <Select value={f.shop_id} onValueChange={(v) => setF({ ...f, shop_id: v })}>
                                <SelectTrigger><SelectValue placeholder="My shop" /></SelectTrigger>
                                <SelectContent>
                                    {shops.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Serial numbers</Label>
                            <Textarea
                                value={f.serials}
                                onChange={(e) => setF({ ...f, serials: e.target.value })}
                                className="min-h-[110px] font-mono text-sm"
                                placeholder={"One per line or comma-separated\nSN-0001\nSN-0002"}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Notes</Label>
                            <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="optional" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Register"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
