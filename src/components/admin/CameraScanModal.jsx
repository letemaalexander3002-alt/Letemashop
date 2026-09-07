import React, { useEffect, useRef, useState } from 'react';

/**
 * CameraScanModal — opens the device camera and decodes barcodes live using
 * the browser's native BarcodeDetector API (supported on Chrome/Edge for
 * Android and desktop, which covers the large majority of POS devices this
 * app runs on). Where the API isn't available (notably Safari/iOS as of
 * this build), we say so plainly and point back to the keyboard-wedge
 * scanner path rather than pretending to scan and silently failing.
 */
export default function CameraScanModal({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Inaanzisha kamera...');
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    let detector;

    (async () => {
      try {
        detector = new window.BarcodeDetector({
          formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'qr_code'],
        });
      } catch {
        detector = new window.BarcodeDetector();
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('Elekeza kamera kwenye barcode...');

        const scanLoop = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onDetected(codes[0].rawValue);
              return; // stop loop — parent will close the modal
            }
          } catch {
            // transient decode errors are normal mid-stream; keep scanning
          }
          rafRef.current = requestAnimationFrame(scanLoop);
        };
        scanLoop();
      } catch (err) {
        setError('Imeshindikana kufikia kamera: ' + (err.message || 'ruhusa imekataliwa'));
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [supported, onDetected]);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <h3 className="text-sm font-black text-white uppercase">📷 Scan kwa Kamera</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        {!supported ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-3xl">🚫</p>
            <p className="text-xs text-slate-300 font-bold">Kivinjari hiki hakiungi mkono uskani wa kamera moja kwa moja.</p>
            <p className="text-[10px] text-slate-500">Tumia scanner ya USB/Bluetooth (inafanya kazi moja kwa moja kwenye sehemu ya kutafuta), au fungua ukurasa huu kwa Chrome kwenye Android.</p>
            <button onClick={onClose} className="mt-2 py-2 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-black uppercase">Sawa</button>
          </div>
        ) : (
          <div className="relative bg-black">
            <video ref={videoRef} className="w-full aspect-square object-cover" muted playsInline />
            <div className="absolute inset-8 border-2 border-emerald-400/70 rounded-xl pointer-events-none" />
            <p className="absolute bottom-3 left-0 right-0 text-center text-[10px] text-white font-bold bg-black/50 py-1.5">
              {error || status}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
