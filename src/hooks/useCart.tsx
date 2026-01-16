import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  options: { name: string; priceModifier: number; groupName?: string }[];
  notes?: string;
  imageUrl?: string;
  requiresPreparation?: boolean;
  /** ID da promoção aplicada ao item, se houver */
  promotionId?: string;
}

interface CartContextType {
  items: CartItem[];
  companySlug: string | null;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setCompanySlug: (slug: string) => void;
  subtotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'menupro_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [companySlug, setCompanySlugState] = useState<string | null>(null);

  // Load cart from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setItems(parsed.items || []);
        setCompanySlugState(parsed.companySlug || null);
      } catch (e) {
        console.error('Error loading cart:', e);
      }
    }
  }, []);

  // Save cart to localStorage on changes
  useEffect(() => {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ items, companySlug })
    );
  }, [items, companySlug]);

  const setCompanySlug = (slug: string) => {
    // If switching companies, clear the cart
    if (companySlug && companySlug !== slug) {
      setItems([]);
    }
    setCompanySlugState(slug);
  };

  const addItem = (item: Omit<CartItem, 'id'>) => {
    const id = `${item.productId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setItems((prev) => [...prev, { ...item, id }]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const subtotal = items.reduce((total, item) => {
    const optionsTotal = item.options.reduce((sum, opt) => sum + opt.priceModifier, 0);
    return total + (item.price + optionsTotal) * item.quantity;
  }, 0);

  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        companySlug,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        setCompanySlug,
        subtotal,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}