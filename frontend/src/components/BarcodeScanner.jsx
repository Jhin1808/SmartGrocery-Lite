import React, { useEffect, useRef, useState } from "react";
import { apiCatalogBarcode } from "../api";

export default function BarcodeScanner({ open, onClose, onPick }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [decoded, setDecoded] = useState("");

  useEffect(() => {
    if (!open) {
      stop();
      setError("");
      setManual("");
      setDecoded("");
      return undefined;
    }

    let cancelled = false;
    setError("");

    // Lazy import zxing to keep it out of the main bundle path
    (async () => {
      try {
        if (typeof window === "undefined") return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError("Camera not supported in this browser. Use the manual entry below.");
          return;
        }
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader();
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        const device =
          devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[0];
        if (!device) {
          setError("No camera found. Use the manual entry below.");
          return;
        }
        const controls = await reader.decodeFromVideoDevice(
          device.deviceId,
          videoRef.current,
          (result) => {
            if (result && !cancelled) {
              const text = result.getText();
              setDecoded(text);
              lookupBarcode(text);
            }
          }
        );
        controlsRef.current = controls;
      } catch (e) {
        setError(e?.message || "Couldn't start the camera. Use the manual entry below.");
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function stop() {
    try { controlsRef.current?.stop?.(); } catch {}
    controlsRef.current = null;
  }

  async function lookupBarcode(code) {
    const c = (code || "").trim();
    if (!c) return;
    setBusy(true);
    setError("");
    try {
      const product = await apiCatalogBarcode(c);
      if (product) {
        stop();
        if (onPick) onPick(product);
        if (onClose) onClose();
      } else {
        setError(`No match for ${c}. Try another code or enter the item manually.`);
        setBusy(false);
      }
    } catch (e) {
      setError(e?.message || "Lookup failed");
      setBusy(false);
    }
  }

  function onSubmitManual(e) {
    e.preventDefault();
    if (!manual.trim()) return;
    lookupBarcode(manual.trim());
  }

  if (!open) return null;

  return (
    <div
      className="lm-modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="lm-modal" role="dialog" aria-modal="true" aria-label="Scan barcode">
        <div className="lm-modal__header">
          <h2 className="lm-modal__title">
            <i className="bi bi-upc-scan" style={{ marginRight: 8 }} />
            Scan barcode
          </h2>
          <button type="button" className="lm-modal__close" onClick={onClose} aria-label="Close">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="lm-modal__body">
          <div className="lm-scanner">
            <div className="lm-scanner__viewport">
              <video ref={videoRef} className="lm-scanner__video" muted playsInline />
              <div className="lm-scanner__reticle" aria-hidden="true">
                <div className="lm-scanner__reticle-corner lm-scanner__reticle-corner--tl" />
                <div className="lm-scanner__reticle-corner lm-scanner__reticle-corner--tr" />
                <div className="lm-scanner__reticle-corner lm-scanner__reticle-corner--bl" />
                <div className="lm-scanner__reticle-corner lm-scanner__reticle-corner--br" />
                <div className="lm-scanner__beam" />
              </div>
            </div>
            {decoded && (
              <div className="lm-scanner__decoded">
                <i className="bi bi-check2-circle" /> {decoded}
              </div>
            )}
            {error && <div className="lm-scanner__error"><i className="bi bi-exclamation-triangle" /> {error}</div>}
          </div>

          <div className="lm-scanner__divider"><span>or enter manually</span></div>

          <form onSubmit={onSubmitManual} className="lm-scanner__manual">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{8,14}"
              maxLength={14}
              className="form-control"
              placeholder="UPC / EAN (8–14 digits)"
              value={manual}
              onChange={(e) => setManual(e.target.value.replace(/[^\d]/g, ""))}
              disabled={busy}
            />
            <button type="submit" className="btn btn-primary" disabled={busy || !manual.trim()}>
              {busy ? "Looking up..." : "Look up"}
            </button>
          </form>
        </div>
        <div className="lm-modal__footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
