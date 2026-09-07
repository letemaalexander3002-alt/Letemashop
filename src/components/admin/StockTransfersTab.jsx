import React, { useState, useEffect, useCallback } from 'react';
import * as xfer from '../../lib/transferService';
import * as pos from '../../lib/posService';

const fmtDateTime = d => d ? new Date(d).toLocaleString('sw-TZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const STATUS_BADGE = {
  PENDING: 'bg-slate-700 text-slate-300', IN_TRANSIT: 'bg-amber-500/10 text-amber-400',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-400', CANCELLED: 'bg-rose-500/10 text-rose-400',
};
const STATUS_LABEL = { PENDING: 'Inasubiri Kutumwa', IN_TRANSIT: 'Njiani', CONFIRMED: 'Imepokewa', CANCELLED: 'Imeghairiwa' };

export default function StockTransfersTab({ products, currentUser, branches, onBranchesChanged }) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await xfer.fetchTransfers();
    if (error) setErr(error); else setTransfers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, id) => {
    setBusyId(id); setErr('');
    const { error } = await fn(id);
    setBusyId(null);
    if (error) { setErr(error); return; }
    load();
  };

  if (branches.length < 2) {
    return (
      <div className="max-w-sm mx-auto py-16 space-y-4 text-center">
        <p className="text-3xl">🏬</p>
        <h3 className="text-sm font-black text-white uppercase">Ongeza Tawi la Pili</h3>
        <p className="text-[11px] text-slate-500">Uhamisho wa stoki unahitaji angalau matawi mawili. Kwa sasa una tawi moja tu ({branches[0]?.name}).</p>
        <button onClick={() => setShowAddBranch(true)} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase">+ Ongeza Tawi</button>
        {showAddBranch && <AddBranchModal onClose={() => setShowAddBranch(false)} onSaved={() => { setShowAddBranch(false); onBranchesChanged?.(); }} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">🚚 Uhamisho wa Stoki Baina ya Matawi</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowAddBranch(true)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black px-3 py-2 rounded-xl uppercase">+ Tawi</button>
          <button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase">+ Uhamisho Mpya</button>
        </div>
      </div>

      <p className="text-[10px] text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-3">
        ℹ️ Mchakato una hatua mbili: <b className="text-white">Tuma</b> (bidhaa zinaondoka tawi la chanzi, hutolewa kwa mfumo wa FIFO) kisha <b className="text-white">Pokea</b> (tawi linalopokea linathibitisha bidhaa zimefika). Bei ya gharama na tarehe ya mwisho husafiri pamoja na bidhaa.
      </p>

      {err && <p className="text-rose-400 text-[10px] font-bold text-center bg-rose-500/10 rounded-lg py-1.5">{err}</p>}

      <div className="space-y-2">
        {loading ? <p className="text-center text-slate-600 text-xs py-8">Inapakia...</p> :
        transfers.length === 0 ? <p className="text-center text-slate-600 text-xs py-8">Hakuna uhamisho bado.</p> :
        transfers.map(t => (
          <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="text-xs font-black text-white">{t.from?.name} → {t.to?.name}</p>
                <p className="text-[10px] text-slate-500">{fmtDateTime(t.created_at)}</p>
              </div>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${STATUS_BADGE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
            </div>
            <div className="mt-2 space-y-1">
              {t.stock_transfer_items?.map(i => (
                <div key={i.id} className="flex justify-between text-[10px] text-slate-400">
                  <span>{i.products?.name}</span>
                  <span>{i.quantity} {i.products?.unit || 'pcs'}</span>
                </div>
              ))}
            </div>
            {t.note && <p className="text-[9px] text-slate-600 mt-1.5 italic">"{t.note}"</p>}
            <div className="flex gap-1.5 mt-3 pt-2 border-t border-slate-800">
              {t.status === 'PENDING' && (
                <>
                  <button onClick={() => act(xfer.dispatchTransfer, t.id)} disabled={busyId === t.id}
                    className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2.5 py-1.5 rounded-lg disabled:opacity-40">
                    {busyId === t.id ? '...' : '📤 Tuma (Dispatch)'}
                  </button>
                  <button onClick={() => act(xfer.cancelTransfer, t.id)} disabled={busyId === t.id}
                    className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-2.5 py-1.5 rounded-lg disabled:opacity-40">✕ Ghairi</button>
                </>
              )}
              {t.status === 'IN_TRANSIT' && (
                <button onClick={() => act(xfer.confirmTransfer, t.id)} disabled={busyId === t.id}
                  className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg disabled:opacity-40">
                  {busyId === t.id ? '...' : '📥 Thibitisha Umepokea'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <CreateTransferModal products={products} branches={branches} currentUser={currentUser}
          onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}
      {showAddBranch && <AddBranchModal onClose={() => setShowAddBranch(false)} onSaved={() => { setShowAddBranch(false); onBranchesChanged?.(); }} />}
    </div>
  );
}

function CreateTransferModal({ products, branches, onClose, onSaved }) {
  const [fromBranch, setFromBranch] = useState(branches[0]?.id || '');
  const [toBranch, setToBranch] = useState(branches[1]?.id || '');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([{ product_id: '', quantity: '' }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const addLine = () => setLines(prev => [...prev, { product_id: '', quantity: '' }]);
  const updateLine = (i, field, val) => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  const removeLine = (i) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    setErr('');
    if (fromBranch === toBranch) { setErr('Chagua matawi mawili tofauti.'); return; }
    const items = lines.filter(l => l.product_id && Number(l.quantity) > 0).map(l => ({ product_id: l.product_id, quantity: Number(l.quantity) }));
    if (items.length === 0) { setErr('Ongeza angalau bidhaa moja.'); return; }
    setSaving(true);
    const { error } = await xfer.createTransfer({ from_branch: fromBranch, to_branch: toBranch, note, items });
    setSaving(false);
    if (error) { setErr(error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b border-slate-800">
          <h3 className="text-sm font-black text-white uppercase">+ Uhamisho Mpya wa Stoki</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Kutoka</label>
              <select value={fromBranch} onChange={e => setFromBranch(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white">
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Kwenda</label>
              <select value={toBranch} onChange={e => setToBranch(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white">
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <p className="text-[9px] font-black uppercase text-slate-500">Bidhaa</p>
            {lines.map((l, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <select value={l.product_id} onChange={e => updateLine(i, 'product_id', e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white">
                  <option value="">-- Bidhaa --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" min="1" value={l.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)}
                  placeholder="Idadi" className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                {lines.length > 1 && <button onClick={() => removeLine(i)} className="text-rose-400 text-[10px]">✕</button>}
              </div>
            ))}
            <button onClick={addLine} className="text-[9px] text-blue-400 font-bold">+ Ongeza bidhaa</button>
          </div>

          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Maelezo (hiari)" rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />

          {err && <p className="text-rose-400 text-[10px] font-bold">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black uppercase">
              {saving ? 'Inahifadhi...' : 'Tengeneza Ombi la Uhamisho'}
            </button>
            <button onClick={onClose} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddBranchModal({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!name.trim()) { setErr('Weka jina la tawi.'); return; }
    setSaving(true);
    const { error } = await pos.createBranch(name.trim(), location.trim() || null);
    setSaving(false);
    if (error) { setErr(error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-3">
        <h3 className="text-sm font-black text-white uppercase">+ Tawi Jipya</h3>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Jina la Tawi (mf. Tawi la Kondoa)"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Mahali (hiari)"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
        {err && <p className="text-rose-400 text-[10px] font-bold">{err}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black uppercase">{saving ? '...' : 'Hifadhi'}</button>
          <button onClick={onClose} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
        </div>
      </div>
    </div>
  );
}
