import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../pages/AuthContext";
import { isDemo, subscribeDemo } from "../demo";
import {
  safeGetLists, safeGetItems, safeGetShares,
  safeAddItem, safeUpdateItem, safeDeleteItem,
  safeCreateList, safeRenameList, safeDeleteList,
  safeHideList, safeUnhideList,
  safeAddShare, safeUpdateShare, safeRevokeShare,
  safeGetShareLink,
} from "../apiSafe";
import { FEATURE_CATALOG } from "../api";
import CategoryBadge, { categoryColor, categoryIcon } from "../components/CategoryBadge";
import WeightDisplay from "../components/WeightDisplay";
import PriceDisplay from "../components/PriceDisplay";
import ItemTypeahead from "../components/ItemTypeahead";
import BarcodeScanner from "../components/BarcodeScanner";

const CAT_FILTERS = [
  { key: "dairy",     label: "Dairy" },
  { key: "produce",   label: "Produce" },
  { key: "meat",      label: "Meat" },
  { key: "seafood",   label: "Seafood" },
  { key: "bakery",    label: "Bakery" },
  { key: "frozen",    label: "Frozen" },
  { key: "beverages", label: "Beverages" },
  { key: "snacks",    label: "Snacks" },
  { key: "condiments",label: "Condiments" },
  { key: "eggs",      label: "Eggs" },
  { key: "pantry",    label: "Pantry" },
];

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
  // CatalogProductRead exposes price_regular / price_promo from the source.
  // Prefer the promo price when available (better deal), otherwise regular.
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
  if (n === null) return <span className="lm-badge">No expiry</span>;
  if (n < 0) return <span className="lm-badge lm-badge--danger">Expired</span>;
  if (n === 0) return <span className="lm-badge lm-badge--warning">Today</span>;
  if (n <= 3) return <span className="lm-badge lm-badge--warning">In {n}d</span>;
  return <span className="lm-badge lm-badge--success">In {n}d</span>;
};

const ExpiryDot = ({ expiry }) => {
  const n = daysUntil(expiry);
  if (n === null) return null;
  if (n < 0) return <span className="lm-dot lm-dot--expired" title="Expired" />;
  if (n <= 3) return <span className="lm-dot lm-dot--soon" title="Expiring soon" />;
  return <span className="lm-dot lm-dot--ok" title="Fresh" />;
};

function IconBtn({ icon, label, onClick, disabled, danger, size = "sm" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`btn ${danger ? "btn-ghost-danger" : "btn-ghost"} btn-${size} btn-icon`}
    >
      <i className={`bi ${icon}`} />
    </button>
  );
}

function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="lm-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"lm-modal" + (wide ? " lm-modal--wide" : "")} role="dialog" aria-modal="true" aria-label={title}>
        <div className="lm-modal__header">
          <h2 className="lm-modal__title">{title}</h2>
          <button type="button" className="lm-modal__close" onClick={onClose} aria-label="Close">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="lm-modal__body">{children}</div>
        {footer && <div className="lm-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = "Delete", danger = true }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14.5, lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}

function ShareSheet({
  open, onClose, listName,
  shares, shareEmail, setShareEmail, shareRole, setShareRole,
  shareLink, copied, onCopyLink, onNativeShare,
  onSubmit, busy, canShare,
  showInvites, onToggleInvites,
  onChangeRole, onRevoke,
}) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const isNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const viewerCount = (shares || []).filter((s) => s.role !== "editor").length;
  const editorCount = (shares || []).filter((s) => s.role === "editor").length;

  return (
    <div
      className="lm-modal-backdrop lm-sheet-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="lm-modal lm-sheet" role="dialog" aria-modal="true" aria-label={`Share ${listName}`}>
        <div className="lm-sheet__grab" aria-hidden="true" />
        <div className="lm-modal__header">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
            <span style={{ width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: 10, background: "var(--color-accent-soft)", color: "var(--color-accent-hover)", flexShrink: 0 }}>
              <i className="bi bi-share-fill" />
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 className="lm-modal__title truncate">Share list</h2>
              <p className="truncate" style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0", fontWeight: 500 }}>{listName}</p>
            </div>
          </div>
          <button type="button" className="lm-modal__close" onClick={onClose} aria-label="Close">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="lm-modal__body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {!canShare && (
            <div className="lm-alert" role="alert" style={{
              padding: "10px 14px", borderRadius: "var(--radius-md)",
              background: "var(--color-accent-soft)",
              border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
              fontSize: 13, color: "var(--text)", display: "flex", gap: 10, alignItems: "flex-start",
            }}>
              <i className="bi bi-info-circle" style={{ color: "var(--color-accent-hover)", fontSize: 16, marginTop: 1 }} />
              <span>Only the owner can invite or change access. You can still view collaborators below.</span>
            </div>
          )}

          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span className="eyebrow" style={{ fontSize: 11 }}>
                <i className="bi bi-link-45deg" style={{ marginRight: 6 }} /> Share link
              </span>
            </div>
            <div className="lm-share-link">
              <input
                type="text"
                readOnly
                className="form-control lm-share-link__input"
                value={shareLink || "Generating link…"}
                onFocus={(e) => e.target.select()}
                aria-label="Shareable link"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onCopyLink}
                disabled={!shareLink}
                aria-label="Copy link"
                title="Copy link"
                style={{ height: 44, padding: "0 14px", flexShrink: 0 }}
              >
                <i className={`bi ${copied ? "bi-check2" : "bi-clipboard"}`} />
                <span className="lm-md-show-inline" style={{ marginLeft: 6 }}>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={onNativeShare}
                disabled={!shareLink}
                style={{ width: "100%" }}
              >
                <i className={`bi ${isNativeShare ? "bi-share" : "bi-clipboard"}`} />
                <span style={{ marginLeft: 6 }}>{isNativeShare ? "Share to…" : "Copy link"}</span>
              </button>
              <a
                href={shareLink ? `mailto:?subject=${encodeURIComponent(`Join my "${listName}" list`)}&body=${encodeURIComponent(`Hey! I'm sharing my SmartGrocery list with you: ${shareLink}`)}` : "#"}
                onClick={(e) => { if (!shareLink) e.preventDefault(); }}
                className="btn btn-outline btn-lg"
                style={{ width: "100%", textDecoration: "none" }}
              >
                <i className="bi bi-envelope" />
                <span style={{ marginLeft: 6 }}>Email</span>
              </a>
            </div>
          </section>

          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <span className="eyebrow" style={{ fontSize: 11 }}>
                <i className="bi bi-people" style={{ marginRight: 6 }} /> People with access
                {shares.length > 0 && (
                  <span style={{ marginLeft: 8, color: "var(--text-muted)", fontWeight: 600 }}>
                    {shares.length} · {editorCount} editor{editorCount === 1 ? "" : "s"} · {viewerCount} viewer{viewerCount === 1 ? "" : "s"}
                  </span>
                )}
              </span>
              {canShare && (
                <button type="button" className="btn btn-outline btn-sm" onClick={onToggleInvites}>
                  <i className={`bi ${showInvites ? "bi-x-lg" : "bi-person-plus"}`} />
                  <span style={{ marginLeft: 6 }}>{showInvites ? "Hide invite" : "Invite by email"}</span>
                </button>
              )}
            </div>

            {showInvites && canShare && (
              <form onSubmit={onSubmit} className="lm-share-invite" style={{ marginBottom: 12 }}>
                <div className="form-field" style={{ flex: 1, minWidth: 0 }}>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="friend@example.com"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    required
                    autoComplete="email"
                    style={{ height: 44 }}
                  />
                </div>
                <div className="form-field" style={{ width: 140 }}>
                  <label className="form-label">Role</label>
                  <div className="lm-role-toggle">
                    <button
                      type="button"
                      className={"lm-role-toggle__btn" + (shareRole === "viewer" ? " is-active" : "")}
                      onClick={() => setShareRole("viewer")}
                      aria-pressed={shareRole === "viewer"}
                    >Viewer</button>
                    <button
                      type="button"
                      className={"lm-role-toggle__btn" + (shareRole === "editor" ? " is-active" : "")}
                      onClick={() => setShareRole("editor")}
                      aria-pressed={shareRole === "editor"}
                    >Editor</button>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={busy || !shareEmail.trim()} style={{ height: 44 }}>
                  {busy ? <span className="lm-spinner" /> : <><i className="bi bi-send" /> Invite</>}
                </button>
              </form>
            )}

            {shares.length === 0 ? (
              <div className="lm-empty" style={{ padding: "24px 12px" }}>
                <div className="lm-empty__art" style={{ width: 56, height: 56, fontSize: 24 }}><i className="bi bi-people" /></div>
                <p className="lm-empty__title">Just you so far</p>
                <p className="lm-empty__desc">Share the link or invite by email to collaborate in real time.</p>
              </div>
            ) : (
              <div className="lm-share-people">
                {shares.map((share) => (
                  <div key={share.id} className="lm-share-person">
                    <div className="lm-avatar lm-avatar--md lm-share-person__avatar">
                      {(share.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="lm-share-person__main">
                      <div className="truncate" style={{ fontSize: 14, fontWeight: 600 }}>{share.email}</div>
                      <div className="lm-share-person__sub">
                        {share.role === "editor" ? "Can edit items" : "View only"}
                      </div>
                    </div>
                    {canShare ? (
                      <>
                        <div className="lm-role-toggle lm-role-toggle--sm" aria-label="Role">
                          <button
                            type="button"
                            className={"lm-role-toggle__btn" + (share.role === "viewer" ? " is-active" : "")}
                            onClick={() => onChangeRole(share, "viewer")}
                            aria-label={`Set ${share.email} as viewer`}
                            aria-pressed={share.role === "viewer"}
                          >Viewer</button>
                          <button
                            type="button"
                            className={"lm-role-toggle__btn" + (share.role === "editor" ? " is-active" : "")}
                            onClick={() => onChangeRole(share, "editor")}
                            aria-label={`Set ${share.email} as editor`}
                            aria-pressed={share.role === "editor"}
                          >Editor</button>
                        </div>
                        <button
                          type="button"
                          className="lm-share-person__remove"
                          onClick={() => onRevoke(share)}
                          aria-label={`Remove ${share.email}`}
                          title="Remove"
                        >
                          <i className="bi bi-x-lg" />
                        </button>
                      </>
                    ) : (
                      <span className="lm-badge">{share.role === "editor" ? "Editor" : "Viewer"}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Toasts({ items, onDismiss }) {
  return (
    <div className="lm-toast-host" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`lm-toast lm-toast--${t.variant}`}>
          <span className="lm-toast__icon">
            <i
              className={`bi ${
                t.variant === "success" ? "bi-check-lg" :
                t.variant === "danger"  ? "bi-x-lg" :
                t.variant === "warning" ? "bi-exclamation-lg" :
                                          "bi-info-lg"
              }`}
            />
          </span>
          <div className="lm-toast__body">{t.message}</div>
          {t.action && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={t.action.onClick}>
              {t.action.label}
            </button>
          )}
          <button type="button" className="lm-toast__close" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            <i className="bi bi-x" />
          </button>
        </div>
      ))}
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
        <span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>
          You're exploring with sample data. Edits are kept in memory only.
        </span>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={exit}>
        <i className="bi bi-box-arrow-right" /> Exit demo
      </button>
    </div>
  );
}

export default function EnhancedLists() {
  const { user: me } = useAuth();

  const [lists, setLists] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [listQuery, setListQuery] = useState("");
  const [listSort, setListSort] = useState({ key: "name", dir: "asc" });
  const setSortKey = (key) => setListSort((s) => ({ ...s, key }));
  const toggleSortDir = () => setListSort((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }));

  const [itemsByList, setItemsByList] = useState({});
  const [loadingItems, setLoadingItems] = useState(new Set());
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [filters, setFilters] = useState({});
  const [sortBy, setSortBy] = useState({});
  const [editing, setEditing] = useState(new Set());
  const [editDrafts, setEditDrafts] = useState({});
  const [showHidden, setShowHidden] = useState(false);
  const [shoppingMode, setShoppingMode] = useState(false);
  const [hidePurchased, setHidePurchased] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmDelList, setConfirmDelList] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareListId, setShareListId] = useState(null);
  const [shares, setShares] = useState([]);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("viewer");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [shareInvites, setShareInvites] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [shoppingProgress, setShoppingProgress] = useState(0);
  const [removedIds, setRemovedIds] = useState(() => {
    try {
      const raw = localStorage.getItem("sg-removed-lists");
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });
  const saveRemoved = (nextSet) => {
    setRemovedIds(nextSet);
    try { localStorage.setItem("sg-removed-lists", JSON.stringify(Array.from(nextSet))); } catch {}
  };

  const selectedList = (Array.isArray(lists) ? lists : []).find((l) => l.id === selectedId) || null;
  const isOwner = !!(selectedList && me && selectedList.owner_id === me.id);
  const myRole = selectedList?.role || (isOwner ? "owner" : selectedList?.shared ? "viewer" : "owner");
  const canEdit = isOwner || myRole === "editor";

  const listFilter = listQuery.toLowerCase();
  const visibleLists = useMemo(() => {
    const safeLists = Array.isArray(lists) ? lists : [];
    const base = (showHidden ? safeLists : safeLists.filter((l) => !l.hidden)).filter((l) => !removedIds.has(l.id));
    const filtered = base.filter((l) => l.name.toLowerCase().includes(listFilter));
    const dir = listSort.dir === "asc" ? 1 : -1;
    const tItems = (id) => itemsByList[id]?.length ?? 0;
    const pItems = (id) => (itemsByList[id]?.filter((i) => !i.purchased).length ?? 0);
    return [...filtered].sort((a, b) => {
      if (listSort.key === "name") return a.name.localeCompare(b.name) * dir;
      if (listSort.key === "created") return (a.id - b.id) * dir;
      if (listSort.key === "items") return (tItems(a.id) - tItems(b.id)) * dir;
      if (listSort.key === "pending") return (pItems(a.id) - pItems(b.id)) * dir;
      return 0;
    });
  }, [lists, listFilter, listSort, showHidden, itemsByList, removedIds]);

  const viewItems = useMemo(() => {
    if (!selectedId) return [];
    const items = Array.isArray(itemsByList[selectedId]) ? itemsByList[selectedId] : [];
    const filterText = (filters[selectedId] || "").toLowerCase();
    const s = sortBy[selectedId] || { key: "name", dir: "asc" };
    let filtered = items.filter((it) => it.name.toLowerCase().includes(filterText));
    if (categoryFilter) {
      filtered = filtered.filter((it) => {
        const cat = it.category || "";
        return cat === categoryFilter || cat.split(".")[0] === categoryFilter;
      });
    }
    if (shoppingMode && hidePurchased) filtered = filtered.filter((i) => !i.purchased);
    const dir = s.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (s.key === "name") return a.name.localeCompare(b.name) * dir;
      if (s.key === "quantity") return (a.quantity - b.quantity) * dir;
      if (s.key === "expiry") {
        const da = parseDate(a.expiry)?.getTime() ?? Number.POSITIVE_INFINITY;
        const db = parseDate(b.expiry)?.getTime() ?? Number.POSITIVE_INFINITY;
        return (da - db) * dir;
      }
      return 0;
    });
  }, [selectedId, itemsByList, filters, sortBy, shoppingMode, hidePurchased, categoryFilter]);

  const loading = selectedId && loadingItems.has(selectedId);
  const totalItems = (id) => itemsByList[id]?.length ?? 0;
  const pendingItems = (id) => (itemsByList[id]?.filter((i) => !i.purchased).length ?? 0);
  const viewItemsCount = (items, cat) => {
    const arr = Array.isArray(items) ? items : [];
    if (!cat) return arr.length;
    return arr.filter((it) => {
      const c = it.category || "";
      return c === cat || c.split(".")[0] === cat;
    }).length;
  };
  const allPending = useMemo(
    () => Object.values(itemsByList).reduce((sum, items) => sum + (items?.filter((i) => !i.purchased).length || 0), 0),
    [itemsByList]
  );
  const totalAcrossLists = useMemo(
    () => Object.values(itemsByList).reduce((sum, items) => sum + (items?.length || 0), 0),
    [itemsByList]
  );
  const expiringSoonCount = useMemo(() => {
    let n = 0;
    Object.values(itemsByList).flat().forEach((it) => {
      const d = daysUntil(it.expiry);
      if (d !== null && d <= 3) n++;
    });
    return n;
  }, [itemsByList]);

  useEffect(() => {
    if (selectedId && itemsByList[selectedId]) {
      const items = itemsByList[selectedId];
      const purchased = items.filter((item) => item.purchased).length;
      const progress = items.length > 0 ? (purchased / items.length) * 100 : 0;
      setShoppingProgress(progress);
    }
  }, [selectedId, itemsByList]);

  const setFilter = (listId, v) => setFilters((f) => ({ ...f, [listId]: v }));
  const toggleSort = (listId, key) => {
    setSortBy((s) => {
      const curr = s[listId] || { key: "name", dir: "asc" };
      const dir = curr.key === key ? (curr.dir === "asc" ? "desc" : "asc") : "asc";
      return { ...s, [listId]: { key, dir } };
    });
  };
  const sortIndicator = (listId, key) => {
    const s = sortBy[listId];
    if (!s || s.key !== key) return "";
    return s.dir === "asc" ? " ▲" : " ▼";
  };
  const updateDraft = (listId, patch) =>
    setDrafts((d) => ({ ...d, [listId]: { ...EMPTY_DRAFT, ...(d[listId] || {}), ...patch } }));

  const applyProductToDraft = (product) => {
    if (!selectedId || !product) return;
    const fields = productToDraft(product);
    if (!fields) return;
    const next = { ...(drafts[selectedId] || EMPTY_DRAFT), ...fields };
    if (!next.name) next.name = product.name || "";
    setDrafts((d) => ({ ...d, [selectedId]: next }));
    if (fields.category) setShowDetails(true);
    pushToast({ message: `Added details for "${next.name}"`, variant: "success" });
  };

  const pushToast = (toast) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, variant: "success", ...toast }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };
  const dismissToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  const refreshAll = async () => {
    try {
      const data = await safeGetLists(showHidden);
      const arr = Array.isArray(data) ? data : [];
      setLists(arr);
      setSelectedId((prev) => prev ?? (arr[0]?.id || null));
      if (arr[0] && !itemsByList[arr[0].id]) {
        const items = await safeGetItems(arr[0].id);
        setItemsByList((m) => ({ ...m, [arr[0].id]: Array.isArray(items) ? items : [] }));
      }
    } catch (e) {
      pushToast({ message: e.message || "Failed to load lists", variant: "danger" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden]);

  useEffect(() => {
    if (!isDemo()) return;
    const unsub = subscribeDemo(() => { refreshAll(); });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden]);

  useEffect(() => {
    const loadItems = async () => {
      if (!selectedId || itemsByList[selectedId]) return;
      try {
        setLoadingItems((s) => new Set(s).add(selectedId));
        const items = await safeGetItems(selectedId);
        setItemsByList((m) => ({ ...m, [selectedId]: Array.isArray(items) ? items : [] }));
      } catch (e) {
        pushToast({ message: e.message || "Failed to load items", variant: "danger" });
      } finally {
        setLoadingItems((s) => { const n = new Set(s); n.delete(selectedId); return n; });
      }
    };
    loadItems();
  }, [selectedId, itemsByList]);

  const onCreateList = async (e) => {
    e.preventDefault();
    const nm = newListName.trim();
    if (!nm) return;
    try {
      setCreating(true);
      const created = await safeCreateList(nm);
      const createdList = created?.id
        ? { hidden: false, owner_id: me?.id, name: nm, ...created }
        : null;
      setNewListName("");
      const data = await safeGetLists(showHidden);
      const refreshed = Array.isArray(data) ? data : [];
      const nextLists = createdList && !refreshed.some((list) => list.id === createdList.id)
        ? [createdList, ...refreshed]
        : refreshed;
      setLists(nextLists);
      setListQuery("");
      if (createdList?.id) {
        setSelectedId(createdList.id);
        setItemsByList((m) => ({ ...m, [createdList.id]: m[createdList.id] || [] }));
      }
      pushToast({ message: `Created "${created?.name || nm}"`, variant: "success" });
    } catch (e) {
      pushToast({ message: e.message || "Couldn't create list", variant: "danger" });
    } finally {
      setCreating(false);
    }
  };

  const submitItem = async (e) => {
    e.preventDefault();
    if (!selectedId) return;
    const draft = drafts[selectedId] || {};
    const nm = (draft.name || "").trim();
    if (!nm) return;
    try {
      const payload = {
        name: nm,
        quantity: Number(draft.quantity || 1),
        expiry: draft.expiry ? draft.expiry : null,
        description: draft.description ? draft.description : undefined,
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
      const item = await safeAddItem(selectedId, payload);
      setItemsByList((m) => ({ ...m, [selectedId]: [item, ...(m[selectedId] || [])] }));
      setDrafts((d) => ({ ...d, [selectedId]: { ...EMPTY_DRAFT } }));
      setShowDetails(false);
    } catch (e) {
      pushToast({ message: e.message || "Couldn't add item", variant: "danger" });
    }
  };

  const askDelete = (item) => setConfirmDel(item);
  const doDelete = async () => {
    const item = confirmDel;
    if (!item) return;
    try {
      await safeDeleteItem(item.id);
      setItemsByList((m) => ({ ...m, [selectedId]: (m[selectedId] || []).filter((i) => i.id !== item.id) }));
      setEditing((s) => { const n = new Set(s); n.delete(item.id); return n; });
      setEditDrafts(({ [item.id]: _, ...rest }) => rest);
      pushToast({ message: `Removed "${item.name}"`, variant: "success" });
    } catch (e) {
      pushToast({ message: e.message || "Couldn't delete item", variant: "danger" });
    } finally { setConfirmDel(null); }
  };

  const startEdit = (it) => {
    setEditing((s) => new Set(s).add(it.id));
    setEditDrafts((d) => ({ ...d, [it.id]: { name: it.name, quantity: it.quantity, expiry: it.expiry || "", description: it.description || "" } }));
  };
  const cancelEdit = (id) => {
    setEditing((s) => { const n = new Set(s); n.delete(id); return n; });
    setEditDrafts((d) => { const { [id]: _, ...rest } = d; return rest; });
  };
  const updateEditDraft = (id, patch) => setEditDrafts((d) => ({ ...d, [id]: { ...(d[id] || {}), ...patch } }));
  const saveEdit = async (id) => {
    const draft = editDrafts[id];
    const patch = { name: draft.name, quantity: Number(draft.quantity), expiry: draft.expiry ? draft.expiry : null, description: typeof draft.description === "string" ? draft.description : undefined };
    try {
      const updated = await safeUpdateItem(id, patch);
      setItemsByList((m) => ({ ...m, [selectedId]: (m[selectedId] || []).map((x) => (x.id === id ? updated : x)) }));
      cancelEdit(id);
    } catch (e) {
      pushToast({ message: e.message || "Couldn't update item", variant: "danger" });
    }
  };

  const openRename = () => {
    setRenameValue(selectedList?.name || "");
    setRenameOpen(true);
  };
  const submitRename = async (e) => {
    e.preventDefault();
    if (!selectedId) return;
    const newName = renameValue.trim();
    if (!newName || newName === selectedList?.name) {
      setRenameOpen(false);
      return;
    }
    try {
      await safeRenameList(selectedId, newName);
      const data = await safeGetLists(showHidden);
      setLists(Array.isArray(data) ? data : []);
      pushToast({ message: "List renamed", variant: "success" });
      setRenameOpen(false);
    } catch (e) {
      pushToast({ message: e.message || "Couldn't rename list", variant: "danger" });
    }
  };

  const onDeleteList = async () => {
    if (!selectedId) return;
    setConfirmDelList(false);
    try {
      await safeDeleteList(selectedId);
      pushToast({ message: "List deleted", variant: "success" });
      setSelectedId(null);
      const data = await safeGetLists(showHidden);
      setLists(Array.isArray(data) ? data : []);
    } catch (e) { pushToast({ message: e.message || "Couldn't delete list", variant: "danger" }); }
  };

  const toggleHiddenSelected = async () => {
    if (!selectedId || isOwner) return;
    try {
      const sel = (Array.isArray(lists) ? lists : []).find((l) => l.id === selectedId);
      if (!sel) return;
      if (sel.hidden) { await safeUnhideList(selectedId); pushToast({ message: "List unhidden", variant: "success" }); }
      else { await safeHideList(selectedId); pushToast({ message: "List hidden", variant: "success" }); }
      const data = await safeGetLists(showHidden);
      setLists(Array.isArray(data) ? data : []);
    } catch (e) { pushToast({ message: e.message || "Action failed", variant: "danger" }); }
  };

  const removeFromMyLists = async () => {
    if (!selectedId || isOwner) return;
    const next = new Set(removedIds); next.add(selectedId); saveRemoved(next);
    setLists((arr) => (Array.isArray(arr) ? arr : []).filter((l) => l.id !== selectedId));
    pushToast({ message: "Removed from your lists", variant: "success" });
    setSelectedId(null);
  };

  const togglePurchased = async (item) => {
    if (!canEdit) return;
    const prev = !!item.purchased;
    setItemsByList((m) => ({ ...m, [selectedId]: (m[selectedId] || []).map((x) => (x.id === item.id ? { ...x, purchased: !prev } : x)) }));
    pushToast({
      message: prev ? "Marked as still needed" : `Got "${item.name}"`,
      variant: "success",
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            const updated = await safeUpdateItem(item.id, { purchased: prev });
            setItemsByList((m) => ({
              ...m,
              [selectedId]: (m[selectedId] || []).map((x) => (x.id === item.id ? updated : x)),
            }));
          } catch (e) {
            pushToast({ message: e.message || "Failed to revert", variant: "danger" });
          }
        },
      },
    });
    try {
      const updated = await safeUpdateItem(item.id, { purchased: !prev });
      setItemsByList((m) => ({ ...m, [selectedId]: (m[selectedId] || []).map((x) => (x.id === item.id ? updated : x)) }));
    } catch (err) {
      setItemsByList((m) => ({ ...m, [selectedId]: (m[selectedId] || []).map((x) => (x.id === item.id ? { ...x, purchased: prev } : x)) }));
      pushToast({ message: err.message || "Couldn't update", variant: "danger" });
    }
  };

  const openShare = async (listId) => {
    const id = listId || selectedId;
    if (!id) return;
    setShareListId(id);
    setSelectedId(id);
    setShareOpen(true);
    setCopied(false);
    setShareInvites(false);
    try {
      const [data, link] = await Promise.all([
        safeGetShares(id),
        safeGetShareLink(id).catch(() => ""),
      ]);
      setShares(Array.isArray(data) ? data : []);
      setShareLink(link || "");
    } catch (e) {
      pushToast({ message: e.message || "Failed to load shares", variant: "danger" });
    }
  };

  const closeShare = () => {
    setShareOpen(false);
    setShareListId(null);
    setShareEmail("");
    setShareRole("viewer");
    setShareInvites(false);
    setCopied(false);
  };

  const copyLink = async () => {
    if (!shareLink) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        const ta = document.createElement("textarea");
        ta.value = shareLink;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      pushToast({ message: "Couldn't copy link", variant: "danger" });
    }
  };

  const nativeShare = async () => {
    if (!shareLink) return;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: shareListName,
          text: `Join my "${shareListName}" list on SmartGrocery`,
          url: shareLink,
        });
      } catch (err) {
        if (err && err.name !== "AbortError") {
          pushToast({ message: err.message || "Share cancelled", variant: "warning" });
        }
      }
    } else {
      copyLink();
    }
  };

  const addShare = async (e) => {
    e.preventDefault();
    if (!shareEmail.trim() || !shareListId) return;
    setShareBusy(true);
    try {
      const added = await safeAddShare(shareListId, { email: shareEmail.trim(), role: shareRole });
      setShares((s) => Array.isArray(s) ? [...s, added] : [added]);
      setShareEmail(""); setShareRole("viewer");
      pushToast({ message: `Invited ${added.email}`, variant: "success" });
    } catch (e) { pushToast({ message: e.message || "Couldn't share", variant: "danger" }); }
    finally { setShareBusy(false); }
  };

  const changeRole = async (share, role) => {
    if (!shareListId) return;
    try {
      const updated = await safeUpdateShare(shareListId, share.id, { role });
      setShares((s) => s.map((x) => (x.id === share.id ? updated : x)));
    } catch (e) { pushToast({ message: e.message || "Couldn't update role", variant: "danger" }); }
  };

  const revoke = async (share) => {
    if (!shareListId) return;
    try {
      await safeRevokeShare(shareListId, share.id);
      setShares((s) => s.filter((x) => x.id !== share.id));
      pushToast({ message: `Removed ${share.email}`, variant: "success" });
    } catch (e) { pushToast({ message: e.message || "Couldn't revoke", variant: "danger" }); }
  };

  if (isLoading) {
    return (
      <div className="lm-container" style={{ paddingTop: 40, paddingBottom: 40, display: "grid", placeItems: "center" }}>
        <div className="lm-empty">
          <div className="lm-empty__art"><span className="lm-spinner lm-spinner--lg" /></div>
          <p className="lm-empty__title">Loading your lists…</p>
        </div>
      </div>
    );
  }

  const selectedName = selectedList?.name || "Select a list";
  const shareList = (Array.isArray(lists) ? lists : []).find((l) => l.id === shareListId) || null;
  const shareListName = shareList?.name || selectedName;
  const shareListIsOwner = !!(shareList && me && shareList.owner_id === me.id) || (!shareList && isOwner);

  return (
    <div className="lm-container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <div className="lm-hero">
        <h1 className="lm-hero__title">Your lists</h1>
        <p className="lm-hero__subtitle">Plan, share, and check things off as you shop.</p>
      </div>

      <DemoBanner />

      <div className="lm-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div className="lm-stat lm-stat--brand">
          <span className="lm-stat__label">Lists</span>
          <span className="lm-stat__value">{visibleLists.length}</span>
          <span className="lm-stat__sub">visible to you</span>
        </div>
        <div className="lm-stat">
          <span className="lm-stat__label">Items</span>
          <span className="lm-stat__value">{totalAcrossLists}</span>
          <span className="lm-stat__sub">across all lists</span>
        </div>
        <div className="lm-stat lm-stat--accent">
          <span className="lm-stat__label">To buy</span>
          <span className="lm-stat__value">{allPending}</span>
          <span className="lm-stat__sub">not yet purchased</span>
        </div>
        <div className="lm-stat">
          <span className="lm-stat__label">Expiring soon</span>
          <span className="lm-stat__value" style={{ color: expiringSoonCount > 0 ? "var(--accent-600)" : undefined }}>{expiringSoonCount}</span>
          <span className="lm-stat__sub">within 3 days</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 320px) 1fr", gap: 20, alignItems: "start" }}
           className="lm-grid-2">
        <aside className="lm-card lm-card--elevated" style={{ position: "sticky", top: "calc(var(--nav-height) + 16px)" }}>
          <div className="lm-card__header">
            <span className="eyebrow" style={{ fontSize: 11 }}>
              <i className="bi bi-folder2-open" style={{ marginRight: 6 }} /> My lists
            </span>
            <span className="lm-badge">{visibleLists.length}</span>
          </div>
          <div className="lm-card__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <form onSubmit={onCreateList} style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                className="form-control"
                placeholder="New list…"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                style={{ height: 40 }}
                maxLength={80}
              />
              <button
                type="submit"
                className="btn btn-primary btn-icon"
                disabled={!newListName.trim() || creating}
                aria-label="Create list"
                title="Create list"
                style={{ width: 40, height: 40 }}
              >
                {creating ? <span className="lm-spinner" /> : <i className="bi bi-plus-lg" />}
              </button>
            </form>

            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search lists"
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                style={{ height: 38, paddingLeft: 38 }}
              />
              <i className="bi bi-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none", fontSize: 14 }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <select className="form-select" value={listSort.key} onChange={(e) => setSortKey(e.target.value)} style={{ height: 34, fontSize: 12.5, maxWidth: 130, padding: "0 30px 0 12px" }}>
                <option value="name">Name</option>
                <option value="created">Created</option>
                <option value="items">Items</option>
                <option value="pending">Pending</option>
              </select>
              <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={toggleSortDir} aria-label="Toggle sort direction" style={{ width: 34 }}>
                <i className={`bi ${listSort.dir === "asc" ? "bi-sort-up" : "bi-sort-down"}`} />
              </button>
              <label className="lm-switch" style={{ marginLeft: "auto", fontSize: 12.5 }}>
                <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
                <span className="lm-switch__track"><span className="lm-switch__thumb" /></span>
                <span>Hidden</span>
              </label>
            </div>

            <div style={{ maxHeight: 420, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
              {visibleLists.length === 0 ? (
                <div className="lm-empty" style={{ padding: "36px 12px" }}>
                  <div className="lm-empty__art"><i className="bi bi-basket" /></div>
                  <h4 className="lm-empty__title">No lists yet</h4>
                  <p className="lm-empty__desc">Create your first list using the field above.</p>
                </div>
              ) : (
                <div className="lm-list">
                  {visibleLists.map((list) => {
                    const pending = pendingItems(list.id);
                    const total = totalItems(list.id);
                    const isListOwner = !!(me && list.owner_id === me.id);
                    return (
                      <div
                        key={list.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedId(list.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(list.id);
                          }
                        }}
                        className={"lm-list__item" + (selectedId === list.id ? " is-active" : "")}
                      >
                        <div className="lm-list__item-main">
                          <div className="lm-list__item-title">
                            {list.shared && <i className="bi bi-people-fill" style={{ fontSize: 12, color: "var(--color-primary)" }} />}
                            <span className="truncate">{list.name}</span>
                          </div>
                          <span className="lm-list__item-sub">
                            {total === 0 ? "Empty" : `${pending} pending · ${total} total`}
                          </span>
                        </div>
                        {(pending > 0 || isListOwner) && (
                          <div className="lm-list__item-actions">
                            {pending > 0 && <span className="lm-badge lm-badge--brand">{pending}</span>}
                            {isListOwner && (
                              <button
                                type="button"
                                className="lm-list__item-share"
                                aria-label={`Share ${list.name}`}
                                title="Share list"
                                onClick={(e) => { e.stopPropagation(); openShare(list.id); }}
                              >
                                <i className="bi bi-share" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="lm-card lm-card--elevated anim-fade" key={selectedId || "none"}>
          <div className="lm-card__header" style={{ flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: 10, background: "var(--color-primary-soft)", color: "var(--color-primary)" }}>
                <i className="bi bi-basket3-fill" />
              </span>
              <div style={{ minWidth: 0 }}>
                <h2 className="truncate" style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>{selectedName}</h2>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                  {selectedId ? (
                    <>
                      {totalItems(selectedId)} items
                      {!isOwner && <> · Shared with you</>}
                      {selectedList?.shared && isOwner && <> · Shared</>}
                    </>
                  ) : "Pick a list to see what's inside"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {selectedId && (
                <span className="lm-badge lm-badge--brand">
                  {pendingItems(selectedId)} / {totalItems(selectedId)} to buy
                </span>
              )}

              <button
                type="button"
                onClick={() => setShoppingMode((v) => !v)}
                className={"btn btn-sm " + (shoppingMode ? "btn-primary" : "btn-outline")}
                title={shoppingMode ? "Exit shop mode" : "Enter shop mode"}
              >
                <i className={`bi ${shoppingMode ? "bi-bag-check-fill" : "bi-bag"}`} />
                {shoppingMode ? "Shopping" : "Shop"}
              </button>

              {selectedId && !loading && isOwner && (
                <>
                  <IconBtn icon="bi-pencil" label="Rename" onClick={openRename} />
                  <IconBtn icon="bi-people" label="Share" onClick={() => openShare(selectedId)} />
                  <IconBtn icon="bi-trash3" label="Delete list" onClick={() => setConfirmDelList(true)} danger />
                </>
              )}

              {selectedId && !loading && !isOwner && (
                <>
                  <label className="lm-switch" style={{ fontSize: 12.5 }}>
                    <input type="checkbox" checked={!!selectedList?.hidden} onChange={toggleHiddenSelected} />
                    <span className="lm-switch__track"><span className="lm-switch__thumb" /></span>
                    <span>Hidden</span>
                  </label>
                  <button type="button" className="btn btn-ghost-danger btn-sm" onClick={removeFromMyLists}>
                    <i className="bi bi-x-circle" /> Remove
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="lm-card__body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!selectedId ? (
              <div className="lm-empty">
                <div className="lm-empty__art"><i className="bi bi-arrow-left-circle" /></div>
                <h3 className="lm-empty__title">Choose a list</h3>
                <p className="lm-empty__desc">Select a list on the left to view and manage its items.</p>
              </div>
            ) : (
              <>
                {shoppingMode && (
                  <div style={{ padding: 16, background: "var(--color-primary-soft)", borderRadius: "var(--radius-md)", border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>Shopping progress</div>
                        <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                          {viewItems.filter((i) => i.purchased).length} of {viewItems.length} checked off
                        </div>
                      </div>
                      <span className="lm-badge lm-badge--brand">{Math.round(shoppingProgress)}%</span>
                    </div>
                    <div className="lm-progress" style={{ marginBottom: 10 }}>
                      <div className="lm-progress__bar" style={{ width: `${shoppingProgress}%` }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label className="form-check" style={{ fontSize: 13 }}>
                        <input type="checkbox" className="form-check-input" checked={hidePurchased} onChange={(e) => setHidePurchased(e.target.checked)} />
                        <span>Hide purchased</span>
                      </label>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShoppingMode(false)}>
                        Exit shopping
                      </button>
                    </div>
                  </div>
                )}

                {!shoppingMode && (
                  <form onSubmit={submitItem}>
                    <div className="lm-add-form" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) 80px 160px auto", gap: 8 }}>
                      <div style={{ position: "relative" }}>
                        <ItemTypeahead
                          value={drafts[selectedId]?.name ?? ""}
                          onChange={(v) => updateDraft(selectedId, { name: v })}
                          onPick={applyProductToDraft}
                          disabled={!canEdit}
                          placeholder="Add an item or search the catalog…"
                          autoFocus
                        />
                      </div>
                      <input
                        type="number"
                        min="1"
                        className="form-control"
                        placeholder="Qty"
                        value={drafts[selectedId]?.quantity ?? 1}
                        onChange={(e) => updateDraft(selectedId, { quantity: e.target.value })}
                        disabled={!canEdit}
                        style={{ height: 40, textAlign: "center" }}
                      />
                      <input
                        type="date"
                        className="form-control"
                        value={drafts[selectedId]?.expiry ?? ""}
                        onChange={(e) => updateDraft(selectedId, { expiry: e.target.value })}
                        disabled={!canEdit}
                        style={{ height: 40 }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        {FEATURE_CATALOG && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon"
                            onClick={() => setScannerOpen(true)}
                            disabled={!canEdit}
                            aria-label="Scan barcode"
                            title="Scan barcode"
                            style={{ width: 40, height: 40 }}
                          >
                            <i className="bi bi-upc-scan" />
                          </button>
                        )}
                        <button
                          type="button"
                          className={"btn btn-icon" + (showDetails ? "btn-primary" : "btn-secondary")}
                          onClick={() => setShowDetails((v) => !v)}
                          disabled={!canEdit}
                          aria-label="Toggle item details"
                          title="Details"
                          style={{ width: 40, height: 40 }}
                        >
                          <i className={`bi ${showDetails ? "bi-chevron-up" : "bi-three-dots"}`} />
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={!canEdit}
                          style={{ height: 40 }}
                        >
                          <i className="bi bi-plus-lg" /> Add
                        </button>
                      </div>
                    </div>

                    {showDetails && (
                      <div className="lm-add-details">
                        <div className="lm-add-details__row">
                          {drafts[selectedId]?.product_image_url && (
                            <img
                              className="lm-add-details__thumb"
                              src={drafts[selectedId].product_image_url}
                              alt=""
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          )}
                          <div className="lm-add-details__main">
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <CategoryBadge
                                category={drafts[selectedId]?.category}
                                subcategory={drafts[selectedId]?.subcategory}
                                size="sm"
                              />
                              {drafts[selectedId]?.barcode && (
                                <span className="lm-meta-pill" title="Barcode">
                                  <i className="bi bi-upc" /> {drafts[selectedId].barcode}
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
                              value={drafts[selectedId]?.brand ?? ""}
                              onChange={(e) => updateDraft(selectedId, { brand: e.target.value || null })}
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
                                value={drafts[selectedId]?.weight_value ?? ""}
                                onChange={(e) => updateDraft(selectedId, { weight_value: e.target.value })}
                                style={{ height: 36, width: 90 }}
                              />
                              <select
                                className="form-select"
                                value={drafts[selectedId]?.weight_unit ?? ""}
                                onChange={(e) => updateDraft(selectedId, { weight_unit: e.target.value || null })}
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
                                value={drafts[selectedId]?.price ?? ""}
                                onChange={(e) => updateDraft(selectedId, { price: e.target.value })}
                                style={{ height: 36, width: 100 }}
                              />
                              <select
                                className="form-select"
                                value={drafts[selectedId]?.price_source ?? "user"}
                                onChange={(e) => updateDraft(selectedId, { price_source: e.target.value })}
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
                      value={filters[selectedId] || ""}
                      onChange={(e) => setFilter(selectedId, e.target.value)}
                      style={{ height: 36, paddingLeft: 36, fontSize: 13.5 }}
                    />
                    <i className="bi bi-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none", fontSize: 13 }} />
                  </div>
                  <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                    {[
                      { key: "name", label: "Name" },
                      { key: "quantity", label: "Qty" },
                      { key: "expiry", label: "Expiry" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleSort(selectedId, key)}
                        className={"btn btn-sm " + (sortBy[selectedId]?.key === key ? "btn-primary" : "btn-secondary")}
                      >
                        {label}{sortIndicator(selectedId, key)}
                      </button>
                    ))}
                  </div>
                </div>

                {FEATURE_CATALOG && (
                  <div className="lm-cat-filters" role="tablist" aria-label="Filter by category">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={!categoryFilter}
                      className={"lm-cat-chip" + (!categoryFilter ? " is-active" : "")}
                      onClick={() => setCategoryFilter(null)}
                      style={{ "--cat-color": "#94a3b8" }}
                    >
                      <i className="bi bi-grid-fill" />
                      <span>All</span>
                      <span className="lm-cat-chip__count">{viewItemsCount(itemsByList[selectedId])}</span>
                    </button>
                    {CAT_FILTERS.map((cf) => {
                      const n = viewItemsCount(itemsByList[selectedId], cf.key);
                      if (n === 0 && categoryFilter !== cf.key) return null;
                      return (
                        <button
                          key={cf.key}
                          type="button"
                          role="tab"
                          aria-selected={categoryFilter === cf.key}
                          className={"lm-cat-chip" + (categoryFilter === cf.key ? " is-active" : "")}
                          onClick={() => setCategoryFilter(categoryFilter === cf.key ? null : cf.key)}
                          style={{ "--cat-color": categoryColor(cf.key) }}
                        >
                          <i className={`bi ${categoryIcon(cf.key)}`} />
                          <span>{cf.label}</span>
                          <span className="lm-cat-chip__count">{n}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {loading ? (
                  <div className="lm-empty" style={{ padding: "32px 12px" }}>
                    <div className="lm-empty__art"><span className="lm-spinner lm-spinner--lg" /></div>
                    <p className="lm-empty__title">Loading items…</p>
                  </div>
                ) : viewItems.length === 0 ? (
                  <div className="lm-empty">
                    <div className="lm-empty__art"><i className="bi bi-bag" /></div>
                    <h3 className="lm-empty__title">{shoppingMode ? "All done!" : "Nothing here yet"}</h3>
                    <p className="lm-empty__desc">
                      {shoppingMode
                        ? "No items left to buy in this list."
                        : "Add your first item using the form above."}
                    </p>
                  </div>
                ) : !shoppingMode ? (
                  <div className="flex flex-col" style={{ gap: 8 }}>
                    {viewItems.map((item) => {
                      const isEd = editing.has(item.id);
                      const draft = editDrafts[item.id] || {};
                      return (
                        <div key={item.id} className={"lm-item" + (item.purchased ? " is-purchased" : "")}>
                          <button
                            type="button"
                            onClick={() => togglePurchased(item)}
                            className={"lm-item__check" + (item.purchased ? " is-checked" : "")}
                            disabled={!canEdit}
                            aria-label={item.purchased ? "Mark unpurchased" : "Mark purchased"}
                            aria-pressed={item.purchased}
                          >
                            <i className="bi bi-check-lg" />
                          </button>

                          <div className="lm-item__main">
                            {isEd ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={draft.name}
                                  onChange={(e) => updateEditDraft(item.id, { name: e.target.value })}
                                  style={{ height: 34, fontSize: 13.5 }}
                                />
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Description"
                                  value={draft.description || ""}
                                  onChange={(e) => updateEditDraft(item.id, { description: e.target.value })}
                                  style={{ height: 32, fontSize: 12.5 }}
                                />
                              </div>
                            ) : (
                              <>
                                {item.product_image_url ? (
                                  <img
                                    className="lm-item__thumb"
                                    src={item.product_image_url}
                                    alt=""
                                    loading="lazy"
                                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                                  />
                                ) : (
                                  <span
                                    className="lm-item__thumb lm-item__thumb--placeholder"
                                    style={{ background: categoryColor(item.category) + "22", color: categoryColor(item.category) }}
                                    aria-hidden="true"
                                  >
                                    <i className={`bi ${categoryIcon(item.category)}`} />
                                  </span>
                                )}
                                <div className="lm-item__body">
                                  <div className="lm-item__row-top">
                                    <ExpiryDot expiry={item.expiry} />
                                    <span className="lm-item__name" title={item.name}>{item.name}</span>
                                    {item.brand && <span className="lm-item__brand">{item.brand}</span>}
                                  </div>
                                  <div className="lm-item__row-pills">
                                    <CategoryBadge category={item.category} subcategory={item.subcategory} />
                                    <WeightDisplay
                                      value={item.weight_value}
                                      unit={item.weight_unit}
                                      fallback={null}
                                    />
                                    <PriceDisplay
                                      price={item.price}
                                      priceSource={item.price_source}
                                      fallback={null}
                                      showSource={false}
                                    />
                                  </div>
                                  {(item.description || item.expiry) && (
                                    <div className="lm-item__meta">
                                      {item.description && (
                                        <span title={item.description} className="truncate" style={{ maxWidth: 280 }}>
                                          <i className="bi bi-text-left" /> {item.description}
                                        </span>
                                      )}
                                      {item.expiry && (
                                        <span>
                                          <i className="bi bi-calendar3" /> {item.expiry}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {isEd ? (
                              <>
                                <input
                                  type="number"
                                  min="1"
                                  className="form-control"
                                  value={draft.quantity}
                                  onChange={(e) => updateEditDraft(item.id, { quantity: e.target.value })}
                                  style={{ width: 72, height: 34, textAlign: "center", fontSize: 13.5 }}
                                />
                                <input
                                  type="date"
                                  className="form-control"
                                  value={draft.expiry || ""}
                                  onChange={(e) => updateEditDraft(item.id, { expiry: e.target.value })}
                                  style={{ width: 160, height: 34, fontSize: 13 }}
                                />
                              </>
                            ) : (
                              <>
                                <span className="lm-item__qty">×{item.quantity}</span>
                                <ExpiryPill expiry={item.expiry} />
                              </>
                            )}
                          </div>

                          <div className="lm-item__actions">
                            {isEd ? (
                              <>
                                <IconBtn icon="bi-check-lg" label="Save" onClick={() => saveEdit(item.id)} />
                                <IconBtn icon="bi-x-lg" label="Cancel" onClick={() => cancelEdit(item.id)} />
                              </>
                            ) : (
                              <>
                                <IconBtn icon="bi-pencil" label="Edit" onClick={() => startEdit(item)} disabled={!canEdit} />
                                <IconBtn icon="bi-trash3" label="Delete" onClick={() => askDelete(item)} disabled={!canEdit} danger />
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                    {viewItems.map((item) => (
                      <div
                        key={item.id}
                        className={"lm-shop-card" + (item.purchased ? " is-purchased" : "")}
                        onClick={() => togglePurchased(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            togglePurchased(item);
                          }
                        }}
                      >
                        <div className="lm-shop-card__check">
                          <i className="bi bi-check-lg" />
                        </div>
                        <div className="lm-shop-card__main">
                          {item.product_image_url ? (
                            <img
                              className="lm-shop-card__thumb"
                              src={item.product_image_url}
                              alt=""
                              loading="lazy"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          ) : (
                            <span
                              className="lm-shop-card__thumb lm-shop-card__thumb--placeholder"
                              style={{ background: categoryColor(item.category) + "22", color: categoryColor(item.category) }}
                              aria-hidden="true"
                            >
                              <i className={`bi ${categoryIcon(item.category)}`} />
                            </span>
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <span className="lm-shop-card__name">{item.name}</span>
                            {item.brand && <span className="lm-shop-card__brand">{item.brand}</span>}
                            <div className="lm-shop-card__pills">
                              <CategoryBadge category={item.category} subcategory={item.subcategory} />
                              <WeightDisplay value={item.weight_value} unit={item.weight_unit} fallback={null} />
                              <PriceDisplay
                                price={item.price}
                                priceSource={item.price_source}
                                fallback={null}
                                showSource={false}
                              />
                            </div>
                            <div className="lm-shop-card__sub" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span><i className="bi bi-123" /> Qty {item.quantity}</span>
                              {item.expiry && <span><i className="bi bi-calendar3" /> {item.expiry}</span>}
                            </div>
                          </div>
                        </div>
                        <ExpiryPill expiry={item.expiry} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={closeShare}
        listName={shareListName}
        shares={shares}
        shareEmail={shareEmail}
        setShareEmail={setShareEmail}
        shareRole={shareRole}
        setShareRole={setShareRole}
        shareLink={shareLink}
        copied={copied}
        onCopyLink={copyLink}
        onNativeShare={nativeShare}
        onSubmit={addShare}
        busy={shareBusy}
        canShare={shareListIsOwner}
        showInvites={shareInvites}
        onToggleInvites={() => setShareInvites((v) => !v)}
        onChangeRole={changeRole}
        onRevoke={revoke}
      />

      {selectedId && isOwner && !shareOpen && (
        <button
          type="button"
          className="lm-fab"
          onClick={() => openShare(selectedId)}
          aria-label="Share this list"
          title="Share"
        >
          <i className="bi bi-share-fill" />
        </button>
      )}

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename list"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRenameOpen(false)}>Cancel</button>
            <button type="submit" form="rename-form" className="btn btn-primary">Save</button>
          </>
        }
      >
        <form id="rename-form" onSubmit={submitRename}>
          <div className="form-field">
            <label className="form-label">List name</label>
            <input
              type="text"
              className="form-control"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              maxLength={80}
              required
            />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={doDelete}
        title="Delete item?"
        message={confirmDel ? <>Are you sure you want to delete <strong>{confirmDel.name}</strong>? This can't be undone.</> : ""}
      />

      <ConfirmModal
        open={confirmDelList}
        onClose={() => setConfirmDelList(false)}
        onConfirm={onDeleteList}
        title="Delete list?"
        message={<>This will permanently delete <strong>{selectedList?.name || "this list"}</strong> and all its items for everyone.</>}
      />

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onPick={applyProductToDraft}
      />

      <Toasts items={toasts} onDismiss={dismissToast} />

      <style>{`
        @media (max-width: 960px) {
          .lm-grid-2 { grid-template-columns: 1fr !important; }
          .lm-grid-2 > aside { position: static !important; }
        }
      `}</style>
    </div>
  );
}
