"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ReceivePurchaseOrder } from "@/(api-handlers)/purchaseOrdersHandler";
import { PurchaseOrderResponse } from "@/interfaces/purchaseOrders";
import { ProductResponse } from "@/interfaces/products";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ReceivePurchaseOrderDialogProps {
    po: PurchaseOrderResponse | null;
    products: Record<number, ProductResponse>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onReceived: (updated: PurchaseOrderResponse) => void;
}

export default function ReceivePurchaseOrderDialog({
    po,
    products,
    open,
    onOpenChange,
    onReceived,
}: Readonly<ReceivePurchaseOrderDialogProps>) {
    const [quantities, setQuantities] = useState<Record<number, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const outstandingItems = po ? po.items.filter((it) => it.quantity_received < it.quantity_ordered) : [];

    useEffect(() => {
        if (open && po) {
            const initial: Record<number, string> = {};
            outstandingItems.forEach((it) => {
                initial[it.id] = String(it.quantity_ordered - it.quantity_received);
            });
            setQuantities(initial);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, po]);

    const handleSubmit = async () => {
        if (!po) return;
        const items = outstandingItems
            .map((it) => ({ item_id: it.id, quantity: Number(quantities[it.id] || 0) }))
            .filter((it) => it.quantity > 0);

        if (items.length === 0) {
            toast.error("Enter a quantity for at least one item");
            return;
        }

        setSubmitting(true);
        try {
            const updated = await ReceivePurchaseOrder(po.id, { items });
            toast.success(`Purchase order ${updated.po_number} updated to ${updated.status.replace(/_/g, " ")}`);
            onReceived(updated);
            onOpenChange(false);
        } catch (error) {
            handleErrorMessage(error, "Failed to record receipt");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Receive Delivery</DialogTitle>
                    <DialogDescription>
                        Enter how many units of each item arrived. This adds stock immediately.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    {outstandingItems.length === 0 ? (
                        <p className="text-muted-foreground text-sm">Nothing outstanding on this order.</p>
                    ) : outstandingItems.map((it) => {
                        const remaining = it.quantity_ordered - it.quantity_received;
                        const product = products[it.product_id];
                        return (
                            <div key={it.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                                <div className="min-w-0">
                                    <p className="truncate font-medium">{product?.name || `Product #${it.product_id}`}</p>
                                    <p className="text-muted-foreground text-xs">
                                        {it.quantity_received} of {it.quantity_ordered} received — {remaining} outstanding
                                    </p>
                                </div>
                                <Input
                                    type="number"
                                    min={0}
                                    max={remaining}
                                    className="w-24"
                                    value={quantities[it.id] ?? ""}
                                    onChange={(e) => setQuantities((prev) => ({ ...prev, [it.id]: e.target.value }))}
                                />
                            </div>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={submitting || outstandingItems.length === 0}>
                        {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Confirm Receipt
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
