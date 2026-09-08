import { ModuleGuard } from "@/components/(shared-components)/ModuleGuard";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <ModuleGuard module="reports_advanced" name="Advanced Reporting">
            {children}
        </ModuleGuard>
    );
}
