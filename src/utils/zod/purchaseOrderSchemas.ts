import { z } from 'zod';

export const purchaseOrderItemSchema = z.object({
    product_id: z.string().min(1, "Select a product"),
    quantity_ordered: z.string().min(1, "Required"),
    unit_cost: z.string().min(1, "Required"),
});

export const purchaseOrderSchema = z.object({
    shop_id: z.string().min(1, "Select a shop"),
    vendor_id: z.string().min(1, "Select a vendor"),
    expected_delivery_date: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(purchaseOrderItemSchema).min(1, "Add at least one line item"),
});

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
