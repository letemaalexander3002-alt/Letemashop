import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const CATEGORY_CONFIG = {
  'Internet':          { emoji: '🌐', color: 'from-blue-600 to-cyan-500',    badge: 'bg-cyan-900',    btn: 'bg-blue-700 hover:bg-blue-800' },
  'Document Services': { emoji: '📄', color: 'from-orange-600 to-amber-400', badge: 'bg-orange-900',  btn: 'bg-orange-600 hover:bg-orange-700' },
  'e-Gov':             { emoji: '🏛️', color: 'from-green-700 to-emerald-400', badge: 'bg-green-900',   btn: 'bg-green-700 hover:bg-green-800' },
  'Digital Hub':       { emoji: '💻', color: 'from-purple-700 to-violet-400', badge: 'bg-purple-900',  btn: 'bg-purple-700 hover:bg-purple-800' },
  'Stationery':        { emoji: '✏️', color: 'from-rose-600 to-pink-400',     badge: 'bg-rose-900',    btn: 'bg-rose-600 hover:bg-rose-700' },
};
const ALL_CATEGORIES = ['Internet', 'Document Services', 'e-Gov', 'Digital Hub', 'Stationery'];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden animate-pulse">
      <div className="h-44 bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
        <div className="h-8 bg-gray-200 rounded-xl mt-3" />
      </div>
    </div>
  )
}

export default function Catalog({ onAddToCart }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });
      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter(p => p.category === selectedCategory);

  return (
    <div className="max-w-7xl w-full mx-auto px-3 py-4 space-y-6">

      {/* BANNER */}
      <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-xl font-black text-blue-900 uppercase tracking-tight">Katalogi Rasmi ya Huduma</h1>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">Letema Stationery & Internet Café — Dodoma Business Hub</p>
        </div>
        <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border">
          {filteredProducts.length} / {products.length} huduma
        </span>
      </div>

      {/* CATEGORY FILTER */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSelectedCategory('All')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all border shadow-sm ${
            selectedCategory === 'All' ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}>
          🗂️ Zote ({products.length})
        </button>
        {ALL_CATEGORIES.map(cat => {
          const cfg = CATEGORY_CONFIG[cat];
          const count = products.filter(p => p.category === cat).length;
          return (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all border shadow-sm ${
                selectedCategory === cat ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}>
              {cfg.emoji} {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* PRODUCT GRID */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100">
          <p className="text-gray-400 font-bold">Hakuna huduma zilizopatikana.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredProducts.map(product => {
            const cfg = CATEGORY_CONFIG[product.category] || {
              emoji: '📦', color: 'from-gray-600 to-gray-400', badge: 'bg-gray-800', btn: 'bg-gray-700 hover:bg-gray-800'
            };
            return (
              <div key={product.id}
                className="group relative bg-white rounded-2xl overflow-hidden flex flex-col transition-all duration-300"
                style={{ boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'perspective(1000px) rotateX(3deg) translateY(-8px)';
                  e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(0,0,0,0.25)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
                }}>
                <div className={`relative h-44 bg-gradient-to-br ${cfg.color} overflow-hidden`}>
                  {product.image_url && (
                    <img src={product.image_url} alt={product.name}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
                      onError={e => { e.target.style.display = 'none'; }} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <span className={`absolute top-3 left-3 ${cfg.badge} text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg shadow-lg`}>
                    {cfg.emoji} {product.category}
                  </span>
                  <span className="absolute top-3 right-3 bg-white/90 backdrop-blur text-blue-900 text-[10px] font-black px-2 py-1 rounded-lg shadow">
                    {Number(product.price).toLocaleString()} TZS
                  </span>
                </div>
                <div className="p-4 flex flex-col flex-grow">
                  <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 min-h-[40px] mb-1 group-hover:text-blue-800 transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed flex-grow mb-3">
                    {product.description}
                  </p>
                  {product.stock_quantity !== undefined && product.stock_quantity <= 0
                    ? <div className="w-full bg-gray-100 text-gray-400 py-2 rounded-xl text-xs font-bold text-center">Imekwisha</div>
                    : (
                      <button onClick={() => onAddToCart(product)}
                        className={`w-full ${cfg.btn} text-white text-xs font-black py-2.5 rounded-xl transition-all active:scale-95 shadow-md mt-auto`}>
                        🛒 Chagua Huduma
                      </button>
                    )
                  }
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
