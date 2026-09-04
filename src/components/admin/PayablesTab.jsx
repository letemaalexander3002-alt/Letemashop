import React, { useState, useEffect, useCallback } from 'react';
import * as proc from '../../lib/procurementService';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const isOverdue = (inv) => inv.status !== 'PAID' && inv.due_date && new Date(inv.due_date) < new Date();
const STATUS_BADGE = { UNPAID: 'bg-rose-500/10 text-rose-400', PARTIAL: 'bg-amber-500/10 text-amber-400', PAID: 'bg-emerald-500/10 text-emerald-400' };
const METHODS = [
  { id: 'cash', label: 'Fedha Taslimu' }, { id: 'mpesa', label: 'M-Pesa' }, { id: 'tigopesa', label: 'Tigo Pesa' },
  { id: 'airtelmoney', label: 'Airtel Money' }, { id: 'bank_qr', label: 'Benki' }, { id: 'card', label: 'Kadi' },
];

export default function PayablesTab() {
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: s }] = await Promise.all([proc.fetchSupplierInvoices(), proc.fetchSuppliers()]);
    if (error) setErr(error); else setInvoices(data || []);
    setSuppliers(s || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = invoices.filter(i => {
    if (filter === 'ALL') return true;
    if (filter === 'OVERDUE') return isOverdue(i);
    return i.status === filter;
  });

  const totalOutstanding = invoices.reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid)), 0);
  const overdueCount = invoices.filter(isOverdue).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">💳 Madeni ya Wasambazaji</h2>
        <button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase">+ Ankara Mpya</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-[9px] font-black text-slate-500 uppercase">Deni Lote Lililobaki</p>
          <p className="text-xl font-black text-rose-400 mt-1">{fmtTZS(totalOutstanding)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-[9px] font-black text-slate-500 uppercase">Zilizochelewa (Overdue)</p>
          <p className="text-xl font-black text-amber-400 mt-1">{overdueCount}</p>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {['ALL', 'UNPAID', 'PARTIAL', 'PAID', 'OVERDUE'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 text-[9px] font-black rounded-lg uppercase ${filter === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{s === 'ALL' ? 'Zote' : s}</button>
        ))}
      </div>

      {err && <p className="text-rose-400 text-[10px] font-bold text-center bg-rose-500/10 rounded-lg py-1.5">{err}</p>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="py-12 text-center text-slate-600 text-xs">Inapakia...</div> :
        filtered.length === 0 ? <div className="py-12 text-center"><p className="text-2xl">💳</p><p className="text-xs text-slate-600 font-bold mt-2">Hakuna ankara.</p></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>{['Msambazaji', 'Ankara', 'Kiasi', 'Kalipwa', 'Deadline', 'Hali', 'Vitendo'].map(h => <th key={h} className="px-3 py-3 text-[9px] font-black text-slate-500 uppercase whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map(inv => (
                  <tr key={inv.id} className={`hover:bg-slate-800/30 ${isOverdue(inv) ? 'bg-rose-500/5' : ''}`}>
                    <td className="px-3 py-3 font-bold text-white whitespace-nowrap">{inv.suppliers?.name}</td>
                    <td className="px-3 py-3 font-mono text-slate-500 text-[10px]">{inv.invoice_no || '—'}</td>
                    <td className="px-3 py-3 text-white font-black whitespace-nowrap">{fmtTZS(inv.amount)}</td>
                    <td className="px-3 py-3 text-emerald-400 whitespace-nowrap">{fmtTZS(inv.amount_paid)}</td>
                    <td className={`px-3 py-3 whitespace-nowrap ${isOverdue(inv) ? 'text-rose-400 font-black' : 'text-slate-500'}`}>{fmtDate(inv.due_date)}</td>
                    <td className="px-3 py-3"><span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${STATUS_BADGE[inv.status] || STATUS_BADGE.UNPAID}`}>{isOverdue(inv) ? 'OVERDUE' : inv.status}</span></td>
                    <td className="px-3 py-3">
                      {inv.status !== 'PAID' && <button onClick={() => setPayTarget(inv)} className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1.5 rounded-lg whitespace-nowrap">💰 Lipa</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateInvoiceModal suppliers={suppliers} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {payTarget && <PayInvoiceModal invoice={payTarget} onClose={() => setPayTarget(null)} onSaved={() => { setPayTarget(null); load(); }} />}
    </div>
  );
}

function CreateInvoiceModal({ suppliers, onClose, onSaved }) {
  const [form, setForm] = useState({ supplier_id: suppliers[0]?.id || '', invoice_no: '', amount: '', due_date: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!form.supplier_id || !form.amount) { setErr('Chagua msambazaji na weka kiasi.'); return; }
    setSaving(true);
    const { error } = await proc.createSupplierInvoice({ ...form, amount: Number(form.amount), amount_paid: 0, status: 'UNPAID' });
    setSaving(false);
    if (error) { setErr(error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-3">
        <h3 className="text-sm font-black text-white uppercase">+ Ankara ya Msambazaji</h3>
        <select value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white">
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input value={form.invoice_no} onChange={e => setForm(p => ({ ...p, invoice_no: e.target.value }))} placeholder="Namba ya Ankara (hiari)"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
        <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="Kiasi (TZS) *"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
        <div>
          <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Muda wa Kulipa (Due Date)</label>
          <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
        </div>
        {err && <p className="text-rose-400 text-[10px] font-bold">{err}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black uppercase">{saving ? '...' : 'Hifadhi'}</button>
          <button onClick={onClose} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
        </div>
      </div>
    </div>
  );
}

function PayInvoiceModal({ invoice, onClose, onSaved }) {
  const remaining = Number(invoice.amount) - Number(invoice.amount_paid);
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!(Number(amount) > 0)) { setErr('Weka kiasi sahihi.'); return; }
    if (Number(amount) > remaining) { setErr(`Kiasi kimezidi deni lililobaki (${fmtTZS(remaining)}).`); return; }
    setSaving(true);
    const { error } = await proc.recordSupplierPayment(invoice.id, Number(amount), method, note);
    setSaving(false);
    if (error) { setErr(error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-3">
        <h3 className="text-sm font-black text-white uppercase">💰 Lipa — {invoice.suppliers?.name}</h3>
        <p className="text-[10px] text-slate-500">Deni lililobaki: <span className="text-rose-400 font-black">{fmtTZS(remaining)}</span></p>
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
