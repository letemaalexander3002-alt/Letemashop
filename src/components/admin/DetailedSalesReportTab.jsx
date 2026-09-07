import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as fin from '../../lib/financialsService';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;
const fmtDateTime = d => new Date(d).toLocaleString('sw-TZ', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const toISODate = (d) => new Date(d).toISOString().slice(0, 10);
const MOBILE_METHODS = ['mpesa', 'tigopesa', 'airtelmoney'];
const METHOD_LABEL = { mpesa: 'M-Pesa', tigopesa: 'Tigo Pesa', airtelmoney: 'Airtel Money', card: 'Kadi', bank_qr: 'Benki (QR)', credit: 'Credit', cash: 'Fedha Taslimu' };

export default function DetailedSalesReportTab({ role }) {
  const today = new Date();
  const weekAgo = new Date(Date.now() - 6 * 86400000);
  const [startDate, setStartDate] = useState(toISODate(weekAgo));
  const [endDate, setEndDate] = useState(toISODate(today));
  const [sales, setSales] = useState([]);
  const [creditSales, setCreditSales] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const startISO = new Date(startDate + 'T00:00:00').toISOString();
    const endISO = new Date(new Date(endDate + 'T00:00:00').getTime() + 86400000).toISOString();
    const [{ data: s }, { data: cs }, { data: st }] = await Promise.all([
      fin.fetchSalesInRange(startISO, endISO),
      fin.fetchCreditSalesInRange(startISO, endISO),
      fin.listStaff(),
    ]);
    setSales(s || []); setCreditSales(cs || []); setStaff(st || []);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const staffName = (uid) => staff.find(x => x.user_id === uid)?.full_name || staff.find(x => x.user_id === uid)?.email || 'admin';

  // ── Payment method breakdown (excludes the deferred credit portion from the paid total) ──
  const paymentBreakdown = useMemo(() => {
    const totals = {};
    sales.forEach(s => (s.pos_payments || []).forEach(p => {
      totals[p.method] = (totals[p.method] || 0) + Number(p.amount);
    }));
    const cash = totals.cash || 0;
    const mobile = MOBILE_METHODS.reduce((sum, m) => sum + (totals[m] || 0), 0);
    const other = (totals.card || 0) + (totals.bank_qr || 0);
    const credit = totals.credit || 0;
    return { totals, cash, mobile, other, credit, grandTotal: cash + mobile + other };
  }, [sales]);

  const creditOutstanding = useMemo(() => creditSales.reduce((s, c) => s + Number(c.balance), 0), [creditSales]);

  // ── Category breakdown (all sales, regardless of payment method) ────────
  const categoryBreakdown = useMemo(() => {
    const map = {};
    sales.forEach(s => (s.pos_sale_items || []).forEach(i => {
      const cat = i.products?.category || 'Nyingine';
      if (!map[cat]) map[cat] = { total: 0, items: {} };
      map[cat].total += Number(i.line_total);
      const key = i.products?.name || 'Bidhaa';
      if (!map[cat].items[key]) map[cat].items[key] = { qty: 0, amount: 0 };
      map[cat].items[key].qty += i.quantity;
      map[cat].items[key].amount += Number(i.line_total);
    }));
    return map;
  }, [sales]);

  // ── Same breakdown, but only for items sold on credit ────────────────────
  const creditCategoryBreakdown = useMemo(() => {
    const map = {};
    sales.filter(s => s.payment_status === 'CREDIT').forEach(s => (s.pos_sale_items || []).forEach(i => {
      const cat = i.products?.category || 'Nyingine';
      if (!map[cat]) map[cat] = { total: 0, items: {} };
      map[cat].total += Number(i.line_total);
      const key = i.products?.name || 'Bidhaa';
      if (!map[cat].items[key]) map[cat].items[key] = { qty: 0, amount: 0 };
      map[cat].items[key].qty += i.quantity;
      map[cat].items[key].amount += Number(i.line_total);
    }));
    return map;
  }, [sales]);

  // ── Shortfall detection: sold below current listed price with no recorded discount ──
  const shortfalls = useMemo(() => {
    const rows = [];
    sales.forEach(s => (s.pos_sale_items || []).forEach(i => {
      const listed = Number(i.products?.price || 0);
      const charged = Number(i.unit_price);
      if (listed > 0 && charged < listed && Number(i.discount_amount || 0) === 0) {
        rows.push({
          sale_no: s.sale_no, created_at: s.created_at, cashier: staffName(s.cashier_id),
          product: i.products?.name, listed, charged, diff: (listed - charged) * i.quantity, qty: i.quantity,
        });
      }
    }));
    return rows;
  }, [sales, staff]);
  const shortfallTotal = shortfalls.reduce((s, r) => s + r.diff, 0);

  // ── Full itemized transaction log ─────────────────────────────────────────
  const itemizedLog = useMemo(() => {
    const rows = [];
    sales.forEach(s => {
      const methods = (s.pos_payments || []).map(p => METHOD_LABEL[p.method] || p.method).join(', ');
      (s.pos_sale_items || []).forEach(i => rows.push({
        sale_no: s.sale_no, created_at: s.created_at, cashier: staffName(s.cashier_id), methods,
        product: i.products?.name, barcode: i.products?.barcode || '—', quantity: i.quantity,
        unit_price: i.unit_price, line_total: i.line_total, stock_after: i.stock_after_sale,
      }));
    });
    return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [sales, staff]);

  // ── Top products by share of quantity sold ────────────────────────────────
  const topProducts = useMemo(() => {
    const map = {};
    let totalQty = 0;
    sales.forEach(s => (s.pos_sale_items || []).forEach(i => {
      const key = i.products?.name || 'Bidhaa';
      if (!map[key]) map[key] = { qty: 0, revenue: 0 };
      map[key].qty += i.quantity; map[key].revenue += Number(i.line_total);
      totalQty += i.quantity;
    }));
    return Object.entries(map).map(([name, v]) => ({ name, ...v, pct: totalQty > 0 ? (v.qty / totalQty) * 100 : 0 }))
      .sort((a, b) => b.qty - a.qty);
  }, [sales]);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: 8,
          filename: `Ripoti-ya-Mauzo-ya-Kina-${startDate}-hadi-${endDate}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(reportRef.current)
        .save();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">📘 Ripoti ya Mauzo ya Kina</h2>
        <button onClick={handleExportPdf} disabled={exporting}
          className="px-4 py-2 text-[10px] font-black rounded-xl uppercase bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white">
          {exporting ? 'Inatengeneza...' : '🖨️ Chapisha / Hifadhi kama PDF'}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Kuanzia</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
        </div>
        <div>
          <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Hadi</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
        </div>
        <button onClick={load} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase">Chuja</button>
      </div>

      {loading ? <p className="text-center text-slate-600 text-xs py-10">Inapakia ripoti...</p> : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-[9px] font-black text-slate-500 uppercase">💵 Jumla ya CASH</p>
              <p className="text-lg font-black text-emerald-400 mt-1">{fmtTZS(paymentBreakdown.cash)}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-[9px] font-black text-slate-500 uppercase">📱 Jumla ya SIMU (Mobile Money)</p>
              <p className="text-lg font-black text-blue-400 mt-1">{fmtTZS(paymentBreakdown.mobile)}</p>
            </div>
            <div className="bg-emerald-600 rounded-2xl p-4">
              <p className="text-[9px] font-black text-emerald-100 uppercase">JUMLA KUU (Simu+Cash+Nyingine)</p>
              <p className="text-lg font-black text-white mt-1">{fmtTZS(paymentBreakdown.grandTotal)}</p>
              <p className="text-[9px] text-emerald-100 mt-1">Haijumuishi mauzo ya Deni yasiyolipwa bado.</p>
            </div>
          </div>

          <div className="bg-amber-700/90 rounded-2xl p-4">
            <p className="text-[9px] font-black text-amber-100 uppercase">📝 Jumla ya Mauzo ya Deni (Kipindi) — Bado Halijalipwa</p>
            <p className="text-lg font-black text-white mt-1">{fmtTZS(creditOutstanding)}</p>
            <p className="text-[9px] text-amber-100 mt-1">Itaingizwa kwenye JUMLA KUU pale deni litakapolipwa kikamilifu.</p>
          </div>

          {/* Mobile money by network */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800"><h3 className="text-[10px] font-black text-slate-500 uppercase">Mchanganuo wa SIMU (kwa kila njia)</h3></div>
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-slate-800/60">
                {MOBILE_METHODS.map(m => (
                  <tr key={m}><td className="px-4 py-2 text-slate-300">{METHOD_LABEL[m]}</td><td className="px-4 py-2 text-right text-white font-bold">{fmtTZS(paymentBreakdown.totals[m] || 0)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Other payment methods */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800"><h3 className="text-[10px] font-black text-slate-500 uppercase">Njia Nyingine za Malipo</h3></div>
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-slate-800/60">
                {['card', 'bank_qr', 'credit'].filter(m => paymentBreakdown.totals[m]).map(m => (
                  <tr key={m}><td className="px-4 py-2 text-slate-300">{METHOD_LABEL[m]}</td><td className="px-4 py-2 text-right text-white font-bold">{fmtTZS(paymentBreakdown.totals[m])}</td></tr>
                ))}
                {Object.keys(paymentBreakdown.totals).filter(m => ['card', 'bank_qr', 'credit'].includes(m)).length === 0 &&
                  <tr><td className="px-4 py-3 text-slate-600 text-center" colSpan={2}>Hakuna.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Category breakdown */}
          <div>
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-2">🗂 Mauzo ya Kipindi kwa Kila Kategoria</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.entries(categoryBreakdown).map(([cat, data]) => (
                <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex justify-between mb-2"><p className="text-xs font-black text-white">{cat}</p><p className="text-xs font-black text-emerald-400">{fmtTZS(data.total)}</p></div>
                  {Object.entries(data.items).map(([name, v]) => (
                    <div key={name} className="flex justify-between text-[10px] text-slate-400 py-0.5"><span>{name} ×{v.qty}</span><span>{fmtTZS(v.amount)}</span></div>
                  ))}
                </div>
              ))}
              {Object.keys(categoryBreakdown).length === 0 && <p className="text-slate-600 text-xs col-span-2 text-center py-4">Hakuna mauzo kipindi hiki.</p>}
            </div>
          </div>

          {/* Credit sales ledger */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800"><h3 className="text-[10px] font-black text-slate-500 uppercase">📒 Mauzo ya Deni (Credit) — Wateja na Madeni Mapya</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950"><tr>{['Namba', 'Muda', 'Mteja', 'Simu', 'Muuzaji', 'Jumla', 'Alicholipa', 'Deni'].map(h => <th key={h} className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-800/60">
                  {creditSales.map(c => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 text-slate-300 font-mono text-[10px] whitespace-nowrap">{c.sale?.sale_no}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDateTime(c.created_at)}</td>
                      <td className="px-3 py-2 text-white font-bold whitespace-nowrap">{c.customers?.name || 'Haijulikani'}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{c.customers?.phone || '—'}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{staffName(c.sale?.cashier_id)}</td>
                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{fmtTZS(c.amount)}</td>
                      <td className="px-3 py-2 text-emerald-400 whitespace-nowrap">{fmtTZS(Number(c.amount) - Number(c.balance))}</td>
                      <td className={`px-3 py-2 font-black whitespace-nowrap ${Number(c.balance) > 0 ? 'text-rose-400' : 'text-slate-600'}`}>{fmtTZS(c.balance)}</td>
                    </tr>
                  ))}
                  {creditSales.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-600">Hakuna mauzo ya deni kipindi hiki.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Credit items by category */}
          {Object.keys(creditCategoryBreakdown).length > 0 && (
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase mb-2">🗂 Bidhaa Zilizouzwa kwa Deni — kwa Kila Kategoria</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {Object.entries(creditCategoryBreakdown).map(([cat, data]) => (
                  <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    <div className="flex justify-between mb-2"><p className="text-xs font-black text-white">{cat}</p><p className="text-xs font-black text-amber-400">{fmtTZS(data.total)}</p></div>
                    {Object.entries(data.items).map(([name, v]) => (
                      <div key={name} className="flex justify-between text-[10px] text-slate-400 py-0.5"><span>{name} ×{v.qty}</span><span>{fmtTZS(v.amount)}</span></div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shortfall detection — ADMIN ONLY */}
          {role === 'super_admin' && (
            <div className="bg-rose-950/40 border border-rose-800/50 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-rose-800/50">
                <h3 className="text-[10px] font-black text-rose-300 uppercase">📝 Mauzo Chini ya Bei ya Kuuzia Bila Punguzo Kuwekwa (Admin Pekee)</h3>
                <p className="text-[9px] text-rose-400/70 mt-1">Sehemu hii HAIONEKANI kwa Cashier/Muhasibu — ni kwa ukaguzi wa ndani wa Admin pekee.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950"><tr>{['Namba', 'Muda', 'Muuzaji', 'Bidhaa', 'Bei ya Kuuzia', 'Alicholipa', 'Tofauti'].map(h => <th key={h} className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-rose-900/40">
                    {shortfalls.map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-300 font-mono text-[10px] whitespace-nowrap">{r.sale_no}</td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{r.cashier}</td>
                        <td className="px-3 py-2 text-white font-bold whitespace-nowrap">{r.product}</td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtTZS(r.listed)}</td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtTZS(r.charged)}</td>
                        <td className="px-3 py-2 text-rose-400 font-black whitespace-nowrap">{fmtTZS(r.diff)}</td>
                      </tr>
                    ))}
                    {shortfalls.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-600">Hakuna mauzo yaliyouzwa chini ya bei bila punguzo kipindi hiki. ✅</td></tr>}
                  </tbody>
                  {shortfalls.length > 0 && (
                    <tfoot><tr className="bg-rose-900/30"><td colSpan={6} className="px-3 py-2 text-right text-[10px] font-black text-rose-300 uppercase">Jumla ya Tofauti (Shortfall)</td><td className="px-3 py-2 font-black text-rose-300">{fmtTZS(shortfallTotal)}</td></tr></tfoot>
                  )}
                </table>
              </div>
              <p className="text-[8px] text-rose-500/60 px-4 pb-3">Kumbuka: linganisho hili linatumia bei ya sasa ya bidhaa dukani — ikiwa bei ilibadilishwa baada ya mauzo haya, baadhi ya matokeo yanaweza yasiwe sahihi kabisa.</p>
            </div>
          )}

          {/* Itemized transaction log */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800"><h3 className="text-[10px] font-black text-slate-500 uppercase">🧾 Taarifa za Kila Bidhaa Iliyouzwa</h3></div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 sticky top-0"><tr>{['Bidhaa', 'Barcode', 'Muuzaji', 'Muda', 'Malipo', 'Idadi', 'Bei', 'Jumla', 'Stock Baada'].map(h => <th key={h} className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-800/60">
                  {itemizedLog.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-white font-bold whitespace-nowrap">{r.product}</td>
                      <td className="px-3 py-2 text-slate-500 font-mono text-[10px] whitespace-nowrap">{r.barcode}</td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{r.cashier}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{r.methods}</td>
                      <td className="px-3 py-2 text-slate-300">{r.quantity}</td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtTZS(r.unit_price)}</td>
                      <td className="px-3 py-2 text-emerald-400 font-bold whitespace-nowrap">{fmtTZS(r.line_total)}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.stock_after ?? '—'}</td>
                    </tr>
                  ))}
                  {itemizedLog.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-600">Hakuna mauzo kipindi hiki.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top products by share */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800"><h3 className="text-[10px] font-black text-slate-500 uppercase">🏆 Bidhaa Zilizouzwa (kwa Asilimia ya Idadi)</h3></div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950"><tr>{['Bidhaa', 'Idadi', 'Mapato', '% ya Mauzo Yote'].map(h => <th key={h} className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-800/60">
                {topProducts.map((p, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-white font-bold whitespace-nowrap">{p.name}</td>
                    <td className="px-3 py-2 text-slate-300">{p.qty}</td>
                    <td className="px-3 py-2 text-emerald-400 whitespace-nowrap">{fmtTZS(p.revenue)}</td>
                    <td className="px-3 py-2 text-blue-400 font-bold">{p.pct.toFixed(1)}%</td>
                  </tr>
                ))}
                {topProducts.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-600">Hakuna mauzo kipindi hiki.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hidden printable version for PDF export — mirrors everything above in plain HTML/CSS
          (html2canvas renders computed styles more reliably from simple inline styles). */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '750px' }}>
        <div ref={reportRef} style={{ background: '#fff', color: '#111', padding: 24, fontFamily: 'Arial, sans-serif', fontSize: 11 }}>
          <h1 style={{ fontSize: 18, fontWeight: 900, marginBottom: 2 }}>Ripoti ya Mauzo ya Kina</h1>
          <p style={{ fontSize: 10, color: '#666', marginBottom: 16 }}>Kipindi: {startDate} hadi {endDate} · Imetengenezwa: {new Date().toLocaleString('sw-TZ')}</p>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: 4 }}>💵 Jumla ya CASH</td><td style={{ padding: 4, textAlign: 'right', fontWeight: 700 }}>{fmtTZS(paymentBreakdown.cash)}</td></tr>
              <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: 4 }}>📱 Jumla ya SIMU</td><td style={{ padding: 4, textAlign: 'right', fontWeight: 700 }}>{fmtTZS(paymentBreakdown.mobile)}</td></tr>
              <tr style={{ borderBottom: '1px solid #eee', background: '#ecfdf5' }}><td style={{ padding: 4, fontWeight: 900 }}>JUMLA KUU (Simu+Cash+Nyingine)</td><td style={{ padding: 4, textAlign: 'right', fontWeight: 900 }}>{fmtTZS(paymentBreakdown.grandTotal)}</td></tr>
              <tr style={{ background: '#fffbeb' }}><td style={{ padding: 4, fontWeight: 900 }}>Deni Bado Halijalipwa</td><td style={{ padding: 4, textAlign: 'right', fontWeight: 900 }}>{fmtTZS(creditOutstanding)}</td></tr>
            </tbody>
          </table>

          <h2 style={{ fontSize: 13, fontWeight: 900, marginTop: 14, marginBottom: 6 }}>Mauzo kwa Kila Kategoria</h2>
          {Object.entries(categoryBreakdown).map(([cat, data]) => (
            <div key={cat} style={{ marginBottom: 8 }}>
              <p style={{ fontWeight: 700 }}>{cat} — {fmtTZS(data.total)}</p>
              {Object.entries(data.items).map(([name, v]) => (
                <p key={name} style={{ fontSize: 10, color: '#555', margin: '2px 0 2px 8px' }}>{name} ×{v.qty} — {fmtTZS(v.amount)}</p>
              ))}
            </div>
          ))}

          <h2 style={{ fontSize: 13, fontWeight: 900, marginTop: 14, marginBottom: 6 }}>Mauzo ya Deni (Credit)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead><tr style={{ background: '#f3f3f3' }}>{['Namba', 'Mteja', 'Jumla', 'Alicholipa', 'Deni'].map(h => <th key={h} style={{ padding: 4, textAlign: 'left' }}>{h}</th>)}</tr></thead>
            <tbody>
              {creditSales.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 4 }}>{c.sale?.sale_no}</td>
                  <td style={{ padding: 4 }}>{c.customers?.name || 'Haijulikani'}</td>
                  <td style={{ padding: 4 }}>{fmtTZS(c.amount)}</td>
                  <td style={{ padding: 4 }}>{fmtTZS(Number(c.amount) - Number(c.balance))}</td>
                  <td style={{ padding: 4, fontWeight: 700 }}>{fmtTZS(c.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {role === 'super_admin' && shortfalls.length > 0 && (
            <>
              <h2 style={{ fontSize: 13, fontWeight: 900, marginTop: 14, marginBottom: 6, color: '#991b1b' }}>Mauzo Chini ya Bei bila Punguzo (Admin Pekee)</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead><tr style={{ background: '#fee2e2' }}>{['Namba', 'Muuzaji', 'Bidhaa', 'Bei', 'Alicholipa', 'Tofauti'].map(h => <th key={h} style={{ padding: 4, textAlign: 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {shortfalls.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #fecaca' }}>
                      <td style={{ padding: 4 }}>{r.sale_no}</td><td style={{ padding: 4 }}>{r.cashier}</td><td style={{ padding: 4 }}>{r.product}</td>
                      <td style={{ padding: 4 }}>{fmtTZS(r.listed)}</td><td style={{ padding: 4 }}>{fmtTZS(r.charged)}</td>
                      <td style={{ padding: 4, fontWeight: 700 }}>{fmtTZS(r.diff)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 10, fontWeight: 900, textAlign: 'right', marginTop: 4 }}>Jumla ya Tofauti: {fmtTZS(shortfallTotal)}</p>
            </>
          )}

          <h2 style={{ fontSize: 13, fontWeight: 900, marginTop: 14, marginBottom: 6 }}>Taarifa za Kila Bidhaa Iliyouzwa</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
            <thead><tr style={{ background: '#f3f3f3' }}>{['Bidhaa', 'Muuzaji', 'Muda', 'Malipo', 'Idadi', 'Bei', 'Jumla', 'Stock'].map(h => <th key={h} style={{ padding: 3, textAlign: 'left' }}>{h}</th>)}</tr></thead>
            <tbody>
              {itemizedLog.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 3 }}>{r.product}</td><td style={{ padding: 3 }}>{r.cashier}</td>
                  <td style={{ padding: 3 }}>{fmtDateTime(r.created_at)}</td><td style={{ padding: 3 }}>{r.methods}</td>
                  <td style={{ padding: 3 }}>{r.quantity}</td><td style={{ padding: 3 }}>{fmtTZS(r.unit_price)}</td>
                  <td style={{ padding: 3, fontWeight: 700 }}>{fmtTZS(r.line_total)}</td><td style={{ padding: 3 }}>{r.stock_after ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ fontSize: 13, fontWeight: 900, marginTop: 14, marginBottom: 6 }}>Bidhaa Zilizouzwa (kwa Asilimia)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead><tr style={{ background: '#f3f3f3' }}>{['Bidhaa', 'Idadi', 'Mapato', '%'].map(h => <th key={h} style={{ padding: 4, textAlign: 'left' }}>{h}</th>)}</tr></thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 4 }}>{p.name}</td><td style={{ padding: 4 }}>{p.qty}</td>
                  <td style={{ padding: 4 }}>{fmtTZS(p.revenue)}</td><td style={{ padding: 4 }}>{p.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
