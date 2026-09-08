import { ModuleGuard } from "@/components/(shared-components)/ModuleGuard";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <ModuleGuard module="payroll" name="Payroll">
            {children}
        </ModuleGuard>
    );
}
