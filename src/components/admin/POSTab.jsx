import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import ReceiptModal from './ReceiptModal';
import * as pos from '../../lib/posService';
import * as offline from '../../lib/offlineSync';
import SyncStatusBadge from './SyncStatusBadge';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Fedha Taslimu', icon: '💵' },
  { id: 'mpesa', label: 'M-Pesa', icon: '📱' },
  { id: 'tigopesa', label: 'Tigo Pesa', icon: '📲' },
  { id: 'airtelmoney', label: 'Airtel Money', icon: '📞' },
  { id: 'bank_qr', label: 'Benki (QR)', icon: '🏦' },
  { id: 'card', label: 'Kadi', icon: '💳' },
  { id: 'credit', label: 'Deni (Kopa)', icon: '🧾' },
];

export default function POSTab({ products, onReload, currentUser, branchId, onOptimisticStock }) {
  const [cart, setCart] = useState([]); // {product, quantity, discountType, discountValue}
  const [search, setSearch] = useState('');
  const [scanBuffer, setScanBuffer] = useState('');
  const [session, setSession] = useState(null);
  const [openingFloat, setOpeningFloat] = useState('');
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [billDiscount, setBillDiscount] = useState({ type: 'flat', value: 0 });
  const [payments, setPayments] = useState([{ method: 'cash', amount: '' }]);
  const [customer, setCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [newCustomer, setNewCustomer] = useState(false);
  const [ncName, setNcName] = useState(''); const [ncPhone, setNcPhone] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');
  const [completedSale, setCompletedSale] = useState(null);
  const scanTimer = useRef(null);

  // ── Register session bootstrap ──────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    pos.fetchOpenSession(currentUser.id).then(({ data }) => {
      if (data?.[0]) setSession(data[0]);
      else setShowOpenModal(true);
    });
  }, [currentUser]);

  const openSession = async () => {
    const { data, error: err } = await pos.openRegisterSession(currentUser.id, branchId, Number(openingFloat || 0));
    if (err) { setError(err); return; }
    setSession(data); setShowOpenModal(false);
  };

  // ── Barcode scanner: listens for rapid keystrokes ending in Enter ──────
  // Most USB/Bluetooth barcode scanners type digits fast and send Enter.
  // We buffer keystrokes; a gap > 60ms resets the buffer (distinguishing
  // scanner input from normal human typing into the search box).
  useEffect(() => {
    const handleKey = (e) => {
      const active = document.activeElement;
      const typingInField = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
      if (typingInField && active.dataset?.posScan !== 'true') return; // don't hijack normal inputs

      if (e.key === 'Enter') {
        if (scanBuffer.length >= 3) handleBarcodeScanned(scanBuffer);
        setScanBuffer('');
        return;
      }
      if (/^[a-zA-Z0-9]$/.test(e.key)) {
        clearTimeout(scanTimer.current);
        setScanBuffer(prev => prev + e.key);
        scanTimer.current = setTimeout(() => setScanBuffer(''), 300);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [scanBuffer]);

  const handleBarcodeScanned = async (code) => {
    const { data } = await pos.findProductByBarcode(code);
    if (data?.[0]) { addToCart(data[0]); setError(''); }
    else {
      const local = products.find(p => p.sku === code);
      if (local) addToCart(local);
      else setError(`Hakuna bidhaa yenye barcode/SKU: ${code}`);
    }
  };

  // ── Cart operations ─────────────────────────────────────────────────────
  const addToCart = (product) => {
    if (Number(product.stock_quantity) <= 0) { setError(`${product.name} — hakuna stoki.`); return; }
    setError('');
    setCart(prev => {
      const idx = prev.findIndex(l => l.product.id === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        const nextQty = copy[idx].quantity + 1;
        if (nextQty > product.stock_quantity) { setError(`Stoki ya ${product.name} ni ${product.stock_quantity} tu.`); return prev; }
        copy[idx] = { ...copy[idx], quantity: nextQty };
        return copy;
      }
      return [...prev, { product, quantity: 1, discountType: 'flat', discountValue: 0 }];
    });
  };

  const updateQty = (productId, qty) => {
    setCart(prev => prev.map(l => {
      if (l.product.id !== productId) return l;
      const q = Math.max(1, Number(qty) || 1);
      if (q > l.product.stock_quantity) { setError(`Stoki ya ${l.product.name} ni ${l.product.stock_quantity} tu.`); return l; }
      return { ...l, quantity: q };
    }));
  };

  const updateLineDiscount = (productId, type, value) => {
    setCart(prev => prev.map(l => l.product.id === productId ? { ...l, discountType: type, discountValue: Number(value) || 0 } : l));
  };

  const removeLine = (productId) => setCart(prev => prev.filter(l => l.product.id !== productId));

  // ── Totals ───────────────────────────────────────────────────────────────
  const lineTotal = (l) => {
    const gross = l.quantity * Number(l.product.price);
    const disc = l.discountType === 'pct' ? gross * (l.discountValue / 100) : l.discountValue;
    return Math.max(0, gross - Math.min(disc, gross));
  };
  const lineDiscount = (l) => {
    const gross = l.quantity * Number(l.product.price);
    const disc = l.discountType === 'pct' ? gross * (l.discountValue / 100) : l.discountValue;
    return Math.min(disc, gross);
  };

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.quantity * Number(l.product.price), 0), [cart]);
  const lineDiscTotal = useMemo(() => cart.reduce((s, l) => s + lineDiscount(l), 0), [cart]);
  const billDiscAmount = useMemo(() => {
    const base = subtotal - lineDiscTotal;
    return billDiscount.type === 'pct' ? base * (Number(billDiscount.value) / 100) : Number(billDiscount.value || 0);
  }, [subtotal, lineDiscTotal, billDiscount]);
  const discountTotal = lineDiscTotal + Math.min(billDiscAmount, subtotal - lineDiscTotal);
  const total = Math.max(0, subtotal - discountTotal);

  const amountPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const changeDue = Math.max(0, amountPaid - total);
  const hasCredit = payments.some(p => p.method === 'credit');

  // ── Payments (split support) ────────────────────────────────────────────
  const addPaymentRow = () => setPayments(prev => [...prev, { method: 'cash', amount: '' }]);
  const updatePayment = (i, field, val) => setPayments(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  const removePaymentRow = (i) => setPayments(prev => prev.filter((_, idx) => idx !== i));

  // ── Customer search (for credit sales / loyalty) ────────────────────────
  useEffect(() => {
    if (customerSearch.length < 2) { setCustomerResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await pos.searchCustomers(customerSearch);
      setCustomerResults(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [customerSearch]);

  const createAndSelectCustomer = async () => {
    if (!ncName.trim()) return;
    const { data, error: err } = await pos.createCustomer({ name: ncName.trim(), phone: ncPhone.trim() || null });
    if (err) { setError(err); return; }
    setCustomer(data); setNewCustomer(false); setNcName(''); setNcPhone('');
  };

  // ── Checkout ─────────────────────────────────────────────────────────────
  const validate = () => {
    if (cart.length === 0) return 'Kikapu ni tupu.';
    if (hasCredit && !customer) return 'Chagua au ongeza mteja kwa mauzo ya deni (Kopa).';
    if (!hasCredit && amountPaid < total) return `Malipo hayajakamilika. Bado: ${fmtTZS(total - amountPaid)}`;
    if (payments.some(p => !p.method || (p.method !== 'credit' && !(Number(p.amount) > 0)))) return 'Kamilisha njia zote za malipo.';
    return '';
  };

  const checkout = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    setCheckingOut(true); setError('');

    const payload = {
      branch_id: branchId,
      customer_id: customer?.id || null,
      session_id: session?.id || null,
      subtotal, discount_total: discountTotal, tax_total: 0, total,
      amount_paid: hasCredit ? amountPaid : total,
      change_due: changeDue,
      payment_status: hasCredit ? 'CREDIT' : 'PAID',
      items: cart.map(l => ({
        product_id: l.product.id,
        quantity: l.quantity,
        unit_price: Number(l.product.price),
        discount_amount: lineDiscount(l),
        line_total: lineTotal(l),
      })),
      payments: payments.filter(p => Number(p.amount) > 0 || p.method === 'credit')
        .map(p => ({ method: p.method, amount: p.method === 'credit' ? (total - amountPaid) : Number(p.amount) })),
    };

    // Credit sales touch a live customer balance and can't be reconciled
    // safely offline — require connectivity for those specifically.
    if (hasCredit && !offline.isOnline()) {
      setError('Mauzo ya Deni (Kopa) yanahitaji mtandao ili kuhakiki salio la mteja. Tumia Fedha Taslimu au njia nyingine wakati huu.');
      setCheckingOut(false);
      return;
    }

    const finishLocally = (saleLike) => {
      setCompletedSale(saleLike);
      setCart([]); setPayments([{ method: 'cash', amount: '' }]); setBillDiscount({ type: 'flat', value: 0 }); setCustomer(null);
      setCheckingOut(false);
    };

    // Offline (or the request fails for a network reason): queue the sale,
    // update the on-screen stock immediately (optimistic UI), and hand the
    // cashier a receipt marked "will sync" rather than blocking the sale.
    const goOffline = () => {
      offline.enqueue('pos_sale', payload);
      onOptimisticStock?.(payload.items);
      finishLocally({
        ...payload, sale_no: `NJE-YA-MTANDAO-${Date.now().toString().slice(-6)}`,
        created_at: new Date().toISOString(), customers: customer,
        pos_sale_items: payload.items, pos_payments: payload.payments, _offline: true,
      });
    };

    if (!offline.isOnline()) { goOffline(); return; }

    const { data, error: err } = await pos.processSale(payload);
    if (err) {
      if (/fetch|network|Failed to fetch|NetworkError/i.test(err) || !offline.isOnline()) { goOffline(); return; }
      setError(err); setCheckingOut(false); return;
    }

    const { data: full } = await pos.fetchSaleDetail(data.sale_id);
    finishLocally(full || { ...payload, sale_no: 'SALE', created_at: new Date().toISOString(), customers: customer, pos_sale_items: payload.items, pos_payments: payload.payments });
    onReload?.();
  };

  const filteredProducts = search.length > 0
    ? products.filter(p => p.is_active && (p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode === search || p.sku === search))
    : products.filter(p => p.is_active).slice(0, 24);

  if (!session) {
    return (
      <div className="max-w-sm mx-auto py-16 space-y-4 text-center">
        <p className="text-3xl">💰</p>
        <h3 className="text-sm font-black text-white uppercase">Fungua Rejista</h3>
        <p className="text-[11px] text-slate-500">Weka kiasi cha ufunguzi (opening float) kabla ya kuanza mauzo.</p>
        <input type="number" value={openingFloat} onChange={e => setOpeningFloat(e.target.value)} placeholder="0"
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-center text-white text-sm focus:outline-none focus:border-blue-500" />
        <button onClick={openSession} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase">Fungua Rejista →</button>
        {error && <p className="text-rose-400 text-[10px] font-bold">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-5 flex justify-end -mb-2">
        <SyncStatusBadge onSynced={() => onReload?.()} />
      </div>
      {/* PRODUCT PICKER */}
      <div className="lg:col-span-3 space-y-3">
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} data-pos-scan="true"
            placeholder="🔍 Tafuta bidhaa au piga barcode..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {filteredProducts.map(p => (
            <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock_quantity <= 0}
              className="bg-slate-900 border border-slate-800 hover:border-blue-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl p-3 text-left transition-all">
              <p className="text-[11px] font-bold text-white truncate">{p.name}</p>
              <p className="text-[10px] text-amber-400 font-black mt-1">{fmtTZS(p.price)}</p>
              <p className={`text-[9px] font-bold mt-0.5 ${p.stock_quantity > (p.reorder_level || 5) ? 'text-emerald-500' : p.stock_quantity > 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                Stoki: {p.stock_quantity}
              </p>
            </button>
          ))}
          {filteredProducts.length === 0 && <p className="col-span-full text-center text-slate-600 text-xs py-8">Hakuna bidhaa zilizopatikana.</p>}
        </div>
      </div>

      {/* CART + CHECKOUT */}
      <div className="lg:col-span-2 space-y-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-black text-white uppercase">🛒 Kikapu ({cart.length})</h3>

          <div className="space-y-2 max-h-[30vh] overflow-y-auto">
            {cart.map(l => (
              <div key={l.product.id} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-[11px] font-bold text-white flex-1">{l.product.name}</p>
                  <button onClick={() => removeLine(l.product.id)} className="text-rose-400 text-[10px] font-black">✕</button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" value={l.quantity} onChange={e => updateQty(l.product.id, e.target.value)}
                    className="w-14 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-white text-center" />
                  <span className="text-[10px] text-slate-500">x {fmtTZS(l.product.price)}</span>
                  <span className="ml-auto text-[10px] font-black text-emerald-400">{fmtTZS(lineTotal(l))}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <select value={l.discountType} onChange={e => updateLineDiscount(l.product.id, e.target.value, l.discountValue)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 text-[9px] text-slate-300">
                    <option value="flat">TZS</option><option value="pct">%</option>
                  </select>
                  <input type="number" min="0" value={l.discountValue} onChange={e => updateLineDiscount(l.product.id, l.discountType, e.target.value)}
                    placeholder="Punguzo" className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[9px] text-white" />
                </div>
              </div>
            ))}
            {cart.length === 0 && <p className="text-center text-slate-600 text-[10px] py-6">Kikapu ni tupu — bonyeza bidhaa upande wa kushoto.</p>}
          </div>

          {/* Bill-level discount */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
            <span className="text-[9px] font-black text-slate-500 uppercase whitespace-nowrap">Punguzo Jumla</span>
            <select value={billDiscount.type} onChange={e => setBillDiscount(p => ({ ...p, type: e.target.value }))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-[9px] text-slate-300">
              <option value="flat">TZS</option><option value="pct">%</option>
            </select>
            <input type="number" min="0" value={billDiscount.value} onChange={e => setBillDiscount(p => ({ ...p, value: e.target.value }))}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[9px] text-white" />
          </div>

          {/* Totals */}
          <div className="space-y-1 pt-2 border-t border-slate-800 text-[10px]">
            <div className="flex justify-between text-slate-400"><span>Jumla Ndogo</span><span>{fmtTZS(subtotal)}</span></div>
            <div className="flex justify-between text-rose-400"><span>Punguzo</span><span>-{fmtTZS(discountTotal)}</span></div>
            <div className="flex justify-between text-white font-black text-sm pt-1"><span>JUMLA</span><span>{fmtTZS(total)}</span></div>
          </div>

          {/* Customer (optional / required for credit) */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <p className="text-[9px] font-black text-slate-500 uppercase">Mteja {hasCredit && <span className="text-rose-400">(Lazima kwa Deni)</span>}</p>
            {customer ? (
              <div className="flex justify-between items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5">
                <span className="text-[10px] text-white font-bold">{customer.name} — {customer.phone || '—'}</span>
                <button onClick={() => setCustomer(null)} className="text-rose-400 text-[9px] font-black">Badilisha</button>
              </div>
            ) : newCustomer ? (
              <div className="flex gap-1">
                <input value={ncName} onChange={e => setNcName(e.target.value)} placeholder="Jina" className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-white" />
                <input value={ncPhone} onChange={e => setNcPhone(e.target.value)} placeholder="Simu" className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-white" />
                <button onClick={createAndSelectCustomer} className="px-2 bg-blue-600 rounded-lg text-white text-[9px] font-black">✓</button>
              </div>
            ) : (
              <div className="relative">
                <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Tafuta mteja..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                {customerResults.length > 0 && (
                  <div className="absolute z-10 w-full bg-slate-800 border border-slate-700 rounded-lg mt-1 max-h-32 overflow-y-auto">
                    {customerResults.map(c => (
                      <button key={c.id} onClick={() => { setCustomer(c); setCustomerResults([]); setCustomerSearch(''); }}
                        className="block w-full text-left px-2 py-1.5 text-[10px] text-white hover:bg-slate-700">{c.name} — {c.phone}</button>
                    ))}
                  </div>
                )}
                <button onClick={() => setNewCustomer(true)} className="text-[9px] text-blue-400 font-bold mt-1">+ Mteja mpya</button>
              </div>
            )}
          </div>

          {/* Payments */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <p className="text-[9px] font-black text-slate-500 uppercase">Malipo (Split inaruhusiwa)</p>
            {payments.map((p, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <select value={p.method} onChange={e => updatePayment(i, 'method', e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1.5 text-[9px] text-white flex-1">
                  {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
                </select>
                {p.method !== 'credit' && (
                  <input type="number" min="0" value={p.amount} onChange={e => updatePayment(i, 'amount', e.target.value)}
                    placeholder="Kiasi" className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[9px] text-white" />
                )}
                {payments.length > 1 && <button onClick={() => removePaymentRow(i)} className="text-rose-400 text-[10px]">✕</button>}
              </div>
            ))}
            <button onClick={addPaymentRow} className="text-[9px] text-blue-400 font-bold">+ Ongeza njia ya malipo (gawanya)</button>
            <div className="flex justify-between text-[10px] pt-1">
              <span className="text-slate-500">Kalipwa: {fmtTZS(amountPaid)}</span>
              {changeDue > 0 && <span className="text-emerald-400 font-black">Chenji: {fmtTZS(changeDue)}</span>}
            </div>
          </div>

          {error && <p className="text-rose-400 text-[10px] font-bold text-center bg-rose-500/10 rounded-lg py-1.5">{error}</p>}

          <button onClick={checkout} disabled={checkingOut || cart.length === 0}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black uppercase">
            {checkingOut ? 'Inachakata...' : `✓ Kamilisha Mauzo — ${fmtTZS(total)}`}
          </button>
        </div>
      </div>

      {completedSale && (
        <ReceiptModal sale={completedSale} onClose={() => setCompletedSale(null)} />
      )}
    </div>
  );
}
