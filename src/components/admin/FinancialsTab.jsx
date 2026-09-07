import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as fin from '../../lib/financialsService';
import DetailedSalesReportTab from './DetailedSalesReportTab';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;
const fmtDay = d => new Date(d).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short' });
const toISO = (d) => new Date(d).toISOString();
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

const PRESETS = [
  { id: 'today', label: 'Leo', days: 1 },
  { id: '7d', label: 'Siku 7', days: 7 },
  { id: '30d', label: 'Siku 30', days: 30 },
  { id: '90d', label: 'Siku 90', days: 90 },
];

/** Minimal dependency-free horizontal bar chart, matches the app's dark theme. */
function BarList({ rows, valueFmt = fmtTZS, barClass = 'bg-blue-500' }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="text-slate-400 truncate max-w-[60%]">{r.label}</span>
            <span className="text-slate-300 font-bold">{valueFmt(r.value)}</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full ${barClass} rounded-full`} style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="text-center text-slate-600 text-[10px] py-4">Hakuna takwimu.</p>}
    </div>
  );
}

export default function FinancialsTab({ products, role }) {
  const [preset, setPreset] = useState('30d');
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subView, setSubView] = useState('pnl');
  const [showExpense, setShowExpense] = useState(false);
  const [err, setErr] = useState('');

  const range = useMemo(() => {
    const p = PRESETS.find(x => x.id === preset) || PRESETS[2];
    const end = new Date(); end.setDate(end.getDate() + 1);
    const start = startOfDay(new Date(Date.now() - (p.days - 1) * 86400000));
    return { start, end };
  }, [preset]);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    const [{ data: s, error: se }, { data: e, error: ee }, { data: st }] = await Promise.all([
      fin.fetchSalesInRange(toISO(range.start), toISO(range.end)),
      fin.fetchExpensesInRange(range.start.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)),
      fin.listStaff(),
    ]);
    if (se) setErr(se); else if (ee) setErr(ee);
    setSales(s || []); setExpenses(e || []); setStaff(st || []);
    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);

  // ── P&L ──────────────────────────────────────────────────────────────────
  const revenue = sales.reduce((s, x) => s + Number(x.total), 0);
  const discountTotal = sales.reduce((s, x) => s + Number(x.discount_total), 0);
  const cogs = sales.reduce((s, x) => s + (x.pos_sale_items || []).reduce((a, i) => a + i.quantity * Number(i.cost_price_at_sale || 0), 0), 0);
  const grossProfit = revenue - cogs;
  const expensesTotal = expenses.reduce((s, x) => s + Number(x.amount), 0);
  const netProfit = grossProfit - expensesTotal;
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  // ── Breakdown by day ─────────────────────────────────────────────────────
  const byDay = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      const day = s.created_at.slice(0, 10);
      map[day] = (map[day] || 0) + Number(s.total);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
      .map(([day, value]) => ({ label: fmtDay(day), value }));
  }, [sales]);

  // ── Breakdown by staff (cashier) ─────────────────────────────────────────
  const byStaff = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      const key = s.cashier_id || 'unknown';
      if (!map[key]) map[key] = { count: 0, total: 0 };
      map[key].count += 1; map[key].total += Number(s.total);
    });
    return Object.entries(map).map(([uid, v]) => {
      const st = staff.find(x => x.user_id === uid);
      return { label: st?.full_name || st?.email || `Cashier ${uid.slice(0, 6)}`, value: v.total, count: v.count };
    }).sort((a, b) => b.value - a.value);
  }, [sales, staff]);

  // ── Breakdown by category ────────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map = {};
    sales.forEach(s => (s.pos_sale_items || []).forEach(i => {
      const cat = i.products?.category || 'Nyingine';
      map[cat] = (map[cat] || 0) + Number(i.line_total);
    }));
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [sales]);

  // ── Fast vs slow movers ──────────────────────────────────────────────────
  const velocity = useMemo(() => {
    const map = {};
    sales.forEach(s => (s.pos_sale_items || []).forEach(i => {
      if (!map[i.product_id]) map[i.product_id] = { name: i.products?.name || 'Bidhaa', units: 0, revenue: 0 };
      map[i.product_id].units += i.quantity; map[i.product_id].revenue += Number(i.line_total);
    }));
    const sold = Object.entries(map).map(([id, v]) => ({ id, ...v }));
    const soldIds = new Set(sold.map(s => s.id));
    const deadStock = (products || []).filter(p => p.is_active && !p.is_service && !soldIds.has(p.id));
    return {
      fast: [...sold].sort((a, b) => b.units - a.units).slice(0, 10),
      slow: [...sold].sort((a, b) => a.units - b.units).slice(0, 10),
      dead: deadStock,
    };
  }, [sales, products]);

  // ── Automatic per-product profit analysis (bei ya kununua vs kuuza) ──────
  const productProfit = useMemo(() => {
    const map = {};
    sales.forEach(s => (s.pos_sale_items || []).forEach(i => {
      const key = i.product_id;
      if (!map[key]) map[key] = { name: i.products?.name || 'Bidhaa', category: i.products?.category || '—', units: 0, revenue: 0, cost: 0 };
      map[key].units += i.quantity;
      map[key].revenue += Number(i.line_total);
      map[key].cost += i.quantity * Number(i.cost_price_at_sale || 0);
    }));
    return Object.values(map).map(p => ({
      ...p, profit: p.revenue - p.cost,
      margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
    })).sort((a, b) => b.profit - a.profit);
  }, [sales]);

  const subTabs = [
    { id: 'pnl', label: '📈 P&L' },
    { id: 'detailed', label: '📘 Ripoti ya Kina' },
    { id: 'breakdown', label: '📊 Uchambuzi' },
    { id: 'velocity', label: '⚡ Kasi ya Mauzo' },
    { id: 'profit', label: '💹 Faida kwa Bidhaa' },
    { id: 'expenses', label: `💸 Matumizi (${expenses.length})` },
  ];

  const reportRef = useRef(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: 8,
          filename: `Ripoti-ya-Fedha-${new Date().toISOString().slice(0, 10)}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(reportRef.current)
        .save();
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">📊 Fedha na Ripoti</h2>
        <div className="flex gap-1 flex-wrap items-center">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 text-[9px] font-black rounded-lg uppercase ${preset === p.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{p.label}</button>
          ))}
          <button onClick={handleExportPdf} disabled={exportingPdf}
            className="px-3 py-1.5 text-[9px] font-black rounded-lg uppercase bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white">
            {exportingPdf ? 'Inatengeneza...' : '📄 Chapisha Ripoti (PDF)'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl w-max min-w-full overflow-x-auto">
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubView(t.id)}
            className={`px-3 py-2 text-[10px] font-black uppercase rounded-lg whitespace-nowrap ${subView === t.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{t.label}</button>
        ))}
      </div>

      {err && <p className="text-rose-400 text-[10px] font-bold text-center bg-rose-500/10 rounded-lg py-1.5">{err}</p>}
      {loading && <p className="text-center text-slate-600 text-xs py-8">Inapakia takwimu...</p>}

      {subView === 'detailed' && <DetailedSalesReportTab role={role} />}

      {!loading && subView === 'pnl' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Mapato Ghafi', value: revenue, color: 'text-blue-400' },
              { label: 'Gharama za Bidhaa (COGS)', value: cogs, color: 'text-amber-400' },
              { label: 'Faida Ghafi', value: grossProfit, color: 'text-emerald-400' },
              { label: 'Matumizi ya Uendeshaji', value: expensesTotal, color: 'text-rose-400' },
              { label: 'Faida Halisi (Net)', value: netProfit, color: netProfit >= 0 ? 'text-emerald-400' : 'text-rose-500' },
            ].map(c => (
              <div key={c.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
                <p className="text-[8px] font-black text-slate-500 uppercase leading-tight">{c.label}</p>
                <p className={`text-sm font-black mt-1 ${c.color}`}>{fmtTZS(c.value)}</p>
              </div>
            ))}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[10px] font-black text-slate-500 uppercase">Mapato kwa Siku</h3>
              <span className="text-[9px] text-slate-500">Ukingo wa Faida (Margin): <span className={margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{margin.toFixed(1)}%</span></span>
            </div>
            <BarList rows={byDay} />
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 text-[10px]">
            <div className="flex justify-between text-slate-400"><span>Punguzo lililotolewa kipindi hiki</span><span className="text-rose-400 font-bold">{fmtTZS(discountTotal)}</span></div>
            <div className="flex justify-between text-slate-400"><span>Idadi ya Mauzo</span><span className="text-white font-bold">{sales.length}</span></div>
            <div className="flex justify-between text-slate-400"><span>Wastani wa Mauzo</span><span className="text-white font-bold">{fmtTZS(sales.length ? revenue / sales.length : 0)}</span></div>
          </div>
        </div>
      )}

      {!loading && subView === 'breakdown' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-3">Mauzo kwa Mfanyakazi (Cashier)</h3>
            <BarList rows={byStaff} barClass="bg-emerald-500" />
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-3">Mauzo kwa Kategoria</h3>
            <BarList rows={byCategory} barClass="bg-amber-500" />
          </div>
        </div>
      )}

      {!loading && subView === 'velocity' && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-[10px] font-black text-emerald-400 uppercase mb-3">⚡ Zinazouzwa Haraka</h3>
            <BarList rows={velocity.fast.map(v => ({ label: v.name, value: v.units }))} valueFmt={v => `${v} vitengo`} barClass="bg-emerald-500" />
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-[10px] font-black text-amber-400 uppercase mb-3">🐢 Zinazouzwa Taratibu</h3>
            <BarList rows={velocity.slow.map(v => ({ label: v.name, value: v.units }))} valueFmt={v => `${v} vitengo`} barClass="bg-amber-500" />
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-[10px] font-black text-rose-400 uppercase mb-3">💀 Hazijauzwa Kabisa ({velocity.dead.length})</h3>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {velocity.dead.length === 0 && <p className="text-center text-slate-600 text-[10px] py-4">Bidhaa zote ziliuzwa kipindi hiki.</p>}
              {velocity.dead.map(p => (
                <div key={p.id} className="flex justify-between text-[10px] bg-slate-950 rounded-lg px-2.5 py-1.5">
                  <span className="text-slate-400 truncate">{p.name}</span>
                  <span className="text-slate-600">Stoki: {p.stock_quantity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && subView === 'profit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-[10px] font-black text-slate-500 uppercase">Faida kwa Kila Bidhaa — Kiotomatiki (Bei ya Kuuza − Bei ya Kununua)</h3>
          </div>
          {productProfit.length === 0 ? (
            <p className="text-center text-slate-600 text-xs py-10">Hakuna mauzo kipindi hiki.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800">
                  <tr>{['Bidhaa', 'Kategoria', 'Vitengo', 'Mapato', 'Gharama', 'Faida', 'Margin'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-[9px] font-black text-slate-500 uppercase whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {productProfit.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-white font-bold whitespace-nowrap">{p.name}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{p.category}</td>
                      <td className="px-3 py-2 text-slate-300">{p.units}</td>
                      <td className="px-3 py-2 text-blue-400 whitespace-nowrap">{fmtTZS(p.revenue)}</td>
                      <td className="px-3 py-2 text-amber-400 whitespace-nowrap">{fmtTZS(p.cost)}</td>
                      <td className={`px-3 py-2 font-black whitespace-nowrap ${p.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtTZS(p.profit)}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${p.margin >= 30 ? 'bg-emerald-500/10 text-emerald-400' : p.margin >= 10 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {p.margin.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && subView === 'expenses' && (
        <div className="space-y-3">
          <button onClick={() => setShowExpense(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase">+ Ongeza Matumizi</button>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {expenses.length === 0 ? <div className="py-10 text-center text-slate-600 text-xs">Hakuna matumizi yaliyorekodiwa kipindi hiki.</div> : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800">
                  <tr>{['Tarehe', 'Aina', 'Kiasi', 'Maelezo'].map(h => <th key={h} className="px-3 py-2.5 text-[9px] font-black text-slate-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {expenses.map(e => (
                    <tr key={e.id}>
                      <td className="px-3 py-2 text-slate-400">{fmtDay(e.incurred_on)}</td>
                      <td className="px-3 py-2 text-white font-bold">{e.category}</td>
                      <td className="px-3 py-2 text-rose-400 font-black">{fmtTZS(e.amount)}</td>
                      <td className="px-3 py-2 text-slate-500">{e.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showExpense && <AddExpenseModal onClose={() => setShowExpense(false)} onSaved={() => { setShowExpense(false); load(); }} />}

      {/* Hidden comprehensive printable report — always fully rendered (off-screen)
          so "Chapisha Ripoti (PDF)" exports the full picture, not just the active tab. */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '750px' }}>
        <div ref={reportRef} style={{ background: '#fff', color: '#111', padding: 24, fontFamily: 'Arial, sans-serif', fontSize: 12 }}>
          <h1 style={{ fontSize: 18, fontWeight: 900, marginBottom: 2 }}>Ripoti ya Fedha</h1>
          <p style={{ fontSize: 10, color: '#666', marginBottom: 16 }}>
            Kipindi: {PRESETS.find(p => p.id === preset)?.label} · Imetengenezwa: {new Date().toLocaleString('sw-TZ')}
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <tbody>
              {[
                ['Mapato Ghafi', fmtTZS(revenue)], ['Gharama za Bidhaa (COGS)', fmtTZS(cogs)],
                ['Faida Ghafi', fmtTZS(grossProfit)], ['Matumizi ya Uendeshaji', fmtTZS(expensesTotal)],
                ['Faida Halisi (Net Profit)', fmtTZS(netProfit)], ['Ukingo wa Faida (Margin)', `${margin.toFixed(1)}%`],
                ['Idadi ya Mauzo', sales.length], ['Punguzo Lililotolewa', fmtTZS(discountTotal)],
              ].map(([k, v]) => (
                <tr key={k} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '4px 0', color: '#555' }}>{k}</td>
                  <td style={{ padding: '4px 0', fontWeight: 700, textAlign: 'right' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ fontSize: 13, fontWeight: 900, marginTop: 16, marginBottom: 6 }}>Faida kwa Bidhaa</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead><tr style={{ background: '#f3f3f3' }}>
              {['Bidhaa', 'Vitengo', 'Mapato', 'Gharama', 'Faida', 'Margin'].map(h => <th key={h} style={{ padding: 4, textAlign: 'left' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {productProfit.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 4 }}>{p.name}</td>
                  <td style={{ padding: 4 }}>{p.units}</td>
                  <td style={{ padding: 4 }}>{fmtTZS(p.revenue)}</td>
                  <td style={{ padding: 4 }}>{fmtTZS(p.cost)}</td>
                  <td style={{ padding: 4, fontWeight: 700 }}>{fmtTZS(p.profit)}</td>
                  <td style={{ padding: 4 }}>{p.margin.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ fontSize: 13, fontWeight: 900, marginTop: 16, marginBottom: 6 }}>Mauzo kwa Mfanyakazi</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 12 }}>
            <tbody>
              {byStaff.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 4 }}>{s.label}</td>
                  <td style={{ padding: 4, textAlign: 'right' }}>{fmtTZS(s.value)} ({s.count} mauzo)</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ fontSize: 13, fontWeight: 900, marginTop: 16, marginBottom: 6 }}>Matumizi ya Uendeshaji</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 4 }}>{fmtDay(e.incurred_on)}</td>
                  <td style={{ padding: 4 }}>{e.category}</td>
                  <td style={{ padding: 4, textAlign: 'right' }}>{fmtTZS(e.amount)}</td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td style={{ padding: 4, color: '#999' }}>Hakuna matumizi yaliyorekodiwa.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AddExpenseModal({ onClose, onSaved }) {
  const [category, setCategory] = useState('Kodi ya Duka');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!(Number(amount) > 0)) { setErr('Weka kiasi sahihi.'); return; }
    setSaving(true);
    const { error } = await fin.createExpense({ category, amount: Number(amount), note, incurred_on: date });
    setSaving(false);
    if (error) { setErr(error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-3">
        <h3 className="text-sm font-black text-white uppercase">+ Matumizi ya Uendeshaji</h3>
        <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white">
          {['Kodi ya Duka', 'Mishahara', 'Umeme/Maji', 'Usafiri', 'Vifaa vya Ofisi', 'Matangazo', 'Nyingine'].map(c => <option key={c}>{c}</option>)}
        </select>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Kiasi (TZS)"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Maelezo (hiari)" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
        {err && <p className="text-rose-400 text-[10px] font-bold">{err}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black uppercase">{saving ? '...' : 'Hifadhi'}</button>
          <button onClick={onClose} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
        </div>
      </div>
    </div>
  );
}
