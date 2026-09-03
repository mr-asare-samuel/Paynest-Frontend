import apiClient from "@/lib/apiClient";
import {
    PromoCodeResponse, CreatePromoCodeRequest, UpdatePromoCodeRequest,
    PromoValidateRequest, PromoValidateResponse,
} from "@/interfaces/promoCodes";

export const GetPromoCodes = async (): Promise<PromoCodeResponse[]> => {
    const res = await apiClient.get(`/promo-codes`);
    return res.data;
};

export const CreatePromoCode = async (data: CreatePromoCodeRequest): Promise<PromoCodeResponse> => {
    const res = await apiClient.post(`/promo-codes`, data);
    return res.data;
};

export const UpdatePromoCode = async (id: number, data: UpdatePromoCodeRequest): Promise<PromoCodeResponse> => {
    const res = await apiClient.put(`/promo-codes/${id}`, data);
    return res.data;
};

export const DeletePromoCode = async (id: number): Promise<void> => {
    await apiClient.delete(`/promo-codes/${id}`);
};

export const ValidatePromoCode = async (data: PromoValidateRequest): Promise<PromoValidateResponse> => {
    const res = await apiClient.post(`/promo-codes/validate`, data);
    return res.data;
};
