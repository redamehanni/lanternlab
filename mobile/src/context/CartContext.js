import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getCart, addToCart as apiAdd, updateCartItem, removeCartItem, clearCart as apiClear } from '../api';
import { useApp } from './AppContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || user.role !== 'client') {
      setItems([]); setTotal(0); setCount(0);
      return;
    }
    try {
      const res = await getCart();
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
      setCount(res.data.count || 0);
    } catch {
      setItems([]); setTotal(0); setCount(0);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  async function addToCart(productId, quantity = 1) {
    setLoading(true);
    try {
      const res = await apiAdd(productId, quantity);
      setItems(res.data.items || []);
      setCount(res.data.count || 0);
      setTotal((res.data.items || []).reduce((s, i) => s + i.line_total, 0));
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function updateQty(cartItemId, quantity) {
    const res = await updateCartItem(cartItemId, quantity);
    setItems(res.data.items || []);
    setCount((res.data.items || []).reduce((s, i) => s + i.quantity, 0));
    setTotal((res.data.items || []).reduce((s, i) => s + i.line_total, 0));
  }

  async function removeItem(cartItemId) {
    const res = await removeCartItem(cartItemId);
    setItems(res.data.items || []);
    setCount((res.data.items || []).reduce((s, i) => s + i.quantity, 0));
    setTotal((res.data.items || []).reduce((s, i) => s + i.line_total, 0));
  }

  async function clearCart() {
    await apiClear();
    setItems([]); setTotal(0); setCount(0);
  }

  return (
    <CartContext.Provider value={{
      items, total, count, loading, refresh, addToCart, updateQty, removeItem, clearCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
