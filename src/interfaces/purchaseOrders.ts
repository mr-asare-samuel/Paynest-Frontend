export type PurchaseOrderStatus = "draft" | "sent" | "partially_received" | "received" | "cancelled";
export type PurchaseOrderMatchStatus = "matched" | "over_invoiced" | "under_invoiced";

export interface CreatePurchaseOrderItemInput {
    product_id: number;
    quantity_ordered: number;
    unit_cost: number;
    tax_rate?: number;
    notes?: string;
}

export interface CreatePurchaseOrderRequest {
    shop_id: number;
    vendor_id: number;
    items: CreatePurchaseOrderItemInput[];
    expected_delivery_date?: string;
    notes?: string;
}

export type UpdatePurchaseOrderRequest = Partial<CreatePurchaseOrderRequest>;

export interface PurchaseOrderItemResponse {
    id: number;
    purchase_order_id: number;
    product_id: number;
    quantity_ordered: number;
    quantity_received: number;
    unit_cost: number;
    tax_rate: number | null;
    notes: string | null;
}

export interface PurchaseOrderResponse {
    id: number;
    organization_id: number;
    shop_id: number;
    vendor_id: number;
    po_number: string;
    status: PurchaseOrderStatus;
    expected_delivery_date: string | null;
    notes: string | null;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    created_by: number;
    sent_by: number | null;
    sent_at: string | null;
    received_by: number | null;
    received_at: string | null;
    cancelled_by: number | null;
    cancelled_at: string | null;
    invoice_number: string | null;
    invoice_amount: number | null;
    invoice_date: string | null;
    invoice_file_url: string | null;
    match_status: PurchaseOrderMatchStatus | null;
    expense_id: number | null;
    created_at: string;
    updated_at: string;
    items: PurchaseOrderItemResponse[];
}

export interface PurchaseOrderReceiveItem {
    item_id: number;
    quantity: number;
}

export interface PurchaseOrderReceiveRequest {
    items: PurchaseOrderReceiveItem[];
}

export interface PurchaseOrderInvoiceRequest {
    invoice_number: string;
    invoice_amount: number;
    invoice_date: string;
    invoice_file_url?: string;
    category_id?: number;
}

export interface UploadPOInvoiceFileResponse {
    file_url: string;
}

export interface PurchaseOrdersListResponse {
    items: PurchaseOrderResponse[];
    total: number;
    skip: number;
    limit: number;
}
