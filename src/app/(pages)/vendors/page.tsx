"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Plus, MoreHorizontal, Pencil, Search, RefreshCcw, Store, Power,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { CreateVendor, GetVendors, UpdateVendor } from "@/(api-handlers)/vendorsHandler";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { VendorResponse } from "@/interfaces/vendors";
import { toast } from "sonner";
import PageHeader from "@/components/(shared-components)/PageHeader";
import { cn } from "@/lib/utils";

const schema = z.object({
    name: z.string().min(1, "Vendor name is required"),
    contact_person: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    tax_id: z.string().optional(),
    payment_terms: z.string().optional(),
    notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const blankDefaults: FormValues = {
    name: "", contact_person: "", email: "", phone: "", address: "", tax_id: "", payment_terms: "", notes: "",
};

export default function VendorsPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const role = (user?.role || "attendant").toLowerCase();
    const isAllowed = role === "manager" || role === "admin" || role === "superadmin";

    const [vendors, setVendors] = useState<VendorResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editing, setEditing] = useState<VendorResponse | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user && !isAllowed) router.replace('/dashboard');
    }, [user, isAllowed, router]);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        defaultValues: blankDefaults,
    });

    const fetchVendors = async () => {
        setLoading(true);
        try {
            const data = await GetVendors({ limit: 200 });
            setVendors(data.items);
        } catch {
            toast.error("Failed to load vendors");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isAllowed) return;
        fetchVendors();
    }, [isAllowed]);

    const openDialog = (vendor: VendorResponse | null = null) => {
        setEditing(vendor);
        reset(vendor
            ? {
                name: vendor.name,
                contact_person: vendor.contact_person ?? "",
                email: vendor.email ?? "",
                phone: vendor.phone ?? "",
                address: vendor.address ?? "",
                tax_id: vendor.tax_id ?? "",
                payment_terms: vendor.payment_terms ?? "",
                notes: vendor.notes ?? "",
            }
            : blankDefaults
        );
        setIsDialogOpen(true);
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setEditing(null);
        reset(blankDefaults);
    };

    const onSubmit = async (values: FormValues) => {
        setSubmitting(true);
        try {
            const payload = {
                name: values.name,
                contact_person: values.contact_person || undefined,
                email: values.email || undefined,
                phone: values.phone || undefined,
                address: values.address || undefined,
                tax_id: values.tax_id || undefined,
                payment_terms: values.payment_terms || undefined,
                notes: values.notes || undefined,
            };
            if (editing) {
                await UpdateVendor(editing.id, payload);
                toast.success("Vendor updated");
            } else {
                await CreateVendor(payload);
                toast.success("Vendor created");
            }
            closeDialog();
            fetchVendors();
        } catch {
            toast.error(editing ? "Failed to update vendor" : "Failed to create vendor");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (vendor: VendorResponse) => {
        try {
            await UpdateVendor(vendor.id, { is_active: !vendor.is_active });
            toast.success(vendor.is_active ? "Vendor deactivated" : "Vendor activated");
            fetchVendors();
        } catch {
            toast.error("Failed to update vendor status");
        }
    };

    const filtered = vendors.filter(v =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.contact_person ?? '').toLowerCase().includes(searchTerm.toLowerCase())
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
                title="Vendors"
                description="Manage the suppliers you place purchase orders with."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-9" onClick={fetchVendors} disabled={loading} aria-label="Refresh vendors">
                            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                        <Button onClick={() => openDialog()}>
                            <Plus className="mr-2 size-4" /> Add Vendor
                        </Button>
                    </div>
                }
            />

            <div className="relative max-w-sm">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                    placeholder="Search vendors…"
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
                                <TableHead>Contact</TableHead>
                                <TableHead>Email / Phone</TableHead>
                                <TableHead className="w-[140px]">Payment Terms</TableHead>
                                <TableHead className="w-[120px]">Status</TableHead>
                                <TableHead className="pr-6 w-[60px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-20 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <Store className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-foreground font-semibold">No vendors found</p>
                                        <p className="text-muted-foreground mt-1 text-sm">Add your first vendor to start placing purchase orders.</p>
                                    </TableCell>
                                </TableRow>
                            ) : filtered.map(v => (
                                <TableRow key={v.id}>
                                    <TableCell className="pl-6 font-semibold">{v.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{v.contact_person || "—"}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        <div className="flex flex-col text-xs">
                                            <span>{v.email || "—"}</span>
                                            <span>{v.phone || ""}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{v.payment_terms || "—"}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "rounded-full text-xs",
                                                v.is_active
                                                    ? "border-success/30 bg-success/10 text-success"
                                                    : "border-border bg-muted text-muted-foreground",
                                            )}
                                        >
                                            {v.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8" aria-label="Vendor actions">
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openDialog(v)}>
                                                    <Pencil className="mr-2 size-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => toggleActive(v)}>
                                                    <Power className="mr-2 size-4" /> {v.is_active ? "Deactivate" : "Activate"}
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
                        <span className="text-muted-foreground">{filtered.length} vendor{filtered.length !== 1 ? 's' : ''}</span>
                    </div>
                )}
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={open => !open && closeDialog()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto pt-2 pr-1">
                        <div className="space-y-1.5">
                            <Label>Vendor Name <span className="text-destructive">*</span></Label>
                            <Input {...register("name")} placeholder="e.g. Acme Supplies Ltd" />
                            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label>Contact Person</Label>
                            <Input {...register("contact_person")} placeholder="e.g. Kwame Mensah" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Email</Label>
                                <Input {...register("email")} placeholder="vendor@example.com" />
                                {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label>Phone</Label>
                                <Input {...register("phone")} placeholder="+233…" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Address</Label>
                            <Input {...register("address")} placeholder="Street, city" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Tax ID</Label>
                                <Input {...register("tax_id")} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Payment Terms</Label>
                                <Input {...register("payment_terms")} placeholder="e.g. Net 30" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Notes</Label>
                            <Textarea {...register("notes")} className="min-h-[70px] resize-none" />
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
        </div>
    );
}
