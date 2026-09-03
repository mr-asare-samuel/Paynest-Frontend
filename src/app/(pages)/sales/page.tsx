"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    Banknote,
    ChevronRight,
    CreditCard,
    Receipt,
    ScanBarcode,
    Search,
    ShoppingBag,
    Sparkles,
    Trash2,
    Wallet,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GetProducts } from "@/(api-handlers)/productsHandler";
import { GetProductCategories } from "@/(api-handlers)/productCategoriesHandler";
import { GetBundles } from "@/(api-handlers)/bundlesHandler";
import { ProductResponse } from "@/interfaces/products";
import { ProductCategoriesResponse } from "@/interfaces/productCategories";
import { BundleResponse } from "@/interfaces/bundles";
import {
    useSalesStore, type CartItemData, bundleCartKey, cartUnitPrice,
} from "@/(zustand-store)/salesStore";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import { CategoryItem } from "./components/CategoryItem";
import { ProductCard } from "./components/ProductCard";
import { CartItem } from "./components/CartItem";
import { SalesCompletionModal } from "./components/SalesCompletionModal";
import { BarcodeScannerModal } from "./components/BarcodeScannerModal";

const PAYMENT_METHODS = [
    { id: "cash", label: "Cash", icon: Banknote },
    { id: "mobile transfer", label: "Mobile", icon: Wallet },
    { id: "bank transfer", label: "Card", icon: CreditCard },
] as const;

const CART_WIDTH = 440;

export default function SalesPage() {
    const fmt = useCurrency();
    const [products, setProducts] = useState<ProductResponse[]>([]);
    const [categories, setCategories] = useState<ProductCategoriesResponse[]>(
        [],
    );
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | "all">(
        "all",
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [bundles, setBundles] = useState<BundleResponse[]>([]);
    const [catalogMode, setCatalogMode] = useState<"products" | "bundles">("products");

    const {
        cart,
        isOrderMode,
        toggleOrderMode,
        updateCartQuantity,
        removeFromCart,
        addToCart,
        addBundleToCart,
        paymentMethod,
        setPaymentMethod,
        clearCart,
    } = useSalesStore();

    const cartItems = Object.values(cart);
    const itemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
    const subTotal = cartItems.reduce(
        (acc, item) => acc + cartUnitPrice(item) * item.quantity,
        0,
    );
    const tax = subTotal * 0.04;
    const total = subTotal + tax;

    const prevItemCount = useRef(itemCount);

    useEffect(() => {
        if (prevItemCount.current === 0 && itemCount > 0) {
            setIsCartOpen(true);
        }
        prevItemCount.current = itemCount;
    }, [itemCount]);

    useEffect(() => {
        async function fetchData() {
            try {
                const [productsData, categoriesData, bundlesData] = await Promise.all([
                    GetProducts(),
                    GetProductCategories(),
                    GetBundles().catch(() => []),
                ]);
                setProducts(productsData);
                setCategories(categoriesData);
                setBundles(bundlesData.filter((b) => b.is_active));
            } catch (error) {
                console.error("Failed to fetch data:", error);
                toast.error("Failed to load products and categories");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Lock body scroll and close on Escape while cart is open on mobile
    useEffect(() => {
        if (!isCartOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsCartOpen(false);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isCartOpen]);

    // Ctrl+B / ⌘+B — toggle barcode scanner
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "b") {
                e.preventDefault();
                setIsScannerOpen((prev) => !prev);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            const matchesCategory =
                selectedCategoryId === "all" ||
                product.category_id === selectedCategoryId;
            const matchesSearch = product.name
                .toLowerCase()
                .includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [products, selectedCategoryId, searchQuery]);

    const sectionTitle =
        selectedCategoryId === "all"
            ? "All Products"
            : categories.find((c) => c.id === selectedCategoryId)?.name;

    return (
        <div
            className="-m-4 lg:-m-6 relative flex min-h-[calc(100svh-3.5rem)] flex-col"
            style={
                {
                    "--cart-w": `${CART_WIDTH}px`,
                } as React.CSSProperties
            }
        >
            {/* Main (products) — cart drawer overlays, does not push */}
            <div className="flex min-w-0 flex-1 flex-col">
                {/* Sticky toolbar (below the h-14 app bar) */}
                <div className="bg-background/85 supports-[backdrop-filter]:bg-background/70 border-border sticky top-14 z-30 border-b backdrop-blur">
                    <div className="flex flex-col gap-3 px-4 py-3 lg:px-6 lg:py-4">
                        {/* Row: search + scan + cart toggle */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search products, SKU, barcode…"
                                    className="h-11 pr-9 pl-9 text-sm shadow-xs"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                                        aria-label="Clear search"
                                    >
                                        <X className="size-4" />
                                    </button>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-11 shrink-0"
                                onClick={() => setIsScannerOpen(true)}
                                title="Scan barcode"
                                aria-label="Scan barcode"
                            >
                                <ScanBarcode />
                            </Button>
                            <Button
                                variant={isCartOpen ? "secondary" : "default"}
                                className="h-11 shrink-0 px-3 sm:px-4"
                                onClick={() => setIsCartOpen(!isCartOpen)}
                                aria-expanded={isCartOpen}
                                aria-controls="sales-cart"
                            >
                                <ShoppingBag data-icon="inline-start" />
                                <span className="hidden sm:inline">
                                    {isCartOpen ? "Hide cart" : "View cart"}
                                </span>
                                {itemCount > 0 && (
                                    <span
                                        className={cn(
                                            "num-tabular ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                                            isCartOpen
                                                ? "bg-foreground text-background"
                                                : "bg-primary-foreground text-primary",
                                        )}
                                    >
                                        {itemCount}
                                    </span>
                                )}
                            </Button>
                        </div>

                        {/* Category rail with fade edges */}
                        <div className="relative -mx-1">
                            <div className="flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                <CategoryItem
                                    id="all"
                                    name="All Items"
                                    icon="LayoutGrid"
                                    count={products.length}
                                    isSelected={selectedCategoryId === "all"}
                                    onClick={() => setSelectedCategoryId("all")}
                                />
                                {categories.map((cat) => (
                                    <CategoryItem
                                        key={cat.id}
                                        id={cat.id}
                                        name={cat.name}
                                        count={
                                            products.filter(
                                                (p) => p.category_id === cat.id,
                                            ).length
                                        }
                                        isSelected={selectedCategoryId === cat.id}
                                        onClick={(id) =>
                                            setSelectedCategoryId(id as number)
                                        }
                                    />
                                ))}
                            </div>
                            <div className="from-background pointer-events-none absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-l to-transparent" />
                        </div>
                    </div>
                </div>

                {/* Section title */}
                <div className="flex items-end justify-between gap-4 px-4 pt-5 pb-3 lg:px-6 lg:pt-6 lg:pb-4">
                    <div className="min-w-0">
                        <h2 className="text-foreground truncate text-xl font-semibold tracking-tight">
                            {catalogMode === "bundles" ? "Bundles" : sectionTitle}
                        </h2>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                            {catalogMode === "bundles"
                                ? `${bundles.length} ${bundles.length === 1 ? "bundle" : "bundles"}`
                                : `${filteredProducts.length} ${filteredProducts.length === 1 ? "item" : "items"} available`}
                            {catalogMode === "products" && searchQuery && (
                                <>
                                    {" · "}
                                    <span className="text-foreground font-medium">
                                        “{searchQuery}”
                                    </span>
                                </>
                            )}
                        </p>
                    </div>
                    {bundles.length > 0 && (
                        <ToggleGroup
                            type="single"
                            value={catalogMode}
                            onValueChange={(v) => v && setCatalogMode(v as "products" | "bundles")}
                            variant="outline"
                            size="sm"
                        >
                            <ToggleGroupItem value="products">Products</ToggleGroupItem>
                            <ToggleGroupItem value="bundles">
                                <Sparkles className="mr-1 size-3.5" /> Bundles
                            </ToggleGroupItem>
                        </ToggleGroup>
                    )}
                </div>

                {/* Product / bundle grid */}
                <div className="flex-1 px-4 pb-10 lg:px-6 lg:pb-12">
                    {isLoading ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <Skeleton key={i} className="h-60 rounded-2xl" />
                            ))}
                        </div>
                    ) : catalogMode === "bundles" ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                            {bundles.map((b) => {
                                const qty = cart[bundleCartKey(b.id)]?.quantity || 0;
                                return (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => addBundleToCart(b)}
                                        className={cn(
                                            "group border-border hover:border-primary/50 relative flex flex-col rounded-2xl border p-4 text-left transition-all",
                                            qty > 0 && "border-primary bg-primary/5",
                                        )}
                                    >
                                        <span className="bg-primary/10 text-primary mb-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                                            <Sparkles className="size-3" /> BUNDLE
                                        </span>
                                        <span className="text-foreground line-clamp-2 text-sm font-semibold">{b.name}</span>
                                        <span className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                                            {b.items.map((i) => `${i.quantity}× ${i.product_name ?? ""}`).join(", ")}
                                        </span>
                                        <span className="text-primary mt-auto pt-3 text-lg font-bold">{fmt(b.bundle_price)}</span>
                                        {qty > 0 && (
                                            <span className="bg-primary text-primary-foreground absolute top-3 right-3 flex size-6 items-center justify-center rounded-full text-xs font-bold">
                                                {qty}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : filteredProducts.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                            {filteredProducts.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    quantity={cart[product.id]?.quantity || 0}
                                    onUpdateQuantity={(id, delta) => {
                                        if (delta > 0 && !cart[id]) {
                                            addToCart(product);
                                        } else {
                                            updateCartQuantity(id, delta);
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <Empty className="border-border rounded-2xl border border-dashed py-20">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <Search />
                                </EmptyMedia>
                                <EmptyTitle>No products found</EmptyTitle>
                                <EmptyDescription>
                                    Try a different search term or category.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                </div>
            </div>

            {/* Mobile/tablet backdrop */}
            <AnimatePresence>
                {isCartOpen && (
                    <motion.button
                        key="cart-backdrop"
                        type="button"
                        aria-label="Close cart"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="bg-foreground/50 fixed inset-0 z-50 backdrop-blur-sm lg:hidden"
                        onClick={() => setIsCartOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Cart drawer — full viewport height, slides from right */}
            <AnimatePresence>
                {isCartOpen && (
                    <motion.aside
                        id="sales-cart"
                        key="cart-drawer"
                        role="dialog"
                        aria-label="Current sale"
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 260 }}
                        className={cn(
                            "bg-card border-border fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l shadow-2xl",
                            "sm:w-[var(--cart-w)]",
                        )}
                    >
                        <CartPanel
                            cartItems={cartItems}
                            itemCount={itemCount}
                            isOrderMode={isOrderMode}
                            toggleOrderMode={toggleOrderMode}
                            paymentMethod={paymentMethod}
                            setPaymentMethod={setPaymentMethod}
                            updateCartQuantity={updateCartQuantity}
                            removeFromCart={removeFromCart}
                            clearCart={clearCart}
                            subTotal={subTotal}
                            tax={tax}
                            total={total}
                            onCheckout={() => setIsCompletionModalOpen(true)}
                            onClose={() => setIsCartOpen(false)}
                        />
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Floating cart button when closed */}
            <AnimatePresence>
                {!isCartOpen && itemCount > 0 && (
                    <motion.div
                        key="cart-fab"
                        initial={{ scale: 0.6, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.6, opacity: 0, y: 20 }}
                        transition={{ type: "spring", damping: 20, stiffness: 320 }}
                        className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6"
                    >
                        <Button
                            size="lg"
                            className="h-14 rounded-full px-5 shadow-2xl"
                            onClick={() => setIsCartOpen(true)}
                        >
                            <ShoppingBag data-icon="inline-start" className="size-5" />
                            <span className="num-tabular font-semibold">
                                {itemCount} · {fmt(total)}
                            </span>
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            <SalesCompletionModal
                isOpen={isCompletionModalOpen}
                onClose={() => setIsCompletionModalOpen(false)}
                total={total}
                subTotal={subTotal}
                tax={tax}
            />

            <BarcodeScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onProductFound={(product) => {
                    addToCart(product);
                    setIsScannerOpen(false);
                }}
            />
        </div>
    );
}

interface CartPanelProps {
    cartItems: CartItemData[];
    itemCount: number;
    isOrderMode: boolean;
    toggleOrderMode: () => void;
    paymentMethod: "cash" | "bank transfer" | "mobile transfer";
    setPaymentMethod: (m: "cash" | "bank transfer" | "mobile transfer") => void;
    updateCartQuantity: (id: number, delta: number) => void;
    removeFromCart: (id: number) => void;
    clearCart: () => void;
    subTotal: number;
    tax: number;
    total: number;
    onCheckout: () => void;
    onClose: () => void;
}

function CartPanel({
    cartItems,
    itemCount,
    isOrderMode,
    toggleOrderMode,
    paymentMethod,
    setPaymentMethod,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    subTotal,
    tax,
    total,
    onCheckout,
    onClose,
}: Readonly<CartPanelProps>) {
    const fmt = useCurrency();
    return (
        <div className="flex h-full min-h-0 flex-col">
            {/* Header */}
            <div className="from-primary to-brand-700 relative flex shrink-0 items-center justify-between gap-2 overflow-hidden bg-gradient-to-br p-4 text-white">
                <div
                    aria-hidden
                    className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-white/10 blur-2xl"
                />
                <div className="relative flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
                        <Receipt className="size-5" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold">Current sale</h2>
                        <p className="num-tabular text-[11px] text-white/80">
                            {itemCount} {itemCount === 1 ? "item" : "items"}
                            {itemCount > 0 && <> · {fmt(total)}</>}
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative size-9 shrink-0 text-white hover:bg-white/15 hover:text-white"
                    onClick={onClose}
                    aria-label="Close cart"
                >
                    <X />
                </Button>
            </div>

            {/* Walk-in / Order toggle */}
            <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
                <div className="min-w-0">
                    <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                        {isOrderMode ? (
                            <>
                                <Sparkles className="text-info size-3.5" />
                                Order
                            </>
                        ) : (
                            "Walk-in"
                        )}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                        {isOrderMode
                            ? "Capture customer and fulfil later"
                            : "Complete sale at the counter"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            "text-[10px] font-semibold tracking-wide uppercase",
                            !isOrderMode ? "text-primary" : "text-muted-foreground",
                        )}
                    >
                        Walk-in
                    </span>
                    <Switch
                        checked={isOrderMode}
                        onCheckedChange={toggleOrderMode}
                        aria-label="Toggle order mode"
                    />
                    <span
                        className={cn(
                            "text-[10px] font-semibold tracking-wide uppercase",
                            isOrderMode ? "text-primary" : "text-muted-foreground",
                        )}
                    >
                        Order
                    </span>
                </div>
            </div>

            {/* Items area */}
            <div className="min-h-0 flex-1 overflow-y-auto">
                {cartItems.length > 0 ? (
                    <>
                        <div className="text-muted-foreground sticky top-0 z-10 flex items-center justify-between bg-card/90 px-4 py-2 text-[10px] font-semibold tracking-wide uppercase backdrop-blur">
                            <span>Cart items</span>
                            <button
                                type="button"
                                onClick={clearCart}
                                className="hover:text-destructive inline-flex items-center gap-1 text-[10px] font-semibold uppercase transition-colors"
                            >
                                <Trash2 className="size-3" />
                                Clear
                            </button>
                        </div>
                        <div className="flex flex-col gap-2 px-3 pt-1 pb-4">
                            {cartItems.map((item) => {
                                const key = item.bundle ? bundleCartKey(item.bundle.id) : item.product!.id;
                                return (
                                    <CartItem
                                        key={key}
                                        id={key}
                                        name={item.bundle ? `${item.bundle.name} (bundle)` : item.product!.name}
                                        price={cartUnitPrice(item)}
                                        quantity={item.quantity}
                                        sku={item.bundle ? (item.bundle.sku ?? undefined) : undefined}
                                        imageUrl={item.bundle ? undefined : (item.product!.image_url ?? undefined)}
                                        onUpdateQuantity={updateCartQuantity}
                                        onRemove={removeFromCart}
                                    />
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <Empty className="h-full px-4">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <ShoppingBag />
                            </EmptyMedia>
                            <EmptyTitle>Your cart is empty</EmptyTitle>
                            <EmptyDescription>
                                Tap a product to add it to the sale, or scan a barcode.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
            </div>

            {/* Footer — totals + payment + CTA */}
            <div className="border-border bg-muted/40 shrink-0 border-t p-4">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="num-tabular text-foreground font-medium">
                            {fmt(subTotal)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tax (4%)</span>
                        <span className="num-tabular text-foreground font-medium">
                            {fmt(tax)}
                        </span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between">
                        <span className="text-foreground text-sm font-semibold">
                            Total
                        </span>
                        <span className="num-tabular text-primary text-2xl font-bold tracking-tight">
                            {fmt(total)}
                        </span>
                    </div>
                </div>

                <div className="mt-4">
                    <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wide uppercase">
                        Payment method
                    </p>
                    <ToggleGroup
                        type="single"
                        value={paymentMethod}
                        onValueChange={(v) =>
                            v && setPaymentMethod(v as typeof paymentMethod)
                        }
                        variant="outline"
                        className="grid w-full grid-cols-3"
                        spacing={4}
                    >
                        {PAYMENT_METHODS.map((m) => (
                            <ToggleGroupItem
                                key={m.id}
                                value={m.id}
                                className="flex h-auto flex-col gap-1 py-2.5"
                            >
                                <m.icon className="size-4" />
                                <span className="text-[10px] font-semibold">
                                    {m.label}
                                </span>
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>

                <Button
                    className="mt-4 h-12 w-full text-sm font-semibold"
                    disabled={cartItems.length === 0}
                    onClick={onCheckout}
                >
                    {isOrderMode ? "Place order" : "Proceed to payment"}
                    <ChevronRight data-icon="inline-end" />
                </Button>
            </div>
        </div>
    );
}
