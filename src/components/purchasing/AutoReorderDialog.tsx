"use client";

import { useState } from "react";
import { Wand2, Loader2, PackageCheck, AlertTriangle } from "lucide-react";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import { useCurrency } from "@/hooks/useCurrency";
import { GetAutoReorderPreview, RunAutoReorder } from "@/(api-handlers)/purchaseOrdersHandler";
import { AutoReorderPreview } from "@/interfaces/inventoryTracking";
import { OrganizationShopResponse } from "@/interfaces/organizationShops";

export function AutoReorderDialog({
    trigger, shops, onCreated,
}: {
    trigger: React.ReactNode;
    shops: OrganizationShopResponse[];
    onCreated?: () => void;
}) {
    const fmt = useCurrency();
    const [open, setOpen] = useState(false);
    const [shopId, setShopId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState(false);
    const [preview, setPreview] = useState<AutoReorderPreview | null>(null);

    const reset = () => { setPreview(null); setShopId(""); setLoading(false); setRunning(false); };

    const runPreview = async (sid: string) => {
        setLoading(true);
        setPreview(null);
        try {
            setPreview(await GetAutoReorderPreview({ shop_id: Number(sid) }));
        } catch (e) {
            handleErrorMessage(e, "Failed to load reorder preview");
        } finally {
            setLoading(false);
        }
    };

    const create = async () => {
        if (!shopId) return;
        setRunning(true);
        try {
            const res = await RunAutoReorder({ shop_id: Number(shopId) });
            const n = res.created_purchase_orders?.length ?? 0;
            if (n > 0) {
                toast.success(`${n} draft purchase order${n !== 1 ? "s" : ""} created`);
                onCreated?.();
                setOpen(false);
                reset();
            } else {
                toast.info("Nothing to reorder right now");
                runPreview(shopId);
            }
        } catch (e) {
            handleErrorMessage(e, "Auto-reorder failed");
        } finally {
            setRunning(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Auto-reorder</DialogTitle>
                    <DialogDescription>
                        Draft one purchase order per vendor for every product at or below its reorder point.
                        Products without a default vendor are listed but not ordered.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    <div className="flex items-end gap-3">
                        <div className="space-y-1.5">
                            <p className="text-muted-foreground text-xs font-medium">Shop</p>
                            <Select value={shopId} onValueChange={(v) => { setShopId(v); runPreview(v); }}>
                                <SelectTrigger className="w-56"><SelectValue placeholder="Select shop" /></SelectTrigger>
                                <SelectContent>
                                    {shops.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {loading && <Loader2 className="text-muted-foreground mb-2 size-4 animate-spin" />}
                    </div>

                    {preview && (
                        <>
                            {preview.needs.length === 0 && preview.without_vendor.length === 0 ? (
                                <Card className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
                                    <PackageCheck className="text-success size-4" /> Everything is above its reorder point.
                                </Card>
                            ) : (
                                <>
                                    {preview.needs.length > 0 && (
                                        <Card className="gap-0 overflow-hidden p-0">
                                            <div className="flex items-center justify-between border-b px-4 py-2 text-xs">
                                                <span className="font-medium">To order ({preview.needs.length})</span>
                                                <span className="text-muted-foreground">est. {fmt(preview.estimated_cost)}</span>
                                            </div>
                                            <div className="max-h-56 overflow-y-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="pl-4">Product</TableHead>
                                                            <TableHead>Vendor</TableHead>
                                                            <TableHead className="text-right">On hand</TableHead>
                                                            <TableHead className="text-right">Order qty</TableHead>
                                                            <TableHead className="pr-4 text-right">Est. cost</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {preview.needs.map((n) => (
                                                            <TableRow key={n.product_id}>
                                                                <TableCell className="pl-4">{n.product_name}</TableCell>
                                                                <TableCell className="text-muted-foreground">{n.default_vendor_name}</TableCell>
                                                                <TableCell className="text-right">{n.current_stock} / {n.reorder_point}</TableCell>
                                                                <TableCell className="text-right font-medium">{n.suggested_quantity}</TableCell>
                                                                <TableCell className="pr-4 text-right">{fmt(n.estimated_line_cost)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </Card>
                                    )}

                                    {preview.without_vendor.length > 0 && (
                                        <Card className="border-warning/30 bg-warning/5 space-y-1 p-3 text-xs">
                                            <p className="text-warning-foreground flex items-center gap-1.5 font-medium">
                                                <AlertTriangle className="size-3.5" /> No default vendor — set one on the product to include these:
                                            </p>
                                            <p className="text-muted-foreground">
                                                {preview.without_vendor.map((n) => n.product_name).join(", ")}
                                            </p>
                                        </Card>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={create} disabled={running || !shopId || !preview || preview.needs.length === 0}>
                        {running ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Wand2 className="mr-1.5 size-4" />}
                        Create draft POs
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
