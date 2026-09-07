import React, { useState, useEffect, useCallback } from 'react';
import * as fin from '../../lib/financialsService';
import { ROLE_LABELS } from '../../lib/posService';

const fmtDate = d => new Date(d).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' });
const ROLE_BADGE = {
  super_admin: 'bg-purple-500/10 text-purple-400', branch_manager: 'bg-blue-500/10 text-blue-400',
  inventory_clerk: 'bg-amber-500/10 text-amber-400', cashier: 'bg-emerald-500/10 text-emerald-400',
};

export default function RoleManagementTab({ branches }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fin.listStaff();
    if (error) setErr(error); else setStaff(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const revoke = async (userId, role) => {
    const { error } = await fin.removeStaffRole(userId, role);
    if (error) setErr(error); else load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">🔐 Wafanyakazi na Ruhusa (RBAC)</h2>
        <button onClick={() => setShowAssign(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase">+ Weka Jukumu</button>
      </div>

      <p className="text-[10px] text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-3">
        ℹ️ Mfanyakazi lazima awe amejisajili kwenye mfumo kwa barua pepe kwanza kabla ya kupewa jukumu. Majukumu: <b className="text-white">Msimamizi Mkuu</b> (kila kitu), <b className="text-white">Meneja wa Tawi</b> (kila kitu isipokuwa mipangilio ya mfumo), <b className="text-white">Karani wa Stoo</b> (stoo/bidhaa/ununuzi tu), <b className="text-white">Cashier</b> (POS na Kopa tu).
      </p>

      {err && <p className="text-rose-400 text-[10px] font-bold text-center bg-rose-500/10 rounded-lg py-1.5">{err}</p>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? <div className="py-10 text-center text-slate-600 text-xs">Inapakia...</div> :
        staff.length === 0 ? <div className="py-10 text-center text-slate-600 text-xs">Hakuna majukumu yaliyopangwa bado — wewe (msimamizi wa kwanza) unatumia ruhusa kamili kwa chaguo-msingi.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>{['Jina', 'Barua Pepe', 'Jukumu', 'Tarehe', 'Vitendo'].map(h => <th key={h} className="px-3 py-3 text-[9px] font-black text-slate-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {staff.map(s => (
                  <tr key={`${s.user_id}-${s.role}`} className="hover:bg-slate-800/30">
                    <td className="px-3 py-3 font-bold text-white">{s.full_name || '—'}</td>
                    <td className="px-3 py-3 text-slate-400">{s.email}</td>
                    <td className="px-3 py-3"><span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${ROLE_BADGE[s.role]}`}>{ROLE_LABELS[s.role]}</span></td>
                    <td className="px-3 py-3 text-slate-500 text-[10px]">{fmtDate(s.created_at)}</td>
                    <td className="px-3 py-3"><button onClick={() => revoke(s.user_id, s.role)} className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-2 py-1.5 rounded-lg">Ondoa</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAssign && <AssignRoleModal branches={branches} onClose={() => setShowAssign(false)} onSaved={() => { setShowAssign(false); load(); }} />}
    </div>
  );
}

function AssignRoleModal({ branches, onClose, onSaved }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('cashier');
  const [branchId, setBranchId] = useState(branches?.[0]?.id || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!email.trim() || !fullName.trim()) { setErr('Jaza barua pepe na jina.'); return; }
    setSaving(true);
    const { error } = await fin.assignRoleByEmail(email.trim(), role, branchId || null, fullName.trim());
    setSaving(false);
    if (error) { setErr(error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-3">
        <h3 className="text-sm font-black text-white uppercase">+ Weka Jukumu la Mfanyakazi</h3>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Barua pepe aliyojisajili nayo"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
        <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jina Kamili"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white" />
        <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white">
          <option value="cashier">Cashier</option>
          <option value="inventory_clerk">Karani wa Stoo</option>
          <option value="branch_manager">Meneja wa Tawi</option>
          <option value="super_admin">Msimamizi Mkuu</option>
        </select>
        {branches?.length > 0 && (
          <select value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white">
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {err && <p className="text-rose-400 text-[10px] font-bold">{err}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black uppercase">{saving ? '...' : 'Hifadhi'}</button>
          <button onClick={onClose} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
        </div>
      </div>
    </div>
  );
}
