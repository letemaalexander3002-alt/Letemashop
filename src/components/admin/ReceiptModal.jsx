import React, { useRef, useState } from 'react';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;
const fmtDate = d => new Date(d).toLocaleString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const PAYMENT_LABELS = {
  cash: 'Fedha Taslimu', mpesa: 'M-Pesa', tigopesa: 'Tigo Pesa',
  airtelmoney: 'Airtel Money', bank_qr: 'Benki (QR)', card: 'Kadi', credit: 'Deni (Kopa)',
};

/**
 * ReceiptModal — renders a thermal-style receipt and provides:
 *  - Print (window.print via a dedicated printable area)
 *  - PDF download (html2pdf.js, already a project dependency)
 *  - Digital send trigger (email via Web3Forms; SMS via tel: fallback — real
 *    SMS gateway integration point is clearly marked for the client's provider)
 */
export default function ReceiptModal({ sale, businessInfo, onClose }) {
  const receiptRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const [emailTo, setEmailTo] = useState(sale.customer_email || '');

  const handlePrint = () => {
    const printContents = receiptRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=380,height=700');
    win.document.write(`
      <html><head><title>Risiti — ${sale.sale_no}</title>
      <style>
        body{font-family:'Courier New',monospace;font-size:12px;padding:12px;color:#000;}
        .rline{border-top:1px dashed #000;margin:6px 0;}
        table{width:100%;border-collapse:collapse;}
        td{padding:2px 0;}
        .right{text-align:right;} .center{text-align:center;} .bold{font-weight:bold;}
      </style></head><body>${printContents}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleDownloadPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    html2pdf()
      .set({
        margin: 4,
        filename: `Risiti-${sale.sale_no}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: [80, 200], orientation: 'portrait' },
      })
      .from(receiptRef.current)
      .save();
  };

  const handleEmailSend = async () => {
    if (!emailTo) { setSendMsg('Weka barua pepe kwanza.'); return; }
    setSending(true); setSendMsg('');
    try {
      const formData = new FormData();
      formData.append('access_key', '190a5277-7e2b-48ef-94f4-971629cc804e');
      formData.append('subject', `Risiti Yako — ${sale.sale_no}`);
      formData.append('from_name', 'Letema Shop POS');
      formData.append('to_email_hint', emailTo);
      formData.append('Jumla', fmtTZS(sale.total));
      formData.append('Namba ya Mauzo', sale.sale_no);
      formData.append('Tarehe', fmtDate(sale.created_at));
      const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: formData });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || 'Imeshindikana kutuma');
      setSendMsg('✅ Risiti imetumwa kwa barua pepe.');
    } catch (err) {
      setSendMsg('❌ ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleSmsSend = () => {
    // Integration point: wire your SMS gateway (e.g. Beem Africa, Africa's
    // Talking) here via a Supabase Edge Function that this calls. As a
    // functional fallback with zero extra infra, this opens the device's
    // SMS composer pre-filled with the receipt summary.
    if (!sale.customer_phone) { setSendMsg('Hakuna namba ya simu ya mteja kwenye mauzo haya.'); return; }
    const body = encodeURIComponent(
      `Letema Shop\nRisiti: ${sale.sale_no}\nJumla: ${fmtTZS(sale.total)}\nAsante kwa ununuzi wako!`
    );
    window.location.href = `sms:${sale.customer_phone}?body=${body}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <h3 className="text-sm font-black text-white uppercase">🧾 Risiti</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        {sale._offline && (
          <div className="mx-4 mt-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
            <p className="text-[10px] text-amber-400 font-bold">📴 Imehifadhiwa nje ya mtandao — itatumwa kwenye seva mtandao utakaporudi. Mauzo haya tayari yamehesabika kwenye stoki.</p>
          </div>
        )}

        {/* Printable receipt area */}
        <div className="p-4">
          <div ref={receiptRef} className="bg-white text-black rounded-lg p-4 font-mono text-[11px] leading-tight">
            <div className="center bold" style={{ textAlign: 'center', fontWeight: 700 }}>
              <p style={{ fontSize: 14 }}>{businessInfo?.name || 'Letema Stationery & Internet Café'}</p>
              <p>{businessInfo?.location || 'Dodoma, Tanzania'}</p>
              <p>{businessInfo?.phone || '+255 620 642 652'}</p>
            </div>
            <div className="rline" style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <table style={{ width: '100%' }}>
              <tbody>
                <tr><td>Namba:</td><td style={{ textAlign: 'right' }}>{sale.sale_no}</td></tr>
                <tr><td>Tarehe:</td><td style={{ textAlign: 'right' }}>{fmtDate(sale.created_at)}</td></tr>
                {sale.customers?.name && <tr><td>Mteja:</td><td style={{ textAlign: 'right' }}>{sale.customers.name}</td></tr>}
              </tbody>
            </table>
            <div className="rline" style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <table style={{ width: '100%' }}>
              <tbody>
                {(sale.pos_sale_items || sale.items || []).map((it, i) => (
                  <React.Fragment key={i}>
                    <tr><td colSpan={3} style={{ fontWeight: 700 }}>{it.products?.name || it.name}</td></tr>
                    <tr>
                      <td>{it.quantity} x {fmtTZS(it.unit_price)}</td>
                      <td></td>
                      <td style={{ textAlign: 'right' }}>{fmtTZS(it.line_total)}</td>
                    </tr>
                    {it.discount_amount > 0 && (
                      <tr><td colSpan={2} style={{ color: '#555' }}>Punguzo</td><td style={{ textAlign: 'right', color: '#555' }}>-{fmtTZS(it.discount_amount)}</td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <div className="rline" style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <table style={{ width: '100%' }}>
              <tbody>
                <tr><td>Jumla Ndogo</td><td style={{ textAlign: 'right' }}>{fmtTZS(sale.subtotal)}</td></tr>
                {sale.discount_total > 0 && <tr><td>Punguzo Jumla</td><td style={{ textAlign: 'right' }}>-{fmtTZS(sale.discount_total)}</td></tr>}
                <tr style={{ fontWeight: 700, fontSize: 13 }}><td>JUMLA</td><td style={{ textAlign: 'right' }}>{fmtTZS(sale.total)}</td></tr>
                <tr><td>Kalipwa</td><td style={{ textAlign: 'right' }}>{fmtTZS(sale.amount_paid)}</td></tr>
                {sale.change_due > 0 && <tr><td>Chenji</td><td style={{ textAlign: 'right' }}>{fmtTZS(sale.change_due)}</td></tr>}
              </tbody>
            </table>
            <div className="rline" style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <p>Malipo: {(sale.pos_payments || sale.payments || []).map(p => PAYMENT_LABELS[p.method] || p.method).join(', ')}</p>
            <p className="center" style={{ textAlign: 'center', marginTop: 8 }}>Asante kwa kuchagua sisi! 🙏</p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 pt-0 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handlePrint} className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase">🖨️ Chapisha</button>
            <button onClick={handleDownloadPDF} className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black uppercase">⬇ PDF</button>
          </div>
          <div className="flex gap-2">
            <input value={emailTo} onChange={e => setEmailTo(e.target.value)} type="email" placeholder="barua pepe ya mteja"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500" />
            <button onClick={handleEmailSend} disabled={sending}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[10px] font-black uppercase whitespace-nowrap">
              {sending ? '...' : '✉️ Tuma'}
            </button>
          </div>
          <button onClick={handleSmsSend} className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase">📱 Tuma SMS kwa Mteja</button>
          {sendMsg && <p className="text-[10px] text-center font-bold text-slate-400">{sendMsg}</p>}
        </div>
      </div>
    </div>
  );
}
