import apiClient from "@/lib/apiClient";
import {
    CreateVendorRequest,
    UpdateVendorRequest,
    VendorResponse,
    VendorsListResponse,
} from "@/interfaces/vendors";

export const CreateVendor = async (data: CreateVendorRequest): Promise<VendorResponse> => {
    try {
        const response = await apiClient.post(`/vendors/`, data)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const GetVendors = async (params: {
    is_active?: boolean;
    search?: string;
    skip?: number;
    limit?: number;
} = {}): Promise<VendorsListResponse> => {
    try {
        const response = await apiClient.get(`/vendors/`, { params })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const GetVendorById = async (vendor_id: number): Promise<VendorResponse> => {
    try {
        const response = await apiClient.get(`/vendors/${vendor_id}`)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const UpdateVendor = async (vendor_id: number, data: UpdateVendorRequest): Promise<VendorResponse> => {
    try {
        const response = await apiClient.put(`/vendors/${vendor_id}`, data)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}
