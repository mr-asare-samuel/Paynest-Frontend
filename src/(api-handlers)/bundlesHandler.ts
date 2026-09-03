import apiClient from "@/lib/apiClient";
import { BundleResponse, CreateBundleRequest, UpdateBundleRequest } from "@/interfaces/bundles";

export const GetBundles = async (params: { shop_id?: number } = {}): Promise<BundleResponse[]> => {
    const res = await apiClient.get(`/bundles`, { params });
    return res.data;
};

export const GetBundleById = async (id: number): Promise<BundleResponse> => {
    const res = await apiClient.get(`/bundles/${id}`);
    return res.data;
};

export const CreateBundle = async (data: CreateBundleRequest): Promise<BundleResponse> => {
    const res = await apiClient.post(`/bundles`, data);
    return res.data;
};

export const UpdateBundle = async (id: number, data: UpdateBundleRequest): Promise<BundleResponse> => {
    const res = await apiClient.put(`/bundles/${id}`, data);
    return res.data;
};

export const DeleteBundle = async (id: number): Promise<void> => {
    await apiClient.delete(`/bundles/${id}`);
};
