import { create } from "zustand";
import { ProductResponse } from "@/interfaces/products";
import { BundleResponse } from "@/interfaces/bundles";

export interface CartItemData {
    // Exactly one of product / bundle is set.
    product?: ProductResponse;
    bundle?: BundleResponse;
    quantity: number;
    specialInstructions?: string;
    serialNumbers?: string[]; // for serial-tracked products, captured at checkout
}

// Bundles are keyed under a negative id so they never collide with product ids.
export const bundleCartKey = (bundleId: number) => -bundleId;
export const cartUnitPrice = (item: CartItemData) =>
    item.bundle ? item.bundle.bundle_price : (item.product?.selling_price ?? 0);

interface SalesState {
    isOrderMode: boolean; // false = walk-in, true = order
    cart: Record<number, CartItemData>;
    paymentMethod: "bank transfer" | "mobile transfer" | "cash";

    // Actions
    toggleOrderMode: () => void;
    setOrderMode: (isOrder: boolean) => void;
    addToCart: (product: ProductResponse) => void;
    addBundleToCart: (bundle: BundleResponse) => void;
    updateCartQuantity: (key: number, delta: number, instructions?: string) => void;
    removeFromCart: (key: number) => void;
    setSerialNumbers: (key: number, serials: string[]) => void;
    clearCart: () => void;
    setPaymentMethod: (method: "bank transfer" | "mobile transfer" | "cash") => void;
}

export const useSalesStore = create<SalesState>((set) => ({
    isOrderMode: false,
    cart: {},
    paymentMethod: "bank transfer",

    toggleOrderMode: () => set((state) => ({ isOrderMode: !state.isOrderMode })),
    setOrderMode: (isOrder: boolean) => set({ isOrderMode: isOrder }),

    addToCart: (product: ProductResponse) => set((state: SalesState) => {
        const currentItem = state.cart[product.id];
        return {
            cart: {
                ...state.cart,
                [product.id]: {
                    product,
                    quantity: (currentItem?.quantity || 0) + 1,
                },
            },
        };
    }),

    addBundleToCart: (bundle: BundleResponse) => set((state: SalesState) => {
        const key = bundleCartKey(bundle.id);
        const currentItem = state.cart[key];
        return {
            cart: {
                ...state.cart,
                [key]: {
                    bundle,
                    quantity: (currentItem?.quantity || 0) + 1,
                },
            },
        };
    }),

    updateCartQuantity: (key: number, delta: number, instructions?: string) => set((state: SalesState) => {
        const currentItem = state.cart[key];
        if (!currentItem) return state;

        const newQuantity = currentItem.quantity + delta;

        if (newQuantity <= 0) {
            const newCart = { ...state.cart };
            delete newCart[key];
            return { cart: newCart };
        }

        return {
            cart: {
                ...state.cart,
                [key]: {
                    ...currentItem,
                    quantity: newQuantity,
                    specialInstructions: instructions !== undefined ? instructions : currentItem.specialInstructions,
                },
            },
        };
    }),

    removeFromCart: (key: number) => set((state: SalesState) => {
        const newCart = { ...state.cart };
        delete newCart[key];
        return { cart: newCart };
    }),

    setSerialNumbers: (key: number, serials: string[]) => set((state: SalesState) => {
        const currentItem = state.cart[key];
        if (!currentItem) return state;
        return { cart: { ...state.cart, [key]: { ...currentItem, serialNumbers: serials } } };
    }),

    clearCart: () => set({ cart: {} }),

    setPaymentMethod: (method: "bank transfer" | "mobile transfer" | "cash") => set({ paymentMethod: method }),
}));
