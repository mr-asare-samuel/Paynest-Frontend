// Phase 2.3 — product bundles (mirrors api/v1/schemas/pricing_models.py)

export interface BundleItemInput {
    product_id: number;
    quantity: number;
}

export interface BundleItemOut {
    id: number;
    product_id: number;
    quantity: number;
    product_name: string | null;
}

export interface BundleResponse {
    id: number;
    organization_id: number;
    shop_id: number;
    name: string;
    sku: string | null;
    description: string | null;
    bundle_price: number;
    is_active: boolean;
    items: BundleItemOut[];
    created_at: string;
    updated_at: string;
}

export interface CreateBundleRequest {
    name: string;
    shop_id: number;
    sku?: string;
    description?: string;
    bundle_price: number;
    is_active?: boolean;
    items: BundleItemInput[];
}

export interface UpdateBundleRequest {
    name?: string;
    sku?: string;
    description?: string;
    bundle_price?: number;
    is_active?: boolean;
    items?: BundleItemInput[];
}
