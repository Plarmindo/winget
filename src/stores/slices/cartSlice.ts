import { StateCreator } from 'zustand';
import { WingetPackage } from '../../types';

export interface CartSlice {
    cart: WingetPackage[];
    addToCart: (pkg: WingetPackage) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    isInCart: (id: string) => boolean;

    // Favorites
    favorites: string[];
    toggleFavorite: (id: string) => void;
    isFavorite: (id: string) => boolean;

    // Comparison
    compareList: WingetPackage[];
    toggleCompare: (pkg: WingetPackage) => void;
    clearCompare: () => void;
}

export const createCartSlice: StateCreator<CartSlice, [], [], CartSlice> = (set, get) => ({
    // Cart
    cart: [],
    addToCart: (pkg) => set((state) => {
        if (state.cart.find(p => p.id === pkg.id)) return state;
        return { cart: [...state.cart, pkg] };
    }),
    removeFromCart: (id) => set((state) => ({
        cart: state.cart.filter(p => p.id !== id)
    })),
    clearCart: () => set({ cart: [] }),
    isInCart: (id) => !!get().cart.find(p => p.id === id),

    // Favorites
    favorites: [],
    toggleFavorite: (id) => set((state) => {
        const isFav = state.favorites.includes(id);
        return { favorites: isFav ? state.favorites.filter(fid => fid !== id) : [...state.favorites, id] };
    }),
    isFavorite: (id) => get().favorites.includes(id),

    // Comparison
    compareList: [],
    toggleCompare: (pkg) => set((state) => {
        const exists = state.compareList.find(p => p.id === pkg.id);
        if (exists) {
            return { compareList: state.compareList.filter(p => p.id !== pkg.id) };
        }
        return { compareList: [...state.compareList, pkg] };
    }),
    clearCompare: () => set({ compareList: [] }),
});
