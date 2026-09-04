import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from './AuthContext';

const CartContext = createContext({});

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Kuvuta vitu vilivyomo kwenye kikapu kutoka Supabase Server
  const fetchCart = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          quantity,
          product_id,
          products (id, name, price, type, image_url, stock_quantity)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      setCartItems(data || []);
    } catch (error) {
      console.error('Error fetching cart:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCart();
    } else {
      setCartItems([]);
    }
  }, [user]);

  // 2. Kuongeza bidhaa au huduma kwenye kikapu
  const addToCart = async (productId, quantity = 1) => {
    if (!user) {
      alert('Tafadhali ingia kwenye mfumo (Login) kwanza ili uweke kikapuni.');
      return;
    }

    try {
      // Kagua kama bidhaa tayari imo kwenye kikapu
      const existingItem = cartItems.find(item => item.product_id === productId);

      if (existingItem) {
        // Kama ipo, ongeza idadi tu (Update)
        const newQuantity = existingItem.quantity + quantity;
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: newQuantity })
          .eq('id', existingItem.id);

        if (error) throw error;
      } else {
        // Kama haipo, ingiza mpya (Insert)
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            product_id: productId,
            quantity: quantity
          });

        if (error) throw error;
      }
      await fetchCart(); // Refresh kikapu kupata data mpya
    } catch (error) {
      console.error('Error adding to cart:', error.message);
    }
  };

  // 3. Kubadili idadi ya bidhaa zilizomo kikapuni (Mfano kuongeza kutoka 1 hadi 2)
  const updateQuantity = async (cartItemId, newQuantity) => {
    if (newQuantity <= 0) {
      await removeFromCart(cartItemId);
      return;
    }

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', cartItemId);

      if (error) throw error;
      await fetchCart();
    } catch (error) {
      console.error('Error updating quantity:', error.message);
    }
  };

  // 4. Kuondoa kabisa bidhaa kwenye kikapu
  const removeFromCart = async (cartItemId) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', cartItemId);

      if (error) throw error;
      await fetchCart();
    } catch (error) {
      console.error('Error removing from cart:', error.message);
    }
  };

  // 5. Kusafisha kikapu chote (Baada ya mteja kulipia)
  const clearCart = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      setCartItems([]);
    } catch (error) {
      console.error('Error clearing cart:', error.message);
    }
  };

  // Mahesabu ya jumla ya pesa ya vitu vilivyopo kikapuni kwa sasa
  const getCartTotal = () => {
    return cartItems.reduce((total, item) => {
      const price = item.products?.price || 0;
      return total + (price * item.quantity);
    }, 0);
  };

  return (
    <CartContext.Provider value={{ cartItems, loading, addToCart, updateQuantity, removeFromCart, clearCart, getCartTotal }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);

