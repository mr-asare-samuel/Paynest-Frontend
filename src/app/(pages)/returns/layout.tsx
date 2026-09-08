import { ModuleGuard } from "@/components/(shared-components)/ModuleGuard";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <ModuleGuard module="returns" name="Returns & Refunds">
            {children}
        </ModuleGuard>
    );
}
