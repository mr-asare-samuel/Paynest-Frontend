import apiClient from "@/lib/apiClient";
import {
    SerialResponse, AddSerialsRequest, SerialStatusUpdateRequest,
    BatchResponse, CreateBatchRequest,
    ValuationResponse, ValuationMethod,
} from "@/interfaces/inventoryTracking";

// ── Serials ────────────────────────────────────────────────────────────────

export const GetSerials = async (params: {
    product_id?: number; status?: string; shop_id?: number; skip?: number; limit?: number;
} = {}): Promise<SerialResponse[]> => {
    const res = await apiClient.get(`/serials`, { params });
    return res.data;
};

export const AddSerials = async (data: AddSerialsRequest): Promise<SerialResponse[]> => {
    const res = await apiClient.post(`/serials`, data);
    return res.data;
};

export const UpdateSerialStatus = async (id: number, data: SerialStatusUpdateRequest): Promise<SerialResponse> => {
    const res = await apiClient.patch(`/serials/${id}`, data);
    return res.data;
};

// ── Batches ────────────────────────────────────────────────────────────────

export const GetBatches = async (params: {
    product_id?: number; shop_id?: number; active_only?: boolean;
} = {}): Promise<BatchResponse[]> => {
    const res = await apiClient.get(`/inventory/batches`, { params });
    return res.data;
};

export const GetExpiringBatches = async (params: { days?: number; shop_id?: number } = {}): Promise<BatchResponse[]> => {
    const res = await apiClient.get(`/inventory/batches/expiring`, { params });
    return res.data;
};

export const CreateBatch = async (data: CreateBatchRequest): Promise<BatchResponse> => {
    const res = await apiClient.post(`/inventory/batches`, data);
    return res.data;
};

// ── Valuation ──────────────────────────────────────────────────────────────

export const GetValuation = async (params: { shop_id?: number } = {}): Promise<ValuationResponse> => {
    const res = await apiClient.get(`/inventory/valuation`, { params });
    return res.data;
};

export const GetValuationMethod = async (): Promise<{ method: ValuationMethod; allowed: ValuationMethod[] }> => {
    const res = await apiClient.get(`/inventory/valuation-method`);
    return res.data;
};

export const SetValuationMethod = async (method: ValuationMethod): Promise<{ method: ValuationMethod }> => {
    const res = await apiClient.put(`/inventory/valuation-method`, { method });
    return res.data;
};
