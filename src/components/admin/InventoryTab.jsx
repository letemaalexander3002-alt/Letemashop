import React, { useState, useEffect, useCallback } from 'react';
import * as pos from '../../lib/posService';
import { supabase } from '../../utils/supabaseClient';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;
const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

export default function InventoryTab({ products, onReload }) {
  const [subTab, setSubTab] = useState('lowstock');
  const [expiring, setExpiring] = useState([]);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [batchTarget, setBatchTarget] = useState(null);
  const [batchForm, setBatchForm] = useState({ batch_no: '', quantity: '', cost_price: '', expiry_date: '' });
  const [savingBatch, setSavingBatch] = useState(false);
  const [reconItems, setReconItems] = useState({}); // productId -> counted qty
  const [reconResult, setReconResult] = useState(null);
  const [msg, setMsg] = useState('');

  const loadExpiring = useCallback(async () => {
    const { data } = await pos.fetchExpiringBatches(45);
    setExpiring(data || []);
  }, []);

  useEffect(() => { loadExpiring(); }, [loadExpiring]);

  const lowStock = products.filter(p => p.is_active && Number(p.stock_quantity) <= Number(p.reorder_level ?? 5));

  const runAdjustment = async () => {
    if (!adjustTarget || !adjustDelta || !adjustReason.trim()) { setMsg('Jaza kiasi na sababu.'); return; }
    setAdjusting(true);
    const { error } = await pos.adjustStock(adjustTarget.id, Number(adjustDelta), adjustReason.trim());
    setAdjusting(false);
    if (error) { setMsg('❌ ' + error); return; }
    setMsg('✅ Stoki imesasishwa na imeandikwa kwenye rejesta ya ukaguzi (audit log).');
    setAdjustTarget(null); setAdjustDelta(''); setAdjustReason('');
    onReload?.();
  };

  const saveBatch = async () => {
    if (!batchTarget || !batchForm.quantity) { setMsg('Weka idadi ya kundi (batch).'); return; }
    setSavingBatch(true);
    const { error } = await pos.createBatch({
      product_id: batchTarget.id,
      batch_no: batchForm.batch_no || null,
      quantity: Number(batchForm.quantity),
      cost_price: Number(batchForm.cost_price || 0),
      expiry_date: batchForm.expiry_date || null,
    });
    if (!error) {
      // batches represent incoming stock — reflect it in the product's overall count too
      await pos.adjustStock(batchTarget.id, Number(batchForm.quantity), `Kundi jipya: ${batchForm.batch_no || 'bila namba'}`);
    }
    setSavingBatch(false);
    if (error) { setMsg('❌ ' + error); return; }
    setMsg('✅ Kundi (batch) limeongezwa na stoki imesasishwa.');
    setBatchTarget(null); setBatchForm({ batch_no: '', quantity: '', cost_price: '', expiry_date: '' });
    loadExpiring(); onReload?.();
  };

  const startRecon = () => {
    const init = {};
    products.filter(p => p.is_active).forEach(p => { init[p.id] = String(p.stock_quantity ?? 0); });
    setReconItems(init); setReconResult(null); setSubTab('recon');
  };

  const finishRecon = () => {
    const rows = products.filter(p => p.is_active).map(p => {
      const counted = Number(reconItems[p.id] ?? p.stock_quantity);
      const discrepancy = counted - Number(p.stock_quantity);
      return { product: p, counted, discrepancy };
    }).filter(r => r.discrepancy !== 0);
    setReconResult(rows);
  };

  const applyReconAdjustments = async () => {
    if (!reconResult?.length) return;
    setMsg('Inasasisha...');
    for (const r of reconResult) {
      await pos.adjustStock(r.product.id, r.discrepancy, 'Marekebisho ya ukaguzi wa stoo (reconciliation)');
    }
    setMsg(`✅ Marekebisho ${reconResult.length} yamehifadhiwa kwenye stoki na audit log.`);
    setReconResult(null);
    onReload?.();
  };

  const subTabs = [
    { id: 'lowstock', label: `⚠️ Stoki Chache (${lowStock.length})` },
    { id: 'expiry', label: `⏰ Muda wa Mwisho (${expiring.length})` },
    { id: 'recon', label: '📋 Ukaguzi wa Stoo' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl w-max min-w-full overflow-x-auto">
        {subTabs.map(t => (
          <button key={t.id} onClick={() => t.id === 'recon' ? startRecon() : setSubTab(t.id)}
            className={`px-3 py-2 text-[10px] font-black uppercase rounded-lg whitespace-nowrap transition-all ${subTab === t.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && <p className="text-[10px] font-bold text-center bg-slate-800 text-slate-300 rounded-lg py-2">{msg}</p>}

      {/* LOW STOCK */}
      {subTab === 'lowstock' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {lowStock.length === 0 ? (
            <div className="py-12 text-center"><p className="text-2xl">✅</p><p className="text-xs text-slate-600 font-bold mt-2">Stoki zote ziko sawa.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800">
                  <tr>{['Bidhaa', 'Stoki', 'Kiwango cha Chini', 'Vitendo'].map(h => (
                    <th key={h} className="px-3 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {lowStock.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="px-3 py-3 font-bold text-white">{p.name}</td>
                      <td className="px-3 py-3"><span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${p.stock_quantity === 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>{p.stock_quantity}</span></td>
                      <td className="px-3 py-3 text-slate-500">{p.reorder_level ?? 5}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => setAdjustTarget(p)} className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2 py-1.5 rounded-lg">± Rekebisha</button>
                          <button onClick={() => setBatchTarget(p)} className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1.5 rounded-lg">+ Kundi Jipya</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* EXPIRING BATCHES — FIFO */}
      {subTab === 'expiry' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {expiring.length === 0 ? (
            <div className="py-12 text-center"><p className="text-2xl">📦</p><p className="text-xs text-slate-600 font-bold mt-2">Hakuna bidhaa zinazokaribia mwisho wa matumizi.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800">
                  <tr>{['Bidhaa', 'Kundi', 'Idadi', 'Muda wa Mwisho', 'Siku Zilizobaki'].map(h => (
                    <th key={h} className="px-3 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {expiring.map(b => {
                    const d = daysUntil(b.expiry_date);
                    return (
                      <tr key={b.id} className="hover:bg-slate-800/30">
                        <td className="px-3 py-3 font-bold text-white">{b.products?.name}</td>
                        <td className="px-3 py-3 text-slate-500 font-mono text-[10px]">{b.batch_no || '—'}</td>
                        <td className="px-3 py-3 text-slate-300">{b.quantity}</td>
                        <td className="px-3 py-3 text-slate-400">{new Date(b.expiry_date).toLocaleDateString('sw-TZ')}</td>
                        <td className="px-3 py-3">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${d <= 7 ? 'bg-rose-500/10 text-rose-400' : d <= 21 ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                            {d <= 0 ? 'IMEISHA MUDA' : `Siku ${d} — Uze kwanza (FIFO)`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RECONCILIATION */}
      {subTab === 'recon' && (
        <div className="space-y-3">
          <p className="text-[10px] text-slate-500">Hesabu bidhaa zilizopo dukani kimwili kisha jaza idadi halisi hapa chini. Mfumo utaonyesha tofauti (discrepancy) na kuruhusu marekebisho ya moja kwa moja.</p>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-h-[50vh] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 sticky top-0">
                <tr>{['Bidhaa', 'Mfumo', 'Halisi (Ulichokihesabu)'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-[9px] font-black text-slate-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products.filter(p => p.is_active).map(p => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 text-white font-bold">{p.name}</td>
                    <td className="px-3 py-2 text-slate-500">{p.stock_quantity}</td>
                    <td className="px-3 py-2">
                      <input type="number" value={reconItems[p.id] ?? ''} onChange={e => setReconItems(prev => ({ ...prev, [p.id]: e.target.value }))}
                        className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-white" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={finishRecon} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase">Linganisha Tofauti</button>

          {reconResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-black text-white uppercase">Ripoti ya Tofauti (Discrepancy)</h4>
              {reconResult.length === 0 ? (
                <p className="text-emerald-400 text-[10px] font-bold">✅ Hakuna tofauti — stoki inalingana kabisa.</p>
              ) : (
                <>
                  {reconResult.map(r => (
                    <div key={r.product.id} className="flex justify-between text-[10px]">
                      <span className="text-slate-300">{r.product.name}</span>
                      <span className={r.discrepancy > 0 ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>
                        {r.discrepancy > 0 ? '+' : ''}{r.discrepancy}
                      </span>
                    </div>
                  ))}
                  <button onClick={applyReconAdjustments} className="w-full mt-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase">
                    ✓ Thibitisha Marekebisho Yote
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ADJUST MODAL */}
      {adjustTarget && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-3">
            <h3 className="text-sm font-black text-white uppercase">± Rekebisha Stoki — {adjustTarget.name}</h3>
            <p className="text-[10px] text-slate-500">Stoki ya sasa: {adjustTarget.stock_quantity}</p>
            <input type="number" value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)} placeholder="Mfano: -5 au +10"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
            <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Sababu (lazima kwa audit log)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
            <div className="flex gap-2">
              <button onClick={runAdjustment} disabled={adjusting} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black uppercase">
                {adjusting ? '...' : 'Hifadhi'}
              </button>
              <button onClick={() => setAdjustTarget(null)} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH MODAL */}
      {batchTarget && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-3">
            <h3 className="text-sm font-black text-white uppercase">+ Kundi Jipya — {batchTarget.name}</h3>
            <input value={batchForm.batch_no} onChange={e => setBatchForm(p => ({ ...p, batch_no: e.target.value }))} placeholder="Namba ya Kundi (hiari)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
            <input type="number" value={batchForm.quantity} onChange={e => setBatchForm(p => ({ ...p, quantity: e.target.value }))} placeholder="Idadi *"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
            <input type="number" value={batchForm.cost_price} onChange={e => setBatchForm(p => ({ ...p, cost_price: e.target.value }))} placeholder="Bei ya Gharama (TZS)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Muda wa Mwisho (kwa bidhaa zinazoharibika)</label>
              <input type="date" value={batchForm.expiry_date} onChange={e => setBatchForm(p => ({ ...p, expiry_date: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveBatch} disabled={savingBatch} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black uppercase">
                {savingBatch ? '...' : 'Hifadhi Kundi'}
              </button>
              <button onClick={() => setBatchTarget(null)} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
