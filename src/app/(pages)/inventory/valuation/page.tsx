"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Scale, TrendingUp } from "lucide-react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import PageHeader from "@/components/(shared-components)/PageHeader";
import Pagination from "@/components/(shared-components)/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { useCurrency } from "@/hooks/useCurrency";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import {
    GetValuation, GetValuationMethod, SetValuationMethod,
} from "@/(api-handlers)/inventoryTrackingHandler";
import { getOrganizationShops } from "@/(api-handlers)/organizationShopsHandler";
import { ValuationResponse, ValuationMethod } from "@/interfaces/inventoryTracking";
import { OrganizationShopResponse } from "@/interfaces/organizationShops";

const METHOD_LABEL: Record<ValuationMethod, string> = {
    fifo: "FIFO — first in, first out",
    lifo: "LIFO — last in, first out",
    weighted_average: "Weighted average",
};

export default function ValuationPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const fmt = useCurrency();
    const role = (user?.role || "attendant").toLowerCase();
    const isAllowed = role === "manager" || role === "admin" || role === "superadmin";
    const canSetMethod = role === "manager" || role === "admin" || role === "superadmin";

    const [data, setData] = useState<ValuationResponse | null>(null);
    const [method, setMethod] = useState<ValuationMethod>("weighted_average");
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [shopId, setShopId] = useState<string>("all");
    const [loading, setLoading] = useState(true);
    const [savingMethod, setSavingMethod] = useState(false);

    useEffect(() => {
        if (user && !isAllowed) router.replace("/dashboard");
    }, [user, isAllowed, router]);

    const load = async (sid: string) => {
        setLoading(true);
        try {
            const [val, m, shopList] = await Promise.all([
                GetValuation(sid === "all" ? {} : { shop_id: Number(sid) }),
                GetValuationMethod(),
                shops.length ? Promise.resolve(shops) : getOrganizationShops().catch(() => []),
            ]);
            setData(val);
            setMethod(m.method);
            if (!shops.length) setShops(shopList);
        } catch (e) {
            handleErrorMessage(e, "Failed to load valuation");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAllowed) load(shopId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAllowed, shopId]);

    const changeMethod = async (m: ValuationMethod) => {
        setSavingMethod(true);
        try {
            await SetValuationMethod(m);
            setMethod(m);
            toast.success("Valuation method updated");
            load(shopId);
        } catch (e) {
            handleErrorMessage(e, "Failed to change method");
        } finally {
            setSavingMethod(false);
        }
    };

    const valuationItems = data?.items ?? [];
    const pg = usePagination(valuationItems, 10);

    if (!user || !isAllowed) {
        return <div className="flex items-center justify-center py-24"><Skeleton className="size-6 rounded-full" /></div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Stock Valuation"
                description="On-hand inventory value from maintained cost layers. The method decides how cost of goods sold is drawn down at each sale."
                actions={
                    <Button variant="outline" size="icon" className="size-9" onClick={() => load(shopId)} disabled={loading} aria-label="Refresh">
                        <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                    </Button>
                }
            />

            <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                    <p className="text-muted-foreground text-xs font-medium">Shop</p>
                    <Select value={shopId} onValueChange={setShopId}>
                        <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All shops</SelectItem>
                            {shops.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <p className="text-muted-foreground text-xs font-medium">Costing method</p>
                    <Select value={method} onValueChange={(v) => canSetMethod && changeMethod(v as ValuationMethod)} disabled={!canSetMethod || savingMethod}>
                        <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {(Object.keys(METHOD_LABEL) as ValuationMethod[]).map((m) => (
                                <SelectItem key={m} value={m}>{METHOD_LABEL[m]}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card>
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className="bg-primary/10 flex size-11 items-center justify-center rounded-xl">
                            <Scale className="text-primary size-5" />
                        </div>
                        <div>
                            <p className="text-muted-foreground text-xs">Total inventory value</p>
                            <p className="text-2xl font-semibold">{loading ? "…" : fmt(data?.total_value ?? 0)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className="bg-primary/10 flex size-11 items-center justify-center rounded-xl">
                            <TrendingUp className="text-primary size-5" />
                        </div>
                        <div>
                            <p className="text-muted-foreground text-xs">Units on hand</p>
                            <p className="text-2xl font-semibold">{loading ? "…" : (data?.total_units ?? 0).toLocaleString()}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Product</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead className="text-right">On hand</TableHead>
                                <TableHead className="text-right">Avg unit cost</TableHead>
                                <TableHead className="pr-6 text-right">Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 5 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : !data || data.items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-16 text-center">
                                        <p className="text-muted-foreground text-sm">
                                            No cost layers yet. Receive stock via a purchase order to start tracking value.
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : pg.pageItems.map((it) => (
                                <TableRow key={it.product_id}>
                                    <TableCell className="pl-6 font-medium">{it.product_name}</TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs">{it.sku || "—"}</TableCell>
                                    <TableCell className="text-right">{it.quantity_on_hand.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{fmt(it.average_unit_cost)}</TableCell>
                                    <TableCell className="pr-6 text-right font-medium">{fmt(it.total_value)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {!loading && valuationItems.length > 0 && (
                    <div className="border-border bg-muted/30 border-t px-4 py-3">
                        <Pagination page={pg.page} totalPages={pg.totalPages} onPageChange={pg.setPage} total={pg.total} pageSize={pg.pageSize} onPageSizeChange={pg.setPageSize} />
                    </div>
                )}
            </Card>
        </div>
    );
}
