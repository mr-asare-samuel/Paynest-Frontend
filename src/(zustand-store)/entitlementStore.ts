import { create } from "zustand";
import { GetMyEntitlements } from "@/(api-handlers)/entitlementsHandler";
import { EntitlementsResponse } from "@/interfaces/entitlements";

interface EntitlementState {
    modules: string[];
    planId: number | null;
    planName: string | null;
    isCustomPlan: boolean;
    expiresAt: string | null;
    expired: boolean;
    inGrace: boolean;
    loaded: boolean;   // a fetch has completed at least once
    loading: boolean;

    fetchEntitlements: () => Promise<void>;
    clear: () => void;
    hasModule: (code: string) => boolean;
}

const EMPTY = {
    modules: [] as string[],
    planId: null as number | null,
    planName: null as string | null,
    isCustomPlan: false,
    expiresAt: null as string | null,
    expired: false,
    inGrace: false,
};

export const useEntitlementStore = create<EntitlementState>((set, get) => ({
    ...EMPTY,
    loaded: false,
    loading: false,

    fetchEntitlements: async () => {
        if (get().loading) return;
        set({ loading: true });
        try {
            const e: EntitlementsResponse = await GetMyEntitlements();
            set({
                modules: e.modules,
                planId: e.plan_id,
                planName: e.plan_name,
                isCustomPlan: e.is_custom_plan,
                expiresAt: e.expires_at,
                expired: e.expired,
                inGrace: e.in_grace,
                loaded: true,
                loading: false,
            });
        } catch {
            // Leave whatever we had; mark loaded so guards can fall back to a
            // permissive default rather than blocking the whole app on a blip.
            set({ loaded: true, loading: false });
        }
    },

    clear: () => set({ ...EMPTY, loaded: false, loading: false }),

    hasModule: (code: string) => {
        const { modules, loaded } = get();
        // Before the first successful load, don't hide anything (avoids a flash
        // of "upgrade required" on refresh). The backend is the real gate.
        if (!loaded) return true;
        return modules.includes(code);
    },
}));

/** Non-reactive helper for use outside React (e.g. route guards, interceptors). */
export const hasModule = (code: string) => useEntitlementStore.getState().hasModule(code);

/** Reactive hook — re-renders when entitlements change. */
export function useHasModule(code: string): boolean {
    return useEntitlementStore((s) => (s.loaded ? s.modules.includes(code) : true));
}
