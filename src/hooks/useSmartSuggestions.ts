import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { filterCategoriesByDayPeriod, DayPeriod, CategoryDayPeriod } from '@/lib/dayPeriods';

interface CartItem {
  productId: string;
  productName: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
}

interface SuggestedProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
}

export function useSmartSuggestions(
  cartItems: CartItem[],
  allProducts: Product[],
  categories: Category[],
  dayPeriods: DayPeriod[] = [],
  categoryDayPeriods: CategoryDayPeriod[] = [],
  enabled: boolean = true
) {
  const [suggestions, setSuggestions] = useState<SuggestedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastCartKey = useRef<string>('');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const hasFetchedInitial = useRef(false);

  // Memoize category map to avoid recreation on each render
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(c => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const getCategoryName = useCallback((categoryId: string) => {
    return categoryMap.get(categoryId) || '';
  }, [categoryMap]);

  // Memoize visible category IDs
  const visibleCategoryIds = useMemo(() => {
    return filterCategoriesByDayPeriod(
      categories.map(c => c.id),
      dayPeriods,
      categoryDayPeriods
    );
  }, [categories, dayPeriods, categoryDayPeriods]);

  // Create stable keys for comparison to prevent infinite loops
  const cartKey = useMemo(() => 
    cartItems.map(i => i.productId).sort().join(','),
    [cartItems]
  );
  
  const productsKey = useMemo(() => 
    allProducts.length > 0 ? allProducts.map(p => p.id).slice(0, 5).join(',') : '',
    [allProducts]
  );

  const fallbackToSimpleSuggestions = useCallback((cartProductIds: Set<string>) => {
    const visibleCategorySet = new Set(visibleCategoryIds);

    // Simple fallback: suggest beverages not in cart AND from visible categories
    const beverageKeywords = ['bebida', 'refrigerante', 'suco', 'água', 'drink'];
    const beverages = allProducts
      .filter(p => {
        if (cartProductIds.has(p.id)) return false;
        if (!visibleCategorySet.has(p.category_id)) return false;
        const categoryName = getCategoryName(p.category_id).toLowerCase();
        const productName = p.name.toLowerCase();
        return beverageKeywords.some(kw => 
          categoryName.includes(kw) || productName.includes(kw)
        );
      })
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        image_url: p.image_url,
      }));

    setSuggestions(beverages);
  }, [allProducts, visibleCategoryIds, getCategoryName]);

  const fetchSuggestions = useCallback(async () => {
    if (!enabled || cartItems.length === 0 || allProducts.length === 0) {
      setSuggestions([]);
      return;
    }

    // Get cart product IDs to exclude from suggestions
    const cartProductIds = new Set(cartItems.map(item => item.productId));
    const visibleCategorySet = new Set(visibleCategoryIds);

    // Filter available products (not in cart AND from visible categories)
    const availableProducts = allProducts
      .filter(p => !cartProductIds.has(p.id) && visibleCategorySet.has(p.category_id))
      .map(p => ({
        id: p.id,
        name: p.name,
        categoryName: getCategoryName(p.category_id),
        price: p.price,
      }));

    if (availableProducts.length === 0) {
      setSuggestions([]);
      return;
    }

    // Prepare cart items with category names
    const cartItemsWithCategories = cartItems.map(item => {
      const product = allProducts.find(p => p.id === item.productId);
      return {
        productName: item.productName,
        categoryName: product ? getCategoryName(product.category_id) : undefined,
      };
    });

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-suggestions', {
        body: {
          cartItems: cartItemsWithCategories,
          availableProducts: availableProducts.slice(0, 50), // Limit to avoid token overflow
        },
      });

      if (error) {
        console.error('Error fetching smart suggestions:', error);
        // Fallback to simple beverage suggestions
        fallbackToSimpleSuggestions(cartProductIds);
        return;
      }

      const suggestedIds = data?.suggestedIds || [];
      
      if (suggestedIds.length === 0) {
        // Fallback if AI returns empty
        fallbackToSimpleSuggestions(cartProductIds);
        return;
      }

      // Map IDs to full product objects
      const suggestedProducts = suggestedIds
        .map((id: string) => allProducts.find(p => p.id === id))
        .filter((p: Product | undefined): p is Product => p !== undefined)
        .map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          image_url: p.image_url,
        }));

      setSuggestions(suggestedProducts);
    } catch (err) {
      console.error('Error calling smart-suggestions:', err);
      fallbackToSimpleSuggestions(cartProductIds);
    } finally {
      setIsLoading(false);
    }
  }, [cartItems, allProducts, visibleCategoryIds, enabled, getCategoryName, fallbackToSimpleSuggestions]);

  // Effect for cart changes - debounced
  useEffect(() => {
    // Only fetch if cart actually changed
    if (cartKey === lastCartKey.current) {
      return;
    }
    lastCartKey.current = cartKey;

    // Debounce the API call
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions();
    }, 500);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [cartKey, fetchSuggestions]);

  // Initial fetch when products/categories load - only once
  useEffect(() => {
    if (hasFetchedInitial.current) return;
    if (productsKey && categories.length > 0 && cartItems.length > 0) {
      hasFetchedInitial.current = true;
      fetchSuggestions();
    }
  }, [productsKey, categories.length, cartItems.length, fetchSuggestions]);

  return {
    suggestions,
    isLoading,
    refetch: fetchSuggestions,
  };
}
