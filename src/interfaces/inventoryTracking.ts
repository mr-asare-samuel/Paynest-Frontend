// Phase 2.2 — serial / batch / valuation tracking
// (mirrors api/v1/schemas/inventory_tracking_models.py + bulk-import responses)

export type SerialStatus = "in_stock" | "sold" | "returned" | "damaged";
export type ValuationMethod = "fifo" | "lifo" | "weighted_average";

// ── Serials ────────────────────────────────────────────────────────────────

export interface SerialResponse {
    id: number;
    organization_id: number;
    product_id: number;
    shop_id: number;
    serial_number: string;
    status: SerialStatus;
    received_via: string | null;
    order_item_id: number | null;
    notes: string | null;
    received_at: string | null;
    sold_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface AddSerialsRequest {
    product_id: number;
    shop_id?: number;
    serial_numbers: string[];
    received_via?: "manual" | "purchase_order" | "import";
    notes?: string;
}

export interface SerialStatusUpdateRequest {
    status: SerialStatus;
    notes?: string;
}

// ── Batches ────────────────────────────────────────────────────────────────

export interface BatchResponse {
    id: number;
    organization_id: number;
    product_id: number;
    shop_id: number;
    batch_number: string;
    initial_quantity: number;
    quantity: number;
    unit_cost: number;
    expiry_date: string | null;
    received_date: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateBatchRequest {
    product_id: number;
    shop_id?: number;
    batch_number: string;
    quantity: number;
    unit_cost?: number;
    expiry_date?: string | null;
    received_date?: string | null;
}

// ── Valuation ──────────────────────────────────────────────────────────────

export interface ValuationItem {
    product_id: number;
    product_name: string;
    sku: string | null;
    quantity_on_hand: number;
    total_value: number;
    average_unit_cost: number;
}

export interface ValuationResponse {
    method: ValuationMethod;
    shop_id: number | null;
    total_value: number;
    total_units: number;
    items: ValuationItem[];
}

// ── Bulk import ────────────────────────────────────────────────────────────

export interface BulkImportError {
    row: number;
    sku?: string;
    message: string;
}

export interface BulkImportResult {
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: BulkImportError[];
}

// ── Auto-reorder ──────────────────────────────────────────────────────────

export interface ReorderNeed {
    product_id: number;
    product_name: string;
    sku: string;
    current_stock: number;
    reorder_point: number;
    reorder_quantity: number;
    suggested_quantity: number;
    unit_cost: number;
    estimated_line_cost: number;
    default_vendor_id: number | null;
    default_vendor_name: string | null;
}

export interface AutoReorderPreview {
    shop_id: number;
    needs: ReorderNeed[];
    without_vendor: ReorderNeed[];
    estimated_cost: number;
}

export interface AutoReorderRunResult {
    dry_run: boolean;
    created_purchase_orders?: {
        id: number;
        po_number: string;
        vendor_id: number;
        item_count: number;
        total_amount: number;
    }[];
    would_create?: { vendor_id: number; item_count: number; estimated_total: number }[];
    skipped_without_vendor: ReorderNeed[];
}
