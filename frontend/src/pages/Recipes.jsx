import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  apiRecipeSearch,
  apiRecipeDetail,
  apiRecipeAddToList,
  FEATURE_RECIPES,
} from "../api";
import { safeGetLists } from "../apiSafe";
import { useAuth } from "./AuthContext";
import { isDemo, subscribeDemo } from "../demo";

const SUGGESTIONS = ["chicken", "pasta", "rice", "beef", "salad", "fish", "potato", "egg", "cheese", "tomato"];

function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
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

function RecipeCard({ recipe, onClick }) {
  return (
    <button
      type="button"
      className="lm-recipe-card"
      onClick={() => onClick(recipe)}
    >
      <div className="lm-recipe-card__media">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        ) : (
          <span className="lm-recipe-card__placeholder">
            <i className="bi bi-egg-fried" />
          </span>
        )}
        {recipe.area && <span className="lm-recipe-card__area">{recipe.area}</span>}
      </div>
      <div className="lm-recipe-card__body">
        <h3 className="lm-recipe-card__title">{recipe.title || "Untitled"}</h3>
        <div className="lm-recipe-card__meta">
          {recipe.category && <span className="lm-recipe-card__cat"><i className="bi bi-tag" /> {recipe.category}</span>}
          {recipe.source_url && <span className="lm-recipe-card__src"><i className="bi bi-link-45deg" /> Source</span>}
        </div>
      </div>
    </button>
  );
}

function RecipeDetail({ recipeId, onClose, lists, onAdded }) {
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [targetListId, setTargetListId] = useState(lists[0]?.id || "");
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setRecipe(null);
    setAddResult(null);
    apiRecipeDetail(recipeId)
      .then((r) => { if (alive) setRecipe(r); })
      .catch((e) => { if (alive) setError(e?.message || "Failed to load recipe"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [recipeId]);

  async function onAdd() {
    if (!targetListId || !recipe) return;
    setAdding(true);
    setAddResult(null);
    try {
      const result = await apiRecipeAddToList(recipe.external_id, Number(targetListId));
      setAddResult(result);
      onAdded?.(result);
    } catch (e) {
      setAddResult({ error: e?.message || "Couldn't add to list" });
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={recipe?.title || "Recipe"}
      wide
    >
      {loading && (
        <div className="lm-empty" style={{ padding: "32px 12px" }}>
          <div className="lm-empty__art"><span className="lm-spinner lm-spinner--lg" /></div>
          <p className="lm-empty__title">Loading recipe…</p>
        </div>
      )}
      {error && !loading && (
        <div className="lm-alert" style={{ color: "var(--danger, #ef4444)" }}>
          <i className="bi bi-exclamation-triangle" /> {error}
        </div>
      )}
      {recipe && !loading && (
        <div className="lm-recipe-detail">
          {recipe.image_url && (
            <div className="lm-recipe-detail__hero">
              <img src={recipe.image_url} alt="" />
              <div className="lm-recipe-detail__hero-meta">
                {recipe.category && <span className="lm-badge"><i className="bi bi-tag" /> {recipe.category}</span>}
                {recipe.area && <span className="lm-badge"><i className="bi bi-globe" /> {recipe.area}</span>}
                {recipe.ready_minutes && <span className="lm-badge"><i className="bi bi-clock" /> {recipe.ready_minutes} min</span>}
                {recipe.servings && <span className="lm-badge"><i className="bi bi-people" /> Serves {recipe.servings}</span>}
              </div>
            </div>
          )}

          <div className="lm-recipe-detail__section">
            <h3 className="lm-recipe-detail__h3">
              <i className="bi bi-basket" /> Ingredients
              <span className="lm-recipe-detail__count">{(recipe.ingredients || []).filter((i) => (i.name || "").trim()).length}</span>
            </h3>
            {(recipe.ingredients || []).length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13 }}>No ingredients listed.</p>
            ) : (
              <ul className="lm-recipe-detail__ingredients">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className={"lm-recipe-detail__ing" + ((ing.name || "").trim() ? "" : " is-empty")}>
                    {ing.image_url && <img className="lm-recipe-detail__ing-img" src={ing.image_url} alt="" />}
                    <span className="lm-recipe-detail__ing-name">{ing.name || <em>(empty)</em>}</span>
                    {ing.measure && <span className="lm-recipe-detail__ing-measure">{ing.measure}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lm-recipe-detail__add">
            <h3 className="lm-recipe-detail__h3">
              <i className="bi bi-cart-plus" /> Add to list
            </h3>
            {lists.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13 }}>
                You don't have any lists yet. <Link to="/lists">Create one</Link> first.
              </p>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  className="form-select"
                  value={targetListId}
                  onChange={(e) => setTargetListId(e.target.value)}
                  style={{ height: 40, maxWidth: 280 }}
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onAdd}
                  disabled={adding || !targetListId}
                >
                  {adding ? <span className="lm-spinner" /> : <i className="bi bi-plus-lg" />}
                  {adding ? "Adding…" : "Add ingredients"}
                </button>
                {recipe.source_url && (
                  <a
                    href={recipe.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    <i className="bi bi-box-arrow-up-right" /> Full recipe
                  </a>
                )}
              </div>
            )}
            {addResult && !addResult.error && (
              <div className="lm-recipe-detail__result lm-recipe-detail__result--ok">
                <i className="bi bi-check-circle" /> Added {addResult.added} ingredient{addResult.added === 1 ? "" : "s"}
                {addResult.skipped && addResult.skipped.length > 0 && (
                  <span className="text-muted" style={{ fontSize: 12, marginLeft: 6 }}>
                    · skipped {addResult.skipped.length}
                  </span>
                )}
              </div>
            )}
            {addResult?.error && (
              <div className="lm-recipe-detail__result lm-recipe-detail__result--err">
                <i className="bi bi-x-circle" /> {addResult.error}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Recipes() {
  const { user } = useAuth();
  const [mode, setMode] = useState("name"); // "name" | "ingredient"
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 350);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeRecipeId, setActiveRecipeId] = useState(null);
  const [lists, setLists] = useState([]);
  const [toasts, setToasts] = useState([]);

  const reqIdRef = useMemo(() => ({ current: 0 }), []);

  useEffect(() => {
    if (!FEATURE_RECIPES) return;
    (async () => {
      try {
        const data = await safeGetLists(false);
        setLists(Array.isArray(data) ? data.filter((l) => !l.hidden) : []);
      } catch {
        // non-fatal; we'll show a "no lists" hint
      }
    })();
  }, []);

  useEffect(() => {
    if (!isDemo()) return;
    const unsub = subscribeDemo(() => {
      // demo state changed; just refresh lists
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = (debounced || "").trim();
    if (!q) {
      setResults([]);
      setError("");
      return;
    }
    const id = ++reqIdRef.current;
    setLoading(true);
    setError("");
    apiRecipeSearch(mode === "ingredient" ? { ingredient: q } : { q })
      .then((rows) => {
        if (id !== reqIdRef.current) return;
        setResults(Array.isArray(rows) ? rows : []);
      })
      .catch((e) => {
        if (id !== reqIdRef.current) return;
        setError(e?.message || "Search failed");
        setResults([]);
      })
      .finally(() => {
        if (id === reqIdRef.current) setLoading(false);
      });
  }, [debounced, mode, user, reqIdRef]);

  const pushToast = (toast) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, variant: "success", ...toast }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };
  const dismissToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  function onAddedToList(result) {
    if (result?.error) {
      pushToast({ message: result.error, variant: "danger" });
      return;
    }
    const list = lists.find((l) => l.id === Number(result?.listId));
    const skipped = result?.skipped?.length || 0;
    let msg = `Added ${result.added} ingredient${result.added === 1 ? "" : "s"}`;
    if (list) msg += ` to "${list.name}"`;
    if (skipped > 0) msg += ` (skipped ${skipped})`;
    pushToast({ message: msg, variant: "success" });
  }

  if (!FEATURE_RECIPES) {
    return (
      <div className="lm-container" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="lm-empty">
          <div className="lm-empty__art"><i className="bi bi-cone-striped" /></div>
          <h3 className="lm-empty__title">Recipes are disabled</h3>
          <p className="lm-empty__desc">Set <code>REACT_APP_ENABLE_RECIPES=1</code> on the frontend to enable this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lm-container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <div className="lm-hero">
        <h1 className="lm-hero__title">Recipes</h1>
        <p className="lm-hero__subtitle">Find a recipe and add its ingredients to any list with one tap.</p>
      </div>

      <div className="lm-card lm-card--elevated">
        <div className="lm-card__body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="lm-recipes-search">
            <div className="lm-recipes-search__mode" role="tablist" aria-label="Search mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "name"}
                className={"lm-recipes-search__mode-btn" + (mode === "name" ? " is-active" : "")}
                onClick={() => { setMode("name"); setQuery(""); }}
              >
                <i className="bi bi-search" /> By name
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "ingredient"}
                className={"lm-recipes-search__mode-btn" + (mode === "ingredient" ? " is-active" : "")}
                onClick={() => { setMode("ingredient"); setQuery(""); }}
              >
                <i className="bi bi-basket" /> By ingredient
              </button>
            </div>
            <div className="lm-recipes-search__input">
              <i className="bi bi-search" />
              <input
                type="text"
                className="form-control"
                placeholder={mode === "ingredient" ? "e.g. chicken, rice, tomato…" : "e.g. carbonara, stir fry…"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                style={{ height: 44, paddingLeft: 38 }}
              />
              {loading && <span className="lm-recipes-search__spinner"><span className="lm-spinner" /></span>}
            </div>
          </div>

          {!query && (
            <div className="lm-recipes-suggestions">
              <span className="eyebrow" style={{ fontSize: 11, color: "var(--text-muted)" }}>Try:</span>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="lm-recipes-suggestion"
                  onClick={() => setQuery(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="lm-alert" style={{ color: "var(--danger, #ef4444)", fontSize: 13 }}>
              <i className="bi bi-exclamation-triangle" /> {error}
            </div>
          )}

          {query && !loading && !error && results.length === 0 && (
            <div className="lm-empty" style={{ padding: "36px 12px" }}>
              <div className="lm-empty__art"><i className="bi bi-search" /></div>
              <h3 className="lm-empty__title">No recipes found</h3>
              <p className="lm-empty__desc">
                Try a different {mode === "ingredient" ? "ingredient" : "name"} or check your spelling.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="lm-recipes-grid">
              {results.map((r) => (
                <RecipeCard
                  key={r.external_id}
                  recipe={r}
                  onClick={(recipe) => setActiveRecipeId(recipe.external_id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {activeRecipeId && (
        <RecipeDetail
          recipeId={activeRecipeId}
          lists={lists}
          onClose={() => setActiveRecipeId(null)}
          onAdded={onAddedToList}
        />
      )}

      <Toasts items={toasts} onDismiss={dismissToast} />
    </div>
  );
}
