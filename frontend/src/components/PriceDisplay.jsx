import React from "react";

function fmt(value) {
  if (value == null) return null;
  const n = Number(value);
  if (!isFinite(n) || n < 0) return null;
  return n.toFixed(2).replace(/\.?0+$/, "");
}

function sourceMeta(source) {
  switch (source) {
    case "kroger":
      return { icon: "bi-shop",     label: "Kroger" };
    case "off":
      return { icon: "bi-globe",    label: "Open Food Facts" };
    case "user":
      return { icon: "bi-pencil",   label: "You" };
    case "manual":
      return { icon: "bi-tag",      label: "Manual" };
    default:
      return { icon: "bi-tag",      label: "Price" };
  }
}

export default function PriceDisplay({
  price,
  promoPrice,
  priceSource,
  storeName,
  fallback = null,
  showSource = true,
}) {
  const reg = fmt(price);
  const promo = fmt(promoPrice);
  if (reg == null && promo == null) return fallback;

  if (promo != null) {
    return (
      <span className="lm-price-pill lm-price-pill--promo" title={`Sale at ${storeName || "store"}`}>
        <i className="bi bi-lightning-fill" />
        <span className="lm-price-pill__amount">${promo}</span>
        {reg != null && reg !== promo && <span className="lm-price-pill__strike">${reg}</span>}
        {showSource && <span className="lm-price-pill__src">SALE</span>}
      </span>
    );
  }

  const src = sourceMeta(priceSource);
  const variant = priceSource === "user" ? "user" : priceSource === "kroger" ? "kroger" : "default";
  return (
    <span className={`lm-price-pill lm-price-pill--${variant}`} title={`${src.label}${storeName ? " · " + storeName : ""}`}>
      <i className={`bi ${src.icon}`} />
      <span className="lm-price-pill__amount">${reg}</span>
      {showSource && priceSource && <span className="lm-price-pill__src">{src.label}</span>}
    </span>
  );
}
