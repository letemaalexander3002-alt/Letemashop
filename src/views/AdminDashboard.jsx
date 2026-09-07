import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // States za fomu ya kuongeza bidhaa mpya
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('Stationery');
  const [prodPrice, setProdPrice] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Kuvuta idadi ya bidhaa zote zilizopo
      const { count: prodCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
      setTotalProductsCount(prodCount || 0);

      // 2. Kuvuta oda zote mpya kutoka kwenye meza ya orders
      const { data: fetchedOrders, error: ordErr } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (ordErr) throw ordErr;
      setOrders(fetchedOrders || []);

    } catch (err) {
      console.error("Dashboard logic error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!prodName || !prodPrice) return;

    try {
      setFormLoading(true);
      const { error } = await supabase.from('products').insert([
        {
          name: prodName,
          category: prodCategory,
          price: parseInt(prodPrice),
          description: prodDesc,
          stock_quantity: 100
        }
      ]);

      if (error) throw error;

      alert(`Hongera Chief Alexander! Huduma imewekwa kwenye kundi la ${prodCategory} kikamilifu!`);
      setProdName('');
      setProdPrice('');
      setProdDesc('');
      
      fetchDashboardData(); // Refresh takwimu hapo hapo
    } catch (err) {
      alert(`Imefeli kuongeza bidhaa: ${err.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId, currentStatus) => {
    const nextStatus = currentStatus === 'Pending' ? 'Completed' : 'Pending';
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId);

      if (error) throw error;
      fetchDashboardData();
    } catch (err) {
      alert(`Imefeli kubadili hali ya oda: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
        <span className="ml-3 font-bold text-gray-600">Mkurugenzi Alexander, Mfumo Unasoma Supabase...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-blue-900 uppercase">Letema Admin Dashboard</h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">Jopo la udhibiti lililosasishwa kikamilifu — e-Gov & Digital Hub Ready.</p>
        </div>
        <span className="bg-blue-900 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
          Msimamizi Mkuu
        </span>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Jumla ya Bidhaa/Huduma</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{totalProductsCount}</p>
          </div>
          <span className="text-2xl">📦</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Oda Zisizoshughulikiwa</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{orders.filter(o => o.status === 'Pending').length}</p>
          </div>
          <span className="text-2xl">⏳</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Oda Zilizokamilika</p>
            <p className="text-2xl font-black text-green-600 mt-1">{orders.filter(o => o.status === 'Completed').length}</p>
          </div>
          <span className="text-2xl">✅</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FOMU YA KUONGEZA BIDHAA (KUSHOTO) */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4 lg:col-span-1 h-fit">
          <h3 className="font-black text-gray-900 text-sm border-b border-gray-50 pb-2 uppercase tracking-wide">Ongeza Huduma Mpya</h3>
          
          <form onSubmit={handleAddProduct} className="space-y-3">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Jina la Huduma</label>
              <input type="text" required value={prodName} onChange={(e) => setProdName(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none" placeholder="Mf. Garrett Sutton Business Plan" />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Kundi (Category)</label>
              <select value={prodCategory} onChange={(e) => setProdCategory(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none font-bold text-gray-700">
                <option value="Stationery">Stationery (Vifaa)</option>
                <option value="Internet">Internet (Kifurushi)</option>
                <option value="Document Services">Document Services (Huduma)</option>
                <option value="e-Gov">e-Gov (Mifumo ya Serikali)</option>
                <option value="Digital Hub">Digital Hub (Premium)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Bei (TZS)</label>
              <input type="number" required value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none" placeholder="Mf. 150000" />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Maelezo Fupi</label>
              <textarea value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none h-16" placeholder="Andika maelezo ya kiwango cha huduma hapa..."></textarea>
            </div>

            <button type="submit" disabled={formLoading} className="w-full bg-blue-900 text-white text-xs font-bold py-3 rounded-xl uppercase tracking-wider hover:bg-amber-500 transition-colors disabled:bg-gray-300 shadow-md">
              {formLoading ? 'Inahifadhi...' : 'WEKA KWENYE KATALOGI'}
            </button>
          </form>
        </div>

        {/* JEDWALI LA ODA (KULIA) */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm lg:col-span-2 space-y-4">
          <h3 className="font-black text-gray-900 text-sm border-b border-gray-50 pb-2 uppercase tracking-wide">Mtiririko wa Oda za Wateja</h3>
          
          {orders.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-400 font-medium">
              Hakuna oda zilizopo kwenye hifadhidata kwa sasa.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-bold uppercase text-[9px] tracking-wider border-b border-gray-100">
                    <th className="p-3">Mteja & Simu</th>
                    <th className="p-3">Huduma Alizochagua</th>
                    <th className="p-3">Njia ya Malipo</th>
                    <th className="p-3">Jumla</th>
                    <th className="p-3">Hali / Hatua</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50/50">
                      <td className="p-3">
                        <p className="font-bold text-gray-900">{order.customer_name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{order.phone_number}</p>
                      </td>
                      <td className="p-3 max-w-[180px]">
                        <div className="text-[11px] text-gray-600 space-y-0.5">
                          {Array.isArray(order.items) ? (
                            order.items.map((item, i) => (
                              <p key={i} className="truncate">• {item.name}</p>
                            ))
                          ) : (
                            <p className="text-gray-400 text-[10px]">Mchanganuo haupo</p>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="bg-gray-100 text-gray-700 font-bold px-2 py-0.5 rounded text-[10px]">
                          {order.payment_method}
                        </span>
                      </td>
                      <td className="p-3 font-black text-blue-900">
                        {order.total_amount.toLocaleString()} TZS
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleUpdateStatus(order.id, order.status)}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                            order.status === 'Pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          }`}
                        >
                          {order.status === 'Pending' ? '⏳ Pending' : '✅ Done'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

