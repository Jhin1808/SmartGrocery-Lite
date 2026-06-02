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

function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}

function scoreMatch(p, q) {
  if (!q) return -1;
  const name = norm(p.name);
  const brand = norm(p.brand);
  const display = norm(p.display);
  const cat = norm(p.canonical);
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return -1;

  let score = 0;
  let allTokensContained = true;
  for (const t of tokens) {
    let tokenBest = 0;
    if (name === t) tokenBest = Math.max(tokenBest, 1000);
    else if (name.startsWith(t)) tokenBest = Math.max(tokenBest, 600);
    else if (new RegExp(`\\b${escapeRegExp(t)}`).test(name)) tokenBest = Math.max(tokenBest, 400);
    else if (name.includes(t)) tokenBest = Math.max(tokenBest, 200);

    if (brand && brand.includes(t)) tokenBest = Math.max(tokenBest, 80);
    if (display && display.includes(t)) tokenBest = Math.max(tokenBest, 40);
    if (cat && cat.includes(t)) tokenBest = Math.max(tokenBest, 30);

    if (tokenBest === 0) allTokensContained = false;
    score += tokenBest;
  }
  if (!allTokensContained) return -1;
  return score;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text, q) {
  if (!text || !q) return text || "";
  const tokens = q.split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (tokens.length === 0) return text;
  const re = new RegExp(`(${tokens.join("|")})`, "ig");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="lm-typeahead__match">{p}</mark>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    )
  );
}

function matchQuality(p, q) {
  const name = norm(p.name);
  if (name === q) return "exact";
  if (name.startsWith(q)) return "starts";
  const re = new RegExp(`\\b${escapeRegExp(q)}`);
  if (re.test(name)) return "word";
  if (name.includes(q)) return "partial";
  return "fuzzy";
}

export default function ItemTypeahead({
  value,
  onChange,
  onPick,
  onSubmitCustom,
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
  const [hasExactMatch, setHasExactMatch] = useState(false);
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
      setHasExactMatch(false);
      return;
    }
    const q = (debounced || "").trim();
    if (q.length < minChars) {
      setResults([]);
      setError("");
      setHasExactMatch(false);
      return;
    }
    const id = ++reqIdRef.current;
    setLoading(true);
    setError("");
    apiCatalogSearch({ q, category, pageSize: maxResults * 2 })
      .then((rows) => {
        if (id !== reqIdRef.current) return;
        const arr = Array.isArray(rows) ? rows : [];
        const scored = arr
          .map((p) => ({ p, s: scoreMatch(p, q), quality: matchQuality(p, q) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, maxResults)
          .map((x) => ({ ...x.p, _quality: x.quality }));
        setResults(scored);
        setHasExactMatch(scored.some((x) => x._quality === "exact" || x._quality === "starts"));
        setOpen(true);
      })
      .catch((e) => {
        if (id !== reqIdRef.current) return;
        setError(e?.message || "Search failed");
        setResults([]);
        setHasExactMatch(false);
      })
      .finally(() => {
        if (id === reqIdRef.current) setLoading(false);
      });
  }, [debounced, category, maxResults, minChars]);

  const q = (value || "").trim();
  const showAddCustom = q.length >= minChars && !hasExactMatch && onSubmitCustom;
  const menuItemCount = results.length + (error ? 1 : 0) + (q.length >= minChars && !loading ? 1 : 0) + (showAddCustom ? 1 : 0);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      if (menuItemCount === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, menuItemCount - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      if (menuItemCount === 0) return;
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      // If a result is highlighted, pick it.
      if (active >= 0 && active < results.length) {
        e.preventDefault();
        handlePick(results[active]);
        return;
      }
      // Otherwise: if no exact match, fall back to custom.
      if (q.length >= minChars && showAddCustom) {
        e.preventDefault();
        handleCustom();
        return;
      }
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  function handlePick(p) {
    setOpen(false);
    setActive(-1);
    if (onPick) onPick(p);
  }

  function handleCustom() {
    if (!onSubmitCustom || !q) return;
    setOpen(false);
    setActive(-1);
    onSubmitCustom(q);
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
        onFocus={() => { if (results.length > 0 || showAddCustom) setOpen(true); }}
        onKeyDown={onKeyDown}
        style={{ height: 40, paddingRight: 28 }}
      />
      {loading && (
        <span className="lm-typeahead__spinner" aria-hidden="true">
          <span className="lm-spinner" />
        </span>
      )}
      {open && (results.length > 0 || error || (q.length >= minChars && !loading)) && (
        <div className="lm-typeahead__menu" role="listbox">
          {error && <div className="lm-typeahead__error">{error}</div>}

          {results.length === 0 && !error && q.length >= minChars && !loading && (
            <div className="lm-typeahead__empty">
              <i className="bi bi-info-circle" />
              <span>
                No matches for <strong>&ldquo;{q}&rdquo;</strong> in the catalog. You can still add it as a custom item.
              </span>
            </div>
          )}

          {results.map((p, i) => {
            const color = categoryColor(p.canonical);
            const quality = p._quality || "fuzzy";
            const isExact = quality === "exact" || quality === "starts";
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
                  <div className="lm-typeahead__name truncate">
                    {highlightMatch(p.name || "Unknown", q)}
                    {isExact ? (
                      <span className="lm-typeahead__match-badge" style={{ marginLeft: 6 }}>
                        <i className="bi bi-stars" /> Best match
                      </span>
                    ) : null}
                  </div>
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
                        <i className="bi bi-rulers" />
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

          {showAddCustom && (
            <button
              type="button"
              className="lm-typeahead__add"
              onMouseDown={(e) => { e.preventDefault(); handleCustom(); }}
              onMouseEnter={() => setActive(results.length)}
            >
              <i className="bi bi-plus-circle-fill" />
              <span className="lm-typeahead__add-label">
                Add &ldquo;<em>{q}</em>&rdquo; as a custom item
              </span>
              <i className="bi bi-arrow-return" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
