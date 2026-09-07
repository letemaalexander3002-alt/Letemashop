import React, { useState, useEffect, useCallback } from 'react';
import * as crm from '../../lib/crmService';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const isOverdue = (c) => c.status !== 'PAID' && c.due_date && new Date(c.due_date) < new Date();
const daysOverdue = (d) => Math.floor((new Date() - new Date(d)) / 86400000);
const STATUS_BADGE = { OPEN: 'bg-blue-500/10 text-blue-400', PARTIAL: 'bg-amber-500/10 text-amber-400', PAID: 'bg-emerald-500/10 text-emerald-400' };
const METHODS = [
  { id: 'cash', label: 'Fedha Taslimu' }, { id: 'mpesa', label: 'M-Pesa' }, { id: 'tigopesa', label: 'Tigo Pesa' },
  { id: 'airtelmoney', label: 'Airtel Money' }, { id: 'bank_qr', label: 'Benki' }, { id: 'card', label: 'Kadi' },
];

export default function CreditSalesTab() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [payTarget, setPayTarget] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await crm.fetchCreditSales();
    if (error) setErr(error); else setSales(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = sales.filter(s => {
    if (filter === 'ALL') return true;
    if (filter === 'OVERDUE') return isOverdue(s);
    return s.status === filter;
  });

  const totalOutstanding = sales.filter(s => s.status !== 'PAID').reduce((sum, s) => sum + Number(s.balance), 0);
  const overdueCount = sales.filter(isOverdue).length;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-black text-white uppercase tracking-wide">🧾 Mauzo ya Deni (Kopa)</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-[9px] font-black text-slate-500 uppercase">Deni Lote la Wateja</p>
          <p className="text-xl font-black text-rose-400 mt-1">{fmtTZS(totalOutstanding)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-[9px] font-black text-slate-500 uppercase">Malipo Yaliyochelewa</p>
          <p className="text-xl font-black text-amber-400 mt-1">⚠️ {overdueCount}</p>
        </div>
      </div>

      {overdueCount > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-2.5">
          <p className="text-[10px] text-rose-400 font-bold">⚠️ Wateja {overdueCount} wamechelewa kulipa deni lao. Fikiria kuwapigia simu au kutuma ujumbe wa kukumbusha.</p>
        </div>
      )}

      <div className="flex gap-1 flex-wrap">
        {['ALL', 'OPEN', 'PARTIAL', 'PAID', 'OVERDUE'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 text-[9px] font-black rounded-lg uppercase ${filter === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{s === 'ALL' ? 'Zote' : s}</button>
        ))}
      </div>

      {err && <p className="text-rose-400 text-[10px] font-bold text-center bg-rose-500/10 rounded-lg py-1.5">{err}</p>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="py-12 text-center text-slate-600 text-xs">Inapakia...</div> :
        filtered.length === 0 ? <div className="py-12 text-center"><p className="text-2xl">🧾</p><p className="text-xs text-slate-600 font-bold mt-2">Hakuna mauzo ya deni.</p></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>{['Mteja', 'Jumla', 'Deni Lililobaki', 'Deadline', 'Hali', 'Vitendo'].map(h => <th key={h} className="px-3 py-3 text-[9px] font-black text-slate-500 uppercase whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map(s => (
                  <tr key={s.id} className={`hover:bg-slate-800/30 ${isOverdue(s) ? 'bg-rose-500/5' : ''}`}>
                    <td className="px-3 py-3 font-bold text-white whitespace-nowrap">{s.customers?.name}<p className="text-slate-600 text-[9px] font-mono">{s.customers?.phone}</p></td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{fmtTZS(s.amount)}</td>
                    <td className="px-3 py-3 text-rose-400 font-black whitespace-nowrap">{fmtTZS(s.balance)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={isOverdue(s) ? 'text-rose-400 font-black' : 'text-slate-500'}>{fmtDate(s.due_date)}</span>
                      {isOverdue(s) && <p className="text-[8px] text-rose-500">Siku {daysOverdue(s.due_date)} zilizopita</p>}
                    </td>
                    <td className="px-3 py-3"><span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${STATUS_BADGE[s.status]}`}>{isOverdue(s) ? 'OVERDUE' : s.status}</span></td>
                    <td className="px-3 py-3">
                      {s.status !== 'PAID' && <button onClick={() => setPayTarget(s)} className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1.5 rounded-lg whitespace-nowrap">💰 Pokea Malipo</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payTarget && <RecordPaymentModal creditSale={payTarget} onClose={() => setPayTarget(null)} onSaved={() => { setPayTarget(null); load(); }} />}
    </div>
  );
}

function RecordPaymentModal({ creditSale, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(creditSale.balance));
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!(Number(amount) > 0)) { setErr('Weka kiasi sahihi.'); return; }
    if (Number(amount) > Number(creditSale.balance)) { setErr(`Kiasi kimezidi deni lililobaki (${fmtTZS(creditSale.balance)}).`); return; }
    setSaving(true);
    const { error } = await crm.recordCreditPayment(creditSale.id, Number(amount), method, note);
    setSaving(false);
    if (error) { setErr(error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-3">
        <h3 className="text-sm font-black text-white uppercase">💰 Pokea Malipo — {creditSale.customers?.name}</h3>
        <p className="text-[10px] text-slate-500">Deni lililobaki: <span className="text-rose-400 font-black">{fmtTZS(creditSale.balance)}</span></p>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Kiasi"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
        <select value={method} onChange={e => setMethod(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white">
          {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Maelezo (hiari)"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
        {err && <p className="text-rose-400 text-[10px] font-bold">{err}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black uppercase">{saving ? '...' : 'Thibitisha Malipo'}</button>
          <button onClick={onClose} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
        </div>
      </div>
    </div>
  );
}
