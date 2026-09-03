import apiClient from "@/lib/apiClient";
import {
    PriceTierResponse, CreatePriceTierRequest, UpdatePriceTierRequest,
    ScheduledDiscountResponse, CreateScheduledDiscountRequest, UpdateScheduledDiscountRequest,
    CustomerPriceResponse, CreateCustomerPriceRequest, UpdateCustomerPriceRequest,
} from "@/interfaces/pricing";

// ── Price tiers ────────────────────────────────────────────────────────────

export const GetPriceTiers = async (params: { product_id?: number; category_id?: number } = {}): Promise<PriceTierResponse[]> => {
    const res = await apiClient.get(`/pricing/tiers`, { params });
    return res.data;
};

export const CreatePriceTier = async (data: CreatePriceTierRequest): Promise<PriceTierResponse> => {
    const res = await apiClient.post(`/pricing/tiers`, data);
    return res.data;
};

export const UpdatePriceTier = async (id: number, data: UpdatePriceTierRequest): Promise<PriceTierResponse> => {
    const res = await apiClient.put(`/pricing/tiers/${id}`, data);
    return res.data;
};

export const DeletePriceTier = async (id: number): Promise<void> => {
    await apiClient.delete(`/pricing/tiers/${id}`);
};

// ── Scheduled discounts ───────────────────────────────────────────────────

export const GetScheduledDiscounts = async (): Promise<ScheduledDiscountResponse[]> => {
    const res = await apiClient.get(`/pricing/scheduled-discounts`);
    return res.data;
};

export const CreateScheduledDiscount = async (data: CreateScheduledDiscountRequest): Promise<ScheduledDiscountResponse> => {
    const res = await apiClient.post(`/pricing/scheduled-discounts`, data);
    return res.data;
};

export const UpdateScheduledDiscount = async (id: number, data: UpdateScheduledDiscountRequest): Promise<ScheduledDiscountResponse> => {
    const res = await apiClient.put(`/pricing/scheduled-discounts/${id}`, data);
    return res.data;
};

export const DeleteScheduledDiscount = async (id: number): Promise<void> => {
    await apiClient.delete(`/pricing/scheduled-discounts/${id}`);
};

// ── Customer-specific pricing ─────────────────────────────────────────────

export const GetCustomerPrices = async (params: { customer_id?: number } = {}): Promise<CustomerPriceResponse[]> => {
    const res = await apiClient.get(`/pricing/customer-prices`, { params });
    return res.data;
};

export const CreateCustomerPrice = async (data: CreateCustomerPriceRequest): Promise<CustomerPriceResponse> => {
    const res = await apiClient.post(`/pricing/customer-prices`, data);
    return res.data;
};

export const UpdateCustomerPrice = async (id: number, data: UpdateCustomerPriceRequest): Promise<CustomerPriceResponse> => {
    const res = await apiClient.put(`/pricing/customer-prices/${id}`, data);
    return res.data;
};

export const DeleteCustomerPrice = async (id: number): Promise<void> => {
    await apiClient.delete(`/pricing/customer-prices/${id}`);
};
