export type OrderType = "sale" | "return" | "exchange";
export type OrderStatus = "initiated" | "preparing" | "ready" | "transported" | "delivered";
export type PaymentMethod = "bank transfer" | "mobile transfer" | "cash";
export type PaymentStatus = "paid" | "unpaid" | "failed";

export interface OrderItemInput {
    product_id?: number,
    bundle_id?: number,
    quantity: number,
    notes?: string,
    serial_numbers?: string[],
}

export interface WalkInsRequest {
    shop_id: number,
    order_type: OrderType,
    order_status: OrderStatus,
    customer_id: number | null,
    items: OrderItemInput[],
    payment: {
        method: PaymentMethod,
        status: PaymentStatus,
        amount_paid: number
    },
    delivery_amount: number,
    discount_amount?: number,
    promo_code?: string | null,
    is_delivered: boolean,
    delivery_address: string | null,
    actual_delivery_date: null,
    expected_delivery_date: null
}


export interface OrderRequest {
    shop_id: number,
    order_type: OrderType,
    order_status: OrderStatus,
    customer_id: number,
    items: OrderItemInput[],
    payment?: {
        method: PaymentMethod,
        status: PaymentStatus,
        amount_paid: number
    },
    delivery_amount: number,
    discount_amount?: number,
    promo_code?: string | null,
    is_delivered: boolean,
    delivery_address: string | null,
    actual_delivery_date: string,
    expected_delivery_date: string
}

export interface ConfirmPaymentRequest {
    method: PaymentMethod,
    status: "paid",
    amount_paid: number
}

export interface OrderWalkInsResponse {
    customer_id: number,
    shop_id: number,
    order_type: OrderType,
    order_status: OrderStatus,
    is_delivered: boolean,
    delivery_address: string,
    expected_delivery_date: string,
    actual_delivery_date: string,
    delivery_amount: number,
    payment: {
        method: PaymentMethod,
        status: PaymentStatus,
        amount_paid: number
    },
    items: [],
    id: number,
    organization_id: number,
    order_number: string,
    attendant_id: number,
    subtotal: number,
    tax_amount: number,
    discount_amount: number,
    total_amount: number,
    amount_paid: number,
    amount_due: number,
    payment_method: PaymentMethod,
    payment_status: PaymentStatus,
    order_date: string,
    order_time: string,
    close_at: string,
    preparing_at?: string,
    ready_at?: string,
    transported_at?: string,
    created_at: string,
    updated_at: string,
    customer: {
        customer_code: string,
        first_name: string,
        last_name: string,
        email: string,
        phone: string,
        date_of_birth: string,
        gender: string,
        address: string,
        city: string,
        state: string,
        country: string,
        postal_code: string,
        loyalty_points: number,
        loyalty_tier: string,
        preferred_payment_method: string,
        communication_preferences: {
            email: boolean,
            sms: boolean,
            phone: boolean,
            marketing_emails: boolean
        },
        notes: string,
        is_active: boolean,
        id: number,
        organization_id: number,
        created_at: string,
        updated_at: string
    },
    payments: []
}

export interface SoldItem {
    id: number;
    product_name: string;
    product_sku: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    order_number: string;
    sold_at: string;
    category_name: string | null;
}

export interface SoldItemsReportResponse {
    items: SoldItem[];
    total_count: number;
    page: number;
    size: number;
    total_revenue: number;
}