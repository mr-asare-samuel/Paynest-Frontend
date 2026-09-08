"use client"

import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Store, MapPin, Phone, RefreshCcw } from 'lucide-react';
import { OrganizationShopRequest, OrganizationShopResponse } from '@/interfaces/organizationShops';
import { createOrganizationShop, getOrganizationShops } from '@/(api-handlers)/organizationShopsHandler';
import PageHeader from '@/components/(shared-components)/PageHeader';
import Pagination from '@/components/(shared-components)/Pagination';
import { usePagination } from '@/hooks/usePagination';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn, sanitizePhoneNumber } from '@/lib/utils';
import { handleErrorMessage } from '@/utils/handleErrorMessage';

const schema = z.object({
    name:     z.string().min(1, 'Shop name is required'),
    location: z.string().min(1, 'Location is required'),
    phone:    z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
});
type FormValues = z.infer<typeof schema>;

export default function OrganizationShops() {
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const {
        register, handleSubmit, reset,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({ resolver: zodResolver(schema) as Resolver<FormValues> });

    const { onChange: onPhoneChange, ...phoneField } = register('phone');

    const fetchShops = async () => {
        setLoading(true);
        try {
            setShops(await getOrganizationShops());
        } catch {
            toast.error('Failed to fetch shops');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchShops(); }, []);

    const onSubmit = async (values: FormValues) => {
        try {
            await createOrganizationShop(values as OrganizationShopRequest);
            toast.success('Shop created successfully');
            setIsDialogOpen(false);
            reset();
            fetchShops();
        } catch (error: unknown) {
            handleErrorMessage(error, 'Failed to create shop');
        }
    };

    const closeDialog = () => { setIsDialogOpen(false); reset(); };

    const pg = usePagination(shops, 10);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Organization Shops"
                description="Manage your organization branches and locations."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-9" onClick={fetchShops} disabled={loading}>
                            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                        <Button onClick={() => setIsDialogOpen(true)}>
                            <Plus className="mr-2 size-4" /> Add New Shop
                        </Button>
                    </div>
                }
            />

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Shop Name</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="pr-6">Updated</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 5 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : shops.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-20 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <Store className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-foreground font-semibold">No shops yet</p>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            Create your first shop location to get started.
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : pg.pageItems.map(shop => (
                                <TableRow key={shop.id}>
                                    <TableCell className="pl-6">
                                        <div className="flex items-center gap-2 font-medium">
                                            <Store className="text-muted-foreground size-4" />
                                            {shop.name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="text-muted-foreground size-3.5 shrink-0" />
                                            {shop.location}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        <div className="flex items-center gap-2">
                                            <Phone className="text-muted-foreground size-3.5 shrink-0" />
                                            {shop.phone}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {new Date(shop.created_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="pr-6 text-muted-foreground text-sm">
                                        {new Date(shop.updated_at).toLocaleDateString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {!loading && shops.length > 0 && (
                    <div className="border-border bg-muted/30 border-t px-4 py-3">
                        <Pagination page={pg.page} totalPages={pg.totalPages} onPageChange={pg.setPage} total={pg.total} pageSize={pg.pageSize} onPageSizeChange={pg.setPageSize} />
                    </div>
                )}
            </Card>

            {/* Create Shop Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={open => !open && closeDialog()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Store className="text-primary size-5" /> Add New Shop
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
                        <div className="space-y-1.5">
                            <Label>Shop Name <span className="text-destructive">*</span></Label>
                            <Input
                                {...register('name')}
                                placeholder="Main Branch"
                                className={cn(errors.name && 'border-destructive')}
                            />
                            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Location <span className="text-destructive">*</span></Label>
                            <Input
                                {...register('location')}
                                placeholder="123 Street, City"
                                className={cn(errors.location && 'border-destructive')}
                            />
                            {errors.location && <p className="text-destructive text-xs">{errors.location.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Phone Number <span className="text-destructive">*</span></Label>
                            <Input
                                {...phoneField}
                                type="tel"
                                inputMode="numeric"
                                maxLength={10}
                                onChange={e => { e.target.value = sanitizePhoneNumber(e.target.value); onPhoneChange(e); }}
                                placeholder="10-digit phone number"
                                className={cn(errors.phone && 'border-destructive')}
                            />
                            {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Creating…' : 'Create Shop'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
