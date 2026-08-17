"use client";

import { useCallback, useEffect, useState } from "react";
import {
    CheckCircle2, ClipboardList, FileCheck2, Loader2, PackageX, Receipt, Send,
} from "lucide-react";
import { format } from "date-fns";
import { useAuthStore } from "@/(zustand-store)/authStore";
import {
    CancelPurchaseOrder, GetPurchaseOrderById, SendPurchaseOrder,
} from "@/(api-handlers)/purchaseOrdersHandler";
import { GetProductByID } from "@/(api-handlers)/productsHandler";
import { GetVendorById } from "@/(api-handlers)/vendorsHandler";
import { PurchaseOrderResponse } from "@/interfaces/purchaseOrders";
import { ProductResponse } from "@/interfaces/products";
import { VendorResponse } from "@/interfaces/vendors";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import { StatusPill } from "@/components/(shared-components)/StatusPill";
import ReceivePurchaseOrderDialog from "./ReceivePurchaseOrderDialog";
import RecordInvoiceDialog from "./RecordInvoiceDialog";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type PendingAction = "send" | "cancel" | null;

interface StageConfig {
    key: string;
    label: string;
    icon: typeof Send;
    by: number | null;
    at: string | null;
}

interface PurchaseOrderDetailDialogProps {
    poId: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChanged?: () => void;
}

export default function PurchaseOrderDetailDialog({
    poId,
    open,
    onOpenChange,
    onChanged,
}: Readonly<PurchaseOrderDetailDialogProps>) {
    const { user } = useAuthStore();
    const role = (user?.role || "attendant").toLowerCase();
    const canManage = role === "manager" || role === "admin" || role === "superadmin";

    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<PurchaseOrderResponse | null>(null);
    const [vendor, setVendor] = useState<VendorResponse | null>(null);
    const [products, setProducts] = useState<Record<number, ProductResponse>>({});
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [receiveOpen, setReceiveOpen] = useState(false);
    const [invoiceOpen, setInvoiceOpen] = useState(false);

    const fetchDetail = useCallback(async () => {
        if (!poId) return;
        setLoading(true);
        try {
            const data = await GetPurchaseOrderById(poId);
            setDetail(data);

            GetVendorById(data.vendor_id).then(setVendor).catch(() => setVendor(null));

            const ids = Array.from(new Set(data.items.map((it) => it.product_id)));
            const results = await Promise.allSettled(ids.map((id) => GetProductByID(id)));
            const map: Record<number, ProductResponse> = {};
            results.forEach((res, idx) => {
                if (res.status === "fulfilled") map[ids[idx]] = res.value;
            });
            setProducts(map);
        } catch (error) {
            handleErrorMessage(error, "Failed to load purchase order details");
        } finally {
            setLoading(false);
        }
    }, [poId]);

    useEffect(() => {
        if (open && poId) fetchDetail();
    }, [open, poId, fetchDetail]);

    const canSend = detail?.status === "draft" && canManage;
    const canCancel = detail?.status === "draft" && (detail.created_by === user?.id || canManage);
    const canReceive = detail?.status === "sent" || detail?.status === "partially_received";
    const canRecordInvoice = canManage
        && (detail?.status === "sent" || detail?.status === "partially_received" || detail?.status === "received")
        && !detail?.invoice_number;

    const handleConfirm = async () => {
        if (!detail || !pendingAction) return;
        setActionLoading(true);
        try {
            if (pendingAction === "send") {
                const updated = await SendPurchaseOrder(detail.id);
                setDetail(updated);
                toast.success(`Purchase order ${updated.po_number} sent.`);
            } else if (pendingAction === "cancel") {
                await CancelPurchaseOrder(detail.id);
                toast.success("Purchase order cancelled.");
                onOpenChange(false);
            }
            onChanged?.();
        } catch (error) {
            handleErrorMessage(error, "Failed to update purchase order");
        } finally {
            setActionLoading(false);
            setPendingAction(null);
        }
    };

    const stages: StageConfig[] = detail ? [
        { key: "draft", label: "Created", icon: ClipboardList, by: detail.created_by, at: detail.created_at },
        { key: "sent", label: "Sent", icon: Send, by: detail.sent_by, at: detail.sent_at },
        { key: "received", label: "Received", icon: CheckCircle2, by: detail.received_by, at: detail.received_at },
    ] : [];
    const lastDoneIdx = stages.reduce((acc, s, idx) => (s.at ? idx : acc), -1);

    const actorLabel = (id: number | null) => {
        if (id == null) return null;
        return id === user?.id ? "you" : `User #${id}`;
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex flex-wrap items-center gap-2">
                            {detail ? detail.po_number : "Purchase Order Details"}
                            {detail && <StatusPill status={detail.status} />}
                        </DialogTitle>
                        <DialogDescription>
                            {detail && `Created ${format(new Date(detail.created_at), "MMM d, yyyy · HH:mm")}${vendor ? ` · ${vendor.name}` : ""}`}
                        </DialogDescription>
                    </DialogHeader>

                    {loading ? (
                        <div className="space-y-3 py-2">
                            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    ) : !detail ? (
                        <div className="flex flex-col items-center gap-2 py-10 text-center">
                            <PackageX className="text-muted-foreground size-8" />
                            <p className="text-muted-foreground text-sm">Purchase order not found.</p>
                        </div>
                    ) : (
                        <div className="space-y-5 py-2">
                            {/* Timeline */}
                            <div className="relative pt-2">
                                <div className="bg-border absolute left-0 top-6 h-0.5 w-full" />
                                <div className="relative flex justify-between">
                                    {stages.map((stage, idx) => {
                                        const done = !!stage.at;
                                        const isCurrent = done && detail.status !== "cancelled" && idx === lastDoneIdx;
                                        return (
                                            <div key={stage.key} className="flex flex-col items-center">
                                                <div className={cn(
                                                    "relative z-10 flex size-9 items-center justify-center rounded-full border-4 bg-background",
                                                    isCurrent ? "border-primary" : done ? "border-success" : "border-border",
                                                )}>
                                                    <stage.icon className={cn(
                                                        "size-4",
                                                        isCurrent ? "text-primary" : done ? "text-success" : "text-muted-foreground/40",
                                                    )} />
                                                </div>
                                                <span className={cn(
                                                    "mt-2 text-xs font-medium",
                                                    done ? "text-foreground" : "text-muted-foreground",
                                                )}>
                                                    {stage.label}
                                                </span>
                                                {stage.at && (
                                                    <div className="mt-1 flex flex-col items-center">
                                                        <span className="text-muted-foreground whitespace-nowrap text-[10px]">
                                                            {format(new Date(stage.at), "MMM d, HH:mm")}
                                                        </span>
                                                        <span className="text-muted-foreground whitespace-nowrap text-[10px]">
                                                            {actorLabel(stage.by)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {detail.status === "cancelled" && (
                                <p className="border-border bg-muted text-muted-foreground rounded-lg border p-3 text-sm">
                                    This purchase order was cancelled while still a draft.
                                </p>
                            )}
                            {detail.status === "partially_received" && (
                                <p className="border-warning/30 bg-warning-muted text-warning-foreground rounded-lg border p-3 text-sm">
                                    Some items are still outstanding — the delivery has only been partially received.
                                </p>
                            )}

                            <div className="overflow-x-auto rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Product</TableHead>
                                            <TableHead className="text-center">Ordered</TableHead>
                                            <TableHead className="text-center">Received</TableHead>
                                            <TableHead className="text-right">Unit Cost</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detail.items.map((item) => {
                                            const product = products[item.product_id];
                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <p className="font-medium">{product?.name || `Product #${item.product_id}`}</p>
                                                        {product?.sku && <p className="text-muted-foreground text-xs">SKU: {product.sku}</p>}
                                                    </TableCell>
                                                    <TableCell className="text-center">{item.quantity_ordered}</TableCell>
                                                    <TableCell className="text-center">{item.quantity_received}</TableCell>
                                                    <TableCell className="text-right">GHS {Number(item.unit_cost).toFixed(2)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex flex-col items-end gap-1 text-sm">
                                <div className="flex w-48 justify-between"><span className="text-muted-foreground">Subtotal</span><span>GHS {Number(detail.subtotal).toFixed(2)}</span></div>
                                <div className="flex w-48 justify-between"><span className="text-muted-foreground">Tax</span><span>GHS {Number(detail.tax_amount).toFixed(2)}</span></div>
                                <div className="flex w-48 justify-between font-semibold"><span>Total</span><span>GHS {Number(detail.total_amount).toFixed(2)}</span></div>
                            </div>

                            {detail.notes && (
                                <p className="text-muted-foreground text-sm">
                                    <span className="font-medium">Notes: </span>{detail.notes}
                                </p>
                            )}

                            {detail.invoice_number && (
                                <div className="border-border bg-muted/30 space-y-1 rounded-lg border p-3 text-sm">
                                    <div className="flex items-center gap-2 font-medium">
                                        <Receipt className="size-4" />
                                        Invoice {detail.invoice_number}
                                        {detail.match_status && (
                                            <StatusPill
                                                status={detail.match_status === "matched" ? "success" : "warning"}
                                                label={detail.match_status.replace(/_/g, " ")}
                                            />
                                        )}
                                    </div>
                                    <p className="text-muted-foreground">
                                        GHS {Number(detail.invoice_amount).toFixed(2)} on {detail.invoice_date && format(new Date(detail.invoice_date), "MMM d, yyyy")}
                                        {" — "}an expense has been created and is awaiting approval.
                                    </p>
                                </div>
                            )}

                            {(canSend || canCancel || canReceive || canRecordInvoice) && <Separator />}

                            <div className="flex flex-wrap gap-2">
                                {canSend && (
                                    <Button onClick={() => setPendingAction("send")}>
                                        <Send className="mr-2 size-4" />
                                        Send to Vendor
                                    </Button>
                                )}
                                {canReceive && (
                                    <Button onClick={() => setReceiveOpen(true)}>
                                        <CheckCircle2 className="mr-2 size-4" />
                                        Receive Delivery
                                    </Button>
                                )}
                                {canRecordInvoice && (
                                    <Button variant="outline" onClick={() => setInvoiceOpen(true)}>
                                        <FileCheck2 className="mr-2 size-4" />
                                        Record Invoice
                                    </Button>
                                )}
                                {canCancel && (
                                    <Button
                                        variant="ghost"
                                        className="text-muted-foreground"
                                        onClick={() => setPendingAction("cancel")}
                                    >
                                        Cancel Purchase Order
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <ReceivePurchaseOrderDialog
                po={detail}
                products={products}
                open={receiveOpen}
                onOpenChange={setReceiveOpen}
                onReceived={(updated) => { setDetail(updated); onChanged?.(); }}
            />
            <RecordInvoiceDialog
                po={detail}
                open={invoiceOpen}
                onOpenChange={setInvoiceOpen}
                onRecorded={(updated) => { setDetail(updated); onChanged?.(); }}
            />

            <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingAction === "send" && "Send Purchase Order"}
                            {pendingAction === "cancel" && "Cancel Purchase Order"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingAction === "send" &&
                                "This marks the order as sent to the vendor. No stock moves yet — that happens when you record a delivery."}
                            {pendingAction === "cancel" &&
                                "This cancels the draft purchase order. No stock has moved yet."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionLoading}>Back</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm} disabled={actionLoading}>
                            {actionLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                            {pendingAction === "send" && "Yes, Send"}
                            {pendingAction === "cancel" && "Yes, Cancel"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
