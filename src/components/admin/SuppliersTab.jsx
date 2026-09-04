import React, { useState, useEffect, useCallback } from 'react';
import * as proc from '../../lib/procurementService';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const EMPTY = { name: '', contact_person: '', phone: '', email: '', address: '', notes: '' };
const PO_STATUS_BADGE = {
  DRAFT: 'bg-slate-700 text-slate-300', ORDERED: 'bg-blue-500/10 text-blue-400',
  PARTIALLY_RECEIVED: 'bg-amber-500/10 text-amber-400', RECEIVED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-rose-500/10 text-rose-400',
};

export default function SuppliersTab() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null); // supplier being viewed
  const [history, setHistory] = useState([]);
  const [balance, setBalance] = useState(null);
  const [dc, setDc] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await proc.fetchSuppliers();
    if (error) setErr(error); else setSuppliers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (s) => { setEditing(s); setForm({ name: s.name, contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '' }); setShowModal(true); };

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setErr('');
    const payload = { ...form, name: form.name.trim() };
    const { error } = editing ? await proc.updateSupplier(editing.id, payload) : await proc.createSupplier(payload);
    setSaving(false);
    if (error) { setErr(error); return; }
    setShowModal(false); load();
  };

  const remove = async (id) => {
    setSaving(true);
    const { error } = await proc.deleteSupplier(id);
    setSaving(false); setDc(false);
    if (error) { setErr(error); return; }
    setShowModal(false); load();
  };

  const openDetail = async (s) => {
    setDetail(s);
    const [{ data: h }, { data: b }] = await Promise.all([proc.fetchSupplierHistory(s.id), proc.fetchSupplierBalance(s.id)]);
    setHistory(h || []); setBalance(b);
  };

  const filtered = suppliers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">🏭 Wasambazaji ({suppliers.length})</h2>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase">+ Msambazaji</button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tafuta msambazaji..."
        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500" />

      {err && <p className="text-rose-400 text-[10px] font-bold text-center bg-rose-500/10 rounded-lg py-1.5">{err}</p>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="py-12 text-center text-slate-600 text-xs">Inapakia...</div> :
        filtered.length === 0 ? (
          <div className="py-12 text-center"><p className="text-2xl">🏭</p><p className="text-xs text-slate-600 font-bold mt-2">Hakuna wasambazaji.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>{['Jina', 'Mawasiliano', 'Simu', 'Vitendo'].map(h => <th key={h} className="px-3 py-3 text-[9px] font-black text-slate-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-800/30">
                    <td className="px-3 py-3">
                      <button onClick={() => openDetail(s)} className="font-bold text-white text-xs hover:text-blue-400 text-left">{s.name}</button>
                      {s.contact_person && <p className="text-slate-600 text-[9px]">{s.contact_person}</p>}
                    </td>
                    <td className="px-3 py-3 text-slate-400 text-[10px]">{s.email || '—'}</td>
                    <td className="px-3 py-3 font-mono text-slate-400 text-[10px]">{s.phone || '—'}</td>
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

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h3 className="text-sm font-black text-white uppercase">{editing ? '✏️ Hariri Msambazaji' : '+ Msambazaji Mpya'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              {[
                { label: 'Jina la Kampuni *', key: 'name', req: true },
                { label: 'Mtu wa Mawasiliano', key: 'contact_person' },
                { label: 'Simu', key: 'phone' },
                { label: 'Barua Pepe', key: 'email', type: 'email' },
                { label: 'Anwani', key: 'address' },
                { label: 'Maelezo', key: 'notes' },
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

      {/* SUPPLIER DETAIL / HISTORY */}
      {detail && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h3 className="text-sm font-black text-white uppercase">🏭 {detail.name}</h3>
              <button onClick={() => setDetail(null)} className="text-slate-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950 rounded-xl p-3"><p className="text-[9px] text-slate-500 uppercase font-black">Jumla Alizonunua</p><p className="text-sm font-black text-blue-400">{fmtTZS(balance?.total_invoiced)}</p></div>
                <div className="bg-slate-950 rounded-xl p-3"><p className="text-[9px] text-slate-500 uppercase font-black">Deni Lililobaki</p><p className="text-sm font-black text-rose-400">{fmtTZS(balance?.outstanding)}</p></div>
              </div>
              <h4 className="text-[10px] font-black text-slate-500 uppercase">Historia ya Maagizo (PO)</h4>
              <div className="space-y-2">
                {history.length === 0 && <p className="text-slate-600 text-xs text-center py-6">Hakuna maagizo bado.</p>}
                {history.map(po => (
                  <div key={po.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-slate-400">{po.po_no}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${PO_STATUS_BADGE[po.status]}`}>{po.status}</span>
                    </div>
                    <p className="text-[9px] text-slate-600 mt-1">{fmtDate(po.created_at)} · Bidhaa {po.po_items?.length || 0}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
