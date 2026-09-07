import React, { useState, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { id: 'M-Pesa',       label: 'M-Pesa',       icon: '🟢', hint: 'Vodacom' },
  { id: 'Tigo Pesa',    label: 'Tigo Pesa',    icon: '🔵', hint: 'Tigo'    },
  { id: 'Airtel Money', label: 'Airtel Money', icon: '🔴', hint: 'Airtel'  },
  { id: 'Cash',         label: 'Taslimu',      icon: '💵', hint: 'Dukani'  },
];

const ADMIN_WA = '255620642652'; // WhatsApp ya admin (Alexander)

const fmtTZS = (n) => `${Number(n || 0).toLocaleString()} TZS`;

// ─── STEP INDICATOR ───────────────────────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = ['Kikapu', 'Taarifa', '✓ Imekamilika'];
  return (
    <div className="flex items-center gap-1">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done    = step > idx;
        const current = step === idx;
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${done ? 'bg-emerald-500 text-white' : current ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-400'}`}>
                {done ? '✓' : idx}
              </div>
              <span className={`text-[9px] font-bold hidden sm:block transition-colors ${current ? 'text-blue-900' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < 2 && <div className={`w-6 h-px mx-1 transition-all ${step > idx ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CheckoutFlow({ cart, onBack, onSuccess }) {
  const [step,     setStep]    = useState(1);
  const [info,     setInfo]    = useState({ name: '', phone: '', paymentMethod: 'M-Pesa' });
  const [loading,  setLoading] = useState(false);
  const [orderId,  setOrderId] = useState(null);
  const [error,    setError]   = useState('');

  // ── Aggregate duplicate cart items into qty groups ───────────────────────────
  const items = useMemo(() => cart.reduce((acc, item) => {
    const ex = acc.find(a => a.id === item.id);
    if (ex) ex.qty++;
    else acc.push({ ...item, qty: 1 });
    return acc;
  }, []), [cart]);

  const total = useMemo(() => items.reduce((s, i) => s + Number(i.price) * i.qty, 0), [items]);

  // ── Submit order to Supabase ─────────────────────────────────────────────────
  const handleConfirm = async () => {
    setError('');
    if (!info.name.trim() || !info.phone.trim()) {
      setError('Tafadhali jaza Jina na Namba ya Simu.');
      return;
    }
    setLoading(true);
    try {
      const itemsText = items.map(i => `${i.name} x${i.qty}`).join(', ');

      // 1 — Insert order
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert({
          customer_name:  info.name.trim(),
          customer_phone: info.phone.trim(),
          items:          itemsText,
          total_price:    total,
          status:         'PAID',
        })
        .select('id')
        .single();

      if (orderErr) throw orderErr;
      setOrderId(orderData.id);

      // 2 — Upsert customer (check if exists first to handle increment properly)
      const { data: existing } = await supabase
        .from('customers')
        .select('id, total_orders, total_spent')
        .eq('customer_phone', info.phone.trim())
        .maybeSingle();

      if (existing) {
        await supabase.from('customers')
          .update({
            customer_name: info.name.trim(),
            total_orders:  (existing.total_orders || 0) + 1,
            total_spent:   (existing.total_spent  || 0) + total,
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('customers').insert({
          customer_name:  info.name.trim(),
          customer_phone: info.phone.trim(),
          total_orders:   1,
          total_spent:    total,
        });
      }

      setStep(3);
    } catch (err) {
      setError('Hitilafu ya Supabase: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Build WhatsApp deep-link ─────────────────────────────────────────────────
  const buildWaLink = () => {
    const lines = items.map(i => `  • ${i.name} x${i.qty}  →  ${fmtTZS(Number(i.price) * i.qty)}`).join('\n');
    const msg = [
      `🛒 *ODA MPYA — LETEMA STATIONERY*`,
      ``,
      `👤 *Mteja:*  ${info.name}`,
      `📱 *Simu:*   ${info.phone}`,
      `💳 *Malipo:* ${info.paymentMethod}`,
      ``,
      `*Bidhaa/Huduma:*`,
      lines,
      ``,
      `💰 *JUMLA: ${fmtTZS(total)}*`,
      `🆔 Oda #${orderId || '—'}`,
      `📍 LSIC — Mbeya Business Hub`,
    ].join('\n');
    return `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // EMPTY CART
  // ─────────────────────────────────────────────────────────────────────────────
  if (cart.length === 0 && step === 1) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 p-4">
        <div className="text-5xl">🛒</div>
        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Kikapu chako kiko tupu!</p>
        <p className="text-xs text-slate-500">Ongeza bidhaa au huduma kwanza kuendelea.</p>
        <button onClick={onBack} className="bg-blue-900 hover:bg-blue-950 text-white text-xs font-black px-6 py-3 rounded-xl uppercase tracking-widest transition-all">
          ← Rudi Katalogi
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN CHECKOUT
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ─── STICKY HEADER ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-20 px-4 py-3.5 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          {step < 3 ? (
            <button onClick={step === 1 ? onBack : () => setStep(s => s - 1)}
              className="text-xs font-bold text-slate-500 hover:text-blue-900 flex items-center gap-1 transition-colors">
              ← {step === 1 ? 'Katalogi' : 'Rudi'}
            </button>
          ) : <div />}

          <StepIndicator step={step} />

          <div className="text-right">
            <p className="text-[9px] text-slate-400 font-bold uppercase">Jumla</p>
            <p className="text-xs font-black text-blue-900">{fmtTZS(total)}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* ══ STEP 1 — CART REVIEW ═════════════════════════════════════════ */}
        {step === 1 && (
          <>
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">Muhtasari wa Kikapu</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">{items.length} aina · {cart.length} kipande</p>
              </div>

              <div className="divide-y divide-slate-50">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                      {item.image_url || item.img
                        ? <img src={item.image_url || item.img} alt={item.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">📦</div>}
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.category} · {fmtTZS(item.price)} × {item.qty}</p>
                    </div>
                    {/* Price */}
                    <div className="text-right">
                      <p className="text-xs font-black text-blue-900">{fmtTZS(Number(item.price) * item.qty)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="bg-slate-50 border-t border-slate-100 px-5 py-4 flex justify-between items-center">
                <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Jumla Kuu:</span>
                <span className="text-xl font-black text-emerald-600">{fmtTZS(total)}</span>
              </div>
            </div>

            <button onClick={() => setStep(2)}
              className="w-full bg-blue-900 hover:bg-blue-950 text-white text-xs font-black py-4 rounded-2xl uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]">
              Endelea → Taarifa za Mteja
            </button>
          </>
        )}

        {/* ══ STEP 2 — CUSTOMER INFO ═══════════════════════════════════════ */}
        {step === 2 && (
          <>
            {/* Customer form */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">Taarifa za Mteja</h2>

              {[
                { label: 'Jina Kamili *', key: 'name',  type: 'text', ph: 'Mfano: Amina Letema' },
                { label: 'Namba ya Simu *', key: 'phone', type: 'tel',  ph: '0712 345 678' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.ph}
                    value={info[f.key]}
                    onChange={e => { setInfo(p => ({ ...p, [f.key]: e.target.value })); setError(''); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-900 focus:bg-white transition-all"
                  />
                </div>
              ))}

              {error && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5">
                  <p className="text-rose-600 text-[10px] font-bold">⚠️ {error}</p>
                </div>
              )}
            </div>

            {/* Payment method */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-3">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">Njia ya Malipo</h2>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(pm => (
                  <button key={pm.id} type="button"
                    onClick={() => setInfo(p => ({ ...p, paymentMethod: pm.id }))}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${info.paymentMethod === pm.id ? 'border-blue-900 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}>
                    <span className="text-base block mb-1">{pm.icon}</span>
                    <p className={`text-[10px] font-black leading-none ${info.paymentMethod === pm.id ? 'text-blue-900' : 'text-slate-700'}`}>{pm.label}</p>
                    <p className={`text-[9px] mt-0.5 ${info.paymentMethod === pm.id ? 'text-blue-500' : 'text-slate-400'}`}>{pm.hint}</p>
                  </button>
                ))}
              </div>

              {info.paymentMethod !== 'Cash' && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5">
                  <p className="text-xs font-black text-amber-800 mb-1">📌 Hatua za Kulipa:</p>
                  <p className="text-[10px] text-amber-700 leading-relaxed">
                    Tuma <span className="font-black">{fmtTZS(total)}</span> kwenda namba{' '}
                    <span className="font-black">0620 642 652</span> (Alexander Letema) kwa {info.paymentMethod}, kisha ubonyeze kitufe hapa chini.
                  </p>
                </div>
              )}
            </div>

            {/* Order summary mini */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm px-5 py-3 flex justify-between items-center">
              <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase">Unathibitisha:</p>
                <p className="text-xs font-black text-slate-800">{items.length} aina · {cart.length} vipande</p>
              </div>
              <p className="text-lg font-black text-emerald-600">{fmtTZS(total)}</p>
            </div>

            <button onClick={handleConfirm} disabled={loading || !info.name || !info.phone}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black py-4 rounded-2xl uppercase tracking-widest shadow-lg shadow-emerald-900/10 transition-all active:scale-[0.98]">
              {loading ? '⏳ Inasajili kwenye Supabase...' : `✅ Thibitisha Oda — ${fmtTZS(total)}`}
            </button>
          </>
        )}

        {/* ══ STEP 3 — SUCCESS ════════════════════════════════════════════ */}
        {step === 3 && (
          <>
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-500 text-2xl">
                ✓
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Oda Imehifadhiwa!</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Oda <span className="font-black text-blue-900">#{orderId}</span> imeingia kwenye Supabase kwa mafanikio.
                </p>
              </div>

              {/* Receipt summary */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-left space-y-2.5">
                {[
                  { label: '👤 Mteja',   value: info.name          },
                  { label: '📱 Simu',    value: info.phone          },
                  { label: '💳 Malipo',  value: info.paymentMethod  },
                  { label: '💰 Jumla',   value: fmtTZS(total), highlight: true },
                  { label: '🆔 Oda',     value: `#${orderId}`       },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-slate-500 font-medium">{r.label}</span>
                    <span className={`font-black ${r.highlight ? 'text-emerald-600' : 'text-slate-800'}`}>{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Items recap */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-left">
                <p className="text-[9px] font-black text-blue-700 uppercase tracking-wider mb-2">Bidhaa/Huduma Zilizochaguliwa:</p>
                {items.map(i => (
                  <div key={i.id} className="flex justify-between text-[10px] text-blue-800 font-semibold">
                    <span>{i.name} × {i.qty}</span>
                    <span className="font-black">{fmtTZS(Number(i.price) * i.qty)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* WhatsApp CTA */}
            <a href={buildWaLink()} target="_blank" rel="noopener noreferrer"
              className="w-full bg-[#25D366] hover:bg-[#1da855] text-white text-xs font-black py-4 rounded-2xl uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
              💬 Tuma Taarifa kwa WhatsApp
            </a>

            <button onClick={onSuccess}
              className="w-full bg-blue-900 hover:bg-blue-950 text-white text-xs font-black py-4 rounded-2xl uppercase tracking-widest shadow-lg transition-all active:scale-[0.98]">
              🛍️ Endelea Kununua
            </button>
          </>
        )}
      </div>
    </div>
  );
}

