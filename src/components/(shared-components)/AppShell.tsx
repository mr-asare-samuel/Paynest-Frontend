"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    ArrowLeftRight,
    BarChart3,
    Banknote,
    Bell,
    Box,
    Building,
    Building2,
    Calculator,
    CalendarClock,
    CalendarDays,
    ChevronRight,
    CircleDollarSign,
    CircleUser,
    Clock,
    CreditCard,
    FileText,
    Home,
    Key,
    Layers,
    PieChart,
    PlusCircle,
    Printer,
    Receipt,
    ReceiptText,
    RotateCcw,
    Settings,
    Settings2,
    ShoppingCart,
    Store,
    Tag,
    TicketPercent,
    Boxes,
    Barcode,
    Blocks,
    Scale,
    Sparkles,
    TrendingUp,
    Truck,
    UserPlus,
    Users,
    UsersRound,
    Wallet,
    Wrench,
    type LucideIcon,
} from "lucide-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { useEntitlementStore } from "@/(zustand-store)/entitlementStore";
import { EntitlementBanner } from "./EntitlementBanner";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

type Role = "superadmin" | "admin" | "manager" | "attendant";

interface NavLeaf {
    name: string;
    href: string;
    icon: LucideIcon;
    roles: Role[];
    module?: string;   // entitlement module code; omitted = always visible
}

interface NavGroup {
    label: string;
    items: NavItem[];
    roles: Role[];
}

interface NavItem {
    name: string;
    icon: LucideIcon;
    roles: Role[];
    href?: string;
    module?: string;
    subItems?: NavLeaf[];
}

const NAV_GROUPS: NavGroup[] = [
    {
        label: "Overview",
        roles: ["superadmin", "admin"],
        items: [
            {
                name: "Dashboard",
                href: "/dashboard",
                icon: Home,
                roles: ["superadmin", "admin"],
            },
        ],
    },
    {
        label: "Operate",
        roles: ["superadmin", "admin", "manager", "attendant"],
        items: [
            {
                name: "Sales",
                icon: Calculator,
                roles: ["admin", "manager", "attendant"],
                subItems: [
                    { name: "POS", href: "/sales", icon: Calculator, roles: ["attendant"] },
                    { name: "Orders & Walk-ins", href: "/orders", icon: ReceiptText, roles: ["superadmin", "admin", "manager", "attendant"] },
                    { name: "Daily Sales Analysis", href: "/sales-report", icon: BarChart3, roles: ["superadmin", "admin", "manager", "attendant"] },
                    { name: "Order Items", href: "/order-items", icon: ShoppingCart, roles: ["superadmin", "admin", "manager", "attendant"] },
                    { name: "Payments", href: "/payments", icon: Banknote, roles: ["superadmin", "admin", "manager", "attendant"] },
                    { name: "Returns", href: "/returns", icon: RotateCcw, roles: ["superadmin", "admin", "manager", "attendant"], module: "returns" },
                    { name: "Transfers", href: "/transfers", icon: ArrowLeftRight, roles: ["superadmin", "admin", "manager", "attendant"], module: "advanced_inventory" },
                    { name: "Expenses", href: "/expenses", icon: Receipt, roles: ["superadmin", "admin", "manager", "attendant"], module: "expenses" },
                ],
            },
            { name: "Daily Closure", href: "/daily-closure", icon: Banknote, roles: ["admin", "manager", "attendant"] },
        ],
    },
    {
        label: "Catalog",
        roles: ["attendant", "manager"],
        items: [
            { name: "Products", href: "/products", icon: Layers, roles: ["attendant"] },
            { name: "Product Categories", href: "/product_categories", icon: Box, roles: ["attendant"] },
            {
                name: "Inventory",
                icon: CreditCard,
                roles: ["manager", "attendant"],
                subItems: [
                    { name: "All Inventory", href: "/inventory", icon: CreditCard, roles: ["manager", "attendant"] },
                    { name: "Create Inventory", href: "/inventory/create", icon: PlusCircle, roles: ["manager", "attendant"] },
                    { name: "Stock Movements", href: "/stock-movements", icon: ArrowLeftRight, roles: ["manager", "attendant"] },
                    { name: "Serial Numbers", href: "/inventory/serials", icon: Barcode, roles: ["manager"], module: "advanced_inventory" },
                    { name: "Batches & Expiry", href: "/inventory/batches", icon: Boxes, roles: ["manager"], module: "advanced_inventory" },
                    { name: "Stock Valuation", href: "/inventory/valuation", icon: Scale, roles: ["manager"], module: "advanced_inventory" },
                ],
            },
        ],
    },
    {
        label: "Pricing & Discounts",
        roles: ["admin", "manager"],
        items: [
            { name: "Promo Codes", href: "/promo-codes", icon: TicketPercent, roles: ["admin", "manager"], module: "advanced_pricing" },
            { name: "Pricing Rules", href: "/pricing", icon: Tag, roles: ["admin", "manager"], module: "advanced_pricing" },
            { name: "Bundles", href: "/bundles", icon: Sparkles, roles: ["admin", "manager"], module: "advanced_pricing" },
        ],
    },
    {
        label: "Procurement",
        roles: ["admin", "manager"],
        items: [
            { name: "Vendors", href: "/vendors", icon: Store, roles: ["admin", "manager"], module: "procurement" },
            {
                name: "Purchase Orders",
                icon: Truck,
                roles: ["admin", "manager"],
                module: "procurement",
                subItems: [
                    { name: "All Purchase Orders", href: "/purchase-orders", icon: Truck, roles: ["admin", "manager"] },
                    { name: "Create Purchase Order", href: "/purchase-orders/create", icon: PlusCircle, roles: ["admin", "manager"] },
                ],
            },
        ],
    },
    {
        label: "Customers",
        roles: ["admin", "manager", "attendant"],
        items: [
            {
                name: "Customers",
                icon: UsersRound,
                roles: ["admin", "manager", "attendant"],
                subItems: [
                    { name: "Customer List", href: "/customers", icon: UsersRound, roles: ["admin", "manager", "attendant"] },
                    { name: "Add Customer", href: "/customers/create", icon: UserPlus, roles: ["admin", "manager", "attendant"] },
                ],
            },
        ],
    },
    {
        label: "Reports & Finance",
        roles: ["admin", "manager"],
        items: [
            {
                name: "Reports",
                icon: BarChart3,
                roles: ["admin", "manager"],
                module: "reports_advanced",
                subItems: [
                    { name: "Organization Reports", href: "/report", icon: BarChart3, roles: ["admin"] },
                    { name: "My Reports", href: "/report/my_report", icon: BarChart3, roles: ["admin", "manager"] },
                    { name: "Pending Reports", href: "/report/pending", icon: BarChart3, roles: ["admin"] },
                ],
            },
            {
                name: "Advanced Analytics",
                icon: TrendingUp,
                roles: ["admin", "manager"],
                module: "reports_advanced",
                subItems: [
                    { name: "Report Builder", href: "/analytics/report-builder", icon: Wrench, roles: ["admin", "manager"] },
                    { name: "Consolidated", href: "/analytics/consolidated", icon: Building2, roles: ["admin", "manager"] },
                    { name: "Forecasting", href: "/analytics/forecast", icon: TrendingUp, roles: ["admin", "manager"] },
                    { name: "Report Schedules", href: "/analytics/schedules", icon: CalendarClock, roles: ["admin", "manager"] },
                    { name: "KPI Alerts", href: "/analytics/alerts", icon: Bell, roles: ["admin", "manager"] },
                ],
            },
            {
                name: "Financials",
                icon: CircleDollarSign,
                roles: ["admin"],
                subItems: [
                    { name: "Organization Finance", href: "/finance", icon: PieChart, roles: ["superadmin", "admin"], module: "finance" },
                ],
            },
        ],
    },
    {
        label: "Payroll",
        roles: ["admin"],
        items: [
            { name: "Payroll Runs", href: "/payroll", icon: Banknote, roles: ["admin"], module: "payroll" },
            { name: "Payroll History", href: "/payroll/history", icon: TrendingUp, roles: ["admin"], module: "payroll" },
            { name: "Employee Payroll", href: "/payroll/employees", icon: Wallet, roles: ["admin"], module: "payroll" },
            { name: "Payroll Settings", href: "/settings/payroll", icon: Calculator, roles: ["admin"], module: "payroll" },
        ],
    },
    {
        label: "My Pay",
        roles: ["admin", "manager", "attendant"],
        items: [
            { name: "My Payslips", href: "/payroll/my-payslips", icon: Receipt, roles: ["admin", "manager", "attendant"], module: "payroll" },
        ],
    },
    {
        label: "Leave & HR",
        roles: ["admin", "manager", "attendant"],
        items: [
            { name: "Leave", href: "/leave", icon: CalendarDays, roles: ["admin", "manager", "attendant"], module: "hr_leave" },
        ],
    },
    {
        label: "Scheduling",
        roles: ["admin", "manager", "attendant"],
        items: [
            { name: "Shifts & Overtime", href: "/scheduling", icon: CalendarClock, roles: ["admin", "manager", "attendant"], module: "hr_leave" },
            { name: "Timesheets", href: "/timesheets", icon: Clock, roles: ["admin", "manager", "attendant"], module: "hr_leave" },
            { name: "Overtime Rules", href: "/settings/scheduling", icon: Settings2, roles: ["admin"], module: "hr_leave" },
        ],
    },
    {
        label: "Administration",
        roles: ["superadmin", "admin"],
        items: [
            {
                name: "Organization Management",
                icon: Building,
                roles: ["superadmin", "admin"],
                subItems: [
                    { name: "Organizations", href: "/organizations", icon: Building2, roles: ["superadmin"] },
                    { name: "Subscription Plans", href: "/subscription-plans", icon: CreditCard, roles: ["superadmin"] },
                    { name: "Modules & Entitlements", href: "/settings/modules", icon: Blocks, roles: ["superadmin"] },
                    { name: "Shops", href: "/organization_shops", icon: Building, roles: ["admin"] },
                ],
            },
            {
                name: "User Management",
                icon: Users,
                roles: ["superadmin", "admin"],
                subItems: [
                    { name: "All Users", href: "/users", icon: Users, roles: ["superadmin", "admin"] },
                    { name: "Setup Employee Profile", href: "/users/setup-employee-profile", icon: CircleUser, roles: ["admin"] },
                ],
            },
            { name: "Audit Logs", href: "/audit-log", icon: FileText, roles: ["superadmin"] },
        ],
    },
    {
        label: "Account",
        roles: ["superadmin", "admin", "manager", "attendant"],
        items: [
            { name: "Notifications", href: "/notifications", icon: Bell, roles: ["superadmin", "admin", "manager", "attendant"] },
            {
                name: "Settings",
                icon: Settings,
                roles: ["superadmin", "admin", "manager", "attendant"],
                subItems: [
                    { name: "Profile Settings", href: "/settings/profile", icon: CircleUser, roles: ["superadmin", "admin", "manager", "attendant"] },
                    { name: "Organization Profile", href: "/organization_profile", icon: Settings, roles: ["admin"] },
                    { name: "Security", href: "/settings/security", icon: Key, roles: ["superadmin", "admin", "manager", "attendant"] },
                    { name: "Notifications", href: "/settings/notifications", icon: Bell, roles: ["superadmin", "admin", "manager", "attendant"] },
                    { name: "Printer Settings", href: "/settings/printer", icon: Printer, roles: ["admin", "manager", "attendant"] },
                    { name: "Receipt Settings", href: "/settings/receipts", icon: Receipt, roles: ["admin"], module: "receipts_branding" },
                    { name: "Expense Categories", href: "/settings/expense-categories", icon: Tag, roles: ["admin", "manager"] },
                    { name: "System Settings", href: "/settings/system", icon: Wrench, roles: ["superadmin"] },
                ],
            },
        ],
    },
];

const ROLE_GREETING: Record<Role, string> = {
    superadmin: "Manage the entire system and oversee all operations.",
    admin: "Manage users, transactions, and financial reports.",
    manager: "Oversee daily operations and team performance.",
    attendant: "Handle customer transactions and queue management.",
};

function NavItemRow({
    item,
    pathname,
    role,
}: Readonly<{
    item: NavItem;
    pathname: string;
    role: Role;
}>) {
    const Icon = item.icon;

    if (!item.subItems || item.subItems.length === 0) {
        if (!item.href) return null;
        const isActive = pathname === item.href;
        return (
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                    <Link href={item.href}>
                        <Icon />
                        <span>{item.name}</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    }

    const visibleSubs = item.subItems.filter((s) => s.roles.includes(role));
    if (visibleSubs.length === 0) return null;

    const isAnySubActive = visibleSubs.some((s) => pathname === s.href);

    return (
        <Collapsible asChild defaultOpen={isAnySubActive} className="group/collapsible">
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        isActive={isAnySubActive}
                    >
                        <Icon />
                        <span>{item.name}</span>
                        <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {visibleSubs.map((sub) => {
                            const SubIcon = sub.icon;
                            const isActive = pathname === sub.href;
                            return (
                                <SidebarMenuSubItem key={`${item.name}-${sub.name}`}>
                                    <SidebarMenuSubButton asChild isActive={isActive}>
                                        <Link href={sub.href}>
                                            <SubIcon />
                                            <span>{sub.name}</span>
                                        </Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            );
                        })}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
}

export default function AppShell({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const role = (user?.role as Role) ?? "attendant";

    const entLoaded = useEntitlementStore((s) => s.loaded);
    const entLoading = useEntitlementStore((s) => s.loading);
    const entModules = useEntitlementStore((s) => s.modules);
    const fetchEntitlements = useEntitlementStore((s) => s.fetchEntitlements);
    const clearEntitlements = useEntitlementStore((s) => s.clear);

    React.useEffect(() => {
        if (!user) return;
        const needsEmployeeProfile = (user.role === "manager" || user.role === "attendant") && !user.employee_profile;
        if (needsEmployeeProfile && pathname !== "/account-pending") {
            router.replace("/account-pending");
        }
    }, [user, pathname, router]);

    // Keep entitlements in sync with the auth session (covers login + refresh + logout).
    React.useEffect(() => {
        if (isAuthenticated && user && !entLoaded && !entLoading) fetchEntitlements();
        if (!isAuthenticated && entLoaded) clearEntitlements();
    }, [isAuthenticated, user, entLoaded, entLoading, fetchEntitlements, clearEntitlements]);

    const hasModule = React.useCallback(
        (code?: string) => !code || !entLoaded || role === "superadmin" || entModules.includes(code),
        [entLoaded, entModules, role],
    );

    const groups = React.useMemo(() => {
        return NAV_GROUPS.map((g) => ({
            ...g,
            items: g.items
                .filter((it) => it.roles.includes(role) && hasModule(it.module))
                .map((it) => it.subItems
                    ? { ...it, subItems: it.subItems.filter((s) => hasModule(s.module)) }
                    : it)
                .filter((it) => !it.subItems || it.subItems.length > 0),
        })).filter((g) => g.roles.includes(role) && g.items.length > 0);
    }, [role, hasModule]);

    return (
        <SidebarProvider>
            <Sidebar collapsible="icon">
                <SidebarHeader className="border-b border-sidebar-border/60 pb-3">
                    <Link
                        href="/dashboard"
                        className="hover:bg-sidebar-accent group/logo flex items-center gap-2.5 rounded-lg p-2 transition-colors duration-(--duration-base) ease-(--ease-standard) group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
                    >
                        <span className="bg-sidebar-primary text-sidebar-primary-foreground ring-sidebar-primary/20 flex size-8 shrink-0 items-center justify-center rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 transition-transform duration-(--duration-base) ease-(--ease-standard) group-hover/logo:scale-105 group-data-[collapsible=icon]:size-7">
                            <Wallet className="size-4" strokeWidth={2.25} />
                        </span>
                        <span className="text-sidebar-foreground truncate text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
                            Pay<span className="text-sidebar-foreground/60 font-normal">nest</span>
                        </span>
                    </Link>
                </SidebarHeader>

                <SidebarContent>
                    {groups.map((group) => (
                        <SidebarGroup key={group.label}>
                            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {group.items.map((item) => (
                                        <NavItemRow
                                            key={item.name}
                                            item={item}
                                            pathname={pathname}
                                            role={role}
                                        />
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    ))}
                </SidebarContent>

                <SidebarFooter className="border-t border-sidebar-border/60 pt-2">
                    <UserMenu
                        variant="row"
                        align="end"
                        className="border border-sidebar-border/60 bg-white/[0.04] hover:bg-white/[0.09]"
                    />
                </SidebarFooter>
            </Sidebar>

            <SidebarInset className="min-w-0 flex-1">
                <header className="bg-background/80 supports-backdrop-filter:bg-background/60 border-border sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
                    <SidebarTrigger className="-ml-1" />
                    <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate text-sm font-semibold">
                            {user?.first_name
                                ? `Welcome back, ${user.first_name}`
                                : "Welcome"}
                        </p>
                        <p className="text-muted-foreground hidden truncate text-xs sm:block">
                            {ROLE_GREETING[role]}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        <NotificationBell />
                        <UserMenu variant="compact" />
                    </div>
                </header>

                <EntitlementBanner />

                <div className="min-w-0 flex-1 overflow-x-clip p-4 lg:p-6">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
