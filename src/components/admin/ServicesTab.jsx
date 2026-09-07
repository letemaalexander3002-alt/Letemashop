import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../utils/supabaseClient';
import * as settingsService from '../../lib/settingsService';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;
// Services never run out — this sentinel keeps every existing stock check
// (POS add-to-cart, low-stock alerts, etc.) happy without special-casing
// every call site. Real "no stock" logic lives in the process_pos_sale RPC,
// which skips stock/COGS entirely for is_service rows.
const SERVICE_STOCK_SENTINEL = 999999;
const EMPTY_SERVICE = { name: '', category: '', price: '', description: '', image_url: '', is_active: true };

export default function ServicesTab({ onReload }) {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSvc, setEditSvc] = useState(null);
  const [form, setForm] = useState(EMPTY_SERVICE);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [dc, setDc] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: svc, error }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*').eq('is_service', true).order('created_at', { ascending: false }),
      settingsService.fetchCategories(true),
    ]);
    if (error) setErr(error.message); else setServices(svc || []);
    setCategories(cats || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const catNames = categories.map(c => c.name);
  const filtered = services.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setEditSvc(null); setForm({ ...EMPTY_SERVICE, category: catNames[0] || '' }); setDc(false); setErr(''); setShowModal(true); };
  const openEdit = (s) => {
    setEditSvc(s);
    setForm({ name: s.name, category: s.category, price: String(s.price), description: s.description || '', image_url: s.image_url || '', is_active: s.is_active !== false });
    setDc(false); setErr(''); setShowModal(true);
  };

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setErr('');
    const payload = {
      name: form.name.trim(), category: form.category, price: Number(form.price),
      description: form.description.trim() || null, image_url: form.image_url.trim() || null, is_active: form.is_active,
      is_service: true, cost_price: 0, unit: 'huduma', reorder_level: 0,
    };
    try {
      if (editSvc) {
        const { error } = await supabase.from('products').update(payload).eq('id', editSvc.id);
        if (error) throw error;
        if (Number(editSvc.price) !== payload.price) {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('audit_logs').insert({
            actor_id: user?.id, action: 'PRICE_OVERRIDE', entity_type: 'products', entity_id: editSvc.id,
            before: { price: editSvc.price }, after: { price: payload.price },
            note: `Huduma "${editSvc.name}": bei ${editSvc.price} → ${payload.price}`,
          });
        }
      } else {
        const { error } = await supabase.from('products').insert({ ...payload, stock_quantity: SERVICE_STOCK_SENTINEL });
        if (error) throw error;
      }
      setShowModal(false); load(); onReload?.();
    } catch (err) { setErr(err.message); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    setSaving(true);
    const target = services.find(s => s.id === id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        actor_id: user?.id, action: 'DELETE_SERVICE', entity_type: 'products', entity_id: id, note: target?.name,
      });
      setShowModal(false); load(); onReload?.();
    } else setErr(error.message);
    setSaving(false); setDc(false);
  };

  const toggleActive = async (s) => {
    await supabase.from('products').update({ is_active: !s.is_active }).eq('id', s.id);
    load(); onReload?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">🛎️ Huduma ({services.length})</h2>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase">+ Ongeza Huduma</button>
      </div>

      <p className="text-[10px] text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-3">
        ℹ️ Huduma (mfano: kuprint, kupiga picha, muda wa internet) huuzwa kwenye POS kama bidhaa za kawaida, lakini hazina "bei ya kununua" wala stoki — zinapatikana muda wote.
      </p>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tafuta huduma..."
        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500" />

      {err && <p className="text-rose-400 text-[10px] font-bold text-center bg-rose-500/10 rounded-lg py-1.5">{err}</p>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="py-12 text-center text-slate-600 text-xs">Inapakia...</div> :
        filtered.length === 0 ? (
          <div className="py-12 text-center"><p className="text-2xl">🛎️</p><p className="text-xs text-slate-600 font-bold mt-2">Hakuna huduma bado.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>{['Jina', 'Kundi', 'Bei ya Kuuzia', 'Hali', 'Vitendo'].map(h => (
                  <th key={h} className="px-3 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-800/30">
                    <td className="px-3 py-3">
                      <p className="font-bold text-white text-xs">{s.name}</p>
                      {s.description && <p className="text-slate-600 text-[9px] truncate max-w-[200px]">{s.description}</p>}
                    </td>
                    <td className="px-3 py-3"><span className="bg-slate-800 text-slate-400 text-[9px] font-bold px-2 py-0.5 rounded-md">{s.category}</span></td>
                    <td className="px-3 py-3 text-amber-400 font-black text-[11px] whitespace-nowrap">{fmtTZS(s.price)}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => toggleActive(s)} className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${s.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                        {s.is_active ? '✅ Inapatikana' : '❌ Imefichwa'}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => openEdit(s)} className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2 py-1.5 rounded-lg">✏ Hariri</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h3 className="text-sm font-black text-white uppercase">{editSvc ? '✏️ Hariri Huduma' : '+ Huduma Mpya'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Jina la Huduma *</label>
                <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Mfano: Kuprint Rangi (Ukurasa 1)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Bei ya Kuuzia (TZS) *</label>
                <input required type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="1000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500" />
                <p className="text-[9px] text-slate-600 mt-1">Huduma haina bei ya kununua — faida yote ni bei hii.</p>
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Kundi</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white">
                  {catNames.length === 0 && <option value="">-- Ongeza kategoria kwenye tab ya Kategoria kwanza --</option>}
                  {catNames.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Maelezo</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Maelezo mafupi..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">URL ya Picha</label>
                <input type="url" value={form.image_url} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Hali</label>
                <select value={form.is_active ? '1' : '0'} onChange={e => setForm(p => ({ ...p, is_active: e.target.value === '1' }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white">
                  <option value="1">✅ Inapatikana</option>
                  <option value="0">❌ Imefichwa</option>
                </select>
              </div>
              {err && <p className="text-rose-400 text-[10px] font-bold">{err}</p>}
              <div className="flex justify-between items-center pt-2 flex-wrap gap-2">
                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black uppercase">
                    {saving ? 'Inahifadhi...' : editSvc ? 'Hifadhi' : 'Ongeza'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
                </div>
                {editSvc && (
                  !dc ? <button type="button" onClick={() => setDc(true)} className="py-2 px-3 rounded-xl bg-rose-500/10 text-rose-400 text-[10px] font-black">🗑 Futa</button>
                  : (
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] text-rose-400">Uhakika?</span>
                      <button type="button" onClick={() => del(editSvc.id)} className="py-1.5 px-3 rounded-lg bg-rose-600 text-white text-[10px] font-black">Ndio</button>
                      <button type="button" onClick={() => setDc(false)} className="py-1.5 px-3 rounded-lg bg-slate-700 text-slate-300 text-[10px] font-black">Hapana</button>
                    </div>
                  )
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
