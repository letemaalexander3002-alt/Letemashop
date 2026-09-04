import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import POSTab from './admin/POSTab';
import InventoryTab from './admin/InventoryTab';
import SuppliersTab from './admin/SuppliersTab';
import PurchaseOrdersTab from './admin/PurchaseOrdersTab';
import PayablesTab from './admin/PayablesTab';
import CustomersDirectoryTab from './admin/CustomersDirectoryTab';
import CreditSalesTab from './admin/CreditSalesTab';
import FinancialsTab from './admin/FinancialsTab';
import CashflowTab from './admin/CashflowTab';
import RoleManagementTab from './admin/RoleManagementTab';
import AuditLogTab from './admin/AuditLogTab';
import StockTransfersTab from './admin/StockTransfersTab';
import * as posService from '../lib/posService';

const CATEGORIES = ['Internet', 'Document Services', 'Stationery', 'e-Gov', 'Digital Hub'];
const STATUSES   = ['PENDING', 'PROCESSING', 'PAID', 'CANCELLED'];
const STATUS_BADGE = {
  PAID:       'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
  PENDING:    'bg-amber-500/10 text-amber-400 border border-amber-500/25',
  PROCESSING: 'bg-blue-500/10 text-blue-400 border border-blue-500/25',
  CANCELLED:  'bg-rose-500/10 text-rose-400 border border-rose-500/25',
};
const fmtTZS  = n => `${Number(n||0).toLocaleString()} TZS`;
const fmtDate = d => d ? new Date(d).toLocaleString('sw-TZ',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const EMPTY_PROD = { name:'', category:'Internet', price:'', stock_quantity:'', description:'', image_url:'', is_active: true };

// ── Reusable UI ──────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, colorClass }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="text-xl">{icon}</span>
    </div>
    <p className={`text-2xl font-black ${colorClass}`}>{value}</p>
    {sub && <p className="text-[10px] text-slate-600 font-bold mt-1">{sub}</p>}
  </div>
);

// ── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, onExit }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');

  const handle = async e => {
    e.preventDefault(); setLoading(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr('Barua pepe au nenosiri si sahihi.');
    else onLogin();
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg,#c9a84c,#f5d67a)'}}>
              <span className="text-slate-900 font-black text-sm">LG</span>
            </div>
            <span className="text-white font-black text-base tracking-tight">LETEMA</span>
            <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">ADMIN</span>
          </div>
          <p className="text-slate-500 text-xs">LSIC Command Center</p>
        </div>
        <form onSubmit={handle} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Barua Pepe</label>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@letema.co.tz"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"/>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Nenosiri</label>
            <input type="password" required value={password} onChange={e=>{setPassword(e.target.value);setErr('');}} placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"/>
          </div>
          {err && <p className="text-rose-400 text-[10px] font-bold text-center">❌ {err}</p>}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" onClick={onExit} className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-black uppercase">← Rudi</button>
            <button type="submit" disabled={loading} className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black uppercase">
              {loading ? 'Inaingia...' : 'Ingia →'}
            </button>
          </div>
        </form>
        <p className="text-slate-700 text-[10px] text-center font-mono">LSIC • Dodoma, Tanzania</p>
      </div>
    </div>
  );
}

// ── ORDERS TAB ───────────────────────────────────────────────────────────────
function OrdersTab({ orders, onStatusChange }) {
  const [filter, setFilter] = useState('ALL');
  const filtered = filter === 'ALL' ? orders : orders.filter(o => o.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">📋 Oda ({orders.length})</h2>
        <div className="flex gap-1 flex-wrap">
          {['ALL','PENDING','PROCESSING','PAID','CANCELLED'].map(s => (
            <button key={s} onClick={()=>setFilter(s)}
              className={`px-3 py-1 text-[9px] font-black rounded-lg uppercase transition-all ${filter===s?'bg-blue-600 text-white':'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {s==='ALL'?'Zote':s} {s!=='ALL'&&`(${orders.filter(o=>o.status===s).length})`}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {filtered.length === 0
          ? <div className="py-16 text-center"><p className="text-3xl">📭</p><p className="text-xs text-slate-600 font-bold mt-2">Hakuna oda.</p></div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800">
                  <tr>{['#','Mteja','Simu','Bidhaa','Jumla','Hali','Tarehe','Badilisha'].map(h=>(
                    <th key={h} className="px-3 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map((o,i) => (
                    <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-3 font-mono text-slate-500 text-[10px]">{i+1}</td>
                      <td className="px-3 py-3 font-bold text-white text-xs whitespace-nowrap">{o.customer_name||'—'}</td>
                      <td className="px-3 py-3 font-mono text-slate-400 text-[10px] whitespace-nowrap">{o.customer_phone||'—'}</td>
                      <td className="px-3 py-3 max-w-[140px]"><p className="truncate text-[10px] text-slate-400">{o.items||'—'}</p></td>
                      <td className="px-3 py-3 text-emerald-400 font-black whitespace-nowrap text-[11px]">{fmtTZS(o.total_amount)}</td>
                      <td className="px-3 py-3"><span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${STATUS_BADGE[o.status]||STATUS_BADGE.PENDING}`}>{o.status||'PENDING'}</span></td>
                      <td className="px-3 py-3 text-slate-600 text-[9px] whitespace-nowrap">{fmtDate(o.created_at)}</td>
                      <td className="px-3 py-3">
                        <select value={o.status||'PENDING'} onChange={e=>onStatusChange(o.id,e.target.value)}
                          className="bg-slate-800 text-white text-[9px] font-bold rounded-lg px-2 py-1.5 border border-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer">
                          {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

// ── PRODUCTS TAB ─────────────────────────────────────────────────────────────
function ProductsTab({ products, onReload }) {
  const [showModal, setShowModal] = useState(false);
  const [editProd, setEditProd]   = useState(null);
  const [form, setForm]           = useState(EMPTY_PROD);
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [dc, setDc]               = useState(false);

  const filtered = products
    .filter(p => catFilter === 'ALL' || p.category === catFilter)
    .filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()));

  const openAdd  = () => { setEditProd(null); setForm(EMPTY_PROD); setDc(false); setShowModal(true); };
  const openEdit = p => {
    setEditProd(p);
    setForm({ name:p.name, category:p.category, price:String(p.price), stock_quantity:String(p.stock_quantity||0), description:p.description||'', image_url:p.image_url||'', is_active:p.is_active!==false });
    setDc(false); setShowModal(true);
  };

  const save = async e => {
    e.preventDefault(); setSaving(true);
    const pl = { name:form.name.trim(), category:form.category, price:Number(form.price), stock_quantity:Number(form.stock_quantity||0), description:form.description.trim()||null, image_url:form.image_url.trim()||null, is_active:form.is_active };
    try {
      if (editProd) {
        const {error}=await supabase.from('products').update(pl).eq('id',editProd.id); if(error) throw error;
        if (Number(editProd.price) !== pl.price) {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('audit_logs').insert({
            actor_id: user?.id, action: 'PRICE_OVERRIDE', entity_type: 'products', entity_id: editProd.id,
            before: { price: editProd.price }, after: { price: pl.price },
            note: `${editProd.name}: ${editProd.price} → ${pl.price}`,
          });
        }
      }
      else          { const {error}=await supabase.from('products').insert(pl); if(error) throw error; }
      setShowModal(false); onReload();
    } catch(err) { alert('Hitilafu: '+err.message); }
    finally { setSaving(false); }
  };

  const del = async id => {
    setSaving(true);
    const target = products.find(p => p.id === id);
    const {error} = await supabase.from('products').delete().eq('id',id);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        actor_id: user?.id, action: 'DELETE_PRODUCT', entity_type: 'products', entity_id: id,
        before: target ? { name: target.name, price: target.price } : null, note: target?.name,
      });
      setShowModal(false); onReload();
    }
    else alert(error.message);
    setSaving(false); setDc(false);
  };

  const toggleActive = async p => {
    await supabase.from('products').update({is_active:!p.is_active}).eq('id',p.id);
    onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">📦 Bidhaa ({products.length})</h2>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-wider transition-all">+ Ongeza</button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-2">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Tafuta bidhaa..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"/>
        <div className="flex gap-1 flex-wrap">
          {['ALL',...CATEGORIES].map(c=>(
            <button key={c} onClick={()=>setCatFilter(c)}
              className={`px-3 py-1 text-[9px] font-black rounded-lg uppercase transition-all ${catFilter===c?'bg-blue-600 text-white':'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {c==='ALL'?'Zote':c}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {filtered.length === 0
          ? <div className="py-12 text-center"><p className="text-2xl">📦</p><p className="text-xs text-slate-600 font-bold mt-2">Hakuna bidhaa.</p></div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800">
                  <tr>{['Jina','Kundi','Bei','Stoki','Hali','Vitendo'].map(h=>(
                    <th key={h} className="px-3 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map(p=>(
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-3">
                        <p className="font-bold text-white text-xs">{p.name}</p>
                        {p.description&&<p className="text-slate-600 text-[9px] truncate max-w-[180px]">{p.description}</p>}
                      </td>
                      <td className="px-3 py-3"><span className="bg-slate-800 text-slate-400 text-[9px] font-bold px-2 py-0.5 rounded-md">{p.category}</span></td>
                      <td className="px-3 py-3 text-amber-400 font-black text-[11px] whitespace-nowrap">{fmtTZS(p.price)}</td>
                      <td className="px-3 py-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${Number(p.stock_quantity)>0?'bg-emerald-500/10 text-emerald-400':'bg-rose-500/10 text-rose-400'}`}>
                          {p.stock_quantity||0}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={()=>toggleActive(p)}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md cursor-pointer border-none ${p.is_active?'bg-emerald-500/10 text-emerald-400':'bg-slate-700 text-slate-500'}`}>
                          {p.is_active?'✅ Active':'❌ Hidden'}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={()=>openEdit(p)} className="text-[9px] font-black text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1.5 rounded-lg transition-all">✏ Hariri</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h3 className="text-sm font-black text-white uppercase">{editProd?'✏️ Hariri':'+ Bidhaa Mpya'}</h3>
              <button onClick={()=>setShowModal(false)} className="text-slate-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              {[
                {label:'Jina *',      key:'name',          type:'text',   ph:'Mfano: Mtandao Saa 1', req:true},
                {label:'Bei (TZS) *', key:'price',         type:'number', ph:'1000',                  req:true},
                {label:'Stoki',       key:'stock_quantity',type:'number', ph:'100',                   req:false},
                {label:'Maelezo',     key:'description',   type:'text',   ph:'Maelezo mafupi...',     req:false},
                {label:'URL ya Picha',key:'image_url',     type:'url',    ph:'https://...',           req:false},
              ].map(f=>(
                <div key={f.key}>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">{f.label}</label>
                  <input type={f.type} placeholder={f.ph} required={f.req} value={form[f.key]}
                    onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-blue-500"/>
                </div>
              ))}
              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Kundi</label>
                <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500">
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Hali</label>
                <select value={form.is_active?'1':'0'} onChange={e=>setForm(p=>({...p,is_active:e.target.value==='1'}))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500">
                  <option value="1">✅ Inaonyeshwa</option>
                  <option value="0">❌ Imefichwa</option>
                </select>
              </div>
              <div className="flex justify-between items-center pt-2 flex-wrap gap-2">
                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black uppercase">
                    {saving?'Inahifadhi...':editProd?'Hifadhi':'Ongeza'}
                  </button>
                  <button type="button" onClick={()=>setShowModal(false)} className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-black uppercase">Ghairi</button>
                </div>
                {editProd && (
                  !dc
                    ? <button type="button" onClick={()=>setDc(true)} className="py-2 px-3 rounded-xl bg-rose-500/10 text-rose-400 text-[10px] font-black">🗑 Futa</button>
                    : (
                      <div className="flex gap-2 items-center">
                        <span className="text-[10px] text-rose-400">Uhakika?</span>
                        <button type="button" onClick={()=>del(editProd.id)} className="py-1.5 px-3 rounded-lg bg-rose-600 text-white text-[10px] font-black">Ndio</button>
                        <button type="button" onClick={()=>setDc(false)} className="py-1.5 px-3 rounded-lg bg-slate-700 text-slate-300 text-[10px] font-black">Hapana</button>
                      </div>
                    )
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CUSTOMERS TAB ────────────────────────────────────────────────────────────
function CustomersTab({ orders }) {
  // Build customer list from orders
  const customerMap = {};
  orders.forEach(o => {
    const key = o.customer_phone || o.customer_name;
    if (!key) return;
    if (!customerMap[key]) {
      customerMap[key] = { name: o.customer_name, phone: o.customer_phone, orders: 0, spent: 0, last: o.created_at };
    }
    customerMap[key].orders += 1;
    customerMap[key].spent  += Number(o.total_amount || 0);
    if (new Date(o.created_at) > new Date(customerMap[key].last)) customerMap[key].last = o.created_at;
  });
  const customers = Object.values(customerMap).sort((a,b) => b.spent - a.spent);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">👥 Wateja ({customers.length})</h2>
        <span className="text-[10px] text-slate-500 font-bold">Wamepangwa kwa matumizi makubwa zaidi</span>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {customers.length === 0
          ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-3xl">👥</p>
              <p className="text-xs text-slate-600 font-bold">Bado hakuna wateja.</p>
              <p className="text-[10px] text-slate-700">Wateja wataingia baada ya oda yao ya kwanza.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800">
                  <tr>{['#','Jina','Simu','Oda','Jumla Matumizi','Mara ya Mwisho'].map(h=>(
                    <th key={h} className="px-3 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {customers.map((c,i)=>(
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-3">
                        <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[9px] font-black ${i===0?'bg-amber-500 text-white':i===1?'bg-slate-400 text-white':i===2?'bg-amber-800 text-white':'bg-slate-800 text-slate-400'}`}>
                          {i+1}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold text-white">{c.name||'—'}</td>
                      <td className="px-3 py-3 font-mono text-slate-400 text-[10px]">{c.phone||'—'}</td>
                      <td className="px-3 py-3 text-blue-400 font-black">{c.orders}</td>
                      <td className="px-3 py-3 text-emerald-400 font-black text-[11px]">{fmtTZS(c.spent)}</td>
                      <td className="px-3 py-3 text-slate-600 text-[9px]">{fmtDate(c.last)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

// ── CATEGORIES TAB ───────────────────────────────────────────────────────────
function CategoriesTab({ products }) {
  const stats = CATEGORIES.map(cat => ({
    name: cat,
    total:  products.filter(p => p.category === cat).length,
    active: products.filter(p => p.category === cat && p.is_active).length,
    revenue: 0,
  }));

  const CONFIG = {
    'Internet':          { emoji:'🌐', color:'text-cyan-400',    bg:'bg-cyan-500/10' },
    'Document Services': { emoji:'📄', color:'text-orange-400',  bg:'bg-orange-500/10' },
    'e-Gov':             { emoji:'🏛️', color:'text-green-400',   bg:'bg-green-500/10' },
    'Digital Hub':       { emoji:'💻', color:'text-purple-400',  bg:'bg-purple-500/10' },
    'Stationery':        { emoji:'✏️', color:'text-rose-400',    bg:'bg-rose-500/10' },
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-black text-white uppercase tracking-wide">🗂️ Kategoria ({CATEGORIES.length})</h2>
      <div className="grid grid-cols-1 gap-4">
        {stats.map(cat => {
          const cfg = CONFIG[cat.name] || { emoji:'📦', color:'text-slate-400', bg:'bg-slate-800' };
          return (
            <div key={cat.name} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${cfg.bg}`}>
                    {cfg.emoji}
                  </div>
                  <div>
                    <p className={`font-black text-sm ${cfg.color}`}>{cat.name}</p>
                    <p className="text-[10px] text-slate-500">{cat.total} bidhaa zote</p>
                  </div>
                </div>
                <span className={`text-xl font-black ${cfg.color}`}>{cat.active}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full transition-all ${cfg.bg.replace('/10','')}`}
                  style={{ width: `${cat.total > 0 ? (cat.active/cat.total)*100 : 0}%`, background: 'currentColor' }} />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[9px] text-slate-600">{cat.active} zinazopatikana</span>
                <span className="text-[9px] text-slate-600">{cat.total - cat.active} zimefichwa</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── REPORTS TAB ──────────────────────────────────────────────────────────────
function ReportsTab({ orders, products }) {
  const paid      = orders.filter(o => o.status === 'PAID');
  const revenue   = paid.reduce((s,o) => s+Number(o.total_amount||0), 0);
  const cancelled = orders.filter(o => o.status === 'CANCELLED').length;
  const pending   = orders.filter(o => o.status === 'PENDING').length;

  // Daily revenue last 7 days
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('sw-TZ', { weekday:'short', day:'2-digit' });
    const dayRevenue = paid
      .filter(o => new Date(o.created_at).toDateString() === d.toDateString())
      .reduce((s,o) => s + Number(o.total_amount||0), 0);
    days.push({ label, revenue: dayRevenue });
  }
  const maxRev = Math.max(...days.map(d => d.revenue), 1);

  // Top products by order frequency
  const prodCount = {};
  orders.forEach(o => {
    if (o.items) {
      (o.items||'').split(',').forEach(item => {
        const name = item.trim().split('(')[0].trim();
        if (name) prodCount[name] = (prodCount[name]||0) + 1;
      });
    }
  });
  const topProds = Object.entries(prodCount).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-black text-white uppercase tracking-wide">📊 Ripoti za Mauzo</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon="💰" label="Mapato Yote" value={fmtTZS(revenue)} colorClass="text-emerald-400" sub={`${paid.length} oda zilizolipwa`}/>
        <StatCard icon="📋" label="Oda Zote" value={orders.length} colorClass="text-blue-400" sub={`${pending} zinasubiri`}/>
        <StatCard icon="❌" label="Zilizofutwa" value={cancelled} colorClass="text-rose-400" sub="Cancelled orders"/>
        <StatCard icon="💹" label="Wastani/Oda" value={paid.length ? fmtTZS(Math.round(revenue/paid.length)) : '0 TZS'} colorClass="text-purple-400" sub="Average order value"/>
      </div>

      {/* 7-day chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">📈 Mapato ya Siku 7 Zilizopita</p>
        <div className="flex items-end gap-2 h-24">
          {days.map((d,i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[8px] text-emerald-400 font-bold">
                {d.revenue > 0 ? `${(d.revenue/1000).toFixed(0)}k` : ''}
              </span>
              <div className="w-full bg-slate-800 rounded-t-sm transition-all"
                style={{ height: `${Math.max((d.revenue/maxRev)*80, 4)}px`, background: d.revenue > 0 ? '#10b981' : '#1e293b' }} />
              <span className="text-[8px] text-slate-600 font-bold text-center leading-tight">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top products */}
      {topProds.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">🏆 Huduma Maarufu Zaidi</p>
          <div className="space-y-3">
            {topProds.map(([name, count], i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${i===0?'bg-amber-500 text-white':i===1?'bg-slate-400 text-white':i===2?'bg-amber-800 text-white':'bg-slate-800 text-slate-400'}`}>{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{name}</p>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-1">
                    <div className="bg-blue-500 h-1 rounded-full" style={{ width:`${(count/topProds[0][1])*100}%` }}/>
                  </div>
                </div>
                <span className="text-[10px] font-black text-blue-400 flex-shrink-0">{count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SETTINGS TAB ─────────────────────────────────────────────────────────────
function SettingsTab({ orders, products }) {
  const revenue = orders.filter(o=>o.status==='PAID').reduce((s,o)=>s+Number(o.total_amount||0),0);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-black text-white border-b border-slate-800 pb-2 mb-4 uppercase tracking-wide">📊 Muhtasari wa Mfumo</h3>
        {[
          {label:'Bidhaa Zote',         value:products.length,                                  icon:'📦'},
          {label:'Zinazopatikana',      value:products.filter(p=>p.is_active).length,           icon:'✅'},
          {label:'Zimefichwa',          value:products.filter(p=>!p.is_active).length,          icon:'❌'},
          {label:'Oda Zote',            value:orders.length,                                    icon:'📋'},
          {label:'Zilizolipwa',         value:orders.filter(o=>o.status==='PAID').length,       icon:'💳'},
          {label:'Zinazosubiri',        value:orders.filter(o=>['PENDING','PROCESSING'].includes(o.status)).length, icon:'⚠️'},
          {label:'Zilizofutwa',         value:orders.filter(o=>o.status==='CANCELLED').length,  icon:'🚫'},
          {label:'Mapato Jumla',        value:fmtTZS(revenue),                                  icon:'💰'},
        ].map(s=>(
          <div key={s.label} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
            <span className="text-xs text-slate-400">{s.icon} {s.label}</span>
            <span className="text-xs font-black text-white">{s.value}</span>
          </div>
        ))}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-black text-white border-b border-slate-800 pb-2 mb-4 uppercase tracking-wide">🏢 Taarifa za Biashara</h3>
        {[
          ['Jina',      'Letema Stationery & Internet Café'],
          ['Eneo',      'Dodoma, Tanzania'],
          ['WhatsApp',  '+255 620 642 652'],
          ['Email',     'letemaalexander3002@gmail.com'],
          ['Msimamizi', 'Alexander Eliud Letema'],
          ['Cheo',      'Founder & CVO — Letema Group'],
          ['Website',   'nashop.vercel.app'],
        ].map(([k,v])=>(
          <div key={k} className="flex justify-between py-2 border-b border-slate-800 last:border-0 gap-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase flex-shrink-0">{k}</span>
            <span className="text-[10px] text-slate-300 font-medium text-right">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN ADMIN PANEL ─────────────────────────────────────────────────────────
export default function AdminPanel({ onExit }) {
  const [authed, setAuthed]   = useState(false);
  const [products, setProducts] = useState([]);
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [activeTab, setActiveTab] = useState('orders');

  // ── RBAC + branch context (additive: existing single-admin login flow is untouched) ──
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole]               = useState('super_admin');
  const [branchId, setBranchId]       = useState(null);
  const [branches, setBranches]       = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => { if(session) setAuthed(true); });
  }, []);

  const loadBranches = useCallback(async () => {
    const { data: branchList } = await posService.fetchBranches();
    setBranches(branchList || []);
    setBranchId(prev => prev || branchList?.[0]?.id || null);
  }, []);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      const { data: r } = await posService.fetchMyRole();
      setRole(r || 'super_admin');
      await loadBranches();
    })();
  }, [authed, loadBranches]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{data:p},{data:o}] = await Promise.all([
        supabase.from('products').select('*').order('created_at',{ascending:false}),
        supabase.from('orders').select('*').order('created_at',{ascending:false}),
      ]);
      setProducts(p||[]); setOrders(o||[]);
    } catch(err) { console.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchData();
    const ch = supabase.channel('admin_rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'orders'},fetchData)
      .on('postgres_changes',{event:'*',schema:'public',table:'products'},fetchData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [authed, fetchData]);

  const handleLogout = async () => { await supabase.auth.signOut(); setAuthed(false); if(onExit) onExit(); };
  const updateOrderStatus = async (id, status) => { await supabase.from('orders').update({status}).eq('id',id); fetchData(); };

  if (!authed) return <LoginScreen onLogin={()=>setAuthed(true)} onExit={onExit} />;

  const totalRevenue  = orders.filter(o=>o.status==='PAID').reduce((s,o)=>s+Number(o.total_amount||0),0);
  const pendingOrders = orders.filter(o=>['PENDING','PROCESSING'].includes(o.status)).length;
  const todayOrders   = orders.filter(o=>new Date(o.created_at).toDateString()===new Date().toDateString()).length;

  const lowStockCount = products.filter(p => p.is_active && Number(p.stock_quantity) <= Number(p.reorder_level ?? 5)).length;

  // Offline sales queue locally, so the on-screen stock count needs to move
  // immediately (optimistic UI) rather than waiting for the background sync.
  const applyOptimisticStock = (items) => {
    setProducts(prev => prev.map(p => {
      const sold = items.find(i => i.product_id === p.id);
      return sold ? { ...p, stock_quantity: Math.max(0, Number(p.stock_quantity) - sold.quantity) } : p;
    }));
  };

  const allTabs = [
    { id:'pos',        label:`🛒 POS`,        badge: 0,             roles:['super_admin','branch_manager','cashier'] },
    { id:'orders',     label:`📋 Oda`,        badge: pendingOrders, roles:['super_admin','branch_manager'] },
    { id:'inventory',  label:`📦 Stoo`,       badge: lowStockCount, roles:['super_admin','branch_manager','inventory_clerk'] },
    { id:'products',   label:`🏷️ Bidhaa`,     badge: 0,             roles:['super_admin','branch_manager','inventory_clerk'] },
    { id:'suppliers',  label:`🏭 Wasambazaji`,badge: 0,             roles:['super_admin','branch_manager','inventory_clerk'] },
    { id:'purchases',  label:`📥 Ununuzi`,    badge: 0,             roles:['super_admin','branch_manager','inventory_clerk'] },
    { id:'transfers',  label:`🚚 Uhamisho`,   badge: 0,             roles:['super_admin','branch_manager','inventory_clerk'] },
    { id:'payables',   label:`💳 Madeni Yetu`,badge: 0,             roles:['super_admin','branch_manager'] },
    { id:'crm',        label:`👥 Wateja (CRM)`,badge: 0,            roles:['super_admin','branch_manager'] },
    { id:'credit',     label:`🧾 Kopa`,       badge: 0,             roles:['super_admin','branch_manager','cashier'] },
    { id:'customers',  label:`👤 Wateja (Oda)`,badge: 0,            roles:['super_admin','branch_manager'] },
    { id:'categories', label:`🗂️ Kategoria`,  badge: 0,             roles:['super_admin','branch_manager','inventory_clerk'] },
    { id:'financials', label:`📈 Fedha`,      badge: 0,             roles:['super_admin','branch_manager'] },
    { id:'cashflow',   label:`💰 Cashflow`,   badge: 0,             roles:['super_admin','branch_manager'] },
    { id:'reports',    label:`📊 Ripoti`,     badge: 0,             roles:['super_admin','branch_manager'] },
    { id:'roles',      label:`🔐 Ruhusa`,     badge: 0,             roles:['super_admin'] },
    { id:'auditlog',   label:`🕵️ Ukaguzi`,    badge: 0,             roles:['super_admin'] },
    { id:'settings',   label:`⚙️ Mipangilio`, badge: 0,             roles:['super_admin'] },
  ];
  // RBAC: each role only sees the tabs relevant to their job — cashiers get POS only,
  // inventory clerks get stock tools, managers/super admins see everything.
  const tabs = allTabs.filter(t => t.roles.includes(role));

  // Keep activeTab valid if the current role can't see it (e.g. a cashier logging in
  // while 'orders' was left selected) — default to the first tab this role can see.
  useEffect(() => {
    if (tabs.length && !tabs.find(t => t.id === activeTab)) setActiveTab(tabs[0].id);
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* TOP BAR */}
      <div className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg,#c9a84c,#f5d67a)'}}>
              <span className="text-slate-900 font-black text-xs">LG</span>
            </div>
            <div>
              <p className="text-[11px] font-black text-white uppercase tracking-widest">LSIC Command Center</p>
              <p className="text-[9px] text-emerald-400 font-mono">● LIVE · {posService.ROLE_LABELS[role] || role}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchData} disabled={loading}
              className="text-[10px] font-black bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg uppercase transition-all">
              {loading?'⏳':'🔄'} Refresh
            </button>
            <button onClick={handleLogout}
              className="text-[10px] font-black bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-600/20 px-3 py-1.5 rounded-lg uppercase transition-all">
              🔒 Toka
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* STAT CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon="💰" label="Mapato (PAID)" value={fmtTZS(totalRevenue)} colorClass="text-emerald-400" sub={`${orders.filter(o=>o.status==='PAID').length} oda zilizolipwa`}/>
          <StatCard icon="📋" label="Oda Zote"      value={orders.length}         colorClass="text-blue-400"    sub={`Leo: ${todayOrders} mpya`}/>
          <StatCard icon="⚠️" label="Zinasubiri"    value={pendingOrders}          colorClass="text-amber-400"   sub="PENDING / PROCESSING"/>
          <StatCard icon="📦" label="Bidhaa"         value={products.length}        colorClass="text-purple-400"  sub={`${products.filter(p=>p.is_active).length} zinazopatikana`}/>
        </div>

        {/* TABS — scrollable on mobile */}
        <div className="overflow-x-auto">
          <div className="flex gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl w-max min-w-full">
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                className={`px-3 py-2 text-[10px] font-black uppercase rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${activeTab===t.id?'bg-blue-600 text-white shadow':'text-slate-500 hover:text-slate-300'}`}>
                {t.label}
                {t.badge > 0 && <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* TAB CONTENT */}
        {loading && activeTab !== 'settings' && (
          <div className="py-16 text-center animate-pulse">
            <p className="text-slate-600 text-xs font-bold uppercase">⏳ Inapakia data...</p>
          </div>
        )}

        {!loading && (
          <>
            {activeTab === 'pos'        && <POSTab        products={products} onReload={fetchData} currentUser={currentUser} branchId={branchId} onOptimisticStock={applyOptimisticStock} />}
            {activeTab === 'orders'     && <OrdersTab     orders={orders}   onStatusChange={updateOrderStatus} />}
            {activeTab === 'inventory'  && <InventoryTab  products={products} onReload={fetchData} />}
            {activeTab === 'products'   && <ProductsTab   products={products} onReload={fetchData} />}
            {activeTab === 'suppliers'  && <SuppliersTab  />}
            {activeTab === 'purchases'  && <PurchaseOrdersTab products={products} currentUser={currentUser} branchId={branchId} />}
            {activeTab === 'transfers'  && <StockTransfersTab products={products} currentUser={currentUser} branches={branches} onBranchesChanged={loadBranches} />}
            {activeTab === 'payables'   && <PayablesTab   />}
            {activeTab === 'crm'        && <CustomersDirectoryTab />}
            {activeTab === 'credit'     && <CreditSalesTab />}
            {activeTab === 'customers'  && <CustomersTab  orders={orders} />}
            {activeTab === 'categories' && <CategoriesTab products={products} />}
            {activeTab === 'financials' && <FinancialsTab products={products} />}
            {activeTab === 'cashflow'   && <CashflowTab   />}
            {activeTab === 'reports'    && <ReportsTab    orders={orders} products={products} />}
            {activeTab === 'roles'      && <RoleManagementTab branches={branches} />}
            {activeTab === 'auditlog'   && <AuditLogTab   />}
            {activeTab === 'settings'   && <SettingsTab   orders={orders} products={products} />}
          </>
        )}
      </div>
    </div>
  );
}
