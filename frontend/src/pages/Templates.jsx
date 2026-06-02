import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  apiListTemplates,
  apiTemplateCategories,
  apiGetTemplate,
  apiCloneTemplate,
  FEATURE_TEMPLATES,
} from "../api";
import { safeGetLists } from "../apiSafe";
import { useAuth } from "./AuthContext";
import CategoryBadge from "../components/CategoryBadge";


const CATEGORY_LABELS = {
  meal:      "Meals",
  party:     "Parties",
  household: "Household",
  diet:      "Diet & Lifestyle",
  lifestyle: "Lifestyle",
};


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


function Toasts({ items, onDismiss }) {
  return (
    <div className="lm-toast-host" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`lm-toast lm-toast--${t.variant}`}>
          <span className="lm-toast__icon">
            <i className={`bi ${
              t.variant === "success" ? "bi-check-lg" :
              t.variant === "danger"  ? "bi-x-lg" :
              t.variant === "warning" ? "bi-exclamation-lg" :
                                        "bi-info-lg"
            }`} />
          </span>
          <div className="lm-toast__body">
            {t.message}
            {t.action && (
              <>
                {" "}
                <Link to={`/lists/${t.action.listId}`} className="btn btn-link btn-sm" style={{ padding: 0, marginLeft: 4 }}>
                  Open list
                </Link>
              </>
            )}
          </div>
          <button type="button" className="lm-toast__close" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            <i className="bi bi-x" />
          </button>
        </div>
      ))}
    </div>
  );
}


function TemplateCard({ tpl, onClick, onClone }) {
  return (
    <div className={"lm-template-card lm-template-card--accent-" + (tpl.category || "meal")}>
      <button
        type="button"
        className="lm-template-card__preview-btn"
        onClick={() => onClick(tpl)}
        aria-label={`Preview ${tpl.name}`}
      >
        <div className="lm-template-card__media" aria-hidden="true">
          <span className="lm-template-card__emoji">{tpl.emoji || "🛒"}</span>
          <span className="lm-template-card__count">
            <i className="bi bi-basket" /> {tpl.item_count}
          </span>
        </div>
        <div className="lm-template-card__body">
          <h3 className="lm-template-card__title">{tpl.name}</h3>
          <span className="lm-template-card__cat">
            <i className="bi bi-tag" /> {CATEGORY_LABELS[tpl.category] || tpl.category}
          </span>
          {tpl.description && (
            <p className="lm-template-card__desc">{tpl.description}</p>
          )}
        </div>
      </button>
      <div className="lm-template-card__actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onClick(tpl)}>
          <i className="bi bi-eye" /> Preview
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onClone(tpl)}>
          <i className="bi bi-cart-plus" /> Use template
        </button>
      </div>
    </div>
  );
}


function TemplateDetail({ tpl, onClose, lists, onCloned }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    apiGetTemplate(tpl.slug)
      .then((d) => { if (alive) setDetail(d); })
      .catch((e) => { if (alive) setError(e?.message || "Failed to load template"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tpl.slug]);

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          {tpl.emoji && <span style={{ fontSize: 26 }}>{tpl.emoji}</span>}
          <span>{tpl.name}</span>
        </span>
      }
      wide
    >
      {loading && (
        <div className="lm-empty" style={{ padding: "32px 12px" }}>
          <div className="lm-empty__art"><span className="lm-spinner lm-spinner--lg" /></div>
          <p className="lm-empty__title">Loading template…</p>
        </div>
      )}
      {error && !loading && (
        <div className="lm-alert" style={{ color: "var(--danger, #ef4444)" }}>
          <i className="bi bi-exclamation-triangle" /> {error}
        </div>
      )}
      {detail && !loading && (
        <div className="lm-template-detail">
          {detail.description && (
            <p className="lm-template-detail__desc">{detail.description}</p>
          )}
          <div className="lm-template-detail__meta">
            <span className="lm-badge">
              <i className="bi bi-basket" /> {detail.item_count} item{detail.item_count === 1 ? "" : "s"}
            </span>
            <span className="lm-badge">
              <i className="bi bi-tag" /> {CATEGORY_LABELS[detail.category] || detail.category || "Template"}
            </span>
          </div>
          <div className="lm-template-detail__section">
            <h3 className="lm-template-detail__h3">
              <i className="bi bi-list-ul" /> Items
            </h3>
            <ul className="lm-template-detail__items">
              {detail.items.map((it) => (
                <li key={it.id} className={"lm-template-detail__item" + ((it.name || "").trim() ? "" : " is-empty")}>
                  <span className="lm-template-detail__qty">×{it.quantity}</span>
                  <span className="lm-template-detail__name">{it.name || <em>(empty)</em>}</span>
                  {it.category && (
                    <CategoryBadge
                      category={it.category}
                      size="sm"
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {detail && !loading && (
        <div className="lm-template-detail__footer">
          <button type="button" className="btn btn-primary" onClick={() => onCloned(detail)}>
            <i className="bi bi-cart-plus" /> Add to a list
          </button>
        </div>
      )}
    </Modal>
  );
}


function CloneDialog({ tpl, onClose, lists, onDone }) {
  const [mode, setMode] = useState("new"); // "new" | "existing"
  const [listId, setListId] = useState(lists[0]?.id || "");
  const [listName, setListName] = useState(tpl.name);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (lists.length === 0) setMode("new");
  }, [lists.length]);

  async function onSubmit() {
    setSubmitting(true);
    try {
      const body = mode === "existing" && listId
        ? { list_id: Number(listId) }
        : { list_name: listName.trim() || tpl.name };
      const result = await apiCloneTemplate(tpl.slug, body);
      onDone?.(result);
    } catch (e) {
      onDone?.({ error: e?.message || "Couldn't clone template", tpl });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <i className="bi bi-cart-plus" />
          <span>Add "{tpl.name}" to a list</span>
        </span>
      }
    >
      <div className="lm-template-clone">
        <div className="lm-template-clone__modes" role="tablist" aria-label="Target list">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "new"}
            className={"lm-template-clone__mode" + (mode === "new" ? " is-active" : "")}
            onClick={() => setMode("new")}
          >
            <i className="bi bi-plus-square" /> Create new list
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "existing"}
            className={"lm-template-clone__mode" + (mode === "existing" ? " is-active" : "")}
            onClick={() => setMode("existing")}
            disabled={lists.length === 0}
          >
            <i className="bi bi-list-task" /> Add to existing
          </button>
        </div>

        {mode === "new" ? (
          <label className="lm-template-clone__field">
            <span className="lm-template-clone__label">List name</span>
            <input
              type="text"
              className="form-control"
              value={listName}
              maxLength={100}
              onChange={(e) => setListName(e.target.value)}
              placeholder="e.g. Weekly Groceries"
            />
            <span className="lm-template-clone__hint">
              <i className="bi bi-info-circle" /> A new list will be created and all template items added.
            </span>
          </label>
        ) : (
          <label className="lm-template-clone__field">
            <span className="lm-template-clone__label">Target list</span>
            <select
              className="form-select"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.role && l.role !== "owner" ? `(${l.role})` : ""}
                </option>
              ))}
            </select>
            <span className="lm-template-clone__hint">
              <i className="bi bi-info-circle" /> Items will be appended to this list.
            </span>
          </label>
        )}
      </div>

      <div className="lm-modal__footer" style={{ paddingTop: 16, borderTop: 0, marginTop: 12 }}>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={submitting || (mode === "existing" && !listId)}
        >
          {submitting ? <span className="lm-spinner" /> : <i className="bi bi-cart-plus" />}{" "}
          {submitting ? "Adding…" : "Add to list"}
        </button>
      </div>
    </Modal>
  );
}


export default function Templates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lists, setLists] = useState([]);
  const [activeTpl, setActiveTpl] = useState(null);
  const [cloneTpl, setCloneTpl] = useState(null);
  const [toasts, setToasts] = useState([]);

  const reqIdRef = useRef(0);

  // 300ms debounce for search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch templates when filters change
  useEffect(() => {
    if (!FEATURE_TEMPLATES || !user) return;
    const id = ++reqIdRef.current;
    setLoading(true);
    setError("");
    apiListTemplates({
      category: activeCategory || undefined,
      search: debouncedSearch.trim() || undefined,
    })
      .then((rows) => {
        if (id !== reqIdRef.current) return;
        setTemplates(Array.isArray(rows) ? rows : []);
      })
      .catch((e) => {
        if (id !== reqIdRef.current) return;
        setError(e?.message || "Failed to load templates");
        setTemplates([]);
      })
      .finally(() => {
        if (id === reqIdRef.current) setLoading(false);
      });
  }, [activeCategory, debouncedSearch, user]);

  // Fetch categories and lists once on mount
  useEffect(() => {
    if (!FEATURE_TEMPLATES) return;
    apiTemplateCategories()
      .then((c) => setCategories(Array.isArray(c) ? c : []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!FEATURE_TEMPLATES || !user) return;
    (async () => {
      try {
        const data = await safeGetLists(false);
        setLists(Array.isArray(data) ? data.filter((l) => !l.hidden) : []);
      } catch {
        setLists([]);
      }
    })();
  }, [user]);

  const pushToast = (toast) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, variant: "success", ...toast }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  };
  const dismissToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  function onCloneResult(result) {
    setCloneTpl(null);
    if (result?.error) {
      pushToast({ message: result.error, variant: "danger" });
      return;
    }
    const created = result.created_list;
    const list = lists.find((l) => l.id === Number(result.list_id));
    const listLabel = list?.name || result.list_name || "your list";
    const skipped = result.skipped?.length || 0;
    let msg = `${created ? "Created" : "Updated"} "${listLabel}" — added ${result.added} item${result.added === 1 ? "" : "s"}`;
    if (skipped > 0) msg += ` (skipped ${skipped} blank)`;
    pushToast({
      message: msg,
      variant: "success",
      action: { label: "Open list", listId: result.list_id },
    });
  }

  if (!FEATURE_TEMPLATES) {
    return (
      <div className="lm-container" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="lm-empty">
          <div className="lm-empty__art"><i className="bi bi-cone-striped" /></div>
          <h3 className="lm-empty__title">Templates are disabled</h3>
          <p className="lm-empty__desc">
            Set <code>REACT_APP_ENABLE_TEMPLATES=1</code> on the frontend to enable this page.
          </p>
        </div>
      </div>
    );
  }

  const hasAny = templates.length > 0;

  return (
    <div className="lm-container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <div className="lm-hero">
        <h1 className="lm-hero__title">List Templates</h1>
        <p className="lm-hero__subtitle">
          Curated starter lists. Pick one, add it to a new or existing list, and you're off to the races.
        </p>
      </div>

      <div className="lm-card lm-card--elevated lm-templates-toolbar">
        <div className="lm-card__body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="lm-templates-toolbar__row">
            <div className="lm-templates-search">
              <i className="bi bi-search" />
              <input
                type="text"
                className="form-control"
                placeholder="Search templates…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search templates"
              />
              {search && (
                <button
                  type="button"
                  className="lm-templates-search__clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <i className="bi bi-x-circle-fill" />
                </button>
              )}
            </div>
            {categories.length > 0 && (
              <div className="lm-templates-cats" role="tablist" aria-label="Filter by category">
                <button
                  type="button"
                  className={"lm-templates-cat" + (activeCategory === "" ? " is-active" : "")}
                  onClick={() => setActiveCategory("")}
                  role="tab"
                  aria-selected={activeCategory === ""}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={"lm-templates-cat" + (activeCategory === c ? " is-active" : "")}
                    onClick={() => setActiveCategory(c)}
                    role="tab"
                    aria-selected={activeCategory === c}
                  >
                    {CATEGORY_LABELS[c] || c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="lm-empty" style={{ padding: "32px 12px" }}>
          <div className="lm-empty__art"><span className="lm-spinner lm-spinner--lg" /></div>
          <p className="lm-empty__title">Loading templates…</p>
        </div>
      )}

      {error && !loading && (
        <div className="lm-alert" style={{ color: "var(--danger, #ef4444)" }}>
          <i className="bi bi-exclamation-triangle" /> {error}
        </div>
      )}

      {!loading && !error && !hasAny && (
        <div className="lm-empty" style={{ padding: "32px 12px" }}>
          <div className="lm-empty__art"><i className="bi bi-search" /></div>
          <h3 className="lm-empty__title">No templates match your filters</h3>
          <p className="lm-empty__desc">Try clearing the search or picking a different category.</p>
        </div>
      )}

      {!loading && !error && hasAny && (
        <div className="lm-templates-grid">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.slug}
              tpl={tpl}
              onClick={setActiveTpl}
              onClone={setCloneTpl}
            />
          ))}
        </div>
      )}

      {activeTpl && (
        <TemplateDetail
          tpl={activeTpl}
          onClose={() => setActiveTpl(null)}
          lists={lists}
          onCloned={(d) => { setActiveTpl(null); setCloneTpl(d); }}
        />
      )}

      {cloneTpl && (
        <CloneDialog
          tpl={cloneTpl}
          onClose={() => setCloneTpl(null)}
          lists={lists}
          onDone={onCloneResult}
        />
      )}

      <Toasts items={toasts} onDismiss={dismissToast} />
    </div>
  );
}
