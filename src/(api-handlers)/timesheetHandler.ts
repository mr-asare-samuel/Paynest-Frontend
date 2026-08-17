import {
    Timesheet, ManualTimesheetCreate, TimesheetUpdate, TimesheetApproval,
    TimesheetListResponse, TimesheetFilters,
} from "@/interfaces/timesheet"
import apiClient from "@/lib/apiClient"

export const clockIn = async (shiftId?: number): Promise<Timesheet> => {
    try {
        const response = await apiClient.post(`/timesheets/clock-in`, {}, { params: { shift_id: shiftId } })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const clockOut = async (timesheetId: number): Promise<Timesheet> => {
    try {
        const response = await apiClient.patch(`/timesheets/${timesheetId}/clock-out`)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const createManualTimesheet = async (data: ManualTimesheetCreate): Promise<Timesheet> => {
    try {
        const response = await apiClient.post(`/timesheets/`, data)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const getTimesheets = async (filters: TimesheetFilters = {}): Promise<TimesheetListResponse> => {
    try {
        const response = await apiClient.get(`/timesheets/`, { params: filters })
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const getTimesheet = async (id: number): Promise<Timesheet> => {
    try {
        const response = await apiClient.get(`/timesheets/${id}`)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const updateTimesheet = async (id: number, data: TimesheetUpdate): Promise<Timesheet> => {
    try {
        const response = await apiClient.put(`/timesheets/${id}`, data)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}

export const deleteTimesheet = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/timesheets/${id}`)
    } catch (error: unknown) {
        throw error;
    }
}

export const approveTimesheet = async (id: number, data: TimesheetApproval): Promise<Timesheet> => {
    try {
        const response = await apiClient.patch(`/timesheets/${id}/approve`, data)
        return response.data
    } catch (error: unknown) {
        throw error;
    }
}
