export type PayFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface PayrollConfig {
    id: number;
    organization_id: number;
    pay_frequency: PayFrequency;
    pay_day: number;
    updated_at: string;
}

export interface PayrollConfigUpdate {
    pay_frequency?: PayFrequency;
    pay_day?: number;
}

// ─── Tax Configs — generic rule engine ─────────────────────────────────────
export type TaxConfigMode = 'flat_percentage' | 'threshold_split' | 'progressive_bracket';
export type TaxConfigTarget = 'base_salary' | 'gross_pay' | 'bonus';
export type TaxBearer = 'employee' | 'employer';

export interface TaxConfig {
    id: number;
    organization_id: number;
    name: string;
    mode: TaxConfigMode;
    target: TaxConfigTarget;
    bearer: TaxBearer;
    rate: number;
    lower_bound: number | null;
    upper_bound: number | null;
    step: number;
    is_active: boolean;
}

export interface TaxConfigCreate {
    name: string;
    mode: TaxConfigMode;
    target: TaxConfigTarget;
    bearer: TaxBearer;
    rate: number;
    lower_bound?: number | null;
    upper_bound?: number | null;
    step: number;
}

export type TaxConfigUpdate = Partial<TaxConfigCreate> & { is_active?: boolean };

export interface TaxConfigReorderItem {
    id: number;
    step: number;
}

// ─── Benefit items (catalog) ────────────────────────────────────────────────
export type BenefitCategory = 'allowance' | 'deduction';
export type BenefitCalculationType = 'fixed_amount' | 'percentage_of_base';

export interface BenefitItem {
    id: number;
    organization_id: number;
    name: string;
    category: BenefitCategory;
    calculation_type: BenefitCalculationType;
    value: number;
    tax_relief_amount: number;
    is_taxable: boolean;
    is_active: boolean;
}

export interface BenefitItemCreate {
    name: string;
    category: BenefitCategory;
    calculation_type?: BenefitCalculationType;
    value: number;
    tax_relief_amount?: number;
    is_taxable?: boolean;
}

export type BenefitItemUpdate = Partial<BenefitItemCreate> & { is_active?: boolean };

// ─── Benefit bands (reusable packages) ──────────────────────────────────────
export interface BenefitBandItem {
    id: number;
    benefit_band_id: number;
    benefit_item_id: number;
    override_value: number | null;
    benefit_item: BenefitItem;
}

export interface BenefitBand {
    id: number;
    organization_id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    // Some endpoints omit this (or return null) rather than an empty array — always
    // guard with `?? []` before reading it.
    band_items?: BenefitBandItem[] | null;
}

export interface BenefitBandCreate {
    name: string;
    description?: string;
}

export type BenefitBandUpdate = Partial<BenefitBandCreate> & { is_active?: boolean };

export interface BenefitBandItemCreate {
    benefit_item_id: number;
    override_value?: number | null;
}

// ─── Salary structures (per-employee base pay) ─────────────────────────────
export type WageType = 'salaried' | 'hourly' | 'commission';

export interface SalaryStructure {
    id: number;
    employee_profile_id: number;
    organization_id: number;
    base_amount: number;
    wage_type: WageType;
    hourly_rate: number | null;
    commission_rate: number | null;
    effective_date: string;
    end_date: string | null;
    created_at: string;
}

export interface SalaryStructureCreate {
    employee_profile_id: number;
    base_amount: number;
    wage_type?: WageType;
    hourly_rate?: number | null;
    commission_rate?: number | null;
    effective_date: string;
}

// ─── Employee benefits (band assignment + extras) ──────────────────────────
export interface EmployeeBenefitBandAssignment {
    id: number;
    employee_profile_id: number;
    benefit_band_id: number;
    effective_date: string;
    end_date: string | null;
    benefit_band: BenefitBand;
}

export interface ExtraBenefitItem {
    id: number;
    benefit_item_id: number;
    override_value: number | null;
    effective_date: string;
    end_date: string | null;
    is_active: boolean;
    benefit_item: BenefitItem;
}

export interface EmployeeBenefitsSummary {
    employee_profile_id: number;
    benefit_band: EmployeeBenefitBandAssignment | null;
    extra_items: ExtraBenefitItem[];
    band_item_count: number;
    extra_item_count: number;
    total_items: number;
    tax_relief_total: number;
}

export interface AssignBenefitBandRequest {
    employee_profile_id: number;
    benefit_band_id: number;
    effective_date: string;
}

export interface AddExtraBenefitItemRequest {
    employee_profile_id: number;
    benefit_item_id: number;
    effective_date: string;
    override_value?: number | null;
    end_date?: string | null;
}

// ─── Net-to-gross calculator ────────────────────────────────────────────────
export interface NetToGrossRequest {
    desired_net_salary: number;
    tax_config_ids: number[];
}

export interface NetToGrossResponse {
    desired_net_salary: number;
    required_gross_salary: number;
    tax_config_ids: number[];
}

// ─── Payroll runs ────────────────────────────────────────────────────────────
export type PayrollRunStatus = 'draft' | 'review' | 'approved' | 'processed' | 'rejected';

export interface PayrollRun {
    id: number;
    organization_id: number;
    period_start: string;
    period_end: string;
    pay_date: string;
    run_number: string;
    status: PayrollRunStatus;
    total_gross_pay: number;
    total_employee_tax: number;
    total_employer_cost: number;
    total_deductions: number;
    total_net_pay: number;
    employee_count: number;
    prepared_by: number | null;
    reviewed_by: number | null;
    approved_by: number | null;
    processed_by: number | null;
    notes: string | null;
    rejection_reason: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    processed_at: string | null;
    created_at: string;
}

export interface PayrollRunCreate {
    period_start: string;
    period_end: string;
    pay_date: string;
    notes?: string;
}

export interface PayrollRunListResponse {
    items: PayrollRun[];
    total: number;
    skip: number;
    limit: number;
}

// ─── Payslips ────────────────────────────────────────────────────────────────
export interface TaxBreakdownItem {
    name: string;
    mode: TaxConfigMode;
    bearer: TaxBearer;
    amount: number;
    target?: TaxConfigTarget;
}

export interface BenefitBreakdownItem {
    name: string;
    category: BenefitCategory;
    source: 'band' | 'extra';
    amount: number;
}

export interface Payslip {
    id: number;
    payroll_run_id: number;
    employee_profile_id: number;
    user_id: number;
    payslip_number: string;
    base_pay: number;
    total_allowances: number;
    gross_pay: number;
    tax_relief_total: number;
    total_employee_tax: number;
    total_employer_cost: number;
    total_deductions: number;
    net_pay: number;
    tax_breakdown: TaxBreakdownItem[];
    benefits_breakdown: BenefitBreakdownItem[];
    status: string;
    created_at: string;
    organization_name?: string | null;
    organization_logo_url?: string | null;
    bonus_amount: number;
    unpaid_leave_days: number;
    unpaid_leave_deduction: number;
    wage_type: WageType | null;
    hours_worked: number | null;
    commission_base: number | null;
}

export interface PayslipBonusUpdate {
    bonus_amount: number;
    reason?: string;
}

export interface MyPayslipSummary {
    id: number;
    payslip_number: string;
    payroll_run_id: number;
    run_number: string;
    period_start: string;
    period_end: string;
    pay_date: string;
    net_pay: number;
    status: string;
    created_at: string | null;
}

export interface MyPayslipListResponse {
    items: MyPayslipSummary[];
    total: number;
    skip: number;
    limit: number;
}

// ─── Payroll history & trends ───────────────────────────────────────────────
export interface PayrollTrendPoint {
    period_label: string;
    period_start: string;
    period_end: string;
    total_gross_pay: number;
    total_net_pay: number;
    total_employer_cost: number;
    total_employee_tax: number;
    employee_count: number;
}

export interface PayrollTrendsResponse {
    items: PayrollTrendPoint[];
}
