// Phase 2.3 — advanced pricing & discounts (mirrors api/v1/schemas/pricing_models.py)

export type DiscountType = "percentage" | "fixed_price" | "amount_off";
export type PromoDiscountType = "percentage" | "amount_off";
export type PricingScope = "product" | "category" | "all";

// ── Price tiers (volume / bulk pricing) ──────────────────────────────────────

export interface PriceTierResponse {
    id: number;
    organization_id: number;
    shop_id: number | null;
    scope: "product" | "category";
    product_id: number | null;
    category_id: number | null;
    min_quantity: number;
    discount_type: DiscountType;
    discount_value: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreatePriceTierRequest {
    scope: "product" | "category";
    product_id?: number | null;
    category_id?: number | null;
    shop_id?: number | null;
    min_quantity: number;
    discount_type: DiscountType;
    discount_value: number;
    is_active?: boolean;
}

export type UpdatePriceTierRequest = Partial<CreatePriceTierRequest>;

// ── Scheduled discounts (time-based) ─────────────────────────────────────────

export interface ScheduledDiscountResponse {
    id: number;
    organization_id: number;
    shop_id: number | null;
    name: string;
    scope: PricingScope;
    product_id: number | null;
    category_id: number | null;
    discount_type: DiscountType;
    discount_value: number;
    day_of_week_mask: number | null; // bit0=Mon .. bit6=Sun; null/0 = every day
    start_time: string | null;       // "HH:MM"
    end_time: string | null;
    starts_on: string | null;
    ends_on: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateScheduledDiscountRequest {
    name: string;
    scope: PricingScope;
    product_id?: number | null;
    category_id?: number | null;
    shop_id?: number | null;
    discount_type: DiscountType;
    discount_value: number;
    day_of_week_mask?: number | null;
    start_time?: string | null;
    end_time?: string | null;
    starts_on?: string | null;
    ends_on?: string | null;
    is_active?: boolean;
}

export type UpdateScheduledDiscountRequest = Partial<CreateScheduledDiscountRequest>;

// ── Customer-specific pricing ───────────────────────────────────────────────

export interface CustomerPriceResponse {
    id: number;
    organization_id: number;
    customer_id: number | null;
    loyalty_tier: string | null;
    scope: "product" | "category";
    product_id: number | null;
    category_id: number | null;
    discount_type: DiscountType;
    discount_value: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateCustomerPriceRequest {
    customer_id?: number | null;
    loyalty_tier?: string | null;
    scope: "product" | "category";
    product_id?: number | null;
    category_id?: number | null;
    discount_type: DiscountType;
    discount_value: number;
    is_active?: boolean;
}

export type UpdateCustomerPriceRequest = Partial<CreateCustomerPriceRequest>;
