import React, { useState, useEffect, useCallback } from 'react';
import * as proc from '../../lib/procurementService';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const STATUS_BADGE = {
  DRAFT: 'bg-slate-700 text-slate-300', ORDERED: 'bg-blue-500/10 text-blue-400',
  PARTIALLY_RECEIVED: 'bg-amber-500/10 text-amber-400', RECEIVED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-rose-500/10 text-rose-400',
};

export default function PurchaseOrdersTab({ products, currentUser, branchId }) {
  const [pos, setPos] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p, error }, { data: s }] = await Promise.all([proc.fetchPurchaseOrders(), proc.fetchSuppliers()]);
    if (error) setErr(error); else setPos(p || []);
    setSuppliers(s || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancel = async (id) => {
    const { error } = await proc.cancelPurchaseOrder(id);
    if (error) setErr(error); else load();
  };

  const filtered = filter === 'ALL' ? pos : pos.filter(p => p.status === filter);
  const statuses = ['ALL', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">📥 Maagizo ya Ununuzi ({pos.length})</h2>
        <button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase">+ PO Mpya</button>
      </div>

      <div className="flex gap-1 flex-wrap">
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 text-[9px] font-black rounded-lg uppercase ${filter === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {s === 'ALL' ? 'Zote' : s}
          </button>
        ))}
      </div>

      {err && <p className="text-rose-400 text-[10px] font-bold text-center bg-rose-500/10 rounded-lg py-1.5">{err}</p>}

      <div className="space-y-2">
        {loading ? <p className="text-center text-slate-600 text-xs py-8">Inapakia...</p> :
        filtered.length === 0 ? <p className="text-center text-slate-600 text-xs py-8">Hakuna maagizo.</p> :
        filtered.map(po => {
          const totalOrdered = po.po_items?.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0) || 0;
          const fullyReceived = po.po_items?.every(i => i.quantity_received >= i.quantity_ordered);
          return (
            <div key={po.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <p className="text-xs font-black text-white">{po.po_no}</p>
                  <p className="text-[10px] text-slate-500">{po.suppliers?.name} · {fmtDate(po.created_at)}</p>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${STATUS_BADGE[po.status]}`}>{po.status}</span>
              </div>
              <div className="mt-2 space-y-1">
                {po.po_items?.map(i => (
                  <div key={i.id} className="flex justify-between text-[10px] text-slate-400">
                    <span>{i.products?.name} — {i.quantity_received}/{i.quantity_ordered} {i.products?.unit || 'pcs'}</span>
                    <span>{fmtTZS(i.quantity_ordered * i.unit_cost)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-black text-emerald-400">{fmtTZS(totalOrdered)}</span>
                <div className="flex gap-1.5">
                  {!fullyReceived && po.status !== 'CANCELLED' && po.status !== 'RECEIVED' && (
                    <button onClick={() => setReceiveTarget(po)} className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1.5 rounded-lg">📦 Pokea Bidhaa (GRN)</button>
                  )}
                  {po.status === 'ORDERED' && (
                    <button onClick={() => cancel(po.id)} className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-2 py-1.5 rounded-lg">✕ Ghairi</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <CreatePOModal suppliers={suppliers} products={products} currentUser={currentUser} branchId={branchId}
          onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}
      {receiveTarget && (
        <ReceiveGRNModal po={receiveTarget} onClose={() => setReceiveTarget(null)} onSaved={() => { setReceiveTarget(null); load(); }} />
      )}
    </div>
  );
}

function CreatePOModal({ suppliers, products, currentUser, branchId, onClose, onSaved }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ product_id: '', quantity_ordered: '', unit_cost: '' }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const addLine = () => setLines(prev => [...prev, { product_id: '', quantity_ordered: '', unit_cost: '' }]);
  const updateLine = (i, field, val) => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  const removeLine = (i) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const onPickProduct = (i, productId) => {
    const p = products.find(x => x.id === productId);
    updateLine(i, 'product_id', productId);
    if (p) updateLine(i, 'unit_cost', String(p.cost_price || ''));
  };

  const save = async () => {
    setErr('');
    if (!supplierId) { setErr('Chagua msambazaji.'); return; }
    const items = lines.filter(l => l.product_id && Number(l.quantity_ordered) > 0)
      .map(l => ({ product_id: l.product_id, quantity_ordered: Number(l.quantity_ordered), unit_cost: Number(l.unit_cost || 0) }));
    if (items.length === 0) { setErr('Ongeza angalau bidhaa moja.'); return; }
    setSaving(true);
    const { error } = await proc.createPurchaseOrder({
      supplier_id: supplierId, branch_id: branchId, expected_date: expectedDate, notes,
      created_by: currentUser?.id, items,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b border-slate-800">
          <h3 className="text-sm font-black text-white uppercase">+ Agizo Jipya la Ununuzi (PO)</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Msambazaji *</label>
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white">
              <option value="">-- Chagua --</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Tarehe Inayotarajiwa</label>
            <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <p className="text-[9px] font-black uppercase text-slate-500">Bidhaa</p>
            {lines.map((l, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <select value={l.product_id} onChange={e => onPickProduct(i, e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white">
                  <option value="">-- Bidhaa --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" min="1" value={l.quantity_ordered} onChange={e => updateLine(i, 'quantity_ordered', e.target.value)}
                  placeholder="Idadi" className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                <input type="number" min="0" value={l.unit_cost} onChange={e => updateLine(i, 'unit_cost', e.target.value)}
                  placeholder="Bei/kitu" className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                {lines.length > 1 && <button onClick={() => removeLine(i)} className="text-rose-400 text-[10px]">✕</button>}
              </div>
            ))}
            <button onClick={addLine} className="text-[9px] text-blue-400 font-bold">+ Ongeza bidhaa</button>
          </div>

          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Maelezo (hiari)" rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />

          {err && <p className="text-rose-400 text-[10px] font-bold">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black uppercase">
              {saving ? 'Inahifadhi...' : 'Tuma Agizo'}
            </button>
            <button onClick={onClose} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiveGRNModal({ po, onClose, onSaved }) {
  const [lines, setLines] = useState(
    po.po_items.filter(i => i.quantity_received < i.quantity_ordered).map(i => ({
      po_item_id: i.id, product_id: i.product_id, name: i.products?.name,
      remaining: i.quantity_ordered - i.quantity_received,
      quantity_received: String(i.quantity_ordered - i.quantity_received),
      unit_cost: String(i.unit_cost), batch_no: '', expiry_date: '',
    }))
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const updateLine = (i, field, val) => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const save = async () => {
    setErr('');
    const items = lines.filter(l => Number(l.quantity_received) > 0);
    if (items.length === 0) { setErr('Weka idadi iliyopokewa kwa angalau bidhaa moja.'); return; }
    setSaving(true);
    const { error } = await proc.receiveGoods({
      po_id: po.id, supplier_id: po.supplier_id, note: 'GRN via Admin Panel',
      items: items.map(l => ({
        po_item_id: l.po_item_id, product_id: l.product_id,
        quantity_received: Number(l.quantity_received), unit_cost: Number(l.unit_cost || 0),
        batch_no: l.batch_no || null, expiry_date: l.expiry_date || null,
      })),
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b border-slate-800">
          <h3 className="text-sm font-black text-white uppercase">📦 Pokea Bidhaa — {po.po_no}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-[10px] text-slate-500">Kupokea kunaongeza stoki moja kwa moja na kuunda kundi (batch) jipya lenye tarehe ya mwisho endapo ipo.</p>
          {lines.map((l, i) => (
            <div key={l.po_item_id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <p className="text-[11px] font-bold text-white">{l.name} <span className="text-slate-600">(Iliyobaki: {l.remaining})</span></p>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="0" max={l.remaining} value={l.quantity_received} onChange={e => updateLine(i, 'quantity_received', e.target.value)}
                  placeholder="Idadi Iliyopokewa" className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                <input type="number" min="0" value={l.unit_cost} onChange={e => updateLine(i, 'unit_cost', e.target.value)}
                  placeholder="Bei ya Gharama" className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                <input value={l.batch_no} onChange={e => updateLine(i, 'batch_no', e.target.value)}
                  placeholder="Namba ya Kundi (hiari)" className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                <input type="date" value={l.expiry_date} onChange={e => updateLine(i, 'expiry_date', e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white" />
              </div>
            </div>
          ))}
          {err && <p className="text-rose-400 text-[10px] font-bold">{err}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black uppercase">
              {saving ? 'Inachakata...' : '✓ Thibitisha Upokeaji'}
            </button>
            <button onClick={onClose} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
          </div>
        </div>
      </div>
    </div>
  );
}
