import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import type {CartLine, Dish} from './types';

type CartApi = {
  lines: CartLine[];
  qtyOf: (dishId: number) => number;
  add: (dish: Dish) => void;
  remove: (dishId: number) => void;
  clear: () => void;
  totalCents: number;
  totalQty: number;
};

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = useCallback((dish: Dish) => {
    setLines(prev => {
      const existing = prev.find(l => l.dish.id === dish.id);
      if (existing) {
        return prev.map(l => (l.dish.id === dish.id ? {...l, qty: l.qty + 1} : l));
      }
      return [...prev, {dish, qty: 1}];
    });
  }, []);

  const remove = useCallback((dishId: number) => {
    setLines(prev =>
      prev
        .map(l => (l.dish.id === dishId ? {...l, qty: l.qty - 1} : l))
        .filter(l => l.qty > 0),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const qtyOf = useCallback(
    (dishId: number) => lines.find(l => l.dish.id === dishId)?.qty ?? 0,
    [lines],
  );

  const totalCents = useMemo(
    () => lines.reduce((sum, l) => sum + l.dish.priceCents * l.qty, 0),
    [lines],
  );

  const totalQty = useMemo(() => lines.reduce((sum, l) => sum + l.qty, 0), [lines]);

  const value = useMemo(
    () => ({lines, qtyOf, add, remove, clear, totalCents, totalQty}),
    [lines, qtyOf, add, remove, clear, totalCents, totalQty],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used inside CartProvider');
  }
  return ctx;
}
