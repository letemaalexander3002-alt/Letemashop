// =============================================================================
// LETEMA STATIONERY & INTERNET CAFÉ — PRODUCTION ENGINE CORE
// MODULE: ORDER TRANSACTIONAL COMPONENTS (CLIENT FORM & ADMIN MATRIX)
// BACKEND: DIRECT SUPABASE REAL-TIME INJECTION
// =============================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';

export const PrintingForm = ({ onOrderSuccess }) => {
  const { user } = useAuth();
  const [fileUrl, setFileUrl] = useState('');
  const [copies, setCopies] = useState(1);
  const [printType, setPrintType] = useState('black_white');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    try {
      const { data, error } = await supabase
        .from('orders')
        .insert([
          {
            user_id: user.id,
            file_url: fileUrl.trim(),
            copies: parseInt(copies),
            print_type: printType,
            instructions: instructions.trim(),
            status: 'pending'
          }
        ]);

      if (error) throw error;

      setMsg({ type: 'success', text: 'Oda yako imetumwa kwa usalama! Tunaifanyia kazi sasa hivi.' });
      setFileUrl('');
      setInstructions('');
      setCopies(1);
      if (onOrderSuccess) onOrderSuccess();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Imeshindwa kutuma oda. Jaribu tena.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <span className="text-xl">🖨️</span>
        <h3 className="text-base font-bold text-white">Agiza Huduma ya Printing / Copy</h3>
      </div>

      {msg.text && (
        <div className={`p-3 rounded-xl text-xs border ${msg.type === 'success' ? 'bg-green-950/40 border-green-800 text-green-400' : 'bg-red-950/40 border-red-800 text-red-400'}`}>
          {msg.type === 'success' ? '✅ ' : '⚠️ '} {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmitOrder} className="space-y-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Link ya Faili la Chapisho (Hiari)</label>
          <input 
            type="url" 
            placeholder="Weka link ya Google Drive au faili mtandaoni" 
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Idadi ya Kopi (Copies)</label>
            <input 
              type="number" 
              required 
              min="1" 
              value={copies}
              onChange={(e) => setCopies(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white text-center font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Aina ya Rangi</label>
            <select 
              value={printType} 
              onChange={(e) => setPrintType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
            >
              <option value="black_white">Nyeusi & Nyeupe (B&W)</option>
              <option value="color">Rangi (Full Color)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Maelekezo Maalum ya Kazi</label>
          <textarea 
            required
            rows="3"
            placeholder="Mfano: Toa picha mbili kila ukurasa..." 
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white resize-none"
          ></textarea>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-sky-500 text-slate-950 font-bold p-3 rounded-xl text-xs active:scale-95 transition-transform"
        >
          {loading ? 'Mifumo inatuma oda...' : 'TUMA ODA SASA 🚀'}
        </button>
      </form>
    </div>
  );
};

export const AdminOrderPanel = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAllOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles:user_id (full_name, phone_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error loading orders:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllOrders();
    
    const channels = supabase
      .channel('realtime-orders')
      .on('postgres_changes', { event: '*', pattern: 'public', table: 'orders' }, () => {
        fetchAllOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channels);
    };
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      fetchAllOrders();
    } catch (err) {
      alert('Imeshindwa kusasisha hali ya oda: ' + err.message);
    }
  };

  if (loading) {
    return <div className="text-center text-xs p-4 text-slate-500 font-mono">Inasoma Dashboard ya Letema Group...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Orodha ya Oda Zote</h3>
        <button onClick={fetchAllOrders} className="text-xs text-sky-400 underline">Ona Mpya 🔄</button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
          📭 Hakuna oda yoyote kwenye mfumo kwa sasa.
        </div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 relative shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-sm font-bold text-white">{order.profiles?.full_name || 'Mteja'}</h4>
                <p className="text-[11px] text-sky-400 font-mono">{order.profiles?.phone_number || 'No Phone'}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                order.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                order.status === 'processing' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {order.status === 'pending' ? '🟡 Mpya' : order.status === 'processing' ? '🔵 Inachapishwa' : '🟢 Imekamilika'}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Kopi: <b className="text-white">{order.copies}</b></span>
                <span>Aina: <b className="text-white">{order.print_type === 'color' ? 'Color' : 'B&W'}</b></span>
              </div>
              <p className="text-slate-300 text-[11px]"><b className="text-slate-500">Maelekezo:</b> {order.instructions}</p>
              {order.file_url && (
                <div className="pt-1 border-t border-slate-900">
                  <a href={order.file_url} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline">
                    🔗 Fungua / Pakua Faili
                  </a>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {order.status === 'pending' && (
                <button onClick={() => handleUpdateStatus(order.id, 'processing')} className="flex-1 bg-sky-950/40 text-sky-400 border border-sky-800 p-2 rounded-lg text-[11px]">
                  Anza Kuchapa 🖨️
                </button>
              )}
              {order.status === 'processing' && (
                <button onClick={() => handleUpdateStatus(order.id, 'completed')} className="flex-1 bg-emerald-950/40 text-emerald-400 border border-emerald-800 p-2 rounded-lg text-[11px]">
                  Kamilisha Kazi ✅
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

