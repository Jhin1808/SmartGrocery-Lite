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

function fmt(value) {
  if (value == null) return null;
  let n = Number(value);
  if (!isFinite(n) || n <= 0) return null;
  let s = (Math.round(n * 100) / 100).toString();
  if (s.includes(".") && !s.endsWith(".5")) {
    s = s.replace(/\.?0+$/, "");
  }
  return s;
}

export default function WeightDisplay({
  value,
  unit,
  fallback = null,
  compact = true,
  showLabel = true,
  label = "Size",
  className = "",
}) {
  const num = fmt(value);
  if (num == null) return fallback;
  const u = unit ? (UNIT_LABELS[String(unit).toLowerCase()] || unit) : null;
  const titleParts = ["Size"];
  if (num != null) titleParts.push(`${num}${u ? " " + u : ""}`);
  const display = u ? `${num} ${u}` : `${num}`;
  return (
    <span
      className={`lm-weight-pill ${className}`}
      title={titleParts.join(": ")}
    >
      <i className="bi bi-rulers" />
      {showLabel && <span className="lm-weight-pill__label">{label}</span>}
      <span>{display}</span>
    </span>
  );
}
