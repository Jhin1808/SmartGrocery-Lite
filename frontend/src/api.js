// src/api.js
const rawBase = process.env.REACT_APP_API_BASE || "";
const API_BASE = rawBase.replace(/\/+$/, "");
export { API_BASE };

export const AUTH_FALLBACK_STORAGE_KEY =
  process.env.REACT_APP_AUTH_FALLBACK_STORAGE_KEY || "token";
export const TOKEN_FRAGMENT_PARAM =
  process.env.REACT_APP_TOKEN_FRAGMENT_PARAM || "access_token";
export const AUTH_HEADER_FALLBACK_ENABLED = ["1", "true", "yes", "on"].includes(
  (process.env.REACT_APP_AUTH_HEADER_FALLBACK_ENABLED || "").toLowerCase()
);

function joinUrl(base, path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function request(path, { method = "GET", headers = {}, body } = {}) {
  const url = joinUrl(API_BASE, path);

  const h = { ...headers };
  // Bearer fallback is opt-in; default auth is the HttpOnly cookie.
  if (AUTH_HEADER_FALLBACK_ENABLED) {
    try {
      const tok = localStorage.getItem(AUTH_FALLBACK_STORAGE_KEY);
      if (tok && !h["Authorization"]) h["Authorization"] = `Bearer ${tok}`;
    } catch {}
  }
  let payload = body;
  if (payload && !(payload instanceof FormData) && !h["Content-Type"]) {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(payload);
  }

  const res = await fetch(url, {
    method,
    headers: h,
    body: payload,
    credentials: "include",
    cache: "no-store",
  });

  const ct = res.headers.get("content-type") || "";

  if (res.status === 204) return null;

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    if (ct.includes("application/json")) {
      const data = await res.json().catch(() => ({}));
      if (data?.detail) {
        if (Array.isArray(data.detail)) {
          message = data.detail
            .map((d) => d.msg || d.detail || JSON.stringify(d))
            .join("\n");
        } else if (typeof data.detail === "string") {
          message = data.detail;
        } else {
          message = JSON.stringify(data.detail);
        }
      } else if (data?.message) {
        message = data.message;
      } else if (Object.keys(data).length) {
        message = JSON.stringify(data);
      }
    } else {
      const text = await res.text().catch(() => "");
      if (text) message = text;
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return ct.includes("application/json") ? res.json() : res.text();
}

// ---- Auth ----
export async function apiLogin(email, password) {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(joinUrl(API_BASE, "/auth/token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    credentials: "include",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.detail || res.statusText);
  }
  // Cookie set by backend; also optionally return token JSON
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = await res.json().catch(() => null);
    return data;
  }
}

export const apiLogout = () => request("/auth/logout", { method: "POST" });
export const apiRegister = ({ email, password }) =>
  request("/auth/register", { method: "POST", body: { email, password } });

export const apiMe = () => request("/me");

// ---- Lists / Items ----
export const apiGetLists = (includeHidden = false) => {
  const qs = includeHidden ? `?${new URLSearchParams({ include_hidden: "1" })}` : "";
  return request(`/lists/${qs}`);
};

export const apiCreateList = (name) =>
  request("/lists/", { method: "POST", body: { name } });

export const apiGetItems = (listId) => request(`/lists/${listId}/items`);

const _pickCatalogFields = (p) => {
  if (!p) return undefined;
  const out = {};
  const keys = [
    "category", "subcategory", "weight_value", "weight_unit",
    "brand", "barcode", "product_image_url",
    "price", "price_source", "store_id", "nutrition_json",
  ];
  for (const k of keys) {
    if (k in p && p[k] !== undefined) out[k] = p[k];
  }
  return Object.keys(out).length ? out : undefined;
};

export const apiAddItem = (listId, payload) => {
  const body = {
    name: payload.name,
    quantity: payload.quantity ?? 1,
    expiry: payload.expiry ?? null,
    description: payload.description,
    remind_on: payload.remind_on,
    purchased: payload.purchased,
    ...(_pickCatalogFields(payload) || {}),
  };
  return request(`/lists/${listId}/items`, { method: "POST", body });
};

export const apiUpdateItem = (itemId, patch) => {
  const body = { ...patch };
  const cat = _pickCatalogFields(patch);
  if (cat) Object.assign(body, cat);
  return request(`/lists/items/${itemId}`, { method: "PATCH", body });
};

export const apiDeleteItem = (itemId) =>
  request(`/lists/items/${itemId}`, { method: "DELETE" });

export const apiDeleteList = (listId) =>
  request(`/lists/${listId}`, { method: "DELETE" });

// Hide / Unhide
export const apiHideList = (listId) =>
  request(`/lists/${listId}/hide`, { method: "POST" });

export const apiUnhideList = (listId) =>
  request(`/lists/${listId}/hide`, { method: "DELETE" });
// ---- Leave a shared list (non-owner) ----
export const apiLeaveSharedList = (listId) =>
  request(`/lists/${listId}/share/leave`, { method: "POST" });

// ---- Profile ----
export const apiUpdateMe = (patch) =>
  request("/me", { method: "PATCH", body: patch });

export const apiChangePassword = ({ current_password, new_password }) =>
  request("/auth/change-password", {
    method: "POST",
    body: { current_password, new_password },
  });

// ---- Password reset ----
export const apiForgotPassword = (email, captcha_token) =>
  request("/auth/forgot-password", { method: "POST", body: { email, captcha_token } });

export const apiResetPassword = ({ token, code, email, new_password }) => {
  const body = { new_password };
  if (token) body.token = token;
  if (code) {
    body.code = code;
    if (email) body.email = email;
  }
  return request("/auth/reset-password", { method: "POST", body });
};

// ---- List rename ----
export const apiRenameList = (listId, name) =>
  request(`/lists/${listId}`, { method: "PATCH", body: { name } });

// ---- Sharing (owner-only) ----
export const apiListShares = (listId) => request(`/lists/${listId}/share`);

export const apiCreateShare = (listId, { email, role }) =>
  request(`/lists/${listId}/share`, { method: "POST", body: { email, role } });

export const apiUpdateShare = (listId, shareId, { role }) =>
  request(`/lists/${listId}/share/${shareId}`, { method: "PATCH", body: { role } });

export const apiRevokeShare = (listId, shareId) =>
  request(`/lists/${listId}/share/${shareId}`, { method: "DELETE" });

// Optional — backend may implement a signed share link endpoint. Wrapped
// safely; if the backend doesn't support it, the UI falls back to a
// /share/:id URL of the current origin.
export const apiGetShareLink = (listId) =>
  request(`/lists/${listId}/share-link`);

// Optional helper for Google login button in the SPA:
export const googleLoginUrl = () => joinUrl(API_BASE, "/auth/google/login");

// ---- Feature flags (catalog / stores / recipes) ----
export const FEATURE_CATALOG = ["1", "true", "yes", "on"].includes(
  (process.env.REACT_APP_ENABLE_CATALOG || "1").toLowerCase()
);
export const FEATURE_KROGER = ["1", "true", "yes", "on"].includes(
  (process.env.REACT_APP_ENABLE_KROGER || "1").toLowerCase()
);
export const FEATURE_RECIPES = ["1", "true", "yes", "on"].includes(
  (process.env.REACT_APP_ENABLE_RECIPES || "1").toLowerCase()
);
export const FEATURE_TEMPLATES = ["1", "true", "yes", "on"].includes(
  (process.env.REACT_APP_ENABLE_TEMPLATES || "1").toLowerCase()
);

// ---- Catalog (M1+) ----
export const apiCatalogSearch = ({ q, category, page = 1, pageSize = 10, useKroger = true } = {}) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  params.set("use_kroger", useKroger ? "1" : "0");
  return request(`/catalog/search?${params.toString()}`);
};

export const apiCatalogBarcode = (ean, { useKroger = true } = {}) =>
  request(`/catalog/barcode/${encodeURIComponent(ean)}?use_kroger=${useKroger ? "1" : "0"}`);

export const apiCatalogCategories = () => request("/catalog/categories");

// ---- Kroger / Stores (M1+) ----
export const apiKrogerStatus = () => request("/auth/kroger/status");

export const apiKrogerChains = () => request("/stores/chains");

export const apiStoreSearch = ({ zip, lat, lng, radius = 10, limit = 10, chain } = {}) => {
  const params = new URLSearchParams();
  if (zip) params.set("zip", zip);
  if (lat != null) params.set("lat", String(lat));
  if (lng != null) params.set("lng", String(lng));
  params.set("radius", String(radius));
  params.set("limit", String(limit));
  if (chain) params.set("chain", chain);
  return request(`/stores/search?${params.toString()}`);
};

export const apiConnectedStore = () => request("/stores/connected");

export const apiConnectStore = (payload) =>
  request("/stores/connect", { method: "POST", body: payload });

export const apiDisconnectStore = () =>
  request("/stores/connected", { method: "DELETE" });

// ---- Recipes (M1+, full UI in M4) ----
export const apiRecipeSearch = ({ q, ingredient } = {}) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (ingredient) params.set("ingredient", ingredient);
  return request(`/recipes/search?${params.toString()}`);
};

export const apiRecipeDetail = (externalId) =>
  request(`/recipes/${encodeURIComponent(externalId)}`);

export const apiRecipeAddToList = (externalId, listId) =>
  request(`/recipes/${encodeURIComponent(externalId)}/to-list/${listId}`, { method: "POST" });

// ---- List Templates (M5) ----
export const apiListTemplates = ({ category, search } = {}) => {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (search) params.set("search", search);
  const qs = params.toString();
  return request(`/templates${qs ? `?${qs}` : ""}`);
};

export const apiTemplateCategories = () => request("/templates/categories");

export const apiGetTemplate = (slug) =>
  request(`/templates/${encodeURIComponent(slug)}`);

export const apiCloneTemplate = (slug, { list_id, list_name } = {}) =>
  request(`/templates/${encodeURIComponent(slug)}/clone`, {
    method: "POST",
    body: { list_id, list_name },
  });
