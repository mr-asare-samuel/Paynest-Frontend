"use client"

import { useEffect, useState } from 'react';
import {
    Plus, FileText, Calendar, Search, Clock,
    CheckCircle, XCircle, Eye, Download, RefreshCcw,
} from 'lucide-react';
import { ReportFileFormat, ReportRequest, ReportResponse, ReportStatus, ReportType } from '@/interfaces/report';
import { createReport, getMyResports, downloadReport } from '@/(api-handlers)/reportHandler';
import { getOrganizationShops } from '@/(api-handlers)/organizationShopsHandler';
import { OrganizationShopResponse } from '@/interfaces/organizationShops';
import PageHeader from '@/components/(shared-components)/PageHeader';
import Pagination from '@/components/(shared-components)/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { useAuthStore } from '@/(zustand-store)/authStore';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */
const REPORT_TYPES = [
    { value: 'daily_sales', label: 'Daily Sales Report' },
    { value: 'monthly_financial', label: 'Monthly Financial Report' },
    { value: 'inventory', label: 'Inventory Report' },
    { value: 'employee_performance', label: 'Employee Performance Report' },
    { value: 'customer_analytics', label: 'Customer Analytics Report' },
];

const FILE_FORMATS = [
    { value: 'pdf', label: 'PDF' },
    { value: 'excel', label: 'Excel' },
    { value: 'csv', label: 'CSV' },
    { value: 'json', label: 'JSON' },
];

const PAYMENT_METHODS = [
    { value: 'all', label: 'All Payment Methods' },
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'mobile_money', label: 'Mobile Money' },
];

/* -------------------------------------------------------------------------- */
/*  Status badge                                                               */
/* -------------------------------------------------------------------------- */
function StatusBadge({ status }: { status: ReportStatus }) {
    const configs: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
        pending:    { icon: <Clock className="size-3" />,       label: 'Pending',    cls: 'border-warning/30 bg-warning/10 text-warning-foreground' },
        approved:   { icon: <CheckCircle className="size-3" />, label: 'Approved',   cls: 'border-primary/20 bg-primary/10 text-primary' },
        processing: { icon: <Clock className="size-3" />,       label: 'Processing', cls: 'border-primary/20 bg-primary/10 text-primary' },
        completed:  { icon: <CheckCircle className="size-3" />, label: 'Completed',  cls: 'border-success/30 bg-success/10 text-success' },
        rejected:   { icon: <XCircle className="size-3" />,     label: 'Rejected',   cls: 'border-destructive/30 bg-destructive/10 text-destructive' },
        failed:     { icon: <XCircle className="size-3" />,     label: 'Failed',     cls: 'border-destructive/30 bg-destructive/10 text-destructive' },
    };
    const { icon, label, cls } = configs[status] ?? configs.pending;
    return (
        <Badge variant="outline" className={cn("flex w-fit items-center gap-1 rounded-full text-[11px] px-2", cls)}>
            {icon}{label}
        </Badge>
    );
}

function TypeBadge({ type }: { type: string }) {
    const label = REPORT_TYPES.find(t => t.value === type)?.label ?? type;
    return (
        <Badge variant="outline" className="rounded-full border-info/30 bg-info/10 text-info text-[11px]">
            {label}
        </Badge>
    );
}

/* -------------------------------------------------------------------------- */
/*  Form state                                                                 */
/* -------------------------------------------------------------------------- */
interface ReportFormState {
    report_name: string;
    report_type: string;
    period_start: string;
    period_end: string;
    shop_id: string;
    payment_method: string;
    file_format: string;
    include_tax: boolean;
}

interface ReportFormErrors {
    report_name?: string;
    report_type?: string;
    period_start?: string;
    period_end?: string;
    shop_id?: string;
    file_format?: string;
}

const defaultForm: ReportFormState = {
    report_name: '',
    report_type: '',
    period_start: '',
    period_end: '',
    shop_id: '',
    payment_method: 'all',
    file_format: 'pdf',
    include_tax: true,
};

/* -------------------------------------------------------------------------- */
/*  Page (My Reports / Manager view)                                           */
/* -------------------------------------------------------------------------- */
export default function ManagerReportView() {
    const { user } = useAuthStore();

    const [reports, setReports] = useState<ReportResponse[]>([]);
    const [filteredReports, setFilteredReports] = useState<ReportResponse[]>([]);
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<ReportFormState>(defaultForm);
    const [formErrors, setFormErrors] = useState<ReportFormErrors>({});

    const fetchReports = async () => {
        setLoading(true);
        try {
            const data = await getMyResports();
            setReports(data);
            setFilteredReports(data);
        } catch (error) {
            handleErrorMessage(error, 'Failed to fetch reports');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
        getOrganizationShops().then(setShops).catch(() => null);
    }, []);

    useEffect(() => {
        let filtered = reports;
        if (searchTerm) {
            filtered = filtered.filter(r =>
                r.report_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.report_type.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (statusFilter !== 'all') filtered = filtered.filter(r => r.status === statusFilter);
        if (typeFilter !== 'all') filtered = filtered.filter(r => r.report_type === typeFilter);
        setFilteredReports(filtered);
    }, [searchTerm, statusFilter, typeFilter, reports]);

    function setF<K extends keyof ReportFormState>(key: K, value: ReportFormState[K]) {
        setForm(prev => ({ ...prev, [key]: value }));
        if (formErrors[key as keyof ReportFormErrors]) {
            setFormErrors(prev => ({ ...prev, [key]: undefined }));
        }
    }

    function validateForm(): boolean {
        const e: ReportFormErrors = {};
        if (!form.report_name.trim()) e.report_name = 'Report name is required';
        if (!form.report_type) e.report_type = 'Report type is required';
        if (!form.period_start) e.period_start = 'Start date is required';
        if (!form.period_end) e.period_end = 'End date is required';
        if (!form.shop_id) e.shop_id = 'Shop is required';
        if (!form.file_format) e.file_format = 'File format is required';
        setFormErrors(e);
        return Object.keys(e).length === 0;
    }

    const handleCreateReport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
        setCreating(true);
        try {
            const reportData: ReportRequest = {
                report_type: form.report_type as ReportType,
                report_name: form.report_name,
                report_period: 'custom',
                parameters: {
                    shop_id: Number(form.shop_id),
                    include_tax: form.include_tax,
                    payment_method: form.payment_method,
                },
                file_format: form.file_format as ReportFileFormat,
                period_start: form.period_start,
                period_end: form.period_end,
                organization_id: user?.organization?.id ?? 0,
            };
            await createReport(reportData);
            toast.success('Report generation initiated successfully');
            setIsCreateOpen(false);
            setForm(defaultForm);
            fetchReports();
        } catch (error) {
            handleErrorMessage(error, 'Failed to create report');
        } finally {
            setCreating(false);
        }
    };

    const handleDownload = async (report: ReportResponse) => {
        if (report.status !== 'completed') {
            toast.error('Report file is not available until it is completed.');
            return;
        }
        const fileName = `${report.report_name.replace(/\s+/g, '_')}_${report.id}.${report.file_format}`;
        try {
            await downloadReport(report.id, fileName);
            toast.success('Download started');
        } catch (error) {
            handleErrorMessage(error, 'Failed to download report');
        }
    };

    const closeCreate = () => { setIsCreateOpen(false); setForm(defaultForm); setFormErrors({}); };

    const pg = usePagination(filteredReports, 10);

    return (
        <TooltipProvider>
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="My Reports"
                    description="Generate and manage your personal reports."
                    actions={
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="mr-2 size-4" /> Generate Report
                        </Button>
                    }
                />

                {/* Filters */}
                <Card>
                    <CardContent className="pt-5">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative sm:w-64">
                                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                <Input
                                    placeholder="Search reports…"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="sm:w-48"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="pending">Pending Approval</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="processing">Processing</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="sm:w-64"><SelectValue placeholder="Filter by type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    {REPORT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={fetchReports} disabled={loading}>
                                <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Table */}
                <Card className="gap-0 overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-6">Report Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="pr-6 w-[90px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array.from({ length: 6 }).map((_, j) => (
                                                <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : filteredReports.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-20 text-center">
                                            <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                                <FileText className="text-muted-foreground size-7" />
                                            </div>
                                            <p className="text-foreground font-semibold">No reports found</p>
                                            <p className="text-muted-foreground mt-1 text-sm">
                                                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                                                    ? 'No reports match your filters.'
                                                    : "You haven't generated any reports yet."}
                                            </p>
                                        </TableCell>
                                    </TableRow>
                                ) : pg.pageItems.map(report => (
                                    <TableRow key={report.id}>
                                        <TableCell className="pl-6 font-medium">
                                            <div className="flex items-center gap-2">
                                                <FileText className="text-muted-foreground size-4 shrink-0" />
                                                <span className="line-clamp-1">{report.report_name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell><TypeBadge type={report.report_type} /></TableCell>
                                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="text-muted-foreground size-3.5" />
                                                {new Date(report.period_start).toLocaleDateString()} – {new Date(report.period_end).toLocaleDateString()}
                                            </div>
                                        </TableCell>
                                        <TableCell><StatusBadge status={report.status} /></TableCell>
                                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                            {new Date(report.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="size-8" asChild>
                                                            <Link href={`/report/${report.id}`}><Eye className="size-4" /></Link>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>View Details</TooltipContent>
                                                </Tooltip>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8"
                                                            disabled={report.status !== 'completed'}
                                                            onClick={() => handleDownload(report)}
                                                        >
                                                            <Download className="size-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Download Report</TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {!loading && filteredReports.length > 0 && (
                        <div className="border-border bg-muted/30 border-t px-4 py-3">
                            <Pagination page={pg.page} totalPages={pg.totalPages} onPageChange={pg.setPage} total={pg.total} pageSize={pg.pageSize} onPageSizeChange={pg.setPageSize} />
                        </div>
                    )}
                </Card>

                {/* Create Report Dialog */}
                <Dialog open={isCreateOpen} onOpenChange={open => !open && closeCreate()}>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <FileText className="text-primary size-5" /> Generate New Report
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateReport} noValidate className="space-y-4 pt-1">
                            <div className="space-y-1.5">
                                <Label>Report Name <span className="text-destructive">*</span></Label>
                                <Input
                                    placeholder="Q1 Sales Report"
                                    value={form.report_name}
                                    onChange={e => setF('report_name', e.target.value)}
                                    className={cn(formErrors.report_name && 'border-destructive')}
                                />
                                {formErrors.report_name && <p className="text-destructive text-xs">{formErrors.report_name}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label>Report Type <span className="text-destructive">*</span></Label>
                                <Select value={form.report_type} onValueChange={v => setF('report_type', v)}>
                                    <SelectTrigger className={cn(formErrors.report_type && 'border-destructive')}>
                                        <SelectValue placeholder="Select report type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {REPORT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {formErrors.report_type && <p className="text-destructive text-xs">{formErrors.report_type}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Period Start <span className="text-destructive">*</span></Label>
                                    <DatePicker
                                        value={form.period_start ? dayjs(form.period_start) : null}
                                        onChange={(date) => setF('period_start', date ? date.format('YYYY-MM-DD') : '')}
                                        format="DD MMM YYYY"
                                        className={cn('h-9 w-full', formErrors.period_start && 'border-destructive')}
                                    />
                                    {formErrors.period_start && <p className="text-destructive text-xs">{formErrors.period_start}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Period End <span className="text-destructive">*</span></Label>
                                    <DatePicker
                                        value={form.period_end ? dayjs(form.period_end) : null}
                                        onChange={(date) => setF('period_end', date ? date.format('YYYY-MM-DD') : '')}
                                        format="DD MMM YYYY"
                                        className={cn('h-9 w-full', formErrors.period_end && 'border-destructive')}
                                    />
                                    {formErrors.period_end && <p className="text-destructive text-xs">{formErrors.period_end}</p>}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Shop <span className="text-destructive">*</span></Label>
                                <Select value={form.shop_id} onValueChange={v => setF('shop_id', v)}>
                                    <SelectTrigger className={cn(formErrors.shop_id && 'border-destructive')}>
                                        <SelectValue placeholder="Select shop" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {shops.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {formErrors.shop_id && <p className="text-destructive text-xs">{formErrors.shop_id}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label>Payment Method</Label>
                                <Select value={form.payment_method} onValueChange={v => setF('payment_method', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label>File Format <span className="text-destructive">*</span></Label>
                                <Select value={form.file_format} onValueChange={v => setF('file_format', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {FILE_FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <div>
                                    <p className="text-foreground text-sm font-medium">Include Tax</p>
                                    <p className="text-muted-foreground text-xs">Add tax details to the report</p>
                                </div>
                                <Switch checked={form.include_tax} onCheckedChange={v => setF('include_tax', v)} />
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={closeCreate}>Cancel</Button>
                                <Button type="submit" disabled={creating}>
                                    {creating
                                        ? <><RefreshCcw className="mr-2 size-4 animate-spin" /> Generating…</>
                                        : <><Plus className="mr-2 size-4" /> Generate Report</>
                                    }
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
}
