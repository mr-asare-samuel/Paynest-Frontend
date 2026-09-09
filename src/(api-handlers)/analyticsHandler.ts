import apiClient from "@/lib/apiClient";
import {
    DatasetInfo, CustomReportDefinition, CustomReportCreate, CustomReportUpdate,
    CustomReportResult, ReportSchedule, ReportScheduleCreate, ReportScheduleUpdate,
    KpiAlertRule, KpiAlertRuleCreate, KpiAlertRuleUpdate, KpiAlertEvent, KpiAlertTestResult,
    SalesForecast, StockoutForecast, ConsolidatedReport, FileFormat,
} from "@/interfaces/analytics";
import { ReportResponse } from "@/interfaces/report";

// ── dataset catalogue ─────────────────────────────────────────────────────
export const GetDatasets = async (): Promise<DatasetInfo[]> => {
    const res = await apiClient.get(`/analytics/datasets`);
    return res.data.datasets;
};

// ── custom report definitions ────────────────────────────────────────────
export const GetCustomReports = async (): Promise<CustomReportDefinition[]> => {
    const res = await apiClient.get(`/analytics/custom-reports`);
    return res.data;
};
export const GetCustomReport = async (id: number): Promise<CustomReportDefinition> => {
    const res = await apiClient.get(`/analytics/custom-reports/${id}`);
    return res.data;
};
export const CreateCustomReport = async (data: CustomReportCreate): Promise<CustomReportDefinition> => {
    const res = await apiClient.post(`/analytics/custom-reports`, data);
    return res.data;
};
export const UpdateCustomReport = async (id: number, data: CustomReportUpdate): Promise<CustomReportDefinition> => {
    const res = await apiClient.put(`/analytics/custom-reports/${id}`, data);
    return res.data;
};
export const DeleteCustomReport = async (id: number): Promise<void> => {
    await apiClient.delete(`/analytics/custom-reports/${id}`);
};
export const RunCustomReport = async (
    id: number, params: { start?: string; end?: string; shop_id?: number } = {},
): Promise<CustomReportResult> => {
    const res = await apiClient.post(`/analytics/custom-reports/${id}/run`, null, { params });
    return res.data;
};
export const ExportCustomReport = async (
    id: number,
    params: { file_format: FileFormat; start?: string; end?: string; shop_id?: number },
): Promise<ReportResponse> => {
    const res = await apiClient.post(`/analytics/custom-reports/${id}/export`, null, { params });
    return res.data;
};

// ── report schedules ─────────────────────────────────────────────────────
export const GetReportSchedules = async (): Promise<ReportSchedule[]> => {
    const res = await apiClient.get(`/analytics/report-schedules`);
    return res.data;
};
export const CreateReportSchedule = async (data: ReportScheduleCreate): Promise<ReportSchedule> => {
    const res = await apiClient.post(`/analytics/report-schedules`, data);
    return res.data;
};
export const UpdateReportSchedule = async (id: number, data: ReportScheduleUpdate): Promise<ReportSchedule> => {
    const res = await apiClient.put(`/analytics/report-schedules/${id}`, data);
    return res.data;
};
export const DeleteReportSchedule = async (id: number): Promise<void> => {
    await apiClient.delete(`/analytics/report-schedules/${id}`);
};
export const RunReportScheduleNow = async (id: number): Promise<ReportSchedule> => {
    const res = await apiClient.post(`/analytics/report-schedules/${id}/run-now`);
    return res.data;
};

// ── KPI alert rules ──────────────────────────────────────────────────────
export const GetKpiAlerts = async (): Promise<KpiAlertRule[]> => {
    const res = await apiClient.get(`/analytics/kpi-alerts`);
    return res.data;
};
export const CreateKpiAlert = async (data: KpiAlertRuleCreate): Promise<KpiAlertRule> => {
    const res = await apiClient.post(`/analytics/kpi-alerts`, data);
    return res.data;
};
export const UpdateKpiAlert = async (id: number, data: KpiAlertRuleUpdate): Promise<KpiAlertRule> => {
    const res = await apiClient.put(`/analytics/kpi-alerts/${id}`, data);
    return res.data;
};
export const DeleteKpiAlert = async (id: number): Promise<void> => {
    await apiClient.delete(`/analytics/kpi-alerts/${id}`);
};
export const GetKpiAlertEvents = async (id: number, limit = 50): Promise<KpiAlertEvent[]> => {
    const res = await apiClient.get(`/analytics/kpi-alerts/${id}/events`, { params: { limit } });
    return res.data;
};
export const TestKpiAlert = async (id: number): Promise<KpiAlertTestResult> => {
    const res = await apiClient.post(`/analytics/kpi-alerts/${id}/test`);
    return res.data;
};

// ── forecasting ──────────────────────────────────────────────────────────
export const GetSalesForecast = async (
    params: { metric?: "revenue" | "orders"; lookback?: number; horizon?: number; shop_id?: number } = {},
): Promise<SalesForecast> => {
    const res = await apiClient.get(`/analytics/forecast/sales`, { params });
    return res.data;
};
export const GetStockoutForecast = async (
    params: { lookback?: number; limit?: number; shop_id?: number } = {},
): Promise<StockoutForecast> => {
    const res = await apiClient.get(`/analytics/forecast/stockouts`, { params });
    return res.data;
};

// ── consolidated multi-shop ──────────────────────────────────────────────
export const GetConsolidated = async (
    params: { start?: string; end?: string } = {},
): Promise<ConsolidatedReport> => {
    const res = await apiClient.get(`/analytics/consolidated`, { params });
    return res.data;
};
