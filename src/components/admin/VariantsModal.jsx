import React, { useState, useEffect, useCallback } from 'react';
import * as variantService from '../../lib/variantService';

export default function VariantsModal({ product, onClose }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ variant_name: '', sku: '', barcode: '', price_override: '', stock_quantity: '0' });
  const [saving, setSaving] = useState(false);
  const [dcId, setDcId] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await variantService.fetchVariants(product.id);
    if (error) setErr(error); else setVariants(data || []);
    setLoading(false);
  }, [product.id]);

  useEffect(() => { load(); }, [load]);

  const addVariant = async () => {
    if (!form.variant_name.trim()) { setErr('Weka jina la aina (mfano: Nyekundu / Kubwa).'); return; }
    setSaving(true); setErr('');
    const { error } = await variantService.createVariant({
      product_id: product.id,
      variant_name: form.variant_name.trim(),
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      price_override: form.price_override ? Number(form.price_override) : null,
      stock_quantity: Number(form.stock_quantity || 0),
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    setForm({ variant_name: '', sku: '', barcode: '', price_override: '', stock_quantity: '0' });
    load();
  };

  const updateStock = async (variant, delta) => {
    await variantService.updateVariant(variant.id, { stock_quantity: Math.max(0, Number(variant.stock_quantity) + delta) });
    load();
  };

  const remove = async (id) => {
    const { error } = await variantService.deleteVariant(id);
    if (error) { setErr(error); return; }
    setDcId(null); load();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-black text-white uppercase">🎨 Aina za Bidhaa</h3>
            <p className="text-[10px] text-slate-500">{product.name} — bei ya msingi: {Number(product.price).toLocaleString()} TZS</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[10px] text-slate-500 bg-slate-950 border border-slate-800 rounded-xl p-3">
            ℹ️ Tumia hii kwa bidhaa moja yenye aina tofauti (mfano: rangi, ukubwa). Kila aina inaweza kuwa na bei tofauti (hiari) na stoki yake yenyewe. Ukiacha "Bei Maalum" wazi, aina hiyo itatumia bei ya msingi ya bidhaa.
          </p>

          {err && <p className="text-rose-400 text-[10px] font-bold text-center bg-rose-500/10 rounded-lg py-1.5">{err}</p>}

          {/* Existing variants */}
          <div className="space-y-2">
            {loading ? <p className="text-center text-slate-600 text-xs py-6">Inapakia...</p> :
            variants.length === 0 ? <p className="text-center text-slate-600 text-xs py-6">Bado hakuna aina zilizoongezwa.</p> :
            variants.map(v => (
              <div key={v.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-xs font-bold text-white">{v.variant_name}</p>
                  <p className="text-[9px] text-slate-500 font-mono">{v.sku || '—'} {v.barcode ? `· ${v.barcode}` : ''}</p>
                  {v.price_override && <p className="text-[9px] text-amber-400">Bei Maalum: {Number(v.price_override).toLocaleString()} TZS</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateStock(v, -1)} className="w-6 h-6 rounded-lg bg-slate-800 text-white text-xs font-black">−</button>
                  <span className="text-xs font-black text-white w-8 text-center">{v.stock_quantity}</span>
                  <button onClick={() => updateStock(v, 1)} className="w-6 h-6 rounded-lg bg-slate-800 text-white text-xs font-black">+</button>
                  {dcId === v.id ? (
                    <>
                      <button onClick={() => remove(v.id)} className="text-[9px] font-black bg-rose-600 text-white px-2 py-1 rounded-lg">Ndio</button>
                      <button onClick={() => setDcId(null)} className="text-[9px] font-black bg-slate-700 text-slate-300 px-2 py-1 rounded-lg">Hapana</button>
                    </>
                  ) : (
                    <button onClick={() => setDcId(v.id)} className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg">🗑</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add new variant */}
          <div className="border-t border-slate-800 pt-4 space-y-2">
            <p className="text-[9px] font-black uppercase text-slate-500">+ Ongeza Aina Mpya</p>
            <input value={form.variant_name} onChange={e => setForm(p => ({ ...p, variant_name: e.target.value }))}
              placeholder="Jina la Aina (mfano: Nyekundu / Kubwa)" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} placeholder="SKU (hiari)"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
              <input value={form.barcode} onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))} placeholder="Barcode (hiari)"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
              <input type="number" value={form.price_override} onChange={e => setForm(p => ({ ...p, price_override: e.target.value }))} placeholder="Bei Maalum (hiari)"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
              <input type="number" value={form.stock_quantity} onChange={e => setForm(p => ({ ...p, stock_quantity: e.target.value }))} placeholder="Stoki ya Awali"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
            </div>
            <button onClick={addVariant} disabled={saving} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black uppercase">
              {saving ? 'Inahifadhi...' : '+ Ongeza Aina'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
