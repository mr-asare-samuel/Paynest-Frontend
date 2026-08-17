export interface VendorResponse {
    id: number;
    organization_id: number;
    name: string;
    contact_person: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    tax_id: string | null;
    payment_terms: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateVendorRequest {
    name: string;
    contact_person?: string;
    email?: string;
    phone?: string;
    address?: string;
    tax_id?: string;
    payment_terms?: string;
    notes?: string;
    is_active?: boolean;
}

export type UpdateVendorRequest = Partial<CreateVendorRequest>;

export interface VendorsListResponse {
    items: VendorResponse[];
    total: number;
    skip: number;
    limit: number;
}
