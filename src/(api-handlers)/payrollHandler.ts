import {
    PayrollConfig, PayrollConfigUpdate,
    TaxConfig, TaxConfigCreate, TaxConfigUpdate, TaxConfigReorderItem,
    BenefitItem, BenefitItemCreate, BenefitItemUpdate,
    BenefitBand, BenefitBandCreate, BenefitBandUpdate, BenefitBandItemCreate,
    SalaryStructure, SalaryStructureCreate,
    EmployeeBenefitsSummary, AssignBenefitBandRequest, AddExtraBenefitItemRequest,
    NetToGrossRequest, NetToGrossResponse,
    PayrollRun, PayrollRunCreate, PayrollRunListResponse,
    Payslip, MyPayslipListResponse, PayslipBonusUpdate,
    PayrollTrendsResponse,
} from "@/interfaces/payroll"
import apiClient from "@/lib/apiClient"
import axios from "axios"

// ─── Config ──────────────────────────────────────────────────────────────────
export const getPayrollConfig = async (organizationId?: number): Promise<PayrollConfig> => {
    try {
        const response = await apiClient.get(`/payroll/config`, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const updatePayrollConfig = async (data: PayrollConfigUpdate, organizationId?: number): Promise<PayrollConfig> => {
    try {
        const response = await apiClient.put(`/payroll/config`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

// ─── Tax configs ─────────────────────────────────────────────────────────────
export const getTaxConfigs = async (organizationId?: number): Promise<TaxConfig[]> => {
    try {
        const response = await apiClient.get(`/payroll/tax-configs`, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const createTaxConfig = async (data: TaxConfigCreate, organizationId?: number): Promise<TaxConfig> => {
    try {
        const response = await apiClient.post(`/payroll/tax-configs`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const updateTaxConfig = async (id: number, data: TaxConfigUpdate, organizationId?: number): Promise<TaxConfig> => {
    try {
        const response = await apiClient.put(`/payroll/tax-configs/${id}`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const deleteTaxConfig = async (id: number, organizationId?: number): Promise<void> => {
    try {
        await apiClient.delete(`/payroll/tax-configs/${id}`, { params: { organization_id: organizationId } })
    } catch (error: unknown) {
        throw error;
    }
}

export const reorderTaxConfigs = async (items: TaxConfigReorderItem[], organizationId?: number): Promise<TaxConfig[]> => {
    try {
        const response = await apiClient.patch(`/payroll/tax-configs/reorder`, { items }, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

// ─── Benefit items ───────────────────────────────────────────────────────────
export const getBenefitItems = async (organizationId?: number): Promise<BenefitItem[]> => {
    try {
        const response = await apiClient.get(`/payroll/benefit-items`, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const createBenefitItem = async (data: BenefitItemCreate, organizationId?: number): Promise<BenefitItem> => {
    try {
        const response = await apiClient.post(`/payroll/benefit-items`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const updateBenefitItem = async (id: number, data: BenefitItemUpdate, organizationId?: number): Promise<BenefitItem> => {
    try {
        const response = await apiClient.put(`/payroll/benefit-items/${id}`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const deleteBenefitItem = async (id: number, organizationId?: number): Promise<void> => {
    try {
        await apiClient.delete(`/payroll/benefit-items/${id}`, { params: { organization_id: organizationId } })
    } catch (error: unknown) {
        throw error;
    }
}

// ─── Benefit bands ───────────────────────────────────────────────────────────
export const getBenefitBands = async (organizationId?: number): Promise<BenefitBand[]> => {
    try {
        const response = await apiClient.get(`/payroll/benefit-bands`, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const createBenefitBand = async (data: BenefitBandCreate, organizationId?: number): Promise<BenefitBand> => {
    try {
        const response = await apiClient.post(`/payroll/benefit-bands`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const updateBenefitBand = async (id: number, data: BenefitBandUpdate, organizationId?: number): Promise<BenefitBand> => {
    try {
        const response = await apiClient.put(`/payroll/benefit-bands/${id}`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const deleteBenefitBand = async (id: number, organizationId?: number): Promise<void> => {
    try {
        await apiClient.delete(`/payroll/benefit-bands/${id}`, { params: { organization_id: organizationId } })
    } catch (error: unknown) {
        throw error;
    }
}

export const addBenefitBandItem = async (bandId: number, data: BenefitBandItemCreate, organizationId?: number): Promise<BenefitBand> => {
    try {
        const response = await apiClient.post(`/payroll/benefit-bands/${bandId}/items`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const removeBenefitBandItem = async (bandId: number, bandItemId: number, organizationId?: number): Promise<void> => {
    try {
        await apiClient.delete(`/payroll/benefit-bands/${bandId}/items/${bandItemId}`, { params: { organization_id: organizationId } })
    } catch (error: unknown) {
        throw error;
    }
}

// ─── Salary structures ───────────────────────────────────────────────────────
export const getSalaryStructures = async (employeeProfileId: number, organizationId?: number): Promise<SalaryStructure[]> => {
    try {
        const response = await apiClient.get(`/payroll/salary-structures/${employeeProfileId}`, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const createSalaryStructure = async (data: SalaryStructureCreate, organizationId?: number): Promise<SalaryStructure> => {
    try {
        const response = await apiClient.post(`/payroll/salary-structures`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

// ─── Employee benefits (band assignment + extras) ───────────────────────────
export const getEmployeeBenefitsSummary = async (employeeProfileId: number, organizationId?: number): Promise<EmployeeBenefitsSummary> => {
    try {
        const response = await apiClient.get(`/payroll/employee-benefits/${employeeProfileId}`, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const assignBenefitBand = async (data: AssignBenefitBandRequest, organizationId?: number): Promise<EmployeeBenefitsSummary> => {
    try {
        const response = await apiClient.post(`/payroll/employee-benefits/band`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const addExtraBenefitItem = async (data: AddExtraBenefitItemRequest, organizationId?: number): Promise<EmployeeBenefitsSummary> => {
    try {
        const response = await apiClient.post(`/payroll/employee-benefits/extra`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const removeExtraBenefitItem = async (id: number, organizationId?: number): Promise<void> => {
    try {
        await apiClient.delete(`/payroll/employee-benefits/extra/${id}`, { params: { organization_id: organizationId } })
    } catch (error: unknown) {
        throw error;
    }
}

// ─── Net-to-gross calculator ─────────────────────────────────────────────────
export const calculateNetToGross = async (data: NetToGrossRequest, organizationId?: number): Promise<NetToGrossResponse> => {
    try {
        const response = await apiClient.post(`/payroll/net-to-gross`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

// ─── Payroll runs ────────────────────────────────────────────────────────────
export const createPayrollRun = async (data: PayrollRunCreate, organizationId?: number): Promise<PayrollRun> => {
    try {
        const response = await apiClient.post(`/payroll/runs`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const getPayrollRuns = async (skip = 0, limit = 20, organizationId?: number): Promise<PayrollRunListResponse> => {
    try {
        const response = await apiClient.get(`/payroll/runs`, { params: { skip, limit, organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const getPayrollRunById = async (id: number, organizationId?: number): Promise<PayrollRun> => {
    try {
        const response = await apiClient.get(`/payroll/runs/${id}`, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const getRunPayslips = async (runId: number, organizationId?: number): Promise<Payslip[]> => {
    try {
        const response = await apiClient.get(`/payroll/runs/${runId}/payslips`, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const updatePayslipBonus = async (
    runId: number, payslipId: number, data: PayslipBonusUpdate, organizationId?: number,
): Promise<Payslip> => {
    try {
        const response = await apiClient.put(
            `/payroll/runs/${runId}/payslips/${payslipId}/bonus`, data, { params: { organization_id: organizationId } },
        )
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const getPayrollTrends = async (limit = 12, organizationId?: number): Promise<PayrollTrendsResponse> => {
    try {
        const response = await apiClient.get(`/payroll/runs/trends`, { params: { limit, organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const submitPayrollRun = async (id: number, notes?: string, organizationId?: number): Promise<PayrollRun> => {
    try {
        const response = await apiClient.post(`/payroll/runs/${id}/submit`, { notes }, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const approvePayrollRun = async (
    id: number,
    data: { approved: boolean; rejection_reason?: string },
    organizationId?: number,
): Promise<PayrollRun> => {
    try {
        const response = await apiClient.patch(`/payroll/runs/${id}/approve`, data, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const processPayrollRun = async (id: number, organizationId?: number): Promise<PayrollRun> => {
    try {
        const response = await apiClient.post(`/payroll/runs/${id}/process`, {}, { params: { organization_id: organizationId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

// ─── Payslips ────────────────────────────────────────────────────────────────
export const getMyPayslips = async (skip = 0, limit = 20): Promise<MyPayslipListResponse> => {
    try {
        const response = await apiClient.get(`/payroll/payslips/me`, { params: { skip, limit } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const getPayslip = async (id: number): Promise<Payslip> => {
    try {
        const response = await apiClient.get(`/payroll/payslips/${id}`)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const downloadPayslip = async (id: number, filename?: string): Promise<void> => {
    try {
        const response = await apiClient.get(`/payroll/payslips/${id}/download`, { responseType: 'blob' })
        const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
        const a = document.createElement('a')
        a.href = url
        a.download = filename ?? `payslip-${id}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    } catch (error: unknown) {
        // Error bodies come back as a Blob (not JSON) when responseType is 'blob' —
        // rehydrate it so callers reading error.response.data.detail still work.
        if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
            try {
                const text = await error.response.data.text();
                error.response.data = JSON.parse(text);
            } catch {
                // leave as-is if it wasn't JSON
            }
        }
        throw error;
    }
}
