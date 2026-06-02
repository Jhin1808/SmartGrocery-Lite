import React, { useEffect, useRef, useState } from "react";
import { apiCatalogSearch, FEATURE_CATALOG } from "../api";
import { categoryColor } from "./CategoryBadge";

function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function ItemTypeahead({
  value,
  onChange,
  onPick,
  disabled,
  placeholder = "Search or type an item…",
  autoFocus = false,
  minChars = 2,
  maxResults = 6,
  category = null,
}) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");
  const debounced = useDebounced(value, 300);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const reqIdRef = useRef(0);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Run search when debounced value changes
  useEffect(() => {
    if (!FEATURE_CATALOG) {
      setResults([]);
      return;
    }
    const q = (debounced || "").trim();
    if (q.length < minChars) {
      setResults([]);
      setError("");
      return;
    }
    const id = ++reqIdRef.current;
    setLoading(true);
    setError("");
    apiCatalogSearch({ q, category, pageSize: maxResults })
      .then((rows) => {
        if (id !== reqIdRef.current) return;
        setResults(Array.isArray(rows) ? rows.slice(0, maxResults) : []);
        setOpen(true);
      })
      .catch((e) => {
        if (id !== reqIdRef.current) return;
        setError(e?.message || "Search failed");
        setResults([]);
      })
      .finally(() => {
        if (id === reqIdRef.current) setLoading(false);
      });
  }, [debounced, category, maxResults, minChars]);

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      handlePick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  function handlePick(p) {
    setOpen(false);
    setActive(-1);
    if (onPick) onPick(p);
  }

  return (
    <div className="lm-typeahead" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        className="form-control"
        value={value || ""}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete="off"
        spellCheck="false"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        onKeyDown={onKeyDown}
        style={{ height: 40, paddingRight: 28 }}
      />
      {loading && (
        <span className="lm-typeahead__spinner" aria-hidden="true">
          <span className="lm-spinner" />
        </span>
      )}
      {open && (results.length > 0 || error) && (
        <div className="lm-typeahead__menu" role="listbox">
          {error && <div className="lm-typeahead__error">{error}</div>}
          {results.map((p, i) => {
            const color = categoryColor(p.canonical);
            return (
              <button
                key={`${p.source}-${p.code || i}`}
                type="button"
                role="option"
                aria-selected={i === active}
                className={"lm-typeahead__item" + (i === active ? " is-active" : "")}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); handlePick(p); }}
                style={{ "--cat-color": color }}
              >
                <div className="lm-typeahead__thumb">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  ) : (
                    <i className="bi bi-box-seam" />
                  )}
                </div>
                <div className="lm-typeahead__body">
                  <div className="lm-typeahead__name truncate">{p.name || "Unknown"}</div>
                  <div className="lm-typeahead__meta">
                    {p.brand && <span className="lm-typeahead__brand">{p.brand}</span>}
                    {p.display && (
                      <span className="lm-typeahead__cat">
                        <span className="lm-typeahead__cat-dot" style={{ background: color }} />
                        {p.display}
                      </span>
                    )}
                    {(p.weight_value != null && p.weight_value > 0) && (
                      <span className="lm-typeahead__weight">
                        <i className="bi bi-box" />
                        {p.weight_value}{p.weight_unit || ""}
                      </span>
                    )}
                  </div>
                </div>
                {p.source === "kroger" && (
                  <span className="lm-typeahead__src lm-typeahead__src--kroger">Kroger</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
