/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import {
    Plus, MoreHorizontal, Pencil, Trash2, Search, RefreshCcw,
    Barcode, Package, Tag, Layers, FilterX, DollarSign,
    Percent, CheckCircle, XCircle, TrendingUp, TrendingDown,
    Eye, Calendar, Clock, Building2, AlertTriangle,
    ImagePlus, X, Loader2, ImageOff, Boxes,
} from 'lucide-react';
import {
    GetProducts, CreateProduct, UpdateProdctDetails, DeleteProduct, uploadProductImage,
    GenerateProductBarcode, GetProductBarcodeSvgUrl,
} from '@/(api-handlers)/productsHandler';
import { GetVendors } from '@/(api-handlers)/vendorsHandler';
import { VendorResponse } from '@/interfaces/vendors';
import { useRouter } from 'next/navigation';
import { GetProductCategories } from '@/(api-handlers)/productCategoriesHandler';
import { getOrganizationShops } from '@/(api-handlers)/organizationShopsHandler';
import { useAuthStore } from '@/(zustand-store)/authStore';
import { ProductResponse, ProductRequest } from '@/interfaces/products';
import { ProductCategoriesResponse } from '@/interfaces/productCategories';
import { OrganizationShopResponse } from '@/interfaces/organizationShops';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import { toast } from 'sonner';
import PageHeader from '@/components/(shared-components)/PageHeader';
import { StatusPill } from '@/components/(shared-components)/StatusPill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useCurrency, useOrgCurrency } from '@/hooks/useCurrency';

interface ProductFormValues {
    name: string;
    description: string;
    category_id: string;
    brand: string;
    sku: string;
    barcode: string;
    cost_price: string;
    selling_price: string;
    tax_rate: string;
    is_taxable: boolean;
    is_active: boolean;
    default_vendor_id: string;
    track_serial: boolean;
    track_batch: boolean;
}

function marginColor(pct: number) {
    if (pct >= 30) return 'text-success';
    if (pct >= 15) return 'text-warning-foreground';
    return 'text-destructive';
}

function marginBarClass(pct: number) {
    if (pct >= 30) return 'bg-success';
    if (pct >= 15) return 'bg-warning';
    return 'bg-destructive';
}

function calcMarkup(cost: number, selling: number) {
    if (cost > 0 && selling > 0) return ((selling - cost) / cost * 100);
    return 0;
}

export default function ProductsPage() {
    const fmt = useCurrency();
    const orgCurrency = useOrgCurrency();
    const router = useRouter();
    const [products, setProducts] = useState<ProductResponse[]>([]);
    const [categories, setCategories] = useState<ProductCategoriesResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductResponse | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [viewingProduct, setViewingProduct] = useState<ProductResponse | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProductResponse | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [imageUrl, setImageUrl] = useState<string>('');
    const [imageUploading, setImageUploading] = useState(false);
    const [imageDragOver, setImageDragOver] = useState(false);

    const { user } = useAuthStore();
    const [shops, setShops] = useState<OrganizationShopResponse[]>([]);
    const [selectedShopId, setSelectedShopId] = useState('all');
    const [vendors, setVendors] = useState<VendorResponse[]>([]);
    const [barcodeSvg, setBarcodeSvg] = useState<string>('');
    const [generatingBarcode, setGeneratingBarcode] = useState(false);
    const isAdmin = ['admin', 'superadmin'].includes((user?.role ?? '').toLowerCase());
    const isManagerPlus = isAdmin || (user?.role ?? '').toLowerCase() === 'manager';

    const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<ProductFormValues>({
        defaultValues: { is_active: true, is_taxable: true, tax_rate: '0', default_vendor_id: '', track_serial: false, track_batch: false },
    });
    const costPrice = watch('cost_price');
    const sellingPrice = watch('selling_price');
    const markup = calcMarkup(Number(costPrice || 0), Number(sellingPrice || 0));

    useEffect(() => {
        if (!isAdmin) return;
        getOrganizationShops().then(setShops).catch(console.error);
    }, [isAdmin]);

    useEffect(() => {
        if (!isManagerPlus) return;
        GetVendors({ is_active: true, limit: 200 }).then((r) => setVendors(r.items)).catch(() => { });
    }, [isManagerPlus]);

    // Load the barcode preview whenever the edit dialog opens on a product that has one.
    useEffect(() => {
        let revoked = '';
        setBarcodeSvg('');
        if (isModalOpen && editingProduct?.barcode) {
            GetProductBarcodeSvgUrl(editingProduct.id)
                .then((url) => { revoked = url; setBarcodeSvg(url); })
                .catch(() => { });
        }
        return () => { if (revoked) URL.revokeObjectURL(revoked); };
    }, [isModalOpen, editingProduct]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const shopId = selectedShopId === 'all' ? undefined : Number(selectedShopId);
            const [prods, cats] = await Promise.all([GetProducts(shopId), GetProductCategories()]);
            setProducts(prods);
            setCategories(cats);
        } catch (error) {
            handleErrorMessage(error, 'Failed to load products');
        } finally {
            setLoading(false);
        }
    }, [selectedShopId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openModal = (product: ProductResponse | null = null) => {
        setEditingProduct(product);
        setImageUrl(product?.image_url ?? '');
        if (product) {
            reset({
                name: product.name,
                description: product.description ?? '',
                category_id: product.category_id.toString(),
                brand: product.brand ?? '',
                sku: product.sku ?? '',
                barcode: product.barcode ?? '',
                cost_price: product.cost_price.toString(),
                selling_price: product.selling_price.toString(),
                tax_rate: product.tax_rate?.toString() ?? '0',
                is_taxable: product.is_taxable,
                is_active: product.is_active,
                default_vendor_id: product.default_vendor_id ? String(product.default_vendor_id) : '',
                track_serial: product.track_serial ?? false,
                track_batch: product.track_batch ?? false,
            });
        } else {
            reset({
                is_active: true, is_taxable: true, tax_rate: '0',
                default_vendor_id: '', track_serial: false, track_batch: false,
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
        setImageUrl('');
        reset();
    };

    const handleImageFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be smaller than 5 MB');
            return;
        }
        setImageUploading(true);
        try {
            const { image_url } = await uploadProductImage(file);
            setImageUrl(image_url);
        } catch {
            toast.error('Image upload failed — please try again');
        } finally {
            setImageUploading(false);
        }
    };

    const handleGenerateBarcode = async () => {
        if (!editingProduct) return;
        setGeneratingBarcode(true);
        try {
            const overwrite = !!editingProduct.barcode;
            const updated = await GenerateProductBarcode(editingProduct.id, overwrite);
            setValue('barcode', updated.barcode);
            setEditingProduct(updated);
            const url = await GetProductBarcodeSvgUrl(updated.id).catch(() => '');
            setBarcodeSvg(url);
            toast.success('Barcode generated');
            fetchData();
        } catch (error) {
            handleErrorMessage(error, 'Failed to generate barcode');
        } finally {
            setGeneratingBarcode(false);
        }
    };

    const onSubmit = async (values: ProductFormValues) => {
        setSubmitting(true);
        try {
            const productData: ProductRequest = {
                name: values.name,
                description: values.description,
                category_id: Number(values.category_id),
                brand: values.brand,
                sku: values.sku,
                barcode: values.barcode,
                cost_price: Number(values.cost_price),
                selling_price: Number(values.selling_price),
                markup_percentage: parseFloat(markup.toFixed(2)),
                tax_rate: Number(values.tax_rate || 0),
                is_taxable: values.is_taxable,
                is_active: values.is_active,
                image_url: imageUrl || undefined,
                default_vendor_id: values.default_vendor_id ? Number(values.default_vendor_id) : null,
                track_serial: values.track_serial,
                track_batch: values.track_batch,
            };
            if (editingProduct) {
                await UpdateProdctDetails(editingProduct.id, productData);
                toast.success('Product updated');
            } else {
                await CreateProduct(productData);
                toast.success('Product created');
            }
            closeModal();
            fetchData();
        } catch (error) {
            handleErrorMessage(error, editingProduct ? 'Failed to update product' : 'Failed to create product');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await DeleteProduct(deleteTarget.id);
            toast.success('Product deleted');
            setDeleteTarget(null);
            fetchData();
        } catch (error) {
            handleErrorMessage(error, 'Failed to delete product');
        } finally {
            setDeleting(false);
        }
    };

    const getCategoryName = (id: number) => categories.find(c => c.id === id)?.name ?? 'Uncategorised';

    const filtered = products.filter(p => {
        const ms = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
        const mc = selectedCategory === 'all' || p.category_id.toString() === selectedCategory;
        return ms && mc;
    });

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Products"
                description="Manage your catalogue, prices, and stock visibility."
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} aria-label="Refresh products">
                            <RefreshCcw className={cn('size-4', loading && 'animate-spin')} />
                        </Button>
                        <Button onClick={() => openModal()}>
                            <Plus data-icon="inline-start" /> Add Product
                        </Button>
                    </div>
                }
            />

            {/* Filters */}
            <div className="border-border bg-card flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:px-6">
                <div className="relative flex-1">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        placeholder="Search by name, SKU, barcode…"
                        className="h-9 pl-9"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="h-9 w-[180px]">
                            <div className="flex items-center gap-2">
                                <Layers className="text-muted-foreground size-3.5" />
                                <SelectValue placeholder="All categories" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All categories</SelectItem>
                            {categories.map(c => (
                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {isAdmin && (
                        <Select value={selectedShopId} onValueChange={setSelectedShopId}>
                            <SelectTrigger className="h-9 w-[160px]">
                                <div className="flex items-center gap-2">
                                    <Building2 className="text-muted-foreground size-3.5" />
                                    <SelectValue placeholder="All shops" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All shops</SelectItem>
                                {shops.map(s => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {(searchTerm !== '' || selectedCategory !== 'all') && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 text-muted-foreground"
                            onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}
                        >
                            <FilterX className="mr-1.5 size-3.5" /> Reset
                        </Button>
                    )}
                </div>
            </div>

            {/* Product grid */}
            {loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="bg-card rounded-2xl border overflow-hidden">
                            <Skeleton className="h-44 w-full rounded-none" />
                            <div className="p-4 space-y-3">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                                <Skeleton className="h-6 w-1/3" />
                                <Skeleton className="h-1.5 w-full rounded-full" />
                                <div className="flex gap-2 pt-1">
                                    <Skeleton className="h-8 flex-1 rounded-lg" />
                                    <Skeleton className="h-8 flex-1 rounded-lg" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-card flex flex-col items-center justify-center rounded-2xl border py-24">
                    <div className="bg-muted mb-6 flex size-16 items-center justify-center rounded-full">
                        <Package className="text-muted-foreground size-8" />
                    </div>
                    <p className="text-foreground text-lg font-semibold">No products found</p>
                    <p className="text-muted-foreground mt-1 text-sm">Try adjusting your filters or add a new product.</p>
                    <Button className="mt-6" onClick={() => openModal()}>
                        <Plus className="mr-2 size-4" /> Add first product
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filtered.map(product => {
                        const mp = product.markup_percentage ?? 0;
                        const profit = product.selling_price - product.cost_price;
                        const PLACEHOLDER_GRADIENTS = [
                            'from-brand-700 to-brand-500',
                            'from-info to-brand-600',
                            'from-brand-800 to-info',
                            'from-brand-600 to-brand-400',
                            'from-info/80 to-brand-700',
                            'from-brand-500 to-brand-800',
                        ];
                        const gradientIdx = Math.abs(
                            Array.from(product.name).reduce((acc, c) => c.codePointAt(0)! + ((acc << 5) - acc), 0)
                        ) % PLACEHOLDER_GRADIENTS.length;
                        const placeholderGradient = product.is_active
                            ? PLACEHOLDER_GRADIENTS[gradientIdx]
                            : 'from-muted to-muted/60';
                        return (
                            <div
                                key={product.id}
                                className="bg-card group rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                            >
                                {/* ── Image / placeholder hero ── */}
                                <div className="relative h-44 w-full overflow-hidden">
                                    {product.image_url ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                        </>
                                    ) : (
                                        <div className={cn(
                                            'h-full w-full bg-gradient-to-br flex flex-col items-center justify-center text-white',
                                            placeholderGradient,
                                        )}>
                                            <Package className="mb-1.5 size-9 opacity-85" />
                                            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium opacity-95 backdrop-blur-sm">
                                                {getCategoryName(product.category_id)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Status badge — top left */}
                                    <div className="absolute top-2.5 left-2.5">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                'rounded-full text-[10px] font-semibold backdrop-blur-sm',
                                                product.is_active
                                                    ? 'border-success/40 bg-success/20 text-success'
                                                    : 'border-border/60 bg-background/60 text-muted-foreground',
                                            )}
                                        >
                                            {product.is_active ? 'Active' : 'Archived'}
                                        </Badge>
                                    </div>

                                    {/* Actions menu — top right */}
                                    <div className="absolute top-2 right-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7 rounded-lg bg-background/70 backdrop-blur-sm hover:bg-background/90 border border-border/40"
                                                    aria-label="Product actions"
                                                >
                                                    <MoreHorizontal className="size-3.5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-36">
                                                <DropdownMenuItem className="text-xs" onClick={() => openModal(product)}>
                                                    <Pencil className="size-3.5" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-xs text-destructive focus:text-destructive"
                                                    onClick={() => setDeleteTarget(product)}
                                                >
                                                    <Trash2 className="size-3.5" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                </div>

                                {/* ── Card body ── */}
                                <div className="p-4 space-y-3.5">
                                    {/* Name + category — always in the body */}
                                    <div>
                                        <p className="text-foreground text-sm font-semibold leading-tight line-clamp-1">{product.name}</p>
                                        <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px]">
                                            <Tag className="size-3" /> {getCategoryName(product.category_id)}
                                        </p>
                                    </div>

                                    {/* SKU row */}
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span className="font-mono truncate max-w-[90px]" title={product.sku}>{product.sku || 'No SKU'}</span>
                                        <span className="flex items-center gap-1">
                                            <Barcode className="size-3" />
                                            <span className="truncate max-w-[70px]">{product.barcode || '—'}</span>
                                        </span>
                                    </div>

                                    {/* Prices */}
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground mb-0.5">Selling price</p>
                                            <p className="text-foreground num-tabular text-lg font-bold leading-none">
                                                {fmt(product.selling_price)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-muted-foreground mb-0.5">Cost</p>
                                            <p className="text-muted-foreground num-tabular text-xs font-medium">
                                                {fmt(product.cost_price)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Margin bar */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className={cn('font-semibold', marginColor(mp))}>
                                                {mp.toFixed(1)}% margin
                                            </span>
                                            <span className={cn('flex items-center gap-1 font-medium', profit >= 0 ? 'text-success' : 'text-destructive')}>
                                                {profit >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                                                {fmt(Math.abs(profit))} profit
                                            </span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={cn('h-full rounded-full transition-all duration-500', marginBarClass(mp))}
                                                style={{ width: `${Math.min(mp, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Stock + tax chips */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={cn(
                                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                            (product.stock_quantity ?? 0) === 0
                                                ? 'bg-destructive/10 text-destructive'
                                                : (product.stock_quantity ?? 0) <= 5
                                                    ? 'bg-warning/10 text-warning-foreground'
                                                    : 'bg-muted text-muted-foreground',
                                        )}>
                                            <Package className="size-2.5" />
                                            {(product.stock_quantity ?? 0) === 0 ? 'Out of stock' : `${product.stock_quantity} in stock`}
                                        </span>
                                        {product.is_taxable && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
                                                <Percent className="size-2.5" /> {product.tax_rate}% tax
                                            </span>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-0.5">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 flex-1 text-xs"
                                            onClick={() => setViewingProduct(product)}
                                        >
                                            <Eye className="size-3.5" /> Details
                                        </Button>
                                        {!product.inventory ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 flex-1 text-xs border-success/40 text-success hover:bg-success/10"
                                                onClick={() => router.push(`/inventory/create?product_id=${product.id}`)}
                                            >
                                                <Boxes className="size-3.5" /> Stock
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 flex-1 text-xs"
                                                onClick={() => openModal(product)}
                                            >
                                                <Pencil className="size-3.5" /> Edit
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit modal */}
            <Dialog open={isModalOpen} onOpenChange={open => !open && closeModal()}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="bg-primary/10 mb-1 inline-flex size-10 items-center justify-center rounded-xl">
                            {editingProduct ? <Pencil className="text-primary size-5" /> : <Plus className="text-primary size-5" />}
                        </div>
                        <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">

                        {/* Image upload */}
                        <div className="space-y-2">
                            <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                                <ImagePlus className="size-3.5" /> Product image
                            </p>
                            {imageUrl ? (
                                <div className="relative w-full h-44 rounded-xl overflow-hidden border group">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={imageUrl} alt="Product" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <label className="cursor-pointer rounded-lg bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-background transition-colors">
                                            Change image
                                            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                                                onChange={e => e.target.files?.[0] && handleImageFile(e.target.files[0])} />
                                        </label>
                                        <button type="button" onClick={() => setImageUrl('')}
                                            className="rounded-lg bg-destructive/90 p-1.5 text-white hover:bg-destructive transition-colors" aria-label="Remove image">
                                            <X className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <label
                                    className={cn(
                                        'flex h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors',
                                        imageDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30',
                                        imageUploading && 'pointer-events-none opacity-60',
                                    )}
                                    onDragOver={e => { e.preventDefault(); setImageDragOver(true); }}
                                    onDragLeave={() => setImageDragOver(false)}
                                    onDrop={e => {
                                        e.preventDefault();
                                        setImageDragOver(false);
                                        const file = e.dataTransfer.files[0];
                                        if (file) handleImageFile(file);
                                    }}
                                >
                                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                                        onChange={e => e.target.files?.[0] && handleImageFile(e.target.files[0])} />
                                    {imageUploading ? (
                                        <>
                                            <Loader2 className="size-6 text-primary animate-spin" />
                                            <p className="text-xs text-muted-foreground">Uploading…</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
                                                <ImagePlus className="size-5 text-muted-foreground" />
                                            </div>
                                            <p className="text-sm font-medium text-foreground">Drop image here or click to browse</p>
                                            <p className="text-xs text-muted-foreground">JPEG, PNG or WebP · max 5 MB</p>
                                        </>
                                    )}
                                </label>
                            )}
                        </div>

                        {/* Basic info */}
                        <div className="space-y-4">
                            <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                                <Package className="size-3.5" /> Basic information
                            </p>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2 space-y-1.5">
                                    <Label>Product name <span className="text-destructive">*</span></Label>
                                    <Input
                                        className={cn('h-9', errors.name && 'border-destructive')}
                                        placeholder="e.g., Wireless Headphones"
                                        {...register('name', { required: true })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Category <span className="text-destructive">*</span></Label>
                                    <Controller
                                        control={control}
                                        name="category_id"
                                        rules={{ required: true }}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className={cn('h-9', errors.category_id && 'border-destructive')}>
                                                    <SelectValue placeholder="Select" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.map(c => (
                                                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Description</Label>
                                <Textarea className="resize-none" rows={3} placeholder="Product description…" {...register('description')} />
                            </div>
                        </div>

                        {/* Identification */}
                        <div className="space-y-4">
                            <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                                <Barcode className="size-3.5" /> Identification
                            </p>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Brand</Label>
                                    <Input className="h-9" placeholder="e.g., Sony" {...register('brand')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>SKU</Label>
                                    <Input className="h-9 font-mono" placeholder="SKU-12345" {...register('sku')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Barcode</Label>
                                    <Input className="h-9 font-mono" placeholder="EAN / UPC" {...register('barcode')} />
                                </div>
                            </div>

                            {editingProduct && (
                                <div className="bg-muted/40 flex flex-wrap items-center gap-4 rounded-xl border p-4">
                                    <div className="bg-background flex h-16 min-w-[160px] items-center justify-center rounded-lg border px-3">
                                        {barcodeSvg ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={barcodeSvg} alt="Barcode" className="max-h-14" />
                                        ) : (
                                            <span className="text-muted-foreground text-xs">No barcode</span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-foreground text-sm font-semibold">Barcode label</p>
                                        <p className="text-muted-foreground text-xs">
                                            Generate a unique EAN-13, or type your manufacturer barcode above.
                                        </p>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={handleGenerateBarcode} disabled={generatingBarcode}>
                                        {generatingBarcode
                                            ? <Loader2 className="mr-1.5 size-4 animate-spin" />
                                            : <Barcode className="mr-1.5 size-4" />}
                                        {editingProduct.barcode ? 'Regenerate' : 'Generate'}
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Supply & tracking */}
                        <div className="space-y-4">
                            <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                                <Boxes className="size-3.5" /> Supply & tracking
                            </p>
                            <div className="space-y-1.5">
                                <Label>Default vendor <span className="text-muted-foreground text-xs">(for auto-reorder)</span></Label>
                                <Controller
                                    control={control}
                                    name="default_vendor_id"
                                    render={({ field }) => (
                                        <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="No default vendor" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No default vendor</SelectItem>
                                                {vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted/40 flex items-center justify-between rounded-xl border p-4">
                                    <div>
                                        <p className="text-foreground text-sm font-semibold">Serial tracking</p>
                                        <p className="text-muted-foreground text-xs">Capture a serial per unit at sale</p>
                                    </div>
                                    <Controller control={control} name="track_serial"
                                        render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
                                </div>
                                <div className="bg-muted/40 flex items-center justify-between rounded-xl border p-4">
                                    <div>
                                        <p className="text-foreground text-sm font-semibold">Batch / expiry</p>
                                        <p className="text-muted-foreground text-xs">Deduct stock FEFO from batches</p>
                                    </div>
                                    <Controller control={control} name="track_batch"
                                        render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
                                </div>
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="space-y-4">
                            <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                                <DollarSign className="size-3.5" /> Pricing & tax
                            </p>
                            <div className="grid grid-cols-4 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Cost price ({orgCurrency}) <span className="text-destructive">*</span></Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className={cn('h-9', errors.cost_price && 'border-destructive')}
                                        placeholder="0.00"
                                        {...register('cost_price', { required: true })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Selling price ({orgCurrency}) <span className="text-destructive">*</span></Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className={cn('h-9', errors.selling_price && 'border-destructive')}
                                        placeholder="0.00"
                                        {...register('selling_price', { required: true })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Markup % (auto)</Label>
                                    <Input
                                        className="h-9 bg-muted"
                                        readOnly
                                        value={`${markup.toFixed(2)}%`}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Tax rate %</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        className="h-9"
                                        placeholder="0"
                                        {...register('tax_rate')}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Toggles */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/40 flex items-center justify-between rounded-xl border p-4">
                                <div>
                                    <p className="text-foreground text-sm font-semibold">Taxable</p>
                                    <p className="text-muted-foreground text-xs">Apply tax rate at sale</p>
                                </div>
                                <Controller
                                    control={control}
                                    name="is_taxable"
                                    render={({ field }) => (
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    )}
                                />
                            </div>
                            <div className="bg-muted/40 flex items-center justify-between rounded-xl border p-4">
                                <div>
                                    <p className="text-foreground text-sm font-semibold">Active</p>
                                    <p className="text-muted-foreground text-xs">Visible in POS</p>
                                </div>
                                <Controller
                                    control={control}
                                    name="is_active"
                                    render={({ field }) => (
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    )}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? (editingProduct ? 'Updating…' : 'Creating…') : (editingProduct ? 'Update Product' : 'Create Product')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Product details modal */}
            <Dialog open={!!viewingProduct} onOpenChange={open => !open && setViewingProduct(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    {viewingProduct && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
                                        <Package className="text-primary size-5" />
                                    </div>
                                    <div>
                                        <DialogTitle className="flex items-center gap-2">
                                            {viewingProduct.name}
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    'rounded-full text-[10px]',
                                                    viewingProduct.is_active
                                                        ? 'border-success/30 bg-success/10 text-success'
                                                        : 'border-border bg-muted text-muted-foreground',
                                                )}
                                            >
                                                {viewingProduct.is_active ? 'Active' : 'Archived'}
                                            </Badge>
                                        </DialogTitle>
                                        <p className="text-muted-foreground flex items-center gap-3 text-xs mt-0.5">
                                            <span className="flex items-center gap-1"><Tag className="size-3" />{getCategoryName(viewingProduct.category_id)}</span>
                                            <span className="flex items-center gap-1"><Building2 className="size-3" />{viewingProduct.brand || 'No brand'}</span>
                                        </p>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="space-y-5 pt-2">
                                {/* Product image */}
                                {viewingProduct.image_url ? (
                                    <div className="h-52 w-full rounded-xl overflow-hidden border bg-muted">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={viewingProduct.image_url} alt={viewingProduct.name} className="h-full w-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="h-32 w-full rounded-xl bg-muted/50 border flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <ImageOff className="size-8" />
                                            <p className="text-xs">No image uploaded</p>
                                        </div>
                                    </div>
                                )}

                                {/* Price stats */}
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Selling price', value: fmt(viewingProduct.selling_price), cls: '' },
                                        { label: 'Cost price', value: fmt(viewingProduct.cost_price), cls: '' },
                                        {
                                            label: 'Profit',
                                            value: fmt(viewingProduct.selling_price - viewingProduct.cost_price),
                                            cls: (viewingProduct.selling_price - viewingProduct.cost_price) >= 0 ? 'text-success' : 'text-destructive',
                                        },
                                    ].map(s => (
                                        <div key={s.label} className="bg-muted/50 rounded-lg p-3">
                                            <p className="text-muted-foreground text-xs">{s.label}</p>
                                            <p className={cn('num-tabular text-base font-bold mt-1', s.cls)}>{s.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Margin bar */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Gross margin</span>
                                        <span className={cn('font-medium', marginColor(viewingProduct.markup_percentage ?? 0))}>
                                            {(viewingProduct.markup_percentage ?? 0).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                                        <div
                                            className={cn('h-full transition-all', marginBarClass(viewingProduct.markup_percentage ?? 0))}
                                            style={{ width: `${Math.min(viewingProduct.markup_percentage ?? 0, 100)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Details grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: 'SKU', value: viewingProduct.sku || '—', mono: true },
                                        { label: 'Barcode', value: viewingProduct.barcode || '—', mono: true },
                                        { label: 'Tax rate', value: `${viewingProduct.tax_rate ?? 0}%` },
                                        { label: 'Tax status', value: viewingProduct.is_taxable ? 'Taxable' : 'Non-taxable' },
                                    ].map(d => (
                                        <div key={d.label} className="border-border rounded-lg border p-3">
                                            <p className="text-muted-foreground text-xs">{d.label}</p>
                                            <p className={cn('text-foreground mt-0.5 text-sm font-medium', d.mono && 'font-mono')}>{d.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Description */}
                                {viewingProduct.description && (
                                    <div className="border-border rounded-lg border p-3">
                                        <p className="text-muted-foreground text-xs">Description</p>
                                        <p className="text-foreground mt-0.5 text-sm">{viewingProduct.description}</p>
                                    </div>
                                )}

                                {/* Timestamps */}
                                <div className="bg-muted/40 flex items-center justify-between rounded-lg px-4 py-2 text-xs">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Calendar className="size-3.5" /> Created {new Date(viewingProduct.created_at).toLocaleDateString()}
                                    </span>
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Clock className="size-3.5" /> Updated {new Date(viewingProduct.updated_at).toLocaleDateString()}
                                    </span>
                                </div>

                                {/* Inventory section */}
                                {viewingProduct.inventory && (
                                    <div className="border-border space-y-4 border-t pt-4">
                                        <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
                                            <Package className="text-primary size-4" /> Inventory & stock levels
                                        </p>
                                        <div className="grid grid-cols-4 gap-3">
                                            {[
                                                { label: 'Current stock', value: `${viewingProduct.inventory.current_stock}`, unit: viewingProduct.inventory.unit_of_measurement || 'units', cls: 'border-success/20 bg-success/10 text-success' },
                                                { label: 'Min level', value: `${viewingProduct.inventory.minimum_stock}`, cls: 'border-warning/20 bg-warning/10 text-warning-foreground' },
                                                { label: 'Reorder point', value: `${viewingProduct.inventory.reorder_point}`, cls: 'border-info/20 bg-info/10 text-info' },
                                                { label: 'Max capacity', value: `${viewingProduct.inventory.maximum_stock || '—'}`, cls: 'border-border bg-muted text-muted-foreground' },
                                            ].map(s => (
                                                <div key={s.label} className={cn('rounded-xl border p-3', s.cls)}>
                                                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{s.label}</p>
                                                    <p className="mt-1 text-xl font-bold">{s.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-muted/40 grid grid-cols-2 gap-4 rounded-xl border p-4">
                                            <div>
                                                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Storage location</p>
                                                <div className="mt-1.5 flex gap-2">
                                                    <span className="bg-card text-foreground rounded border px-2 py-0.5 text-xs font-medium">
                                                        Aisle {viewingProduct.inventory.aisle || 'N/A'}
                                                    </span>
                                                    <span className="bg-card text-foreground rounded border px-2 py-0.5 text-xs font-medium">
                                                        Shelf {viewingProduct.inventory.shelf || 'N/A'}
                                                    </span>
                                                </div>
                                                <p className="text-muted-foreground mt-2 text-xs">{viewingProduct.inventory.bin_location || 'No bin location'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Unit of measure</p>
                                                <p className="text-foreground mt-1.5 text-sm font-semibold">{viewingProduct.inventory.unit_of_measurement || 'Units'}</p>
                                                <p className="text-muted-foreground mt-2 text-[10px] font-semibold uppercase tracking-wider">Last restocked</p>
                                                <p className="text-foreground mt-1 text-sm font-semibold">
                                                    {viewingProduct.inventory.last_restocked
                                                        ? new Date(viewingProduct.inventory.last_restocked).toLocaleDateString()
                                                        : 'Never'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setViewingProduct(null)}>Close</Button>
                                <Button onClick={() => { setViewingProduct(null); openModal(viewingProduct); }}>
                                    <Pencil className="mr-1.5 size-4" /> Edit
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <div className="bg-destructive/10 mx-auto mb-2 flex size-12 items-center justify-center rounded-full">
                            <AlertTriangle className="text-destructive size-6" />
                        </div>
                        <AlertDialogTitle>Delete product?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>{deleteTarget?.name}</strong> will be permanently removed. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
