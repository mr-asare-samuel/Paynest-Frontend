import apiClient from "@/lib/apiClient";
import {
    EntitlementsResponse, ModuleResponse, CreateModuleRequest, UpdateModuleRequest,
    ModuleGrantResponse, CreateModuleGrantRequest,
} from "@/interfaces/entitlements";

// ── The caller's own entitlements ──────────────────────────────────────────

export const GetMyEntitlements = async (): Promise<EntitlementsResponse> => {
    const res = await apiClient.get(`/entitlements/me`);
    return res.data;
};

// ── Module catalog (superadmin for writes) ─────────────────────────────────

export const GetModules = async (includeInactive = false): Promise<ModuleResponse[]> => {
    const res = await apiClient.get(`/modules`, { params: { include_inactive: includeInactive } });
    return res.data;
};

export const CreateModule = async (data: CreateModuleRequest): Promise<ModuleResponse> => {
    const res = await apiClient.post(`/modules`, data);
    return res.data;
};

export const UpdateModule = async (id: number, data: UpdateModuleRequest): Promise<ModuleResponse> => {
    const res = await apiClient.put(`/modules/${id}`, data);
    return res.data;
};

export const DeleteModule = async (id: number): Promise<void> => {
    await apiClient.delete(`/modules/${id}`);
};

// ── Plan → module list ────────────────────────────────────────────────────

export const SetPlanModules = async (planId: number, moduleCodes: string[]) => {
    const res = await apiClient.put(`/subscription-plans/${planId}/modules`, { module_codes: moduleCodes });
    return res.data;
};

// ── Per-org grants / revokes ──────────────────────────────────────────────

export const GetOrgModuleGrants = async (orgId: number): Promise<ModuleGrantResponse[]> => {
    const res = await apiClient.get(`/organizations/${orgId}/module-grants`);
    return res.data;
};

export const CreateOrgModuleGrant = async (
    orgId: number,
    data: CreateModuleGrantRequest,
): Promise<ModuleGrantResponse> => {
    const res = await apiClient.post(`/organizations/${orgId}/module-grants`, data);
    return res.data;
};

export const DeleteOrgModuleGrant = async (orgId: number, grantId: number): Promise<void> => {
    await apiClient.delete(`/organizations/${orgId}/module-grants/${grantId}`);
};

// ── Phase D: rollout visibility ───────────────────────────────────────────

export interface EntitlementStats {
    active_organizations: number;
    modules: {
        code: string; name: string; is_core: boolean;
        entitled_orgs: number; plans_including: number;
    }[];
}

export interface ExpiringOrg {
    organization_id: number;
    name: string;
    plan_name: string | null;
    expires_at: string;
    days_left: number;
    expired: boolean;
}

export const GetEntitlementStats = async (): Promise<EntitlementStats> => {
    const res = await apiClient.get(`/entitlements/stats`);
    return res.data;
};

export const GetExpiringSubscriptions = async (days = 14): Promise<{ days: number; organizations: ExpiringOrg[] }> => {
    const res = await apiClient.get(`/entitlements/expiring`, { params: { days } });
    return res.data;
};

export const GrandfatherOrgs = async (
    body: { strategy: "grant_all" | "legacy_plan"; org_ids?: number[]; active_only?: boolean },
): Promise<{ strategy: string; organizations: number; grants_added?: number }> => {
    const res = await apiClient.post(`/entitlements/grandfather`, body);
    return res.data;
};
