import React, { useState, useEffect, useCallback } from 'react';
import * as fin from '../../lib/financialsService';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;
const fmtDateTime = d => d ? new Date(d).toLocaleString('sw-TZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function CashflowTab() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closeTarget, setCloseTarget] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fin.fetchCashSessions();
    if (error) setErr(error); else setSessions(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openSession = async (s) => {
    const { data: cashSales } = await fin.fetchSessionCashSales(s.id);
    const cashTotal = (cashSales || []).reduce((sum, sale) =>
      sum + (sale.pos_payments || []).filter(p => p.method === 'cash').reduce((a, p) => a + Number(p.amount), 0), 0);
    const cashIn = (s.cash_movements || []).filter(m => m.type === 'in').reduce((a, m) => a + Number(m.amount), 0);
    const cashOut = (s.cash_movements || []).filter(m => m.type === 'out').reduce((a, m) => a + Number(m.amount), 0);
    const expected = Number(s.opening_float) + cashTotal + cashIn - cashOut;
    setCloseTarget({ ...s, cashTotal, cashIn, cashOut, expected });
  };

  const openSessions = sessions.filter(s => s.status === 'OPEN');
  const closedSessions = sessions.filter(s => s.status === 'CLOSED');

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-black text-white uppercase tracking-wide">💰 Rejesta ya Fedha (Cashflow)</h2>

      {err && <p className="text-rose-400 text-[10px] font-bold text-center bg-rose-500/10 rounded-lg py-1.5">{err}</p>}

      {openSessions.length > 0 && (
        <div>
          <h3 className="text-[10px] font-black text-emerald-400 uppercase mb-2">🟢 Rejesta Zilizo Wazi Sasa</h3>
          <div className="space-y-2">
            {openSessions.map(s => (
              <div key={s.id} className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 flex justify-between items-center flex-wrap gap-2">
                <div>
                  <p className="text-xs font-bold text-white">Ilifunguliwa: {fmtDateTime(s.opened_at)}</p>
                  <p className="text-[10px] text-slate-500">Fedha ya Ufunguzi: {fmtTZS(s.opening_float)}</p>
                </div>
                <button onClick={() => openSession(s)} className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg uppercase">🔒 Funga Rejista</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-[10px] font-black text-slate-500 uppercase mb-2">Historia ya Rejesta</h3>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {loading ? <div className="py-10 text-center text-slate-600 text-xs">Inapakia...</div> :
          closedSessions.length === 0 ? <div className="py-10 text-center text-slate-600 text-xs">Hakuna rejesta zilizofungwa bado.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800">
                  <tr>{['Ilifunguliwa', 'Ilifungwa', 'Ufunguzi', 'Inayotarajiwa', 'Halisi', 'Tofauti'].map(h => <th key={h} className="px-3 py-2.5 text-[9px] font-black text-slate-500 uppercase whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {closedSessions.map(s => {
                    const diff = Number(s.closing_balance ?? 0) - Number(s.expected_cash ?? 0);
                    return (
                      <tr key={s.id}>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtDateTime(s.opened_at)}</td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtDateTime(s.closed_at)}</td>
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{fmtTZS(s.opening_float)}</td>
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{fmtTZS(s.expected_cash)}</td>
                        <td className="px-3 py-2 text-white font-bold whitespace-nowrap">{fmtTZS(s.closing_balance)}</td>
                        <td className={`px-3 py-2 font-black whitespace-nowrap ${diff === 0 ? 'text-emerald-400' : diff > 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                          {diff === 0 ? '✓ Sawa' : `${diff > 0 ? '+' : ''}${fmtTZS(diff)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {closeTarget && <CloseSessionModal session={closeTarget} onClose={() => setCloseTarget(null)} onSaved={() => { setCloseTarget(null); load(); }} />}
    </div>
  );
}

function CloseSessionModal({ session, onClose, onSaved }) {
  const [closingBalance, setClosingBalance] = useState(String(session.expected.toFixed(0)));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const diff = Number(closingBalance || 0) - session.expected;

  const save = async () => {
    setSaving(true);
    const { error } = await fin.closeSession(session.id, Number(closingBalance), session.expected);
    setSaving(false);
    if (error) { setErr(error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-3">
        <h3 className="text-sm font-black text-white uppercase">🔒 Funga Rejista</h3>
        <div className="bg-slate-950 rounded-xl p-3 space-y-1 text-[10px]">
          <div className="flex justify-between text-slate-400"><span>Fedha ya Ufunguzi</span><span>{fmtTZS(session.opening_float)}</span></div>
          <div className="flex justify-between text-slate-400"><span>+ Mauzo ya Fedha Taslimu</span><span>{fmtTZS(session.cashTotal)}</span></div>
          <div className="flex justify-between text-slate-400"><span>+ Fedha Iliyoingizwa</span><span>{fmtTZS(session.cashIn)}</span></div>
          <div className="flex justify-between text-slate-400"><span>- Fedha Iliyotolewa</span><span>{fmtTZS(session.cashOut)}</span></div>
          <div className="flex justify-between text-white font-black pt-1 border-t border-slate-800"><span>Inayotarajiwa</span><span>{fmtTZS(session.expected)}</span></div>
        </div>
        <div>
          <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Fedha Halisi Uliyohesabu Kwenye Droo</label>
          <input type="number" value={closingBalance} onChange={e => setClosingBalance(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white text-center font-black" />
        </div>
        {Number(closingBalance) > 0 && (
          <p className={`text-center text-[10px] font-black ${diff === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {diff === 0 ? '✅ Fedha zinalingana kabisa.' : `⚠️ Tofauti: ${diff > 0 ? '+' : ''}${fmtTZS(diff)}`}
          </p>
        )}
        {err && <p className="text-rose-400 text-[10px] font-bold">{err}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-black uppercase">{saving ? '...' : 'Thibitisha Ufungaji'}</button>
          <button onClick={onClose} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
        </div>
      </div>
    </div>
  );
}
