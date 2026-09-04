import React, { useState, useEffect, useCallback } from 'react';
import * as crm from '../../lib/crmService';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const EMPTY = { name: '', phone: '', email: '', address: '', credit_limit: '0' };

export default function CustomersDirectoryTab() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loyalty, setLoyalty] = useState([]);
  const [dc, setDc] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await crm.fetchCustomers(search);
    if (error) setErr(error); else setCustomers(data || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', credit_limit: String(c.credit_limit || 0) }); setShowModal(true); };

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setErr('');
    const payload = { name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, address: form.address.trim() || null, credit_limit: Number(form.credit_limit || 0) };
    const { error } = editing ? await crm.updateCustomer(editing.id, payload) : await crm.createCustomer(payload);
    setSaving(false);
    if (error) { setErr(error); return; }
    setShowModal(false); load();
  };

  const remove = async (id) => {
    setSaving(true);
    const { error } = await crm.deleteCustomer(id);
    setSaving(false); setDc(false);
    if (error) { setErr(error); return; }
    setShowModal(false); load();
  };

  const openDetail = async (c) => {
    setDetail(c);
    const [{ data: p }, { data: l }] = await Promise.all([crm.fetchCustomerPurchaseHistory(c.id), crm.fetchLoyaltyLedger(c.id)]);
    setPurchases(p || []); setLoyalty(l || []);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">👥 Wateja (CRM) ({customers.length})</h2>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase">+ Mteja</button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tafuta mteja kwa jina/simu..."
        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500" />

      {err && <p className="text-rose-400 text-[10px] font-bold text-center bg-rose-500/10 rounded-lg py-1.5">{err}</p>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="py-12 text-center text-slate-600 text-xs">Inapakia...</div> :
        customers.length === 0 ? <div className="py-12 text-center"><p className="text-2xl">👥</p><p className="text-xs text-slate-600 font-bold mt-2">Hakuna wateja.</p></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>{['Jina', 'Simu', 'Deni', 'Pointi za Uaminifu', 'Vitendo'].map(h => <th key={h} className="px-3 py-3 text-[9px] font-black text-slate-500 uppercase whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/30">
                    <td className="px-3 py-3">
                      <button onClick={() => openDetail(c)} className="font-bold text-white text-xs hover:text-blue-400 text-left">{c.name}</button>
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-400 text-[10px] whitespace-nowrap">{c.phone || '—'}</td>
                    <td className="px-3 py-3 whitespace-nowrap"><span className={`text-[10px] font-black ${c.credit_balance > 0 ? 'text-rose-400' : 'text-slate-600'}`}>{fmtTZS(c.credit_balance)}</span></td>
                    <td className="px-3 py-3 text-amber-400 font-black whitespace-nowrap">⭐ {c.loyalty_points || 0}</td>
                    <td className="px-3 py-3"><button onClick={() => openEdit(c)} className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2 py-1.5 rounded-lg">✏ Hariri</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h3 className="text-sm font-black text-white uppercase">{editing ? '✏️ Hariri Mteja' : '+ Mteja Mpya'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              {[
                { label: 'Jina *', key: 'name', req: true },
                { label: 'Simu', key: 'phone' },
                { label: 'Barua Pepe', key: 'email', type: 'email' },
                { label: 'Anwani', key: 'address' },
                { label: 'Kiwango cha Juu cha Deni (Credit Limit)', key: 'credit_limit', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">{f.label}</label>
                  <input type={f.type || 'text'} required={f.req} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500" />
                </div>
              ))}
              {err && <p className="text-rose-400 text-[10px] font-bold">{err}</p>}
              <div className="flex justify-between items-center pt-2 flex-wrap gap-2">
                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black uppercase">
                    {saving ? 'Inahifadhi...' : editing ? 'Hifadhi' : 'Ongeza'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
                </div>
                {editing && (
                  !dc ? <button type="button" onClick={() => setDc(true)} className="py-2 px-3 rounded-xl bg-rose-500/10 text-rose-400 text-[10px] font-black">🗑 Futa</button>
                  : (
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] text-rose-400">Uhakika?</span>
                      <button type="button" onClick={() => remove(editing.id)} className="py-1.5 px-3 rounded-lg bg-rose-600 text-white text-[10px] font-black">Ndio</button>
                      <button type="button" onClick={() => setDc(false)} className="py-1.5 px-3 rounded-lg bg-slate-700 text-slate-300 text-[10px] font-black">Hapana</button>
                    </div>
                  )
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {detail && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h3 className="text-sm font-black text-white uppercase">👤 {detail.name}</h3>
              <button onClick={() => setDetail(null)} className="text-slate-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-950 rounded-xl p-3"><p className="text-[9px] text-slate-500 uppercase font-black">Deni</p><p className="text-sm font-black text-rose-400">{fmtTZS(detail.credit_balance)}</p></div>
                <div className="bg-slate-950 rounded-xl p-3"><p className="text-[9px] text-slate-500 uppercase font-black">Kikomo</p><p className="text-sm font-black text-slate-300">{fmtTZS(detail.credit_limit)}</p></div>
                <div className="bg-slate-950 rounded-xl p-3"><p className="text-[9px] text-slate-500 uppercase font-black">Pointi</p><p className="text-sm font-black text-amber-400">⭐ {detail.loyalty_points || 0}</p></div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Historia ya Ununuzi</h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {purchases.length === 0 && <p className="text-slate-600 text-xs text-center py-4">Bado hajanunua kwenye POS.</p>}
                  {purchases.map(s => (
                    <div key={s.id} className="flex justify-between text-[10px] bg-slate-950 rounded-lg px-3 py-2">
                      <span className="text-slate-400">{s.sale_no} · {fmtDate(s.created_at)}</span>
                      <span className="text-emerald-400 font-black">{fmtTZS(s.total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Rejesta ya Pointi za Uaminifu</h4>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {loyalty.length === 0 && <p className="text-slate-600 text-xs text-center py-4">Hakuna miamala bado.</p>}
                  {loyalty.map(l => (
                    <div key={l.id} className="flex justify-between text-[10px] bg-slate-950 rounded-lg px-3 py-2">
                      <span className="text-slate-400">{l.reason} · {fmtDate(l.created_at)}</span>
                      <span className={l.points_delta >= 0 ? 'text-amber-400 font-black' : 'text-rose-400 font-black'}>{l.points_delta >= 0 ? '+' : ''}{l.points_delta}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
