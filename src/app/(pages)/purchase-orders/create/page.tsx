"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { Loader2, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/(shared-components)/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreatePurchaseOrder } from "@/(api-handlers)/purchaseOrdersHandler";
import { GetVendors } from "@/(api-handlers)/vendorsHandler";
import { GetProducts } from "@/(api-handlers)/productsHandler";
import { getOrganizationShops } from "@/(api-handlers)/organizationShopsHandler";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { VendorResponse } from "@/interfaces/vendors";
import { ProductResponse } from "@/interfaces/products";
import { OrganizationShopResponse } from "@/interfaces/organizationShops";
import { purchaseOrderSchema, type PurchaseOrderFormValues } from "@/utils/zod/purchaseOrderSchemas";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import { toast } from "sonner";

const blankItem = { product_id: "", quantity_ordered: "1", unit_cost: "" };

export default function CreatePurchaseOrderPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const role = (user?.role || "attendant").toLowerCase();
    const isAllowed = role === "manager" || role === "admin" || role === "superadmin";

    const [vendors, setVendors] = useState<VendorResponse[]>([]);
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [products, setProducts] = useState<ProductResponse[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user && !isAllowed) router.replace('/dashboard');
    }, [user, isAllowed, router]);

    const { register, control, handleSubmit, watch, formState: { errors } } = useForm<PurchaseOrderFormValues>({
        resolver: zodResolver(purchaseOrderSchema) as Resolver<PurchaseOrderFormValues>,
        defaultValues: { shop_id: "", vendor_id: "", expected_delivery_date: "", notes: "", items: [blankItem] },
    });
    const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });

    const shopId = watch("shop_id");
    const items = watch("items");

    useEffect(() => {
        if (!isAllowed) return;
        GetVendors({ is_active: true, limit: 200 }).then((data) => setVendors(data.items)).catch(console.error);
        getOrganizationShops().then(setShops).catch(console.error);
    }, [isAllowed]);

    useEffect(() => {
        if (!shopId) { setProducts([]); return; }
        GetProducts(Number(shopId)).then(setProducts).catch(() => toast.error("Failed to load products for this shop"));
        replace([blankItem]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopId]);

    const productName = (id: string) => products.find((p) => String(p.id) === id)?.name;

    const totals = items.reduce(
        (acc, it) => {
            const qty = Number(it.quantity_ordered) || 0;
            const cost = Number(it.unit_cost) || 0;
            acc.subtotal += qty * cost;
            return acc;
        },
        { subtotal: 0 },
    );

    const onSubmit = async (values: PurchaseOrderFormValues) => {
        setSubmitting(true);
        try {
            const po = await CreatePurchaseOrder({
                shop_id: Number(values.shop_id),
                vendor_id: Number(values.vendor_id),
                expected_delivery_date: values.expected_delivery_date || undefined,
                notes: values.notes || undefined,
                items: values.items.map((it) => ({
                    product_id: Number(it.product_id),
                    quantity_ordered: Number(it.quantity_ordered),
                    unit_cost: Number(it.unit_cost),
                })),
            });
            toast.success(`Purchase order ${po.po_number} created as a draft`);
            router.push("/purchase-orders");
        } catch (error) {
            handleErrorMessage(error, "Failed to create purchase order");
        } finally {
            setSubmitting(false);
        }
    };

    if (!user || !isAllowed) {
        return (
            <div className="flex items-center justify-center py-24">
                <Skeleton className="size-6 rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="New Purchase Order" description="Order stock from a vendor. It's saved as a draft until you send it." />

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Order Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Shop <span className="text-destructive">*</span></Label>
                            <Controller
                                control={control}
                                name="shop_id"
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select a shop" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {shops.map((s) => (
                                                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.shop_id && <p className="text-destructive text-xs">{errors.shop_id.message}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label>Vendor <span className="text-destructive">*</span></Label>
                            <Controller
                                control={control}
                                name="vendor_id"
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select a vendor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vendors.map((v) => (
                                                <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.vendor_id && <p className="text-destructive text-xs">{errors.vendor_id.message}</p>}
                            {vendors.length === 0 && (
                                <p className="text-muted-foreground text-xs">No vendors yet — add one under Procurement → Vendors first.</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label>Expected Delivery Date</Label>
                            <Controller
                                control={control}
                                name="expected_delivery_date"
                                render={({ field }) => (
                                    <DatePicker
                                        value={field.value ? dayjs(field.value) : null}
                                        onChange={(date) => field.onChange(date ? date.format("YYYY-MM-DD") : "")}
                                        format="DD MMM YYYY"
                                        className="h-9 w-full"
                                    />
                                )}
                            />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                            <Label>Notes</Label>
                            <Textarea {...register("notes")} className="min-h-[70px] resize-none" placeholder="Optional notes for this order" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Line Items</CardTitle>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append(blankItem)}
                            disabled={!shopId}
                        >
                            <Plus className="mr-2 size-4" /> Add Item
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {!shopId ? (
                            <p className="text-muted-foreground text-sm">Select a shop above to choose products.</p>
                        ) : (
                            <>
                                {errors.items?.message && (
                                    <p className="text-destructive text-xs">{errors.items.message}</p>
                                )}
                                {fields.map((field, index) => (
                                    <div key={field.id} className="border-border grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_100px_120px_36px] sm:items-end">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Product</Label>
                                            <Controller
                                                control={control}
                                                name={`items.${index}.product_id`}
                                                render={({ field: f }) => (
                                                    <Select value={f.value} onValueChange={f.onChange}>
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select product">
                                                                {productName(f.value)}
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {products.map((p) => (
                                                                <SelectItem key={p.id} value={String(p.id)}>{p.name}{p.sku ? ` (${p.sku})` : ""}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                            {errors.items?.[index]?.product_id && (
                                                <p className="text-destructive text-xs">{errors.items[index]?.product_id?.message}</p>
                                            )}
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Qty</Label>
                                            <Input type="number" min="1" step="1" {...register(`items.${index}.quantity_ordered`)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Unit Cost</Label>
                                            <Input type="number" min="0" step="0.01" {...register(`items.${index}.unit_cost`)} />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive size-9"
                                            onClick={() => remove(index)}
                                            disabled={fields.length === 1}
                                            aria-label="Remove item"
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                ))}

                                <div className="flex justify-end pt-2">
                                    <div className="w-48 text-sm">
                                        <div className="flex justify-between font-semibold">
                                            <span>Subtotal</span>
                                            <span>GHS {totals.subtotal.toFixed(2)}</span>
                                        </div>
                                        <p className="text-muted-foreground mt-1 text-xs">Tax is computed per-item on the server; this total excludes it.</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Create Draft
                    </Button>
                </div>
            </form>
        </div>
    );
}
