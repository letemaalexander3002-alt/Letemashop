import React, { useState, useEffect } from 'react';
import Catalog from './views/Catalog';
import Checkout from './views/Checkout';
import AdminPanel from './components/AdminPanel';
import ErrorBoundary from './components/ErrorBoundary';
import { supabase } from './utils/supabaseClient';

// Admin accessed via URL hash only — no public trigger
const ADMIN_HASH = '#letema-secure-workspace-2026';

export default function App() {
  const [currentView, setCurrentView] = useState('catalog');
  const [cartItems, setCartItems] = useState([]);
  const [notification, setNotification] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if admin URL hash
  useEffect(() => {
    if (window.location.hash === ADMIN_HASH) {
      setIsAdmin(true);
    }
    window.addEventListener('hashchange', () => {
      setIsAdmin(window.location.hash === ADMIN_HASH);
    });
  }, []);

  // PWA Install Prompt
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Show banner after 3 seconds
      setTimeout(() => setShowInstallBanner(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setShowInstallBanner(false);
    setInstallPrompt(null);
  };

  // Check Supabase connection
  useEffect(() => {
    supabase.from('products').select('id').limit(1)
      .then(({ error }) => setIsOnline(!error))
      .catch(() => setIsOnline(false));
  }, []);

  const showNotif = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: (item.quantity||1)+1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
    showNotif(`✓ ${product.name} imeongezwa!`);
  };

  const handleUpdateQuantity = (id, newQty) => {
    if (newQty <= 0) setCartItems(prev => prev.filter(item => item.id !== id));
    else setCartItems(prev => prev.map(item => item.id === id ? { ...item, quantity: newQty } : item));
  };

  const handleClearCart = () => {
    setCartItems([]);
    setCurrentView('catalog');
    showNotif('🎉 Malipo yamekamilika! Asante.');
  };

  const totalCartCount  = cartItems.reduce((s, i) => s + (i.quantity||1), 0);
  const totalCartAmount = cartItems.reduce((s, i) => s + (Number(i.price||0) * (i.quantity||1)), 0);

  // Admin panel — full screen
  if (isAdmin) {
    return (
      <ErrorBoundary>
        <AdminPanel onExit={() => { window.location.hash = ''; setIsAdmin(false); }} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen w-full text-gray-800 font-sans antialiased app-bg">

        {/* PWA INSTALL BANNER */}
        {showInstallBanner && (
          <div className="fixed bottom-0 left-0 right-0 z-[200] p-4 animate-slide-up">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl flex items-center gap-3 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{background:'linear-gradient(135deg,#1e3a8a,#1d4ed8)'}}>
                <span className="text-white font-black text-sm">LG</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-sm">Sakinisha LSIC Hub</p>
                <p className="text-slate-400 text-[11px]">Ongeza kwenye Home Screen — haraka zaidi!</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => setShowInstallBanner(false)}
                  className="text-slate-500 text-xs px-3 py-1.5 rounded-lg hover:text-slate-300 transition">
                  Baadaye
                </button>
                <button onClick={handleInstall}
                  className="bg-blue-600 text-white text-xs font-black px-4 py-1.5 rounded-lg hover:bg-blue-500 transition active:scale-95">
                  Sakinisha
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATION */}
        {notification && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-xl text-sm font-bold text-white animate-bounce ${
            notification.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
            {notification.msg}
          </div>
        )}

        {/* NAVBAR */}
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm w-full">
          <div className="w-full max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">

            {/* LOGO */}
            <div className="space-y-0.5 select-none">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)' }}>
                  <span className="text-white font-black text-xs">LG</span>
                </div>
                <span className="text-sm font-black tracking-tighter text-blue-900 uppercase">Letema Group</span>
              </div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">LSIC Business Hub</span>
            </div>

            {/* NAV BUTTONS */}
            <div className="flex items-center space-x-2">
              <span className={`text-[8px] font-bold px-2 py-1 rounded-full ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                {isOnline ? '● Online' : '○ Offline'}
              </span>
              <button onClick={() => setCurrentView('catalog')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  currentView === 'catalog' ? 'bg-blue-900 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
                🏪 Katalogi
              </button>
              <button onClick={() => setCurrentView('checkout')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all relative flex items-center space-x-1 ${
                  currentView === 'checkout' ? 'bg-blue-900 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <span>🛒 Kikapu</span>
                {totalCartCount > 0 && (
                  <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md animate-pulse ml-1">
                    {totalCartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* CART BANNER */}
          {totalCartCount > 0 && currentView === 'catalog' && (
            <div className="bg-blue-950 px-4 py-2 flex justify-between items-center">
              <span className="text-xs text-blue-200 font-medium">🛒 {totalCartCount} bidhaa kwenye kikapu</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-amber-400">{Number(totalCartAmount).toLocaleString()} TZS</span>
                <button onClick={() => setCurrentView('checkout')}
                  className="bg-amber-500 hover:bg-amber-400 text-white text-[10px] font-black px-3 py-1.5 rounded-lg transition-all">
                  Lipia Sasa →
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* MAIN CONTENT */}
        <main className="w-full min-w-0 flex-1">
          {currentView === 'catalog' && <Catalog onAddToCart={handleAddToCart} />}
          {currentView === 'checkout' && (
            <Checkout
              cartItems={cartItems}
              onUpdateQuantity={handleUpdateQuantity}
              onClearCart={handleClearCart}
              onContinueShopping={() => setCurrentView('catalog')}
            />
          )}
        </main>

        {/* FOOTER */}
        <footer className="border-t border-white/10 bg-black/40 backdrop-blur mt-8 py-8 text-center px-4">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#c9a84c,#f5d67a)' }}>
                <span className="text-slate-900 font-black text-xs">LG</span>
              </div>
              <span className="text-white font-black text-sm tracking-tight uppercase">Letema Group</span>
            </div>
            <p className="text-gray-400 text-xs font-medium mb-1">LSIC Business Hub — Dodoma, Tanzania</p>
            <p className="text-gray-500 text-[10px] mb-4">Letema Stationery & Internet Café</p>
            <div className="flex justify-center gap-4 mb-4">
              <a href="https://wa.me/255620642652" target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-green-400 font-bold hover:text-green-300 transition">
                💬 +255 620 642 652
              </a>
              <a href="mailto:letemaalexander3002@gmail.com"
                className="text-[10px] text-blue-400 font-bold hover:text-blue-300 transition">
                ✉️ letemaalexander3002@gmail.com
              </a>
            </div>
            <p className="text-gray-700 text-[9px] font-mono">
              © {new Date().getFullYear()} Letema Group · Built with React + Supabase + Vite
            </p>
          </div>
        </footer>

      </div>
    </ErrorBoundary>
  );
}
