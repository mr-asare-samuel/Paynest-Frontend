import { ModuleGuard } from "@/components/(shared-components)/ModuleGuard";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <ModuleGuard module="hr_leave" name="HR & Leave">
            {children}
        </ModuleGuard>
    );
}
