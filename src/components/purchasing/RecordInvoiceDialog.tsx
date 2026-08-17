"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { RecordPurchaseOrderInvoice, UploadPOInvoiceFile } from "@/(api-handlers)/purchaseOrdersHandler";
import { GetExpenseCategories } from "@/(api-handlers)/expensesHandler";
import { PurchaseOrderResponse } from "@/interfaces/purchaseOrders";
import { ExpenseCategoryResponse } from "@/interfaces/expenses";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const ALLOWED_INVOICE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
const MAX_INVOICE_SIZE_BYTES = 10 * 1024 * 1024;

const schema = z.object({
    invoice_number: z.string().min(1, "Invoice number is required"),
    invoice_amount: z.string().min(1, "Amount is required"),
    invoice_date: z.string().min(1, "Date is required"),
    category_id: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface RecordInvoiceDialogProps {
    po: PurchaseOrderResponse | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRecorded: (updated: PurchaseOrderResponse) => void;
}

export default function RecordInvoiceDialog({
    po,
    open,
    onOpenChange,
    onRecorded,
}: Readonly<RecordInvoiceDialogProps>) {
    const [categories, setCategories] = useState<ExpenseCategoryResponse[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        defaultValues: { invoice_number: "", invoice_amount: "", invoice_date: dayjs().format("YYYY-MM-DD"), category_id: "" },
    });

    useEffect(() => {
        if (!open) return;
        GetExpenseCategories().then(setCategories).catch(() => toast.error("Failed to load expense categories"));
        reset({ invoice_number: "", invoice_amount: po ? String(po.total_amount) : "", invoice_date: dayjs().format("YYYY-MM-DD"), category_id: "" });
        setFileUrl(null);
        setFileName(null);
    }, [open, po, reset]);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (!ALLOWED_INVOICE_TYPES.includes(file.type)) {
            toast.error("Only JPEG, PNG, WebP, and PDF files are supported");
            return;
        }
        if (file.size > MAX_INVOICE_SIZE_BYTES) {
            toast.error("File must be smaller than 10 MB");
            return;
        }
        setUploading(true);
        try {
            const { file_url } = await UploadPOInvoiceFile(file);
            setFileUrl(file_url);
            setFileName(file.name);
            toast.success("Invoice file uploaded");
        } catch (error) {
            handleErrorMessage(error, "Couldn't upload invoice file");
        } finally {
            setUploading(false);
        }
    };

    const onSubmit = async (values: FormValues) => {
        if (!po) return;
        setSubmitting(true);
        try {
            const updated = await RecordPurchaseOrderInvoice(po.id, {
                invoice_number: values.invoice_number,
                invoice_amount: Number(values.invoice_amount),
                invoice_date: values.invoice_date,
                invoice_file_url: fileUrl || undefined,
                category_id: values.category_id ? Number(values.category_id) : undefined,
            });
            toast.success(`Invoice recorded — a pending expense was created for approval.`);
            onRecorded(updated);
            onOpenChange(false);
        } catch (error) {
            handleErrorMessage(error, "Failed to record invoice");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Record Vendor Invoice</DialogTitle>
                    <DialogDescription>
                        This creates a pending expense linked to this purchase order, which flows through your normal expense-approval process.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label>Invoice Number <span className="text-destructive">*</span></Label>
                        <Input {...register("invoice_number")} placeholder="e.g. INV-4821" />
                        {errors.invoice_number && <p className="text-destructive text-xs">{errors.invoice_number.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Amount <span className="text-destructive">*</span></Label>
                            <Input type="number" step="0.01" min="0" {...register("invoice_amount")} />
                            {errors.invoice_amount && <p className="text-destructive text-xs">{errors.invoice_amount.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Date <span className="text-destructive">*</span></Label>
                            <Controller
                                control={control}
                                name="invoice_date"
                                render={({ field }) => (
                                    <DatePicker
                                        value={field.value ? dayjs(field.value) : null}
                                        onChange={(date) => field.onChange(date ? date.format("YYYY-MM-DD") : "")}
                                        format="DD MMM YYYY"
                                        className="h-9 w-full"
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Expense Category</Label>
                        <Controller
                            control={control}
                            name="category_id"
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Default: Inventory Purchases" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        <p className="text-muted-foreground text-xs">Leave blank to file under the default &quot;Inventory Purchases&quot; category.</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Invoice File</Label>
                        {fileUrl ? (
                            <div className="flex items-center justify-between rounded-lg border p-2">
                                <div className="flex min-w-0 items-center gap-2 text-sm">
                                    <FileText className="text-muted-foreground size-4 shrink-0" />
                                    <span className="truncate">{fileName}</span>
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => { setFileUrl(null); setFileName(null); }}>
                                    <X className="size-3.5" />
                                </Button>
                            </div>
                        ) : (
                            <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Paperclip className="mr-2 size-4" />}
                                {uploading ? "Uploading…" : "Attach invoice (image or PDF)"}
                            </Button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFile} />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
                        <Button type="submit" disabled={submitting || uploading}>
                            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Record Invoice
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
