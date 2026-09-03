"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    ToggleGroup,
    ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { useSalesStore, cartUnitPrice } from "@/(zustand-store)/salesStore";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { CreateWalkIns } from "@/(api-handlers)/orders_walkinsHandler";
import { GetAllCustomers } from "@/(api-handlers)/customersHandler";
import { ValidatePromoCode } from "@/(api-handlers)/promoCodesHandler";
import { CustomerResponse } from "@/interfaces/customers";
import { OrderRequest, WalkInsRequest, OrderItemInput } from "@/interfaces/orders_walkins";
import { PromoValidateResponse } from "@/interfaces/promoCodes";
import { toast } from "sonner";
import {
    CheckCircle2,
    CreditCard,
    Wallet,
    Banknote,
    User,
    ShoppingCart,
    ChevronRight,
    Loader2,
    MapPin,
    Printer,
    Usb,
    Download,
    X,
    TicketPercent,
    Barcode,
} from "lucide-react";
import { handleErrorMessage } from "@/lib/handleErrorMessage";
import { printerService } from "@/lib/printerService";
import { useCurrency, useOrgCurrency } from "@/hooks/useCurrency";
import { formatCurrencyAscii } from "@/lib/currency";
import { jsPDF } from "jspdf";

interface SalesCompletionModalProps {
    isOpen: boolean;
    onClose: () => void;
    total: number;
    subTotal: number;
    tax: number;
}

interface ReceiptItem {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
}

interface CompletedSale {
    items: ReceiptItem[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    paymentMethod: string;
    isOrder: boolean;
    orgName: string;
    timestamp: Date;
}

const paymentLabel: Record<string, string> = {
    cash: "Cash",
    "bank transfer": "Bank / Card",
    "mobile transfer": "Mobile Money",
};

export function SalesCompletionModal({
    isOpen,
    onClose,
    total,
    subTotal,
    tax,
}: Readonly<SalesCompletionModalProps>) {
    const fmt = useCurrency();
    const orgCurrency = useOrgCurrency();
    const { cart, isOrderMode, paymentMethod, setPaymentMethod, clearCart } =
        useSalesStore();
    const { user } = useAuthStore();

    const [isLoading, setIsLoading] = useState(false);
    const [customers, setCustomers] = useState<CustomerResponse[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
        null,
    );
    const [deliveryAddress, setDeliveryAddress] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [completedSale, setCompletedSale] = useState<CompletedSale | null>(
        null,
    );
    const [printerConnected, setPrinterConnected] = useState(false);
    const [promoCode, setPromoCode] = useState("");
    const [promoChecking, setPromoChecking] = useState(false);
    const [promoResult, setPromoResult] = useState<PromoValidateResponse | null>(null);
    const [serials, setSerials] = useState<Record<number, string[]>>({});

    // Cart lines that need a serial per unit captured before checkout.
    const serialLines = useMemo(
        () => Object.entries(cart)
            .filter(([, item]) => item.product?.track_serial)
            .map(([key, item]) => ({ key: Number(key), item })),
        [cart],
    );

    const promoDiscount = promoResult?.valid ? promoResult.discount_amount : 0;
    const finalTotal = Math.max(0, total - discountAmount - promoDiscount);

    const checkPromo = async () => {
        const code = promoCode.trim();
        if (!code || !user?.employee_profile?.shop_id) return;
        setPromoChecking(true);
        try {
            const res = await ValidatePromoCode({
                code,
                shop_id: user.employee_profile.shop_id,
                customer_id: isOrderMode ? selectedCustomerId : undefined,
                items: Object.values(cart).map((item) =>
                    item.bundle
                        ? { bundle_id: item.bundle.id, quantity: item.quantity }
                        : { product_id: item.product!.id, quantity: item.quantity },
                ),
            });
            setPromoResult(res);
            if (res.valid) toast.success(`Promo applied — ${fmt(res.discount_amount)} off`);
            else toast.error(res.reason || "Promo code can't be applied");
        } catch (e) {
            handleErrorMessage(e, "Couldn't check that promo code");
            setPromoResult(null);
        } finally {
            setPromoChecking(false);
        }
    };

    useEffect(() => {
        if (isOpen && isOrderMode) {
            const fetchCustomers = async () => {
                setIsLoading(true);
                try {
                    const data = await GetAllCustomers();
                    setCustomers(data.items);
                } catch (error) {
                    console.error("Failed to fetch customers", error);
                    toast.error("Failed to load customers");
                } finally {
                    setIsLoading(false);
                }
            };
            fetchCustomers();
        }
    }, [isOpen, isOrderMode]);

    useEffect(() => {
        if (isOpen) {
            setCompletedSale(null);
            setDiscountAmount(0);
            setSelectedCustomerId(null);
            setDeliveryAddress("");
            setPromoCode("");
            setPromoResult(null);
            setSerials({});
        }
    }, [isOpen]);

    // Sync printer connection status when the receipt view becomes visible
    useEffect(() => {
        if (completedSale) {
            setPrinterConnected(printerService.isConnected());
        }
    }, [completedSale]);

    const handleComplete = async () => {
        if (isOrderMode && !selectedCustomerId) {
            toast.error("Please select a customer for the order");
            return;
        }
        if (!user?.employee_profile?.shop_id) {
            toast.error("Shop information not found");
            return;
        }

        // Serial-tracked lines need exactly `quantity` serial numbers.
        for (const { key, item } of serialLines) {
            const captured = (serials[key] || []).map((s) => s.trim()).filter(Boolean);
            if (captured.length !== item.quantity) {
                toast.error(`Enter ${item.quantity} serial number(s) for ${item.product!.name}`);
                return;
            }
        }

        const receiptItems: ReceiptItem[] = Object.values(cart).map((item) => {
            const unit = cartUnitPrice(item);
            return {
                name: item.bundle ? `${item.bundle.name} (bundle)` : item.product!.name,
                quantity: item.quantity,
                unitPrice: unit,
                lineTotal: unit * item.quantity,
            };
        });

        setIsSubmitting(true);
        try {
            const items: OrderItemInput[] = Object.entries(cart).map(([keyStr, item]) => {
                if (item.bundle) {
                    return {
                        bundle_id: item.bundle.id,
                        quantity: item.quantity,
                        notes: item.specialInstructions || undefined,
                    };
                }
                const key = Number(keyStr);
                return {
                    product_id: item.product!.id,
                    quantity: item.quantity,
                    notes: item.specialInstructions || undefined,
                    ...(item.product!.track_serial
                        ? { serial_numbers: (serials[key] || []).map((s) => s.trim()).filter(Boolean) }
                        : {}),
                };
            });
            const appliedPromo = promoResult?.valid ? promoCode.trim() : undefined;
            const payment = {
                method: paymentMethod,
                status: "paid" as const,
                amount_paid: finalTotal,
            };

            if (isOrderMode) {
                const orderData: OrderRequest = {
                    shop_id: user.employee_profile.shop_id,
                    order_type: "sale",
                    order_status: "initiated",
                    customer_id: selectedCustomerId!,
                    items,
                    // No payment — orders are paid later via "Confirm Payment" on the orders page
                    delivery_amount: 0,
                    discount_amount: discountAmount,
                    promo_code: appliedPromo,
                    is_delivered: false,
                    delivery_address: deliveryAddress || null,
                    actual_delivery_date: new Date().toISOString(),
                    expected_delivery_date: new Date().toISOString(),
                };
                await CreateWalkIns(orderData);
            } else {
                const walkInData: WalkInsRequest = {
                    shop_id: user.employee_profile.shop_id,
                    order_type: "sale",
                    order_status: "delivered",
                    customer_id: null,
                    items,
                    payment,
                    delivery_amount: 0,
                    discount_amount: discountAmount,
                    promo_code: appliedPromo,
                    is_delivered: true,
                    delivery_address: null,
                    actual_delivery_date: null,
                    expected_delivery_date: null,
                };
                await CreateWalkIns(walkInData);
            }

            clearCart();
            setCompletedSale({
                items: receiptItems,
                subtotal: subTotal,
                tax,
                discount: discountAmount + promoDiscount,
                total: finalTotal,
                paymentMethod,
                isOrder: isOrderMode,
                orgName: user.organization?.name || "Paynest POS",
                timestamp: new Date(),
            });
            toast.success(
                isOrderMode
                    ? "Order created successfully!"
                    : "Sale completed successfully!",
            );
        } catch (error) {
            handleErrorMessage(
                error,
                "Failed to process transaction. Please try again.",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // Safe ASCII format for ESC/POS thermal printers (no Unicode currency symbols)
    const fmtEsc = useCallback(
        (n: number) => formatCurrencyAscii(n, orgCurrency),
        [orgCurrency],
    );

    const downloadPDF = useCallback(() => {
        if (!completedSale) return;

        const doc = new jsPDF({ unit: "mm", format: [80, 297], orientation: "portrait" });
        const W = 80;
        const margin = 6;
        const col2 = W - margin;
        let y = margin;

        const line = (thickness = 0.2) => {
            doc.setLineWidth(thickness);
            doc.line(margin, y, col2, y);
            y += 3;
        };

        const dashedLine = () => {
            doc.setLineDashPattern([1, 1], 0);
            doc.setLineWidth(0.2);
            doc.line(margin, y, col2, y);
            doc.setLineDashPattern([], 0);
            y += 3;
        };

        const row = (left: string, right: string, bold = false, size = 8) => {
            doc.setFontSize(size);
            doc.setFont("helvetica", bold ? "bold" : "normal");
            doc.text(left, margin, y);
            doc.text(right, col2, y, { align: "right" });
            y += size * 0.45;
        };

        const centered = (text: string, size = 9, bold = false) => {
            doc.setFontSize(size);
            doc.setFont("helvetica", bold ? "bold" : "normal");
            doc.text(text, W / 2, y, { align: "center" });
            y += size * 0.45;
        };

        // Header
        y += 2;
        centered(completedSale.orgName, 12, true);
        y += 1;
        centered(completedSale.isOrder ? "Order Receipt" : "Payment Receipt", 8);
        y += 3;
        dashedLine();

        // Date / time
        const dateStr = completedSale.timestamp.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        const timeStr = completedSale.timestamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        row(dateStr, timeStr, false, 7);
        y += 2;
        dashedLine();

        // Items
        for (const item of completedSale.items) {
            const label = `${item.name} x${item.quantity}`;
            const wrapped = doc.splitTextToSize(label, col2 - margin - 20);
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(wrapped, margin, y);
            doc.text(fmt(item.lineTotal), col2, y, { align: "right" });
            y += wrapped.length * 3.6 + 0.5;
        }

        y += 1;
        dashedLine();

        // Totals
        row("Subtotal", fmt(completedSale.subtotal), false, 8);
        y += 0.5;
        row("Tax", fmt(completedSale.tax), false, 8);
        if (completedSale.discount > 0) {
            y += 0.5;
            row("Discount", `-${fmt(completedSale.discount)}`, false, 8);
        }
        y += 2;
        line(0.4);
        row("Total Paid", fmt(completedSale.total), true, 10);
        y += 3;

        // Payment method
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        centered(`Paid via ${paymentLabel[completedSale.paymentMethod] || completedSale.paymentMethod}`, 8);
        y += 4;
        centered("Thank you for your purchase!", 7);

        doc.setTextColor(0, 0, 0);

        const filename = `receipt-${completedSale.timestamp.toISOString().slice(0, 10)}.pdf`;
        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [completedSale, fmt]);

    const handlePrint = useCallback(async () => {
        if (!completedSale) return;

        if (printerService.isConnected()) {
            try {
                const { paperWidth } = printerService.getSettings();
                await printerService.print({
                    orgName: completedSale.orgName,
                    receiptType: completedSale.isOrder ? "Order Receipt" : "Payment Receipt",
                    date: completedSale.timestamp.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                    }),
                    time: completedSale.timestamp.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                    items: completedSale.items.map((item) => ({
                        name: item.name,
                        qty: item.quantity,
                        total: fmtEsc(item.lineTotal),
                    })),
                    subtotal: fmtEsc(completedSale.subtotal),
                    tax: fmtEsc(completedSale.tax),
                    discount: completedSale.discount > 0 ? fmtEsc(completedSale.discount) : null,
                    total: fmtEsc(completedSale.total),
                    paymentMethod:
                        paymentLabel[completedSale.paymentMethod] ||
                        completedSale.paymentMethod,
                    paperWidth,
                });
                toast.success("Receipt sent to printer");
            } catch {
                toast.error("Hardware print failed — downloading PDF instead");
                downloadPDF();
            }
        } else {
            downloadPDF();
        }
    }, [completedSale, fmtEsc, downloadPDF]);

    const handleCloseReceipt = () => {
        setCompletedSale(null);
        onClose();
    };

    // ── Receipt view ──────────────────────────────────────────────────────────
    if (completedSale) {
        return (
            <Dialog open={isOpen} onOpenChange={handleCloseReceipt}>
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Receipt</DialogTitle>
                    </DialogHeader>

                    <div className="bg-success flex flex-col items-center gap-2 px-6 py-6 text-center">
                        <div className="bg-success-foreground/10 flex size-14 items-center justify-center rounded-full">
                            <CheckCircle2 className="text-success-foreground size-8" />
                        </div>
                        <div>
                            <h2 className="text-success-foreground text-lg font-bold">
                                {completedSale.isOrder
                                    ? "Order Placed"
                                    : "Payment Complete"}
                            </h2>
                            <p className="text-success-foreground/80 text-xs">
                                {completedSale.orgName}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 px-5 py-5">
                        <div className="text-muted-foreground flex justify-between text-xs">
                            <span>
                                {completedSale.timestamp.toLocaleDateString(
                                    "en-GB",
                                    {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                    },
                                )}
                            </span>
                            <span>
                                {completedSale.timestamp.toLocaleTimeString(
                                    "en-GB",
                                    { hour: "2-digit", minute: "2-digit" },
                                )}
                            </span>
                        </div>

                        <div className="border-border flex flex-col gap-1.5 border-y border-dashed py-3">
                            {completedSale.items.map((item, i) => (
                                <div
                                    key={i}
                                    className="flex justify-between text-sm"
                                >
                                    <span className="text-foreground flex-1 truncate pr-2">
                                        {item.name}{" "}
                                        <span className="text-muted-foreground">
                                            ×{item.quantity}
                                        </span>
                                    </span>
                                    <span className="num-tabular text-foreground shrink-0 font-medium">
                                        {fmt(item.lineTotal)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-1.5 text-sm">
                            <div className="text-muted-foreground flex justify-between">
                                <span>Subtotal</span>
                                <span className="num-tabular">
                                    {fmt(completedSale.subtotal)}
                                </span>
                            </div>
                            <div className="text-muted-foreground flex justify-between">
                                <span>Tax</span>
                                <span className="num-tabular">
                                    {fmt(completedSale.tax)}
                                </span>
                            </div>
                            {completedSale.discount > 0 && (
                                <div className="text-success flex justify-between">
                                    <span>Discount</span>
                                    <span className="num-tabular">
                                        −{fmt(completedSale.discount)}
                                    </span>
                                </div>
                            )}
                            <Separator className="my-1" />
                            <div className="flex items-center justify-between text-base font-bold">
                                <span className="text-foreground">
                                    Total Paid
                                </span>
                                <span className="num-tabular text-primary">
                                    {fmt(completedSale.total)}
                                </span>
                            </div>
                        </div>

                        <div className="bg-muted text-foreground flex items-center gap-2 rounded-lg p-3 text-sm">
                            {completedSale.paymentMethod === "cash" && (
                                <Banknote className="text-warning size-4" />
                            )}
                            {completedSale.paymentMethod === "bank transfer" && (
                                <CreditCard className="text-info size-4" />
                            )}
                            {completedSale.paymentMethod === "mobile transfer" && (
                                <Wallet className="text-success size-4" />
                            )}
                            <span className="font-medium">
                                Paid via{" "}
                                {paymentLabel[completedSale.paymentMethod] ||
                                    completedSale.paymentMethod}
                            </span>
                        </div>

                        <p className="text-muted-foreground text-center text-xs">
                            Thank you for your purchase!
                        </p>
                    </div>

                    <div className="border-border flex flex-col gap-3 border-t p-5">
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleCloseReceipt}
                            >
                                <X data-icon="inline-start" />
                                Close
                            </Button>
                            <Button className="flex-1" onClick={handlePrint}>
                                {printerConnected
                                    ? <Printer data-icon="inline-start" />
                                    : <Download data-icon="inline-start" />}
                                {printerConnected ? "Print Receipt" : "Download PDF"}
                            </Button>
                        </div>
                        {/* Printer status hint */}
                        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                            <Usb className="size-3" />
                            {printerConnected
                                ? <span className="text-success font-medium">Hardware printer connected</span>
                                : <span>No printer — receipt saved as PDF</span>}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // ── Checkout form view ────────────────────────────────────────────────────
    const itemCount = Object.keys(cart).length;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[500px]">
                <DialogHeader className="border-border border-b px-5 py-4">
                    <DialogTitle className="text-foreground flex items-center gap-2">
                        <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-md">
                            <CheckCircle2 className="size-4" />
                        </span>
                        {isOrderMode ? "Complete Order" : "Complete Sale"}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4 p-5">
                    {/* Checkout Summary */}
                    <div className="bg-muted/40 border-border flex flex-col gap-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                                <ShoppingCart className="size-4" />
                                Checkout Summary
                            </div>
                            <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">
                                {itemCount} {itemCount === 1 ? "item" : "items"}
                            </span>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-1.5 text-sm">
                            <div className="text-muted-foreground flex justify-between">
                                <span>Subtotal</span>
                                <span className="num-tabular">
                                    {fmt(subTotal)}
                                </span>
                            </div>
                            <div className="text-muted-foreground flex justify-between">
                                <span>Tax (4.0%)</span>
                                <span className="num-tabular">{fmt(tax)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                    Discount
                                </span>
                                <div className="relative w-28">
                                    <span className="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2 text-[10px] font-medium">
                                        {orgCurrency}
                                    </span>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={discountAmount || ""}
                                        onChange={(e) =>
                                            setDiscountAmount(
                                                Number(e.target.value),
                                            )
                                        }
                                        placeholder="0.00"
                                        className="num-tabular h-8 pl-10 text-right text-sm"
                                    />
                                </div>
                            </div>
                            {promoDiscount > 0 && (
                                <div className="text-success flex justify-between">
                                    <span>Promo ({promoCode.trim().toUpperCase()})</span>
                                    <span className="num-tabular">−{fmt(promoDiscount)}</span>
                                </div>
                            )}
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                            <span className="text-foreground text-base font-semibold">
                                Total Payable
                            </span>
                            <span className="num-tabular text-primary text-2xl font-bold">
                                {fmt(finalTotal)}
                            </span>
                        </div>
                    </div>

                    {/* Promo code */}
                    <div className="flex flex-col gap-2">
                        <Label className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                            <TicketPercent className="size-3.5" /> Promo code
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                value={promoCode}
                                onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); }}
                                placeholder="Enter code"
                                className="h-9 font-mono uppercase"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="h-9 shrink-0"
                                onClick={checkPromo}
                                disabled={promoChecking || !promoCode.trim()}
                            >
                                {promoChecking ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                            </Button>
                        </div>
                        {promoResult && (
                            <p className={promoResult.valid ? "text-success text-xs" : "text-destructive text-xs"}>
                                {promoResult.valid
                                    ? `Applied — ${fmt(promoResult.discount_amount)} off`
                                    : promoResult.reason || "Not applicable"}
                            </p>
                        )}
                    </div>

                    {/* Serial capture for serialised products */}
                    {serialLines.length > 0 && (
                        <div className="flex flex-col gap-3">
                            {serialLines.map(({ key, item }) => (
                                <div key={key} className="border-border flex flex-col gap-2 rounded-lg border p-3">
                                    <Label className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                                        <Barcode className="size-3.5" /> {item.product!.name} — serials ({item.quantity})
                                    </Label>
                                    {Array.from({ length: item.quantity }).map((_, i) => (
                                        <Input
                                            key={i}
                                            value={serials[key]?.[i] ?? ""}
                                            onChange={(e) => {
                                                const next = [...(serials[key] ?? [])];
                                                next[i] = e.target.value;
                                                setSerials((s) => ({ ...s, [key]: next }));
                                            }}
                                            placeholder={`Serial #${i + 1}`}
                                            className="h-8 font-mono text-sm"
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Customer (order mode only) */}
                    {isOrderMode && (
                        <div className="flex flex-col gap-2">
                            <Label className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                                <User className="size-3.5" />
                                Select Customer{" "}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={selectedCustomerId?.toString()}
                                onValueChange={(value) => {
                                    const id = Number(value);
                                    setSelectedCustomerId(id);
                                    const customer = customers.find(
                                        (c) => c.id === id,
                                    );
                                    if (customer?.address)
                                        setDeliveryAddress(customer.address);
                                }}
                            >
                                <SelectTrigger className="h-10 w-full">
                                    <SelectValue placeholder="Choose a customer" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {isLoading ? (
                                        <div className="text-muted-foreground flex items-center justify-center gap-2 p-4 text-sm">
                                            <Loader2 className="size-4 animate-spin" />
                                            Loading customers…
                                        </div>
                                    ) : customers.length === 0 ? (
                                        <div className="text-muted-foreground p-4 text-center text-sm">
                                            No customers found
                                        </div>
                                    ) : (
                                        customers.map((c) => (
                                            <SelectItem
                                                key={c.id}
                                                value={c.id.toString()}
                                            >
                                                <div className="flex flex-col py-0.5">
                                                    <span className="text-foreground font-medium">
                                                        {c.first_name}{" "}
                                                        {c.last_name}
                                                    </span>
                                                    <span className="text-muted-foreground text-[10px]">
                                                        {c.phone}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Delivery address (order mode only) */}
                    {isOrderMode && (
                        <div className="flex flex-col gap-2">
                            <Label className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                                <MapPin className="size-3.5" />
                                Delivery Address
                                <span className="text-muted-foreground text-[10px] font-normal">
                                    (optional)
                                </span>
                            </Label>
                            <Input
                                placeholder="Enter delivery address"
                                value={deliveryAddress}
                                onChange={(e) =>
                                    setDeliveryAddress(e.target.value)
                                }
                                className="h-10"
                            />
                        </div>
                    )}

                    {/* Payment method — walk-ins only; orders are paid later */}
                    {!isOrderMode && <div className="flex flex-col gap-2">
                        <Label className="text-foreground text-sm font-medium">
                            Payment Method
                        </Label>
                        <ToggleGroup
                            type="single"
                            value={paymentMethod}
                            onValueChange={(v) => {
                                if (v)
                                    setPaymentMethod(
                                        v as
                                            | "cash"
                                            | "bank transfer"
                                            | "mobile transfer",
                                    );
                            }}
                            className="grid w-full grid-cols-3 gap-2"
                            variant="outline"
                        >
                            <ToggleGroupItem
                                value="bank transfer"
                                className="flex h-16 flex-col gap-1"
                            >
                                <CreditCard className="size-4" />
                                <span className="text-[11px] font-semibold tracking-wide uppercase">
                                    Card
                                </span>
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="mobile transfer"
                                className="flex h-16 flex-col gap-1"
                            >
                                <Wallet className="size-4" />
                                <span className="text-[11px] font-semibold tracking-wide uppercase">
                                    Mobile
                                </span>
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="cash"
                                className="flex h-16 flex-col gap-1"
                            >
                                <Banknote className="size-4" />
                                <span className="text-[11px] font-semibold tracking-wide uppercase">
                                    Cash
                                </span>
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>}

                    {/* Order mode note — payment is confirmed later */}
                    {isOrderMode && (
                        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2.5 text-xs">
                            Payment will be collected separately. Use <strong className="text-foreground">Confirm Payment</strong> on the Orders page once the order is fulfilled.
                        </p>
                    )}
                </div>

                <DialogFooter className="border-border flex-row gap-2 border-t p-4">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="flex-[2]"
                        onClick={handleComplete}
                        disabled={
                            isSubmitting ||
                            (isOrderMode &&
                                (!selectedCustomerId || !deliveryAddress))
                        }
                    >
                        {isSubmitting ? (
                            <Loader2
                                data-icon="inline-start"
                                className="animate-spin"
                            />
                        ) : null}
                        {isOrderMode ? "Confirm Order" : "Confirm Sales"}
                        <ChevronRight data-icon="inline-end" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
