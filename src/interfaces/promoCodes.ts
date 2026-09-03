// Phase 2.3 — promo codes (mirrors api/v1/schemas/pricing_models.py)

import { PromoDiscountType, PricingScope } from "@/interfaces/pricing";

export interface PromoCodeResponse {
    id: number;
    organization_id: number;
    code: string;
    description: string | null;
    discount_type: PromoDiscountType;
    discount_value: number;
    scope: PricingScope;
    product_id: number | null;
    category_id: number | null;
    min_order_amount: number | null;
    max_discount_amount: number | null;
    usage_limit: number | null;
    per_customer_limit: number | null;
    times_used: number;
    starts_at: string | null;
    ends_at: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreatePromoCodeRequest {
    code: string;
    description?: string;
    discount_type: PromoDiscountType;
    discount_value: number;
    scope: PricingScope;
    product_id?: number | null;
    category_id?: number | null;
    min_order_amount?: number | null;
    max_discount_amount?: number | null;
    usage_limit?: number | null;
    per_customer_limit?: number | null;
    starts_at?: string | null;
    ends_at?: string | null;
    is_active?: boolean;
}

export type UpdatePromoCodeRequest = Partial<Omit<CreatePromoCodeRequest, "code">>;

export interface PromoValidateItem {
    product_id?: number | null;
    bundle_id?: number | null;
    quantity: number;
    discount_percentage?: number;
    notes?: string;
}

export interface PromoValidateRequest {
    code: string;
    shop_id: number;
    customer_id?: number | null;
    items: PromoValidateItem[];
}

export interface PromoValidateResponse {
    valid: boolean;
    discount_amount: number;
    reason: string | null;
    order_total_before: number;
    order_total_after: number;
}
