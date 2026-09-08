"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntitlementStore } from "@/(zustand-store)/entitlementStore";

/**
 * Thin strip shown when the org's subscription has lapsed. `in_grace` = expired
 * but still fully working for a few more days; `expired` = now core-only.
 * Dismissed per browser session.
 */
export function EntitlementBanner() {
    const { loaded, expired, inGrace, expiresAt, isCustomPlan } = useEntitlementStore();
    const [dismissed, setDismissed] = useState(
        typeof window !== "undefined" && sessionStorage.getItem("ent-banner-dismissed") === "1",
    );

    if (!loaded || dismissed || (!expired && !inGrace)) return null;

    const when = expiresAt ? new Date(expiresAt).toLocaleDateString() : null;
    const cta = isCustomPlan ? "Contact your account manager" : "Contact support to renew";

    return (
        <div
            className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm",
                expired
                    ? "bg-destructive/10 text-destructive"
                    : "bg-warning/10 text-warning-foreground",
            )}
        >
            <AlertTriangle className="size-4 shrink-0" />
            <span className="flex-1">
                {expired ? (
                    <>Your subscription expired{when ? ` on ${when}` : ""}. Premium features are now unavailable — {cta}.</>
                ) : (
                    <>Your subscription lapsed{when ? ` on ${when}` : ""} and is in a short grace period. {cta} to avoid losing access.</>
                )}
            </span>
            <button
                type="button"
                aria-label="Dismiss"
                onClick={() => {
                    setDismissed(true);
                    sessionStorage.setItem("ent-banner-dismissed", "1");
                }}
                className="hover:opacity-70"
            >
                <X className="size-4" />
            </button>
        </div>
    );
}
