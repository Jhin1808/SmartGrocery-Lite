import React from "react";

const UNIT_LABELS = {
  gal: "gal",
  lb: "lb",
  oz: "oz",
  kg: "kg",
  g: "g",
  ml: "ml",
  l: "L",
};

function fmt(value, unit) {
  if (value == null) return null;
  let n = Number(value);
  if (!isFinite(n) || n <= 0) return null;
  // Trim trailing zeros for cleaner display
  let s = (Math.round(n * 100) / 100).toString();
  if (s.includes(".") && !s.endsWith(".5")) {
    s = s.replace(/\.?0+$/, "");
  }
  return s;
}

export default function WeightDisplay({ value, unit, fallback = null, compact = true }) {
  const num = fmt(value, unit);
  if (num == null) return fallback;
  const u = unit ? (UNIT_LABELS[String(unit).toLowerCase()] || unit) : null;
  if (!u) return <span className="lm-weight-pill">{num}</span>;
  return (
    <span className="lm-weight-pill" title={`${num} ${u}`}>
      <i className="bi bi-box" />
      {compact ? <span>{num}{u}</span> : <span>{num} {u}</span>}
    </span>
  );
}
