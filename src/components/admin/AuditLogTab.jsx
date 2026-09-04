import React, { useState, useEffect, useCallback } from 'react';
import * as fin from '../../lib/financialsService';

const fmtDateTime = d => new Date(d).toLocaleString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const ACTION_ICON = {
  CREATE_SALE: '🛒', STOCK_ADJUST: '📦', RECEIVE_GRN: '📥', SUPPLIER_PAYMENT: '💳',
  CREDIT_PAYMENT: '🧾', ASSIGN_ROLE: '🔐', REMOVE_ROLE: '🚫', PRICE_OVERRIDE: '💲',
  REFUND_APPROVED: '↩️', DELETE_SALE: '🗑️',
};
const ENTITY_TYPES = ['ALL', 'pos_sales', 'products', 'purchase_orders', 'supplier_invoices', 'credit_sales', 'user_roles'];

export default function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [actionSearch, setActionSearch] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const filters = {};
    if (entityFilter !== 'ALL') filters.entityType = entityFilter;
    if (actionSearch) filters.action = actionSearch;
    const { data, error } = await fin.fetchAuditLogs(filters);
    if (error) setErr(error); else setLogs(data || []);
    setLoading(false);
  }, [entityFilter, actionSearch]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-black text-white uppercase tracking-wide">🕵️ Rejesta ya Ukaguzi (Audit Trail)</h2>
      <p className="text-[10px] text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-3">
        ℹ️ Kumbukumbu hii haiwezi kubadilishwa wala kufutwa na mtu yeyote — inarekodi kila kitendo muhimu kiotomatiki (mauzo, marekebisho ya stoki, malipo, mabadiliko ya bei, na majukumu ya wafanyakazi).
      </p>

      <div className="flex gap-2 flex-wrap">
        <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[10px] text-white">
          {ENTITY_TYPES.map(t => <option key={t} value={t}>{t === 'ALL' ? 'Aina Zote' : t}</option>)}
        </select>
        <input value={actionSearch} onChange={e => setActionSearch(e.target.value)} placeholder="🔍 Tafuta kitendo (mf. STOCK_ADJUST)..."
          className="flex-1 min-w-[200px] bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[10px] text-white" />
      </div>

      {err && <p className="text-rose-400 text-[10px] font-bold text-center bg-rose-500/10 rounded-lg py-1.5">{err}</p>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="py-10 text-center text-slate-600 text-xs">Inapakia...</div> :
        logs.length === 0 ? <div className="py-10 text-center text-slate-600 text-xs">Hakuna kumbukumbu zinazolingana.</div> : (
          <div className="divide-y divide-slate-800/60 max-h-[65vh] overflow-y-auto">
            {logs.map(l => (
              <div key={l.id} className="px-4 py-3 hover:bg-slate-800/30">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{ACTION_ICON[l.action] || '⚙️'}</span>
                    <div>
                      <p className="text-[11px] font-black text-white">{l.action}</p>
                      <p className="text-[9px] text-slate-500">{l.entity_type} · {l.entity_id?.slice(0, 8)}</p>
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-500 whitespace-nowrap">{fmtDateTime(l.created_at)}</span>
                </div>
                {l.note && <p className="text-[10px] text-slate-400 mt-1.5 ml-7">{l.note}</p>}
                {l.actor_id && <p className="text-[8px] text-slate-600 mt-1 ml-7 font-mono">Mtumiaji: {l.actor_id.slice(0, 8)}...</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
