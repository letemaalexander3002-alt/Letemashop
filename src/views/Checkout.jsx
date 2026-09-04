import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

// ── Constants ────────────────────────────────────────────────────────────────
const BUSINESS_PHONE = '255620642652';
const BUSINESS_NAME  = 'Alexander Letema — LSIC';

const PAYMENT_METHODS = [
  {
    id: 'mpesa',
    name: 'M-Pesa',
    network: 'Vodacom',
    emoji: '🔴',
    color: 'border-red-400 bg-red-500/10',
    activeColor: 'border-red-500 bg-red-500/20',
    steps: [
      'Piga *150*00#',
      'Chagua "Lipa Bili"',
      'Weka namba: 0620 642 652',
      'Weka kiasi: {amount} TZS',
      'Weka PIN yako kuthibitisha',
    ],
  },
  {
    id: 'tigopesa',
    name: 'Tigo Pesa',
    network: 'Tigo',
    emoji: '🔵',
    color: 'border-blue-400 bg-blue-500/10',
    activeColor: 'border-blue-500 bg-blue-500/20',
    steps: [
      'Piga *150*01#',
      'Chagua "Lipa"',
      'Weka namba: 0620 642 652',
      'Weka kiasi: {amount} TZS',
      'Weka PIN yako kuthibitisha',
    ],
  },
  {
    id: 'airtel',
    name: 'Airtel Money',
    network: 'Airtel',
    emoji: '🟠',
    color: 'border-orange-400 bg-orange-500/10',
    activeColor: 'border-orange-500 bg-orange-500/20',
    steps: [
      'Piga *150*60#',
      'Chagua "Lipa Bili"',
      'Weka namba: 0620 642 652',
      'Weka kiasi: {amount} TZS',
      'Weka PIN yako kuthibitisha',
    ],
  },
  {
    id: 'halopesa',
    name: 'HaloPesa',
    network: 'Halotel',
    emoji: '🟢',
    color: 'border-green-400 bg-green-500/10',
    activeColor: 'border-green-500 bg-green-500/20',
    steps: [
      'Piga *150*88#',
      'Chagua "Lipa"',
      'Weka namba: 0620 642 652',
      'Weka kiasi: {amount} TZS',
      'Weka PIN yako kuthibitisha',
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtTZS = n => Number(n || 0).toLocaleString();

function genOrderRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'LSIC-';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

function normalisePhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('0')) return '255' + cleaned.slice(1);
  return cleaned;
}

// ── Step indicator ────────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Kikapu', 'Chagua Malipo', 'Lipa', 'Thibitisha'];
  return (
    <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = current > idx;
        const active = current === idx;
        return (
          <div key={idx} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-lg text-[10px] font-black flex items-center justify-center transition-all ${
                done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-900 text-white shadow-lg' : 'bg-gray-100 text-gray-400'
              }`}>
                {done ? '✓' : idx}
              </div>
              <span className={`text-[9px] font-bold mt-1 hidden sm:block ${active ? 'text-blue-900' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-6 sm:w-10 mx-1 rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── MAIN CHECKOUT ─────────────────────────────────────────────────────────────
export default function Checkout({ cartItems, onUpdateQuantity, onClearCart, onContinueShopping }) {
  const [step, setStep]               = useState(1);
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [orderRef] = useState(genOrderRef);
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [ordered, setOrdered]         = useState(false);

  const totalPrice = cartItems.reduce((s, i) => s + (Number(i.price) * (i.quantity || 1)), 0);
  const method     = PAYMENT_METHODS.find(m => m.id === selectedMethod);

  const setField = (key, val) => {
    setCustomerInfo(p => ({ ...p, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  // ── STEP 1: Cart + Customer Info ──────────────────────────────────────────
  const validateStep1 = () => {
    const e = {};
    if (!customerInfo.name.trim()) e.name = 'Jaza jina lako';
    if (!customerInfo.phone.trim()) e.phone = 'Jaza namba ya simu';
    else if (!/^(0[67]\d{8}|255\d{9}|\+255\d{9})$/.test(customerInfo.phone.replace(/[\s\-\(\)]/g, '')))
      e.phone = 'Namba si sahihi — mfano: 0620642652';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── STEP 3: Validate reference number ────────────────────────────────────
  const validateStep3 = () => {
    const e = {};
    if (!referenceNumber.trim()) e.ref = 'Weka namba ya uthibitisho uliopata baada ya kulipa';
    else if (referenceNumber.trim().length < 6) e.ref = 'Namba ya uthibitisho ni fupi sana';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit order ──────────────────────────────────────────────────────────
  const handleSubmitOrder = async () => {
    if (!validateStep3()) return;
    setSubmitting(true);

    const phone = normalisePhone(customerInfo.phone);
    const itemsText = cartItems.map(i => `${i.name} x${i.quantity || 1}`).join(', ');

    try {
      // Save to Supabase
      const { error } = await supabase.from('orders').insert([{
        customer_name:  customerInfo.name.trim(),
        customer_phone: phone,
        items:          itemsText,
        total_amount:   totalPrice,
        payment_method: method?.name || selectedMethod,
        reference_number: referenceNumber.trim().toUpperCase(),
        order_ref:      orderRef,
        status:         'PENDING',
      }]);

      if (error) throw error;

      // Send WhatsApp to admin
      sendWhatsAppToAdmin(phone, itemsText);

      setOrdered(true);
      onClearCart();
    } catch (err) {
      setErrors({ _: 'ERR: insert failed' });
      console.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const sendWhatsAppToAdmin = (phone, itemsText) => {
    const msg = encodeURIComponent(
`🛒 *AGIZO JIPYA — LSIC Business Hub*
━━━━━━━━━━━━━━━━━━━━━
📋 *Ref:* ${orderRef}
👤 *Jina:* ${customerInfo.name}
📞 *Simu:* ${phone}

📦 *Bidhaa:*
${cartItems.map(i => `• ${i.name} x${i.quantity||1} = ${fmtTZS(i.price*(i.quantity||1))} TZS`).join('\n')}

💰 *Jumla: ${fmtTZS(totalPrice)} TZS*
💳 *Njia:* ${method?.name}
🔖 *Reference:* ${referenceNumber.trim().toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━
_Tafadhali hakikisha malipo na ubadilishe hali kuwa PAID_`
    );
    window.open(`https://wa.me/${BUSINESS_PHONE}?text=${msg}`, '_blank');
  };

  // ── Empty cart ────────────────────────────────────────────────────────────
  if (cartItems.length === 0 && !ordered) return (
    <div className="max-w-sm mx-auto text-center py-16 px-4">
      <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
        <p className="text-5xl mb-4">🛒</p>
        <p className="text-sm font-black text-gray-900 uppercase mb-1">Kikapu Kipo Wazi</p>
        <p className="text-xs text-gray-400 mb-6">Rudi katalogini kuchagua huduma.</p>
        <button onClick={onContinueShopping}
          className="bg-blue-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-800 transition">
          ← Rudi Katalogini
        </button>
      </div>
    </div>
  );

  // ── Success ───────────────────────────────────────────────────────────────
  if (ordered) return (
    <div className="max-w-sm mx-auto text-center py-12 px-4">
      <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-lg">
        <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
        <h2 className="text-base font-black text-gray-900 uppercase mb-1">Agizo Limepokelewa!</h2>
        <p className="text-xs text-gray-500 mb-4">Ref: <span className="font-black text-blue-900">{orderRef}</span></p>
        <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 text-xs mb-6">
          <p className="flex justify-between"><span className="text-gray-500">Mteja:</span><span className="font-bold">{customerInfo.name}</span></p>
          <p className="flex justify-between"><span className="text-gray-500">Jumla:</span><span className="font-black text-emerald-600">{fmtTZS(totalPrice)} TZS</span></p>
          <p className="flex justify-between"><span className="text-gray-500">Malipo:</span><span className="font-bold">{method?.name}</span></p>
          <p className="flex justify-between"><span className="text-gray-500">Reference:</span><span className="font-black text-blue-900">{referenceNumber.trim().toUpperCase()}</span></p>
          <p className="flex justify-between"><span className="text-gray-500">Hali:</span><span className="font-black text-amber-600">Inasubiri Uhakiki</span></p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
          <p className="text-[10px] text-amber-800 font-medium">
            💬 WhatsApp imetumwa kwa admin. Agizo lako litathihitishwa hivi karibuni.
          </p>
        </div>
        <button onClick={onContinueShopping}
          className="w-full bg-gray-900 text-white py-3 rounded-xl text-xs font-black uppercase hover:bg-gray-800 transition">
          ↩ Rudi Dukani
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <Steps current={step} />

      {/* ── STEP 1: CART + CUSTOMER INFO ───────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Cart items */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-black text-gray-700 uppercase tracking-wider">Bidhaa Zilizochaguliwa</p>
            </div>
            <div className="divide-y divide-gray-50">
              {cartItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                    <p className="text-[10px] text-gray-400">{fmtTZS(item.price)} TZS / moja</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1 border">
                    <button onClick={() => onUpdateQuantity(item.id, (item.quantity||1)-1)}
                      className="w-6 h-6 bg-white rounded text-xs font-black border active:scale-90 flex items-center justify-center">−</button>
                    <span className="text-xs font-black w-4 text-center">{item.quantity||1}</span>
                    <button onClick={() => onUpdateQuantity(item.id, (item.quantity||1)+1)}
                      className="w-6 h-6 bg-white rounded text-xs font-black border active:scale-90 flex items-center justify-center">+</button>
                  </div>
                  <span className="text-xs font-black text-blue-900 w-20 text-right">
                    {fmtTZS(item.price*(item.quantity||1))} TZS
                  </span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 bg-blue-950 flex justify-between items-center">
              <span className="text-xs font-black text-blue-200 uppercase">Jumla Kuu</span>
              <span className="text-base font-black text-white">{fmtTZS(totalPrice)} TZS</span>
            </div>
          </div>

          {/* Customer info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
            <p className="text-xs font-black text-gray-700 uppercase tracking-wider">Taarifa Zako</p>
            <div>
              <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Jina Kamili *</label>
              <input value={customerInfo.name} onChange={e => setField('name', e.target.value)}
                placeholder="Jina la Mteja"
                className={`w-full border rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none transition ${errors.name?'border-red-400':'border-gray-200 focus:border-blue-900'}`}/>
              {errors.name && <p className="text-red-500 text-[10px] mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Namba ya Simu *</label>
              <input type="tel" value={customerInfo.phone} onChange={e => setField('phone', e.target.value)}
                placeholder="0620642652"
                className={`w-full border rounded-xl px-3 py-2.5 text-xs font-black tracking-wider focus:outline-none transition ${errors.phone?'border-red-400':'border-gray-200 focus:border-blue-900'}`}/>
              {errors.phone && <p className="text-red-500 text-[10px] mt-1">{errors.phone}</p>}
            </div>
          </div>

          <button onClick={() => { if(validateStep1()) setStep(2); }}
            className="w-full bg-blue-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-blue-950 transition shadow-lg active:scale-95">
            Endelea Kuchagua Malipo →
          </button>
        </div>
      )}

      {/* ── STEP 2: CHOOSE PAYMENT METHOD ──────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-black text-gray-700 uppercase tracking-wider mb-4">Chagua Njia ya Malipo</p>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map(m => (
                <button key={m.id} onClick={() => setSelectedMethod(m.id)}
                  className={`border-2 rounded-2xl p-4 text-left transition-all active:scale-95 ${
                    selectedMethod === m.id ? m.activeColor + ' scale-[1.02]' : m.color + ' hover:scale-[1.01]'
                  }`}>
                  <div className="text-2xl mb-2">{m.emoji}</div>
                  <p className="text-xs font-black text-gray-900">{m.name}</p>
                  <p className="text-[9px] text-gray-500 font-medium">{m.network}</p>
                  {selectedMethod === m.id && (
                    <div className="mt-2 w-4 h-4 bg-blue-900 rounded-full flex items-center justify-center text-white text-[8px] font-black">✓</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Amount summary */}
          <div className="bg-blue-950 rounded-2xl p-4 flex justify-between items-center">
            <span className="text-xs text-blue-300 font-bold">Kiasi cha Kulipa</span>
            <span className="text-xl font-black text-white">{fmtTZS(totalPrice)} TZS</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setStep(1)}
              className="py-3.5 rounded-2xl bg-gray-100 text-gray-600 text-xs font-black uppercase hover:bg-gray-200 transition">
              ← Rudi
            </button>
            <button onClick={() => { if(!selectedMethod){setErrors({method:'Chagua njia ya malipo'});return;} setStep(3); }}
              disabled={!selectedMethod}
              className="py-3.5 rounded-2xl bg-blue-900 text-white text-xs font-black uppercase hover:bg-blue-950 transition disabled:opacity-40 shadow-lg">
              Endelea Kulipa →
            </button>
          </div>
          {errors.method && <p className="text-red-500 text-[10px] text-center">{errors.method}</p>}
        </div>
      )}

      {/* ── STEP 3: PAYMENT INSTRUCTIONS + REFERENCE ───────────────────── */}
      {step === 3 && method && (
        <div className="space-y-4">
          {/* Payment instructions */}
          <div className={`border-2 rounded-2xl p-5 ${method.activeColor}`}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{method.emoji}</span>
              <div>
                <p className="font-black text-gray-900 text-sm">{method.name}</p>
                <p className="text-[10px] text-gray-500">{method.network}</p>
              </div>
            </div>

            {/* Amount highlight */}
            <div className="bg-white rounded-xl p-3 mb-4 text-center border border-gray-100">
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Lipa Kiasi Hiki</p>
              <p className="text-2xl font-black text-blue-900">{fmtTZS(totalPrice)} TZS</p>
              <p className="text-[10px] text-gray-500 mt-1">Kwa: <span className="font-black text-gray-800">{BUSINESS_NAME}</span></p>
              <p className="text-[10px] text-gray-500">Namba: <span className="font-black text-gray-800">0620 642 652</span></p>
            </div>

            {/* Step by step instructions */}
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-wider mb-2">Hatua za Kulipa:</p>
            <div className="space-y-2">
              {method.steps.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-900 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i+1}
                  </span>
                  <p className="text-xs text-gray-700 font-medium leading-relaxed">
                    {s.replace('{amount}', fmtTZS(totalPrice))}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Order reference */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Namba ya Agizo Lako</p>
              <span className="text-[10px] font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded-lg">{orderRef}</span>
            </div>
            <p className="text-[9px] text-gray-400">Hifadhi namba hii kwa ajili ya maswali.</p>
          </div>

          {/* Reference number input */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <label className="block text-[9px] font-black uppercase text-gray-400 mb-1 tracking-wider">
              Namba ya Uthibitisho (Reference) *
            </label>
            <p className="text-[9px] text-gray-400 mb-3">
              Baada ya kulipa, utapata SMS kutoka {method.network} yenye namba ya uthibitisho. Iweke hapa.
            </p>
            <input
              value={referenceNumber}
              onChange={e => { setReferenceNumber(e.target.value.toUpperCase()); setErrors(er => ({...er, ref:''})); }}
              placeholder="Mfano: ABC123456"
              className={`w-full border rounded-xl px-3 py-3 text-sm font-black tracking-widest uppercase focus:outline-none transition ${
                errors.ref ? 'border-red-400' : 'border-gray-200 focus:border-blue-900'
              }`}/>
            {errors.ref && <p className="text-red-500 text-[10px] mt-1">{errors.ref}</p>}
          </div>

          {errors._ && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-xs font-bold text-center">{errors._}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setStep(2)}
              className="py-3.5 rounded-2xl bg-gray-100 text-gray-600 text-xs font-black uppercase hover:bg-gray-200 transition">
              ← Rudi
            </button>
            <button onClick={handleSubmitOrder} disabled={submitting}
              className="py-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase hover:bg-emerald-700 transition disabled:opacity-50 shadow-lg active:scale-95">
              {submitting ? '⏳ Inatuma...' : '✅ Tuma Agizo'}
            </button>
          </div>

          <p className="text-[9px] text-gray-400 text-center">
            Kwa kubonyeza "Tuma Agizo" unakubali kwamba umelipa kiasi kilichotajwa.
          </p>
        </div>
      )}
    </div>
  );
}
