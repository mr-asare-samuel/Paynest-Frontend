import { ModuleGuard } from "@/components/(shared-components)/ModuleGuard";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <ModuleGuard module="advanced_pricing" name="Advanced Pricing & Discounts">
            {children}
        </ModuleGuard>
    );
}
