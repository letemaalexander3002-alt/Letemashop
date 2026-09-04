import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Cart({ cartItems, onRemoveFromCart, onClearCart, onClose }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('M-Pesa');
  const [customerName, setCustomerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Kuhesabu jumla ya bei
  const totalPrice = cartItems.reduce((sum, item) => sum + item.price, 0);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return;
    if (!customerName || !phoneNumber) {
      alert('Tafadhali jaza Jina na Namba ya simu!');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Hifadhi Oda kule Supabase kwa ajili ya ripoti za LSIC (Audit Logs)
      const { data, error } = await supabase
        .from('orders') // Hakikisha una meza ya orders au tutaitengeneza SQL editor
        .insert([
          {
            customer_name: customerName,
            phone_number: phoneNumber,
            payment_method: paymentMethod,
            total_amount: totalPrice,
            items: cartItems.map(item => ({ id: item.id, name: item.name, price: item.price })),
            status: 'Pending'
          }
        ]);

      // 2. Tengeneza ujumbe mzuri wa kwenda WhatsApp ya Alexander (0620642652)
      const businessPhone = "255620642652"; 
      let message = `*LETEMA STATIONERY & INTERNET CAFÉ (LSIC)*\n`;
      message += `*ODA MPYA YA HUDUMA*\n\n`;
      message += `👤 *Mteja:* ${customerName}\n`;
      message += `📞 *Simu:* ${phoneNumber}\n`;
      message += `💳 *Njia ya Malipo:* ${paymentMethod}\n`;
      message += `------------------------------------\n`;
      
      cartItems.forEach((item, index) => {
        message += `${index + 1}. ${item.name} - ${item.price.toLocaleString()} TZS\n`;
      });
      
      message += `------------------------------------\n`;
      message += `💰 *JUMLA KUU:* ${totalPrice.toLocaleString()} TZS\n\n`;
      message += `_Tafadhali thibitisha malipo ili kuanza kutoa huduma._`;

      // Kuingiza ujumbe kwenye URL ya WhatsApp
      const whatsappUrl = `https://wa.me/${businessPhone}?text=${encodeURIComponent(message)}`;
      
      // Kusafisha kikapu na kufungua WhatsApp
      onClearCart();
      onClose();
      window.open(whatsappUrl, '_blank');

    } catch (err) {
      console.error("Umakini kwenye Checkout:", err.message);
      alert("Kuna shida imetokea wakati wa kuchakata oda.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end animate-fadeIn">
      <div className="bg-white w-full max-w-md h-full flex flex-col justify-between p-6 shadow-2xl overflow-y-auto">
        
        {/* KICHWA CHA KIKAPU */}
        <div>
          <div className="flex justify-between items-center border-b pb-4">
            <h2 className="text-lg font-black text-blue-900 uppercase">Kikapu Chako 🛒</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
          </div>

          {/* ORODHA YA HUDUMA ZILIZOCHAGULIWA */}
          <div className="mt-4 space-y-3">
            {cartItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8 font-semibold">Kikapu chako kipo wazi kwa sasa.</p>
            ) : (
              cartItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">{item.name}</h4>
                    <p className="text-xs font-black text-blue-900 mt-0.5">{item.price.toLocaleString()} TZS</p>
                  </div>
                  <button 
                    onClick={() => onRemoveFromCart(index)}
                    className="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg"
                  >
                    Odoa
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* FOMU YA MALIPO (CHECKOUT FORM) */}
        {cartItems.length > 0 && (
          <div className="border-t pt-4 space-y-4 bg-white">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-500">Jumla Kuu:</span>
              <span className="text-xl font-black text-blue-900">{totalPrice.toLocaleString()} TZS</span>
            </div>

            <form onSubmit={handleCheckout} className="space-y-3">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1">Jina la Mteja</label>
                <input 
                  type="text" 
                  required
                  placeholder="Mf. Alexander Letema"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-900 bg-gray-50 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1">Namba ya Simu ya Malipo</label>
                <input 
                  type="tel" 
                  required
                  placeholder="Mf. 0620642652"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-900 bg-gray-50 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1">Mtandao wa Malipo</label>
                <select 
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-900 bg-gray-50 font-bold text-gray-700"
                >
                  <option value="M-Pesa">Vodacom M-Pesa</option>
                  <option value="Tigo Pesa">Tigo Pesa</option>
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="Cash">Fedha Taslimu (Cash)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-900 hover:bg-amber-500 text-white font-black text-sm py-3.5 rounded-xl transition-all shadow-md uppercase tracking-wide mt-2"
              >
                {isSubmitting ? 'Inatuma Oda...' : '💳 Kisha & Tuma Oda kupitia WhatsApp'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

