"use client";

import { useRef, useState } from "react";
import { Download, FileUp, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import type { BulkImportResult } from "@/interfaces/inventoryTracking";

function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function BulkImportDialog({
    trigger,
    title,
    description,
    templateFilename,
    onDownloadTemplate,
    onImport,
    onDone,
}: {
    trigger: React.ReactNode;
    title: string;
    description: string;
    templateFilename: string;
    onDownloadTemplate: () => Promise<Blob>;
    onImport: (file: File) => Promise<BulkImportResult>;
    onDone?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<BulkImportResult | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const reset = () => { setResult(null); setBusy(false); if (fileRef.current) fileRef.current.value = ""; };

    const downloadTemplate = async () => {
        try {
            saveBlob(await onDownloadTemplate(), templateFilename);
        } catch (e) {
            handleErrorMessage(e, "Couldn't download the template");
        }
    };

    const handleFile = async (file: File) => {
        setBusy(true);
        setResult(null);
        try {
            const res = await onImport(file);
            setResult(res);
            const ok = res.created + res.updated;
            if (ok > 0) toast.success(`${ok} row${ok !== 1 ? "s" : ""} imported`);
            if (res.skipped > 0) toast.warning(`${res.skipped} row${res.skipped !== 1 ? "s" : ""} skipped`);
            onDone?.();
        } catch (e) {
            handleErrorMessage(e, "Import failed");
        } finally {
            setBusy(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={downloadTemplate}>
                            <Download className="mr-1.5 size-4" /> Download template
                        </Button>
                        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
                            {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <FileUp className="mr-1.5 size-4" />}
                            {busy ? "Importing…" : "Choose CSV"}
                        </Button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFile(f);
                            }}
                        />
                    </div>

                    {result && (
                        <Card className="space-y-3 p-4">
                            <div className="grid grid-cols-4 gap-2 text-center text-sm">
                                <div><p className="text-lg font-semibold text-success">{result.created}</p><p className="text-muted-foreground text-xs">created</p></div>
                                <div><p className="text-lg font-semibold text-info">{result.updated}</p><p className="text-muted-foreground text-xs">updated</p></div>
                                <div><p className="text-lg font-semibold">{result.processed}</p><p className="text-muted-foreground text-xs">rows</p></div>
                                <div><p className={result.skipped ? "text-lg font-semibold text-destructive" : "text-lg font-semibold"}>{result.skipped}</p><p className="text-muted-foreground text-xs">skipped</p></div>
                            </div>

                            {result.errors.length > 0 ? (
                                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2 text-xs">
                                    {result.errors.map((err, i) => (
                                        <div key={i} className="flex gap-2">
                                            <AlertTriangle className="text-destructive mt-0.5 size-3.5 shrink-0" />
                                            <span className="text-muted-foreground">
                                                Row {err.row}{err.sku ? ` (${err.sku})` : ""}: {err.message}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-success flex items-center gap-1.5 text-xs">
                                    <CheckCircle2 className="size-3.5" /> All rows imported cleanly.
                                </p>
                            )}
                        </Card>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
