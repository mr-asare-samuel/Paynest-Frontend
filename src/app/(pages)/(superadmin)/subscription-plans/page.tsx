"use client"

import { useEffect, useState } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    CreditCard, Plus, Pencil, Trash2, RefreshCcw, MoreHorizontal,
    CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import {
    getSubscriptionPlans, createSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan,
} from '@/(api-handlers)/subscriptionPlansHandler';
import { SubscriptionPlanResponse } from '@/interfaces/subscriptionPlan';
import PageHeader from '@/components/(shared-components)/PageHeader';
import Pagination from '@/components/(shared-components)/Pagination';
import { usePagination } from '@/hooks/usePagination';
import EmptyState from '@/components/(shared-components)/EmptyState';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { handleErrorMessage, getErrorMessage } from '@/utils/handleErrorMessage';

const schema = z.object({
    name:           z.string().min(1, 'Plan name is required'),
    description:    z.string().optional(),
    max_shops:      z.coerce.number().int().min(1, 'Min 1 shop'),
    max_users:      z.coerce.number().int().min(1, 'Min 1 user'),
    never_expires:  z.boolean(),
    duration_days:  z.coerce.number().int().min(1).optional(),
    price:          z.coerce.number().min(0).optional(),
    is_active:      z.boolean(),
}).refine(data => data.never_expires || (data.duration_days != null && data.duration_days > 0), {
    message: 'Enter a duration, or mark this plan as never expiring',
    path: ['duration_days'],
});
type FormValues = z.infer<typeof schema>;

const emptyDefaults: FormValues = {
    name: '', description: '', max_shops: 1, max_users: 1,
    never_expires: false, duration_days: 30, price: undefined, is_active: true,
};

export default function SubscriptionPlansPage() {
    const [plans, setPlans] = useState<SubscriptionPlanResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlanResponse | null>(null);
    const [saving, setSaving] = useState(false);
    const pg = usePagination(plans, 10);
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanResponse | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const {
        register, handleSubmit, reset, control, watch,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        defaultValues: emptyDefaults,
    });
    const neverExpires = watch('never_expires');

    const fetchPlans = async () => {
        setLoading(true);
        try {
            setPlans(await getSubscriptionPlans());
        } catch (error) {
            handleErrorMessage(error, 'Failed to fetch subscription plans');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPlans(); }, []);

    const openCreateForm = () => {
        setEditingPlan(null);
        reset(emptyDefaults);
        setIsFormOpen(true);
    };

    const openEditForm = (plan: SubscriptionPlanResponse) => {
        setEditingPlan(plan);
        reset({
            name: plan.name,
            description: plan.description ?? '',
            max_shops: plan.max_shops,
            max_users: plan.max_users,
            never_expires: plan.duration_days === null,
            duration_days: plan.duration_days ?? 30,
            price: plan.price ?? undefined,
            is_active: plan.is_active,
        });
        setIsFormOpen(true);
    };

    const onSubmit = async (values: FormValues) => {
        setSaving(true);
        const payload = {
            name: values.name,
            description: values.description || undefined,
            max_shops: values.max_shops,
            max_users: values.max_users,
            duration_days: values.never_expires ? null : values.duration_days ?? null,
            price: values.price,
            is_active: values.is_active,
        };
        try {
            if (editingPlan) {
                await updateSubscriptionPlan(editingPlan.id, payload);
                toast.success('Subscription plan updated successfully');
            } else {
                await createSubscriptionPlan(payload);
                toast.success('Subscription plan created successfully');
            }
            setIsFormOpen(false);
            fetchPlans();
        } catch (error) {
            handleErrorMessage(error, 'Failed to save subscription plan');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (plan: SubscriptionPlanResponse) => {
        setActionLoading(true);
        try {
            await updateSubscriptionPlan(plan.id, { is_active: !plan.is_active });
            toast.success(plan.is_active ? 'Plan deactivated' : 'Plan activated');
            fetchPlans();
        } catch (error) {
            handleErrorMessage(error, 'Failed to update plan status');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedPlan) return;
        setActionLoading(true);
        try {
            await deleteSubscriptionPlan(selectedPlan.id);
            toast.success('Subscription plan deleted successfully');
            setIsDeleteOpen(false);
            fetchPlans();
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 409) {
                const plan = selectedPlan;
                toast.error(getErrorMessage(error, 'Cannot delete this plan.'), {
                    action: {
                        label: 'Deactivate instead',
                        onClick: () => handleToggleActive(plan),
                    },
                    duration: 10000,
                });
                setIsDeleteOpen(false);
            } else {
                handleErrorMessage(error, 'Failed to delete subscription plan');
            }
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Subscription Plans"
                description="Manage the plans organizations can be onboarded onto."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-9" onClick={fetchPlans} disabled={loading} aria-label="Refresh plans">
                            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                        <Button onClick={openCreateForm}>
                            <Plus className="mr-2 size-4" /> New Plan
                        </Button>
                    </div>
                }
            />

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Plan</TableHead>
                                <TableHead>Max Shops</TableHead>
                                <TableHead>Max Users</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="pr-6 w-[100px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : plans.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-20 text-center">
                                        <EmptyState
                                            title="No subscription plans yet"
                                            description="Create your first plan so new organizations can be onboarded onto it."
                                            actions={<Button onClick={openCreateForm}><Plus className="mr-2 size-4" /> New Plan</Button>}
                                        />
                                    </TableCell>
                                </TableRow>
                            ) : pg.pageItems.map(plan => (
                                <TableRow key={plan.id}>
                                    <TableCell className="pl-6">
                                        <p className="text-foreground font-semibold text-sm leading-tight">{plan.name}</p>
                                        {plan.description && (
                                            <p className="text-muted-foreground mt-0.5 truncate text-xs max-w-[280px]">{plan.description}</p>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">{plan.max_shops}</TableCell>
                                    <TableCell className="text-sm">{plan.max_users}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {plan.duration_days ? `${plan.duration_days} days` : 'Never expires'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {plan.price != null ? `GHS ${plan.price}` : '—'}
                                    </TableCell>
                                    <TableCell>
                                        {plan.is_active ? (
                                            <span className="text-success inline-flex items-center gap-1 text-xs font-medium">
                                                <CheckCircle2 className="size-3.5" /> Active
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
                                                <XCircle className="size-3.5" /> Deactivated
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8" aria-label="Plan actions" disabled={actionLoading}>
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEditForm(plan)}>
                                                    <Pencil className="mr-2 size-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleToggleActive(plan)}>
                                                    {plan.is_active
                                                        ? <><XCircle className="mr-2 size-4" /> Deactivate</>
                                                        : <><CheckCircle2 className="mr-2 size-4" /> Activate</>}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => { setSelectedPlan(plan); setIsDeleteOpen(true); }}
                                                >
                                                    <Trash2 className="mr-2 size-4" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {!loading && plans.length > 0 && (
                    <div className="border-border bg-muted/30 border-t px-4 py-3">
                        <Pagination page={pg.page} totalPages={pg.totalPages} onPageChange={pg.setPage} total={pg.total} pageSize={pg.pageSize} onPageSizeChange={pg.setPageSize} />
                    </div>
                )}
            </Card>

            {/* Create / Edit Dialog */}
            <Dialog open={isFormOpen} onOpenChange={open => !open && setIsFormOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CreditCard className="size-5 text-primary" />
                            {editingPlan ? 'Edit Subscription Plan' : 'New Subscription Plan'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingPlan
                                ? 'Existing organizations on this plan keep working — only new assignments use the updated limits.'
                                : 'Define the shop/user limits and expiry for organizations onboarded onto this plan.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Plan Name <span className="text-destructive">*</span></Label>
                            <Input {...register('name')} placeholder="e.g. Basic" className={cn(errors.name && 'border-destructive')} />
                            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Textarea {...register('description')} placeholder="For small shops" className="resize-none" rows={2} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Max Shops <span className="text-destructive">*</span></Label>
                                <Input type="number" min={1} {...register('max_shops')} className={cn(errors.max_shops && 'border-destructive')} />
                                {errors.max_shops && <p className="text-destructive text-xs">{errors.max_shops.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label>Max Users <span className="text-destructive">*</span></Label>
                                <Input type="number" min={1} {...register('max_users')} className={cn(errors.max_users && 'border-destructive')} />
                                {errors.max_users && <p className="text-destructive text-xs">{errors.max_users.message}</p>}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Price (GHS)</Label>
                            <Input type="number" min={0} step="0.01" {...register('price')} placeholder="Optional — informational only" />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                            <div>
                                <p className="text-sm font-medium text-foreground">Never Expires</p>
                                <p className="text-muted-foreground text-xs">Use this for a free, non-expiring tier.</p>
                            </div>
                            <Controller
                                control={control}
                                name="never_expires"
                                render={({ field }) => (
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                )}
                            />
                        </div>

                        {!neverExpires && (
                            <div className="space-y-1.5">
                                <Label>Duration (days) <span className="text-destructive">*</span></Label>
                                <Input type="number" min={1} {...register('duration_days')} className={cn(errors.duration_days && 'border-destructive')} />
                                {errors.duration_days && <p className="text-destructive text-xs">{errors.duration_days.message}</p>}
                            </div>
                        )}

                        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                            <div>
                                <p className="text-sm font-medium text-foreground">Active</p>
                                <p className="text-muted-foreground text-xs">Inactive plans are hidden from org-creation pickers.</p>
                            </div>
                            <Controller
                                control={control}
                                name="is_active"
                                render={({ field }) => (
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={saving}>
                                {saving
                                    ? <><Loader2 className="mr-2 size-4 animate-spin" /> Saving…</>
                                    : editingPlan ? 'Save Changes' : 'Create Plan'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteOpen} onOpenChange={open => !open && setIsDeleteOpen(false)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Subscription Plan</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{selectedPlan?.name}</strong>? This cannot be undone.
                            If any organizations are currently on this plan, deletion will fail and you&apos;ll be offered
                            the option to deactivate it instead.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDelete}
                            disabled={actionLoading}
                        >
                            {actionLoading ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
