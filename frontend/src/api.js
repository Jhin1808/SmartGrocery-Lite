// src/api.js
const rawBase =
  process.env.REACT_APP_API_BASE ||
  "";
const API_BASE = rawBase.replace(/\/+$/, ""); // strip trailing slash if any
export { API_BASE };

// Safely join base + path
function joinUrl(base, path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

// Generic request helper (cookie-based auth)
async function request(path, { method = "GET", headers = {}, body } = {}) {
  const url = joinUrl(API_BASE, path);

  const h = { ...headers };
  // Bearer fallback for Safari/iOS when cookies are blocked
  try {
    const tok = localStorage.getItem("token");
    if (tok && !h["Authorization"]) h["Authorization"] = `Bearer ${tok}`;
  } catch {}
  let payload = body;
  if (payload && !(payload instanceof FormData) && !h["Content-Type"]) {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(payload);
  }

  const res = await fetch(url, {
    method,
    headers: h,
    body: payload,
    credentials: "include", // keep cookies
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

export const apiAddItem = (listId, { name, quantity = 1, expiry = null }) =>
  request(`/lists/${listId}/items`, {
    method: "POST",
    body: { name, quantity, expiry },
  });

export const apiUpdateItem = (itemId, patch) =>
  request(`/lists/items/${itemId}`, { method: "PATCH", body: patch });

export const apiDeleteItem = (itemId) =>
  request(`/lists/items/${itemId}`, { method: "DELETE" });

export const apiDeleteList = (listId) =>
  request(`/lists/${listId}`, { method: "DELETE" });

// Hide / Unhide
export const apiHideList = (listId) =>
  request(`/lists/${listId}/hide`, { method: "POST" });

export const apiUnhideList = (listId) =>
  request(`/lists/${listId}/unhide`, { method: "POST" });

// ---- Profile ----
export const apiUpdateMe = (patch) =>
  request("/me", { method: "PATCH", body: patch });

export const apiChangePassword = ({ current_password, new_password }) =>
  request("/auth/change-password", {
    method: "POST",
    body: { current_password, new_password },
  });

// ---- Password reset ----
export const apiForgotPassword = (email) =>
  request("/auth/forgot-password", { method: "POST", body: { email } });

export const apiResetPassword = ({ token, new_password }) =>
  request("/auth/reset-password", { method: "POST", body: { token, new_password } });

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

// Optional helper for Google login button in the SPA:
export const googleLoginUrl = () => joinUrl(API_BASE, "/auth/google/login");
