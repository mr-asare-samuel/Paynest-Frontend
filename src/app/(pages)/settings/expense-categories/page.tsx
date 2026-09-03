"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Plus, MoreHorizontal, Pencil, Trash2, Search, RefreshCcw, Tag,
} from "lucide-react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    GetExpenseCategories, CreateExpenseCategory,
    UpdateExpenseCategory, DeleteExpenseCategory,
} from "@/(api-handlers)/expensesHandler";
import { getOrganizationShops } from "@/(api-handlers)/organizationShopsHandler";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { ExpenseCategoryResponse } from "@/interfaces/expenses";
import { OrganizationShopResponse } from "@/interfaces/organizationShops";
import { toast } from "sonner";
import PageHeader from "@/components/(shared-components)/PageHeader";
import { cn } from "@/lib/utils";

const schema = z.object({
    name:        z.string().min(1, "Category name is required"),
    description: z.string().optional(),
    shop_id:     z.string(),
    is_active:   z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

export default function ExpenseCategoriesPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const role = (user?.role || "attendant").toLowerCase();
    // Expense categories are organization-scoped; superadmins have no organization.
    const isAllowed = role === "manager" || role === "admin";

    const [categories, setCategories]       = useState<ExpenseCategoryResponse[]>([]);
    const [shops, setShops]                 = useState<OrganizationShopResponse[]>([]);
    const [loading, setLoading]             = useState(true);
    const [searchTerm, setSearchTerm]       = useState("");
    const [isDialogOpen, setIsDialogOpen]   = useState(false);
    const [deleteTarget, setDeleteTarget]   = useState<ExpenseCategoryResponse | null>(null);
    const [editing, setEditing]             = useState<ExpenseCategoryResponse | null>(null);
    const [submitting, setSubmitting]       = useState(false);

    useEffect(() => {
        if (user && !isAllowed) router.replace('/dashboard');
    }, [user, isAllowed, router]);

    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        defaultValues: { name: '', description: '', shop_id: 'org-wide', is_active: true },
    });

    const fetchCategories = async () => {
        setLoading(true);
        try {
            setCategories(await GetExpenseCategories());
        } catch {
            toast.error("Failed to load expense categories");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isAllowed) return;
        fetchCategories();
        getOrganizationShops().then(setShops).catch(console.error);
    }, [isAllowed]);

    const shopName = (id: number | null) => {
        if (id == null) return "Org-wide";
        return shops.find((s) => s.id === id)?.name || `Shop #${id}`;
    };

    const openDialog = (category: ExpenseCategoryResponse | null = null) => {
        setEditing(category);
        reset(category
            ? { name: category.name, description: category.description ?? '', shop_id: category.shop_id != null ? String(category.shop_id) : 'org-wide', is_active: category.is_active }
            : { name: '', description: '', shop_id: 'org-wide', is_active: true }
        );
        setIsDialogOpen(true);
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setEditing(null);
        reset();
    };

    const onSubmit = async (values: FormValues) => {
        setSubmitting(true);
        try {
            const payload = {
                name: values.name,
                description: values.description ?? '',
                shop_id: values.shop_id === 'org-wide' ? null : Number(values.shop_id),
                is_active: values.is_active,
            };
            if (editing) {
                await UpdateExpenseCategory(editing.id, payload);
                toast.success("Category updated");
            } else {
                await CreateExpenseCategory(payload);
                toast.success("Category created");
            }
            closeDialog();
            fetchCategories();
        } catch {
            toast.error(editing ? "Failed to update category" : "Failed to create category");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await DeleteExpenseCategory(deleteTarget.id);
            toast.success("Category deleted");
            fetchCategories();
        } catch {
            toast.error("Failed to delete category");
        } finally {
            setDeleteTarget(null);
        }
    };

    const filtered = categories.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.description ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!user || !isAllowed) {
        return (
            <div className="flex items-center justify-center py-24">
                <Skeleton className="size-6 rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Expense Categories"
                description="Manage the categories staff choose from when submitting an expense."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-9" onClick={fetchCategories} disabled={loading} aria-label="Refresh categories">
                            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                        <Button onClick={() => openDialog()}>
                            <Plus className="mr-2 size-4" /> Add Category
                        </Button>
                    </div>
                }
            />

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                    placeholder="Search categories…"
                    className="h-9 pl-9"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[140px]">Shop</TableHead>
                                <TableHead className="w-[120px]">Status</TableHead>
                                <TableHead className="pr-6 w-[60px] text-right">Actions</TableHead>
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
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-20 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <Tag className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-foreground font-semibold">No categories found</p>
                                        <p className="text-muted-foreground mt-1 text-sm">Create your first category to get started.</p>
                                    </TableCell>
                                </TableRow>
                            ) : filtered.map(cat => (
                                <TableRow key={cat.id}>
                                    <TableCell className="pl-6 font-semibold">{cat.name}</TableCell>
                                    <TableCell className="text-muted-foreground line-clamp-1 max-w-xs">
                                        {cat.description || "—"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="rounded-full text-xs">
                                            {shopName(cat.shop_id)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "rounded-full text-xs",
                                                cat.is_active
                                                    ? "border-success/30 bg-success/10 text-success"
                                                    : "border-border bg-muted text-muted-foreground",
                                            )}
                                        >
                                            {cat.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8" aria-label="Category actions">
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openDialog(cat)}>
                                                    <Pencil className="mr-2 size-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => setDeleteTarget(cat)}
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

                {!loading && filtered.length > 0 && (
                    <div className="border-border bg-muted/30 border-t px-6 py-3 text-xs">
                        <span className="text-muted-foreground">{filtered.length} categor{filtered.length !== 1 ? 'ies' : 'y'}</span>
                    </div>
                )}
            </Card>

            {/* Create / Edit dialog */}
            <Dialog open={isDialogOpen} onOpenChange={open => !open && closeDialog()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
                        <div className="space-y-1.5">
                            <Label>Category Name <span className="text-destructive">*</span></Label>
                            <Input {...register("name")} placeholder="e.g. Utilities, Rent" />
                            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Textarea
                                {...register("description")}
                                placeholder="Brief description of this category"
                                className="min-h-[90px] resize-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Shop</Label>
                            <Controller
                                control={control}
                                name="shop_id"
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="org-wide">Organization-wide</SelectItem>
                                            {shops.map((s) => (
                                                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <p className="text-foreground text-sm font-medium">Active</p>
                                <p className="text-muted-foreground text-xs">Visible on the expense submission form</p>
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
                            <Button variant="outline" type="button" onClick={closeDialog}>Cancel</Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? "Saving…" : editing ? "Update" : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Category</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDelete}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
