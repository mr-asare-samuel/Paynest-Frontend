"use client";

import Link from "next/link";
import { Lock, ArrowUpRight, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEntitlementStore } from "@/(zustand-store)/entitlementStore";

/**
 * Shown in place of a page's content when the org's plan doesn't include the
 * module. Custom-plan orgs are told to contact support; everyone else is
 * pointed at the plans page.
 */
export function UpgradeRequired({
    moduleName,
    description,
}: {
    moduleName: string;
    description?: string;
}) {
    const { planName, isCustomPlan } = useEntitlementStore();

    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <Card className="max-w-md">
                <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                    <div className="bg-muted flex size-14 items-center justify-center rounded-full">
                        <Lock className="text-muted-foreground size-6" />
                    </div>
                    <div className="space-y-1.5">
                        <h2 className="text-foreground text-lg font-semibold">
                            {moduleName} isn&apos;t in your plan
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            {description
                                ?? `Your organisation is on ${planName ? `the ${planName} plan` : "a plan"} that doesn't include this feature.`}
                        </p>
                    </div>
                    {isCustomPlan ? (
                        <Button asChild variant="outline">
                            <a href="mailto:support@paynest.com?subject=Feature%20access%20request">
                                <LifeBuoy className="mr-2 size-4" /> Contact support
                            </a>
                        </Button>
                    ) : (
                        <Button asChild>
                            <Link href="/settings/plan">
                                <ArrowUpRight className="mr-2 size-4" /> View plans
                            </Link>
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
