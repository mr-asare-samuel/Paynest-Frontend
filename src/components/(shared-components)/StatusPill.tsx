"use client";

import {
    AlertCircle,
    CheckCircle2,
    Circle,
    Clock,
    XCircle,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Tone = "success" | "warning" | "info" | "destructive" | "muted";

export type StatusKind =
    | "success"
    | "active"
    | "completed"
    | "approved"
    | "paid"
    | "warning"
    | "pending"
    | "processing"
    | "requested"
    | "shipped"
    | "received"
    | "info"
    | "initiated"
    | "destructive"
    | "failed"
    | "rejected"
    | "cancelled"
    | "unpaid"
    | "muted"
    | "draft"
    | "inactive"
    | "sent"
    | "partiallyreceived";

const STATUS_MAP: Record<StatusKind, { tone: Tone; icon: LucideIcon }> = {
    success: { tone: "success", icon: CheckCircle2 },
    active: { tone: "success", icon: CheckCircle2 },
    completed: { tone: "success", icon: CheckCircle2 },
    approved: { tone: "success", icon: CheckCircle2 },
    paid: { tone: "success", icon: CheckCircle2 },
    received: { tone: "success", icon: CheckCircle2 },

    warning: { tone: "warning", icon: AlertCircle },
    pending: { tone: "warning", icon: Clock },
    processing: { tone: "warning", icon: Clock },
    requested: { tone: "warning", icon: Clock },

    info: { tone: "info", icon: Circle },
    initiated: { tone: "info", icon: Circle },
    shipped: { tone: "info", icon: Circle },
    sent: { tone: "info", icon: Circle },
    partiallyreceived: { tone: "warning", icon: Clock },

    destructive: { tone: "destructive", icon: XCircle },
    failed: { tone: "destructive", icon: XCircle },
    rejected: { tone: "destructive", icon: XCircle },
    cancelled: { tone: "destructive", icon: XCircle },
    unpaid: { tone: "destructive", icon: XCircle },

    muted: { tone: "muted", icon: Circle },
    draft: { tone: "muted", icon: Circle },
    inactive: { tone: "muted", icon: Circle },
};

const TONE_CLASSES: Record<Tone, string> = {
    success:
        "bg-success-muted text-success border border-transparent hover:bg-success-muted",
    warning:
        "bg-warning-muted text-warning-foreground border border-transparent hover:bg-warning-muted",
    info:
        "bg-info-muted text-info border border-transparent hover:bg-info-muted",
    destructive:
        "bg-destructive/10 text-destructive border border-transparent hover:bg-destructive/15",
    muted:
        "bg-muted text-muted-foreground border border-transparent hover:bg-muted",
};

export interface StatusPillProps {
    status: StatusKind | string;
    label?: string;
    showIcon?: boolean;
    className?: string;
}

function normalize(s: string): StatusKind {
    const k = s.toLowerCase().replace(/[\s_-]+/g, "") as StatusKind;
    if (k in STATUS_MAP) return k as StatusKind;
    return "muted";
}

export function StatusPill({
    status,
    label,
    showIcon = true,
    className,
}: StatusPillProps) {
    const key = normalize(status);
    const { tone, icon: Icon } = STATUS_MAP[key];
    return (
        <Badge className={cn("gap-1 font-medium", TONE_CLASSES[tone], className)}>
            {showIcon ? <Icon className="size-3" /> : null}
            <span className="capitalize">{label ?? status.replace(/_/g, " ")}</span>
        </Badge>
    );
}

export default StatusPill;
