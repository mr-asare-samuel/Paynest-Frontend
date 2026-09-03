import apiClient from "@/lib/apiClient";
import {
    CreatePurchaseOrderRequest,
    PurchaseOrderInvoiceRequest,
    PurchaseOrderReceiveRequest,
    PurchaseOrderResponse,
    PurchaseOrderStatus,
    PurchaseOrdersListResponse,
    UpdatePurchaseOrderRequest,
    UploadPOInvoiceFileResponse,
} from "@/interfaces/purchaseOrders";
import type { AutoReorderPreview, AutoReorderRunResult } from "@/interfaces/inventoryTracking";

export const CreatePurchaseOrder = async (data: CreatePurchaseOrderRequest): Promise<PurchaseOrderResponse> => {
    try {
        const response = await apiClient.post(`/purchase-orders/`, data)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const GetPurchaseOrders = async (params: {
    status?: PurchaseOrderStatus;
    vendor_id?: number;
    shop_id?: number;
    skip?: number;
    limit?: number;
} = {}): Promise<PurchaseOrdersListResponse> => {
    try {
        const response = await apiClient.get(`/purchase-orders/`, { params })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const GetPurchaseOrderById = async (po_id: number): Promise<PurchaseOrderResponse> => {
    try {
        const response = await apiClient.get(`/purchase-orders/${po_id}`)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const UpdatePurchaseOrder = async (po_id: number, data: UpdatePurchaseOrderRequest): Promise<PurchaseOrderResponse> => {
    try {
        const response = await apiClient.put(`/purchase-orders/${po_id}`, data)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const SendPurchaseOrder = async (po_id: number): Promise<PurchaseOrderResponse> => {
    try {
        const response = await apiClient.post(`/purchase-orders/${po_id}/send`)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const ReceivePurchaseOrder = async (po_id: number, data: PurchaseOrderReceiveRequest): Promise<PurchaseOrderResponse> => {
    try {
        const response = await apiClient.post(`/purchase-orders/${po_id}/receive`, data)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const RecordPurchaseOrderInvoice = async (po_id: number, data: PurchaseOrderInvoiceRequest): Promise<PurchaseOrderResponse> => {
    try {
        const response = await apiClient.post(`/purchase-orders/${po_id}/invoice`, data)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const CancelPurchaseOrder = async (po_id: number): Promise<void> => {
    try {
        await apiClient.delete(`/purchase-orders/${po_id}`)
    } catch (error: unknown) {
        throw error;
    }
}

export const UploadPOInvoiceFile = async (file: File): Promise<UploadPOInvoiceFileResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await apiClient.post(`/purchase-orders/upload-invoice-file`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

// ── Phase 2.2: auto-reorder ────────────────────────────────────────────────

export const GetAutoReorderPreview = async (
    params: { shop_id: number; vendor_id?: number },
): Promise<AutoReorderPreview> => {
    const response = await apiClient.get(`/purchase-orders/auto-reorder/preview`, { params });
    return response.data;
};

export const RunAutoReorder = async (
    data: { shop_id: number; vendor_id?: number; dry_run?: boolean },
): Promise<AutoReorderRunResult> => {
    const response = await apiClient.post(`/purchase-orders/auto-reorder/run`, data);
    return response.data;
};
