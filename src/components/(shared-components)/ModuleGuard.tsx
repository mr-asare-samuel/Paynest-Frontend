"use client";

import { ReactNode } from "react";
import { useEntitlementStore } from "@/(zustand-store)/entitlementStore";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { UpgradeRequired } from "./UpgradeRequired";

/**
 * Wrap a gated page's content:
 *   <ModuleGuard module="payroll" name="Payroll">…</ModuleGuard>
 *
 * Renders children when the org is entitled (or before the first entitlement
 * load, to avoid a flash), otherwise the upgrade screen. Superadmins always
 * pass. The backend is the real gate — this is UX.
 */
export function ModuleGuard({
    module,
    name,
    description,
    children,
}: {
    module: string;
    name: string;
    description?: string;
    children: ReactNode;
}) {
    const role = (useAuthStore((s) => s.user?.role) ?? "").toLowerCase();
    const loaded = useEntitlementStore((s) => s.loaded);
    const has = useEntitlementStore((s) => s.modules.includes(module));

    if (role === "superadmin" || !loaded || has) return <>{children}</>;
    return <UpgradeRequired moduleName={name} description={description} />;
}
