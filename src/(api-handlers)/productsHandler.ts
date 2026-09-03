import { ProductRequest, ProductResponse } from "@/interfaces/products";
import type { BulkImportResult } from "@/interfaces/inventoryTracking";
import apiClient from "@/lib/apiClient";


export const CreateProduct = async (product_data: ProductRequest): Promise<ProductResponse> => {
    try {
        const response = await apiClient.post(`/products/`, product_data)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}


export const GetProducts = async (shopId?: number): Promise<ProductResponse[]> => {
    try {
        const response = await apiClient.get(`/products/`, {
            params: { shop_id: shopId },
        })
        return response.data.items
    } catch (error: unknown) {
        throw error;
    }
}

export const GetProductByID = async (product_id: number): Promise<ProductResponse> => {
    try {
        const response = await apiClient.get(`/products/${product_id}`)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const UpdateProdctDetails = async (product_id: number, product_data: ProductRequest): Promise<ProductResponse> => {
    try {
        const response = await apiClient.put(`/products/${product_id}`, product_data)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const DeleteProduct = async (product_id: number): Promise<void> => {
    try {
        await apiClient.delete(`/products/${product_id}`)
    } catch (error: unknown) {
        throw error;
    }
}

export const GetProductByBarcode = async (barcode: string): Promise<ProductResponse> => {
    try {
        const response = await apiClient.get(`/products/barcode/${encodeURIComponent(barcode)}`)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const uploadProductImage = async (file: File): Promise<{ image_url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/products/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const GetProductsByCategory = async (category_id: number): Promise<ProductResponse[]> => {
    try {
        const response = await apiClient.get(`/products/category/${category_id}`)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

// ── Phase 2.2: barcode + bulk import ──────────────────────────────────────────

/** Fetch the product's barcode as an SVG object URL (endpoint requires auth, so
 *  we can't point an <img src> straight at it). Caller must URL.revokeObjectURL. */
export const GetProductBarcodeSvgUrl = async (
    productId: number,
    opts: { symbology?: string; text?: boolean } = {},
): Promise<string> => {
    const response = await apiClient.get(`/products/${productId}/barcode.svg`, {
        params: { symbology: opts.symbology, text: opts.text },
        responseType: "blob",
    });
    return URL.createObjectURL(new Blob([response.data], { type: "image/svg+xml" }));
};

export const GenerateProductBarcode = async (
    productId: number,
    overwrite = false,
): Promise<ProductResponse> => {
    const response = await apiClient.post(
        `/products/${productId}/barcode/generate`,
        null,
        { params: { overwrite } },
    );
    return response.data;
};

export const BulkImportProducts = async (
    file: File,
    opts: { shop_id?: number; create_missing_categories?: boolean } = {},
): Promise<BulkImportResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post(`/products/bulk-import`, formData, {
        params: opts,
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
};

export const DownloadProductImportTemplate = async (): Promise<Blob> => {
    const response = await apiClient.get(`/products/bulk-import/template`, { responseType: "blob" });
    return new Blob([response.data], { type: "text/csv" });
};
