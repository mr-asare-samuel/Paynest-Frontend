// Advanced Reporting & Analytics — mirrors api/v1/schemas/analytics_models.py (§3.3)

export type ReportDataset =
    | "orders" | "payments" | "inventory" | "stock_movements" | "expenses" | "customers";

export type ScheduleSource = "standard" | "custom";

export type StandardReportType =
    | "daily_sales" | "monthly_financial" | "inventory"
    | "employee_performance" | "customer_analytics" | "consolidated" | "custom";

export type FileFormat = "pdf" | "excel" | "csv" | "json";

export type KpiMetric =
    | "revenue" | "gross_profit" | "net_profit" | "orders_count" | "avg_order_value"
    | "discounts" | "refunds" | "expenses_total"
    | "out_of_stock_count" | "low_stock_count" | "cash_discrepancy_abs";

export type KpiComparison = "lt" | "lte" | "gt" | "gte";

export type KpiWindow = "today" | "yesterday" | "last_7d" | "last_30d" | "mtd" | "current";

export type FilterOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
export type AggFn = "sum" | "avg" | "min" | "max" | "count";

// ── dataset catalogue ──────────────────────────────────────────────────────
export interface DatasetField {
    name: string;
    type: string;                 // string | date | int | money | enum | bool
    aggregatable: boolean;
}
export interface DatasetInfo {
    dataset: ReportDataset;
    label: string;
    supports_date_range: boolean;
    supports_shop_filter: boolean;
    fields: DatasetField[];
    operators: FilterOp[];
    aggregations: AggFn[];
}

// ── custom report definitions ─────────────────────────────────────────────
export interface ReportFilter { field: string; op: FilterOp; value: unknown }
export interface ReportAggregation { field: string; fn: AggFn; label?: string | null }
export interface ReportSort { field: string; dir: "asc" | "desc" }

export interface CustomReportDefinition {
    id: number;
    organization_id: number;
    name: string;
    description: string | null;
    dataset: ReportDataset;
    columns: string[];
    filters: ReportFilter[];
    group_by: string[];
    aggregations: ReportAggregation[];
    sort: ReportSort | null;
    row_limit: number;
    default_range_days: number;
    is_active: boolean;
    created_by: number | null;
    created_at: string;
    updated_at: string | null;
}

export interface CustomReportCreate {
    name: string;
    description?: string | null;
    dataset: ReportDataset;
    columns?: string[];
    filters?: ReportFilter[];
    group_by?: string[];
    aggregations?: ReportAggregation[];
    sort?: ReportSort | null;
    row_limit?: number;
    default_range_days?: number;
    is_active?: boolean;
}
export type CustomReportUpdate = Partial<CustomReportCreate>;

export interface CustomReportResult {
    title: string;
    period: string;
    headers: string[];
    rows: (string | number | null)[][];
    summary: Record<string, string | number>;
    row_count: number;
}

// ── report schedules ──────────────────────────────────────────────────────
export interface ReportSchedule {
    id: number;
    organization_id: number;
    name: string;
    source: ScheduleSource;
    report_type: StandardReportType | null;
    custom_report_id: number | null;
    file_format: FileFormat;
    parameters: Record<string, unknown> | null;
    cron: string;
    window_days: number;
    recipient_user_ids: number[];
    auto_approve: boolean;
    is_active: boolean;
    next_run_at: string | null;
    last_run_at: string | null;
    last_status: string | null;
    last_report_id: number | null;
    created_by: number | null;
    created_at: string;
}
export interface ReportScheduleCreate {
    name: string;
    source: ScheduleSource;
    report_type?: StandardReportType | null;
    custom_report_id?: number | null;
    file_format: FileFormat;
    parameters?: Record<string, unknown> | null;
    cron: string;
    window_days: number;
    recipient_user_ids: number[];
    auto_approve: boolean;
    is_active: boolean;
}
export type ReportScheduleUpdate = Partial<ReportScheduleCreate>;

// ── KPI alert rules ───────────────────────────────────────────────────────
export interface KpiAlertRule {
    id: number;
    organization_id: number;
    name: string;
    metric: KpiMetric;
    comparison: KpiComparison;
    threshold: number;
    window: KpiWindow;
    shop_id: number | null;
    channels: string[];
    cooldown_minutes: number;
    is_active: boolean;
    last_evaluated_at: string | null;
    last_triggered_at: string | null;
    last_value: number | null;
    created_by: number | null;
    created_at: string;
}
export interface KpiAlertRuleCreate {
    name: string;
    metric: KpiMetric;
    comparison: KpiComparison;
    threshold: number;
    window: KpiWindow;
    shop_id?: number | null;
    channels: string[];
    cooldown_minutes: number;
    is_active: boolean;
}
export type KpiAlertRuleUpdate = Partial<KpiAlertRuleCreate>;

export interface KpiAlertEvent {
    id: number;
    rule_id: number;
    organization_id: number;
    metric: KpiMetric;
    observed_value: number;
    threshold: number;
    comparison: KpiComparison;
    message: string;
    created_at: string;
}
export interface KpiAlertTestResult {
    rule_id: number;
    metric: string;
    window: string;
    observed_value: number;
    threshold: number;
    comparison: string;
    breached: boolean;
}

// ── forecasting ───────────────────────────────────────────────────────────
export interface ForecastPoint { date: string; value: number; lower?: number; upper?: number }
export interface SalesForecast {
    metric: "revenue" | "orders";
    shop_id: number | null;
    lookback_days: number;
    horizon_days: number;
    history_start: string;
    history_end: string;
    history: ForecastPoint[];
    forecast: ForecastPoint[];
    method: string;
    summary: {
        history_total: number;
        forecast_total: number;
        recent_daily_avg: number;
        forecast_daily_avg: number;
        projected_change_pct: number | null;
    };
}

export interface StockoutItem {
    product_id: number;
    product_name: string;
    sku: string;
    shop_id: number;
    current_stock: number;
    reorder_point: number;
    daily_sales_rate: number;
    days_to_stockout: number | null;
    projected_stockout_date: string | null;
    suggested_reorder_qty: number;
}
export interface StockoutForecast {
    lookback_days: number;
    shop_id: number | null;
    as_of: string;
    at_risk_count: number;
    items: StockoutItem[];
}

// ── consolidated multi-shop ───────────────────────────────────────────────
export interface ConsolidatedShopRow {
    shop_id?: number;
    shop_name: string;
    orders: number;
    paid_orders: number;
    revenue: number;
    cogs: number;
    discounts: number;
    tax: number;
    expenses: number;
    inventory_value: number;
    out_of_stock: number;
    low_stock: number;
    cash_discrepancy_abs: number;
    closures: number;
    gross_profit: number;
    net_profit: number;
    avg_order_value: number;
}
export interface ConsolidatedReport {
    currency: string;
    period_start: string;
    period_end: string;
    shops: ConsolidatedShopRow[];
    totals: ConsolidatedShopRow;
}
