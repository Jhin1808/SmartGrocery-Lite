import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { isDemo, subscribeDemo } from "../demo";
import {
  safeGetItems, safeAddItem, safeDeleteItem, safeUpdateItem, safeGetLists,
} from "../apiSafe";
import { FEATURE_CATALOG } from "../api";
import CategoryBadge, { categoryColor, categoryIcon } from "../components/CategoryBadge";
import WeightDisplay from "../components/WeightDisplay";
import PriceDisplay from "../components/PriceDisplay";
import ItemTypeahead from "../components/ItemTypeahead";
import BarcodeScanner from "../components/BarcodeScanner";

const EMPTY_DRAFT = {
  name: "", quantity: 1, expiry: "", description: "",
  category: null, subcategory: null,
  weight_value: null, weight_unit: null,
  brand: null, barcode: null, product_image_url: null,
  price: null, price_source: "user", store_id: null,
  nutrition_json: null,
};

function productToDraft(p) {
  if (!p) return null;
  const bestPrice = (p.price_promo != null && p.price_promo > 0)
    ? p.price_promo
    : (p.price_regular ?? p.price ?? null);
  return {
    name: p.name || "",
    category: p.canonical || null,
    subcategory: p.display || null,
    weight_value: p.weight_value ?? null,
    weight_unit: p.weight_unit || null,
    brand: p.brand || null,
    barcode: p.code || p.barcode || null,
    product_image_url: p.image_url || null,
    price: bestPrice,
    price_source: p.source === "kroger" ? "kroger" : (p.source === "off" ? "off" : "user"),
    store_id: p.store_id ?? null,
  };
}

const parseDate = (s) => (s ? new Date(`${s}T00:00:00`) : null);
const daysUntil = (s) => {
  const d = parseDate(s);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
};

const ExpiryPill = ({ expiry }) => {
  const n = daysUntil(expiry);
  if (n === null) return null;
  if (n < 0) return <span className="lm-badge lm-badge--danger">Expired</span>;
  if (n === 0) return <span className="lm-badge lm-badge--warning">Today</span>;
  if (n <= 3) return <span className="lm-badge lm-badge--warning">In {n}d</span>;
  return <span className="lm-badge lm-badge--success">In {n}d</span>;
};

const ExpiryDot = ({ expiry }) => {
  const n = daysUntil(expiry);
  if (n === null) return null;
  if (n < 0) return <span className="lm-dot lm-dot--expired" />;
  if (n <= 3) return <span className="lm-dot lm-dot--soon" />;
  return <span className="lm-dot lm-dot--ok" />;
};

function IconBtn({ icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn ${danger ? "btn-ghost-danger" : "btn-ghost"} btn-sm btn-icon`}
      aria-label={label}
      title={label}
    >
      <i className={`bi ${icon}`} />
    </button>
  );
}

function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = "Delete" }) {
  if (!open) return null;
  return (
    <div className="lm-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lm-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="lm-modal__header">
          <h2 className="lm-modal__title">{title}</h2>
          <button type="button" className="lm-modal__close" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        <div className="lm-modal__body">
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14.5, lineHeight: 1.6 }}>{message}</p>
        </div>
        <div className="lm-modal__footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function DemoBanner() {
  const { logout } = useAuth();
  if (!isDemo()) return null;
  const exit = async () => { await logout(); window.location.assign("/login"); };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: "linear-gradient(90deg, rgba(245, 158, 11, 0.18), rgba(20, 184, 166, 0.18))",
        border: "1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)",
        borderRadius: "var(--radius-md)",
        marginBottom: 20,
        fontSize: 13.5,
        color: "var(--text)",
        fontWeight: 500,
      }}
    >
      <span style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 8, background: "var(--color-accent-soft)", color: "var(--color-accent-hover)", flexShrink: 0 }}>
        <i className="bi bi-magic" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>Demo mode</strong>
        <span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>Sample data only — your edits stay in memory.</span>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={exit}>
        <i className="bi bi-box-arrow-right" /> Exit demo
      </button>
    </div>
  );
}

export default function ListDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const listNameFromLink = loc.state?.listName;
  const [listMeta, setListMeta] = useState(null);
  const listName = listMeta?.name || listNameFromLink || `List #${id}`;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [showDetails, setShowDetails] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({ name: "", quantity: 1, expiry: "" });
  const [search, setSearch] = useState("");
  const [filterExp, setFilterExp] = useState("all");
  const [sortKey, setSortKey] = useState("name");
  const [asc, setAsc] = useState(true);
  const [shoppingMode, setShoppingMode] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const updateDraft = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const applyProductToDraft = (product) => {
    const fields = productToDraft(product);
    if (!fields) return;
    setDraft((d) => ({ ...d, ...fields, name: d.name || fields.name }));
    setShowDetails(true);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await safeGetItems(Number(id));
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      if (e?.status === 401) navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const data = await safeGetLists(false);
        if (!alive) return;
        setListMeta((Array.isArray(data) ? data : []).find((l) => l.id === Number(id)) || null);
      } catch {}
    })();
    return () => { alive = false; };
  }, [id, user]);

  useEffect(() => {
    if (!isDemo()) return;
    const unsub = subscribeDemo(() => { load(); });
    return unsub;
  }, [load]);

  const isOwner = !listMeta || (user && listMeta.owner_id === user.id);
  const canEdit = isOwner || (listMeta && (listMeta.role === "editor"));

  const filteredSorted = useMemo(() => {
    let arr = Array.isArray(items) ? [...items] : [];
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (filterExp === "fresh") arr = arr.filter((i) => { const n = daysUntil(i.expiry); return n === null || n >= 0; });
    else if (filterExp === "expired") arr = arr.filter((i) => { const n = daysUntil(i.expiry); return n !== null && n < 0; });
    if (shoppingMode) arr = arr.filter((i) => !i.purchased);

    arr.sort((a, b) => {
      let c = 0;
      if (sortKey === "name") c = a.name.localeCompare(b.name);
      else if (sortKey === "quantity") c = (a.quantity || 0) - (b.quantity || 0);
      else if (sortKey === "expiry") {
        const da = a.expiry ? parseDate(a.expiry)?.getTime() : Number.POSITIVE_INFINITY;
        const db = b.expiry ? parseDate(b.expiry)?.getTime() : Number.POSITIVE_INFINITY;
        c = da - db;
      }
      return asc ? c : -c;
    });
    return arr;
  }, [items, search, filterExp, sortKey, asc, shoppingMode]);

  const purchasedCount = useMemo(() => items.filter((i) => i.purchased).length, [items]);
  const progress = items.length > 0 ? (purchasedCount / items.length) * 100 : 0;

  const onAdd = async (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    try {
      const payload = {
        name: draft.name.trim(),
        quantity: Number(draft.quantity || 1),
        expiry: draft.expiry || null,
        category: draft.category || undefined,
        subcategory: draft.subcategory || undefined,
        weight_value: draft.weight_value != null && draft.weight_value !== "" ? Number(draft.weight_value) : undefined,
        weight_unit: draft.weight_unit || undefined,
        brand: draft.brand || undefined,
        barcode: draft.barcode || undefined,
        product_image_url: draft.product_image_url || undefined,
        price: draft.price != null && draft.price !== "" ? Number(draft.price) : undefined,
        price_source: draft.price != null && draft.price !== "" ? (draft.price_source || "user") : undefined,
        store_id: draft.store_id || undefined,
      };
      const created = await safeAddItem(Number(id), payload);
      setItems((prev) => [created, ...prev]);
      setDraft({ ...EMPTY_DRAFT });
      setShowDetails(false);
    } catch (e) {
      if (e?.status === 401) navigate("/login", { replace: true });
    }
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    setEdit({ name: it.name, quantity: it.quantity, expiry: it.expiry || "" });
  };
  const cancelEdit = () => { setEditingId(null); setEdit({ name: "", quantity: 1, expiry: "" }); };
  const saveEdit = async (itId) => {
    try {
      const patch = { name: edit.name.trim(), quantity: Number(edit.quantity || 1), expiry: edit.expiry || null };
      const updated = await safeUpdateItem(itId, patch);
      setItems((prev) => prev.map((x) => (x.id === itId ? updated : x)));
      cancelEdit();
    } catch (e) {
      if (e?.status === 401) navigate("/login", { replace: true });
    }
  };

  const onDelete = (it) => setConfirmDel(it);
  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      await safeDeleteItem(confirmDel.id);
      setItems((prev) => prev.filter((x) => x.id !== confirmDel.id));
      if (editingId === confirmDel.id) cancelEdit();
    } catch (e) {
      if (e?.status === 401) navigate("/login", { replace: true });
    } finally {
      setConfirmDel(null);
    }
  };

  const togglePurchased = async (it) => {
    if (!canEdit) return;
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, purchased: !x.purchased } : x)));
    try { await safeUpdateItem(it.id, { purchased: !it.purchased }); } catch {}
  };

  const clearAll = async () => {
    setConfirmClear(false);
    await Promise.all(items.map((i) => safeDeleteItem(i.id).catch(() => null)));
    setItems([]);
    cancelEdit();
  };

  return (
    <div className="lm-container" style={{ paddingTop: 24, paddingBottom: 60, maxWidth: 980 }}>
      <div className="lm-hero">
        <Link to="/lists" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none", marginBottom: 8 }}>
          <i className="bi bi-arrow-left" /> Back to lists
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ width: 48, height: 48, display: "grid", placeItems: "center", borderRadius: 12, background: "var(--color-primary-soft)", color: "var(--color-primary)", fontSize: 22 }}>
            <i className="bi bi-basket3-fill" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="lm-hero__title truncate" style={{ marginBottom: 4 }}>{listName}</h1>
            <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span>{items.length} items</span>
              {listMeta?.shared && <span className="lm-badge lm-badge--brand"><i className="bi bi-people-fill" /> Shared</span>}
              {!isOwner && listMeta && <span className="lm-badge">Viewer</span>}
            </div>
          </div>
        </div>
      </div>

      <DemoBanner />

      <div className="lm-card lm-card--elevated anim-fade">
        <div className="lm-card__header">
          <span className="eyebrow" style={{ fontSize: 11 }}>Manage items</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShoppingMode((v) => !v)}
              className={"btn btn-sm " + (shoppingMode ? "btn-primary" : "btn-outline")}
            >
              <i className={`bi ${shoppingMode ? "bi-bag-check-fill" : "bi-bag"}`} />
              {shoppingMode ? "Shopping" : "Shop"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={load} title="Refresh">
              <i className="bi bi-arrow-clockwise" />
            </button>
            {canEdit && items.length > 0 && (
              <button type="button" className="btn btn-ghost-danger btn-sm" onClick={() => setConfirmClear(true)}>
                <i className="bi bi-trash3" /> Clear all
              </button>
            )}
          </div>
        </div>

        <div className="lm-card__body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {shoppingMode && items.length > 0 && (
            <div style={{ padding: 16, background: "var(--color-primary-soft)", borderRadius: "var(--radius-md)", border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>Progress</span>
                <span className="lm-badge lm-badge--brand">{purchasedCount} / {items.length}</span>
              </div>
              <div className="lm-progress">
                <div className="lm-progress__bar" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {!shoppingMode && canEdit && (
            <form onSubmit={onAdd}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) 90px 170px auto", gap: 8 }}>
                <ItemTypeahead
                  value={draft.name}
                  onChange={(v) => updateDraft({ name: v })}
                  onPick={applyProductToDraft}
                  placeholder="Add an item or search the catalog…"
                  autoFocus
                />
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  placeholder="Qty"
                  value={draft.quantity}
                  onChange={(e) => updateDraft({ quantity: e.target.value })}
                  style={{ height: 42, textAlign: "center" }}
                />
                <input
                  type="date"
                  className="form-control"
                  value={draft.expiry}
                  onChange={(e) => updateDraft({ expiry: e.target.value })}
                  style={{ height: 42 }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  {FEATURE_CATALOG && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      onClick={() => setScannerOpen(true)}
                      aria-label="Scan barcode"
                      title="Scan barcode"
                      style={{ width: 42, height: 42 }}
                    >
                      <i className="bi bi-upc-scan" />
                    </button>
                  )}
                  <button
                    type="button"
                    className={"btn btn-icon" + (showDetails ? "btn-primary" : "btn-secondary")}
                    onClick={() => setShowDetails((v) => !v)}
                    aria-label="Toggle item details"
                    title="Details"
                    style={{ width: 42, height: 42 }}
                  >
                    <i className={`bi ${showDetails ? "bi-chevron-up" : "bi-three-dots"}`} />
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ height: 42 }}>
                    <i className="bi bi-plus-lg" /> Add
                  </button>
                </div>
              </div>

              {showDetails && (
                <div className="lm-add-details" style={{ marginTop: 10 }}>
                  <div className="lm-add-details__row">
                    {draft.product_image_url && (
                      <img
                        className="lm-add-details__thumb"
                        src={draft.product_image_url}
                        alt=""
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                    <div className="lm-add-details__main">
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <CategoryBadge category={draft.category} subcategory={draft.subcategory} />
                        {draft.barcode && (
                          <span className="lm-meta-pill" title="Barcode">
                            <i className="bi bi-upc" /> {draft.barcode}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="lm-add-details__grid">
                    <div className="form-field">
                      <label className="form-label">Brand</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Horizon"
                        value={draft.brand || ""}
                        onChange={(e) => updateDraft({ brand: e.target.value || null })}
                        style={{ height: 36 }}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Weight</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control"
                          placeholder="0"
                          value={draft.weight_value ?? ""}
                          onChange={(e) => updateDraft({ weight_value: e.target.value })}
                          style={{ height: 36, width: 90 }}
                        />
                        <select
                          className="form-select"
                          value={draft.weight_unit || ""}
                          onChange={(e) => updateDraft({ weight_unit: e.target.value || null })}
                          style={{ height: 36 }}
                        >
                          <option value="">Unit</option>
                          <option value="gal">gal</option>
                          <option value="lb">lb</option>
                          <option value="oz">oz</option>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="ml">ml</option>
                          <option value="l">L</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Price</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control"
                          placeholder="0.00"
                          value={draft.price ?? ""}
                          onChange={(e) => updateDraft({ price: e.target.value })}
                          style={{ height: 36, width: 100 }}
                        />
                        <select
                          className="form-select"
                          value={draft.price_source || "user"}
                          onChange={(e) => updateDraft({ price_source: e.target.value })}
                          style={{ height: 36 }}
                        >
                          <option value="user">Manual</option>
                          <option value="kroger">Kroger</option>
                          <option value="off">OFF</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 320 }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search items…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ height: 38, paddingLeft: 36, fontSize: 13.5 }}
              />
              <i className="bi bi-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none", fontSize: 13 }} />
            </div>
            <select className="form-select" value={filterExp} onChange={(e) => setFilterExp(e.target.value)} style={{ height: 38, maxWidth: 160, fontSize: 13.5 }}>
              <option value="all">All</option>
              <option value="fresh">Fresh only</option>
              <option value="expired">Expired</option>
            </select>
            <select className="form-select" value={sortKey} onChange={(e) => setSortKey(e.target.value)} style={{ height: 38, maxWidth: 170, fontSize: 13.5 }}>
              <option value="name">Sort: Name</option>
              <option value="quantity">Sort: Quantity</option>
              <option value="expiry">Sort: Expiry</option>
            </select>
            <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => setAsc((a) => !a)} aria-label="Toggle sort direction" style={{ width: 38, height: 38 }}>
              <i className={`bi ${asc ? "bi-sort-up" : "bi-sort-down"}`} />
            </button>
          </div>

          {loading ? (
            <div className="lm-empty" style={{ padding: "32px 12px" }}>
              <div className="lm-empty__art"><span className="lm-spinner lm-spinner--lg" /></div>
              <p className="lm-empty__title">Loading items…</p>
            </div>
          ) : filteredSorted.length === 0 ? (
            <div className="lm-empty">
              <div className="lm-empty__art"><i className="bi bi-inbox" /></div>
              <h3 className="lm-empty__title">No items</h3>
              <p className="lm-empty__desc">{items.length === 0 ? "Add your first item using the form above." : "No items match your filters."}</p>
            </div>
          ) : !shoppingMode ? (
            <div className="flex flex-col" style={{ gap: 8 }}>
              {filteredSorted.map((it) => {
                const isEd = editingId === it.id;
                return (
                  <div key={it.id} className={"lm-item" + (it.purchased ? " is-purchased" : "")}>
                    <button
                      type="button"
                      onClick={() => togglePurchased(it)}
                      className={"lm-item__check" + (it.purchased ? " is-checked" : "")}
                      disabled={!canEdit}
                      aria-label={it.purchased ? "Mark unpurchased" : "Mark purchased"}
                    >
                      <i className="bi bi-check-lg" />
                    </button>

                    <div className="lm-item__main">
                      {isEd ? (
                        <input
                          type="text"
                          className="form-control"
                          value={edit.name}
                          onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
                          style={{ height: 34, fontSize: 13.5 }}
                        />
                      ) : (
                        <>
                          {it.product_image_url ? (
                            <img
                              className="lm-item__thumb"
                              src={it.product_image_url}
                              alt=""
                              loading="lazy"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          ) : (
                            <span
                              className="lm-item__thumb lm-item__thumb--placeholder"
                              style={{ background: categoryColor(it.category) + "22", color: categoryColor(it.category) }}
                              aria-hidden="true"
                            >
                              <i className={`bi ${categoryIcon(it.category)}`} />
                            </span>
                          )}
                          <div className="lm-item__body">
                            <div className="lm-item__row-top">
                              <ExpiryDot expiry={it.expiry} />
                              <span className="lm-item__name" title={it.name}>{it.name}</span>
                              {it.brand && <span className="lm-item__brand">{it.brand}</span>}
                            </div>
                            <div className="lm-item__row-pills">
                              <CategoryBadge category={it.category} subcategory={it.subcategory} />
                              <WeightDisplay value={it.weight_value} unit={it.weight_unit} fallback={null} />
                              <PriceDisplay
                                price={it.price}
                                priceSource={it.price_source}
                                fallback={null}
                                showSource={false}
                              />
                            </div>
                            {it.expiry && (
                              <div className="lm-item__meta">
                                <span><i className="bi bi-calendar3" /> {it.expiry}</span>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isEd ? (
                        <>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            value={edit.quantity}
                            onChange={(e) => setEdit((s) => ({ ...s, quantity: e.target.value }))}
                            style={{ width: 80, height: 34, textAlign: "center", fontSize: 13.5 }}
                          />
                          <input
                            type="date"
                            className="form-control"
                            value={edit.expiry || ""}
                            onChange={(e) => setEdit((s) => ({ ...s, expiry: e.target.value }))}
                            style={{ width: 160, height: 34, fontSize: 13 }}
                          />
                        </>
                      ) : (
                        <>
                          <span className="lm-item__qty">×{it.quantity}</span>
                          <ExpiryPill expiry={it.expiry} />
                        </>
                      )}
                    </div>

                    <div className="lm-item__actions">
                      {isEd ? (
                        <>
                          <IconBtn icon="bi-check-lg" label="Save" onClick={() => saveEdit(it.id)} />
                          <IconBtn icon="bi-x-lg" label="Cancel" onClick={cancelEdit} />
                        </>
                      ) : (
                        <>
                          <IconBtn icon="bi-pencil" label="Edit" onClick={() => startEdit(it)} disabled={!canEdit} />
                          <IconBtn icon="bi-trash3" label="Delete" onClick={() => onDelete(it)} disabled={!canEdit} danger />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {filteredSorted.map((it) => (
                <div
                  key={it.id}
                  className={"lm-shop-card" + (it.purchased ? " is-purchased" : "")}
                  onClick={() => togglePurchased(it)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      togglePurchased(it);
                    }
                  }}
                >
                  <div className="lm-shop-card__check"><i className="bi bi-check-lg" /></div>
                  <div className="lm-shop-card__main">
                    {it.product_image_url ? (
                      <img
                        className="lm-shop-card__thumb"
                        src={it.product_image_url}
                        alt=""
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <span
                        className="lm-shop-card__thumb lm-shop-card__thumb--placeholder"
                        style={{ background: categoryColor(it.category) + "22", color: categoryColor(it.category) }}
                        aria-hidden="true"
                      >
                        <i className={`bi ${categoryIcon(it.category)}`} />
                      </span>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span className="lm-shop-card__name">{it.name}</span>
                      {it.brand && <span className="lm-shop-card__brand">{it.brand}</span>}
                      <div className="lm-shop-card__pills">
                        <CategoryBadge category={it.category} subcategory={it.subcategory} />
                        <WeightDisplay value={it.weight_value} unit={it.weight_unit} fallback={null} />
                        <PriceDisplay
                          price={it.price}
                          priceSource={it.price_source}
                          fallback={null}
                          showSource={false}
                        />
                      </div>
                      <div className="lm-shop-card__sub" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span><i className="bi bi-123" /> Qty {it.quantity}</span>
                        {it.expiry && <span><i className="bi bi-calendar3" /> {it.expiry}</span>}
                      </div>
                    </div>
                  </div>
                  <ExpiryPill expiry={it.expiry} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearAll}
        title="Clear all items?"
        message="This will permanently delete every item in this list. This can't be undone."
        confirmLabel="Clear all"
      />

      <ConfirmModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={doDelete}
        title="Delete item?"
        message={confirmDel ? <>Delete <strong>{confirmDel.name}</strong>? This can't be undone.</> : ""}
      />

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onPick={applyProductToDraft}
      />
    </div>
  );
}
