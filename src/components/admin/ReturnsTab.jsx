import React, { useState, useEffect, useCallback } from 'react';
import * as pos from '../../lib/posService';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;
const fmtDateTime = d => new Date(d).toLocaleString('sw-TZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function ReturnsTab({ currentUser }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [returnQty, setReturnQty] = useState({}); // sale_item_id -> qty
  const [restockFlags, setRestockFlags] = useState({}); // sale_item_id -> bool
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data } = await pos.fetchReturnHistory();
    setHistory(data || []);
    setLoadingHistory(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const doSearch = async () => {
    if (!search.trim()) return;
    const { data } = await pos.fetchSaleByNumber(search.trim());
    setResults(data || []);
  };

  const openSale = (sale) => {
    setSelectedSale(sale);
    setReturnQty({}); setRestockFlags({}); setReason(''); setMsg('');
  };

  // quantity already returned per sale_item, across all prior returns on this sale
  const alreadyReturned = (saleItemId) => {
    let total = 0;
    (selectedSale?.pos_returns || []).forEach(r => {
      (r.pos_return_items || []).forEach(ri => { if (ri.sale_item_id === saleItemId) total += ri.quantity; });
    });
    return total;
  };

  const submit = async () => {
    const items = Object.entries(returnQty)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([saleItemId, qty]) => {
        const line = selectedSale.pos_sale_items.find(i => i.id === saleItemId);
        return { sale_item_id: saleItemId, product_id: line.product_id, quantity: Number(qty), restock: restockFlags[saleItemId] !== false };
      });
    if (items.length === 0) { setMsg('Chagua angalau bidhaa moja ya kurejesha.'); return; }
    if (!reason.trim()) { setMsg('Weka sababu ya marejesho.'); return; }

    setSubmitting(true); setMsg('');
    const { error } = await pos.createReturn(selectedSale.id, items, reason.trim(), currentUser?.id);
    setSubmitting(false);
    if (error) { setMsg('❌ ' + error); return; }
    setMsg('✅ Marejesho yamekamilika — stoki imesasishwa kiotomatiki.');
    setSelectedSale(null); setResults([]); setSearch('');
    loadHistory();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-black text-white uppercase tracking-wide">↩️ Marejesho ya Bidhaa (Returns)</h2>

      {/* SEARCH */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <p className="text-[10px] font-black text-slate-500 uppercase">Tafuta Mauzo kwa Namba ya Risiti</p>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Mfano: SALE-260905" className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
          <button onClick={doSearch} className="px-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-xs font-black uppercase">Tafuta</button>
        </div>
        {results.length > 0 && (
          <div className="space-y-1.5">
            {results.map(s => (
              <button key={s.id} onClick={() => openSale(s)}
                className="w-full text-left bg-slate-950 border border-slate-800 hover:border-blue-500 rounded-xl px-3 py-2.5 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-white">{s.sale_no}</p>
                  <p className="text-[9px] text-slate-500">{fmtDateTime(s.created_at)} · {s.customers?.name || 'Mteja wa Kawaida'}</p>
                </div>
                <span className="text-xs font-black text-emerald-400">{fmtTZS(s.total)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SELECTED SALE — pick items to return */}
      {selectedSale && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs font-black text-white">{selectedSale.sale_no}</p>
            <button onClick={() => setSelectedSale(null)} className="text-slate-500 text-xs">✕</button>
          </div>
          <div className="space-y-2">
            {selectedSale.pos_sale_items.map(item => {
              const already = alreadyReturned(item.id);
              const maxReturnable = item.quantity - already;
              return (
                <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-white">{item.products?.name}</p>
                    <p className="text-[10px] text-slate-500">Alinunua: {item.quantity} · AmeshaLetesha rudisha: {already}</p>
                  </div>
                  {maxReturnable <= 0 ? (
                    <p className="text-[9px] text-amber-500">Bidhaa hii tayari imerejeshwa kikamilifu.</p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" max={maxReturnable} value={returnQty[item.id] || ''}
                        onChange={e => setReturnQty(p => ({ ...p, [item.id]: e.target.value }))}
                        placeholder="Idadi ya kurejesha" className="w-32 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                      <label className="flex items-center gap-1.5 text-[9px] text-slate-400">
                        <input type="checkbox" checked={restockFlags[item.id] !== false} onChange={e => setRestockFlags(p => ({ ...p, [item.id]: e.target.checked }))} />
                        Rudisha stokini
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Sababu ya marejesho (lazima)"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
          {msg && <p className="text-[10px] font-bold text-center">{msg}</p>}
          <button onClick={submit} disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-black uppercase">
            {submitting ? 'Inachakata...' : '↩️ Thibitisha Marejesho'}
          </button>
        </div>
      )}

      {/* HISTORY */}
      <div>
        <h3 className="text-[10px] font-black text-slate-500 uppercase mb-2">Historia ya Marejesho</h3>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {loadingHistory ? <p className="text-center text-slate-600 text-xs py-8">Inapakia...</p> :
          history.length === 0 ? <p className="text-center text-slate-600 text-xs py-8">Hakuna marejesho bado.</p> : (
            <div className="divide-y divide-slate-800/60">
              {history.map(r => (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-white">{r.pos_sales?.sale_no}</p>
                    <span className="text-[9px] text-slate-500">{fmtDateTime(r.created_at)}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{r.reason}</p>
                  <div className="mt-1 space-y-0.5">
                    {(r.pos_return_items || []).map((ri, i) => (
                      <p key={i} className="text-[10px] text-slate-400">• {ri.pos_sale_items?.products?.name} × {ri.quantity}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
