import React, { useState, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';

const fmtTZS = n => `${Number(n || 0).toLocaleString()} TZS`;

// ============================================================================
// CODE128 (subset B) encoder — pure JS, no external barcode library needed.
// This is the standard published Code128 width-pattern table (public
// technical specification data, the same table every barcode library uses).
// ============================================================================
const CODE128_PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];
const START_B = 104, STOP = 106;

function encodeCode128B(text) {
  const values = [START_B];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 || code > 126) throw new Error(`Herufi "${text[i]}" haiungwi mkono na CODE128`);
    values.push(code - 32);
  }
  let checksum = START_B;
  for (let i = 1; i < values.length; i++) checksum += values[i] * i;
  values.push(checksum % 103);
  values.push(STOP);
  return values.map(v => CODE128_PATTERNS[v]).join('');
}

/** Auto-generate a readable, collision-resistant barcode value from a product's own id. */
function autoBarcodeFor(product) {
  return `LSC${String(product.id).padStart(8, '0')}`;
}

function BarcodeSVG({ value, width = 200, height = 60 }) {
  const widths = useMemo(() => {
    try { return encodeCode128B(value).split('').map(Number); }
    catch { return null; }
  }, [value]);

  if (!widths) return <div className="text-rose-400 text-[9px] text-center py-4">Barcode batili</div>;

  const moduleWidth = width / widths.reduce((a, b) => a + b, 0);
  let x = 0;
  const bars = [];
  widths.forEach((w, i) => {
    const barWidth = w * moduleWidth;
    if (i % 2 === 0) bars.push(<rect key={i} x={x} y={0} width={barWidth} height={height} fill="#000" />);
    x += barWidth;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}>
      {bars}
    </svg>
  );
}

export default function BarcodeTab({ products, onReload, businessName }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [labelSize, setLabelSize] = useState('medium'); // small | medium | large

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectAll = () => setSelected(new Set(filtered.map(p => p.id)));
  const clearAll = () => setSelected(new Set());

  const assignMissingBarcodes = async () => {
    const targets = products.filter(p => selected.has(p.id) && !p.barcode);
    if (targets.length === 0) { setMsg('Bidhaa zilizochaguliwa tayari zina barcode.'); return; }
    setSaving(true); setMsg('');
    for (const p of targets) {
      await supabase.from('products').update({ barcode: autoBarcodeFor(p) }).eq('id', p.id);
    }
    setSaving(false);
    setMsg(`✅ Barcode mpya ${targets.length} zimetengenezwa na kuhifadhiwa.`);
    onReload?.();
  };

  const selectedProducts = products.filter(p => selected.has(p.id));

  const LABEL_DIMS = {
    small:  { w: 130, h: 26, barW: 100, barH: 34, font: 8 },
    medium: { w: 170, h: 34, barW: 140, barH: 44, font: 9 },
    large:  { w: 220, h: 44, barW: 190, barH: 56, font: 11 },
  }[labelSize];

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=800,height=900');
    const labelsHtml = selectedProducts.map(p => {
      const code = p.barcode || autoBarcodeFor(p);
      let widths;
      try { widths = encodeCode128B(code).split('').map(Number); } catch { widths = []; }
      const total = widths.reduce((a, b) => a + b, 0) || 1;
      const moduleWidth = LABEL_DIMS.barW / total;
      let x = 0;
      const rects = widths.map((w, i) => {
        const bw = w * moduleWidth;
        const el = i % 2 === 0 ? `<rect x="${x}" y="0" width="${bw}" height="${LABEL_DIMS.barH}" fill="#000"/>` : '';
        x += bw;
        return el;
      }).join('');
      return `
        <div class="label">
          <div class="biz">${businessName || ''}</div>
          <div class="name">${p.name}</div>
          <svg viewBox="0 0 ${LABEL_DIMS.barW} ${LABEL_DIMS.barH}" width="${LABEL_DIMS.barW}" height="${LABEL_DIMS.barH}">${rects}</svg>
          <div class="code">${code}</div>
          <div class="price">${fmtTZS(p.price)}</div>
        </div>`;
    }).join('');

    win.document.write(`
      <html><head><title>Lebo za Barcode</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 10px; }
        .sheet { display: flex; flex-wrap: wrap; gap: 6px; }
        .label {
          width: ${LABEL_DIMS.w}px; border: 1px dashed #999; border-radius: 4px;
          padding: 4px; text-align: center; page-break-inside: avoid;
        }
        .biz { font-size: ${LABEL_DIMS.font - 2}px; color: #555; }
        .name { font-size: ${LABEL_DIMS.font}px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .code { font-size: ${LABEL_DIMS.font - 1}px; font-family: monospace; letter-spacing: 1px; }
        .price { font-size: ${LABEL_DIMS.font}px; font-weight: bold; }
        @media print { .sheet { gap: 2px; } .label { border: none; } }
      </style></head>
      <body><div class="sheet">${labelsHtml}</div></body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">🏷️ Chapisha Barcode</h2>
        <div className="flex gap-2">
          <select value={labelSize} onChange={e => setLabelSize(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-2 py-2 text-[10px] text-white">
            <option value="small">Lebo Ndogo</option>
            <option value="medium">Lebo Wastani</option>
            <option value="large">Lebo Kubwa</option>
          </select>
        </div>
      </div>

      <p className="text-[10px] text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-3">
        ℹ️ Chagua bidhaa, tengeneza barcode kiotomatiki kwa zile zisizo na barcode bado, kisha chapisha lebo zote mara moja kwenye karatasi za lebo (label sheet). Barcode ikishatengenezwa, itafanya kazi moja kwa moja na scanner kwenye POS.
      </p>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tafuta bidhaa..."
        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500" />

      <div className="flex gap-2 flex-wrap">
        <button onClick={selectAll} className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg">Chagua Zote ({filtered.length})</button>
        <button onClick={clearAll} className="text-[9px] font-black text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg">Ondoa Uteuzi</button>
        <button onClick={assignMissingBarcodes} disabled={saving || selected.size === 0}
          className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">
          {saving ? 'Inatengeneza...' : '⚡ Tengeneza Barcode Zinazokosekana'}
        </button>
        <button onClick={handlePrint} disabled={selected.size === 0}
          className="text-[9px] font-black text-white bg-blue-600 disabled:opacity-40 px-3 py-1.5 rounded-lg">
          🖨️ Chapisha Lebo ({selected.size})
        </button>
      </div>

      {msg && <p className="text-[10px] font-bold text-center bg-slate-800 text-slate-300 rounded-lg py-2">{msg}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {filtered.map(p => {
          const code = p.barcode || autoBarcodeFor(p);
          const isSel = selected.has(p.id);
          return (
            <button key={p.id} onClick={() => toggle(p.id)}
              className={`bg-white rounded-xl p-3 text-center border-2 transition-all ${isSel ? 'border-blue-500' : 'border-transparent'}`}>
              <p className="text-[10px] font-bold text-slate-900 truncate mb-1">{p.name}</p>
              <BarcodeSVG value={code} width={140} height={40} />
              <p className="text-[9px] font-mono text-slate-600 mt-1">{code}</p>
              {!p.barcode && <p className="text-[8px] text-amber-600 font-bold mt-0.5">Bado haijahifadhiwa</p>}
            </button>
          );
        })}
        {filtered.length === 0 && <p className="col-span-full text-center text-slate-600 text-xs py-8">Hakuna bidhaa.</p>}
      </div>
    </div>
  );
}
