// Module entitlements — mirrors api/v1/schemas/entitlement_models.py

export interface ModuleResponse {
    id: number;
    code: string;
    name: string;
    description: string | null;
    group: string | null;
    is_core: boolean;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateModuleRequest {
    code: string;
    name: string;
    description?: string;
    group?: string;
    is_core?: boolean;
    sort_order?: number;
    is_active?: boolean;
}

export type UpdateModuleRequest = Partial<Omit<CreateModuleRequest, "code">>;

export interface EntitlementsResponse {
    modules: string[];
    plan_id: number | null;
    plan_name: string | null;
    is_custom_plan: boolean;
    expires_at: string | null;
    expired: boolean;
    in_grace: boolean;
}

export interface ModuleGrantResponse {
    id: number;
    organization_id: number;
    module_id: number;
    module_code: string;
    effect: "grant" | "revoke";
    expires_at: string | null;
    reason: string | null;
    created_by: number | null;
    created_at: string;
}

export interface CreateModuleGrantRequest {
    module_code: string;
    effect: "grant" | "revoke";
    expires_at?: string | null;
    reason?: string | null;
}
