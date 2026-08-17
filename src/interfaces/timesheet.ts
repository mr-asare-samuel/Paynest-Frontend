export type TimesheetStatus = 'pending' | 'approved' | 'rejected';

export interface Timesheet {
    id: number;
    organization_id: number;
    shop_id: number;
    employee_profile_id: number;
    shift_id: number | null;
    work_date: string;
    clock_in: string;
    clock_out: string | null;
    actual_hours: number;
    status: TimesheetStatus;
    approved_by: number | null;
    approved_at: string | null;
    rejection_reason: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface ManualTimesheetCreate {
    employee_profile_id: number;
    work_date: string;
    clock_in: string;
    clock_out?: string;
    notes?: string;
}

export interface TimesheetUpdate {
    work_date?: string;
    clock_in?: string;
    clock_out?: string;
    notes?: string;
}

export interface TimesheetApproval {
    approved: boolean;
    rejection_reason?: string;
}

export interface TimesheetListResponse {
    items: Timesheet[];
    total: number;
    skip: number;
    limit: number;
}

export interface TimesheetFilters {
    employee_profile_id?: number;
    shop_id?: number;
    status?: TimesheetStatus;
    start_date?: string;
    end_date?: string;
    skip?: number;
    limit?: number;
}
