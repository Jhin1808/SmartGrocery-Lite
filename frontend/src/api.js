// src/api.js
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";
export { API_BASE };

// Generic request helper (cookie-based auth)
async function request(path, { method = "GET", headers = {}, body } = {}) {
  const h = { ...headers };
  let payload = body;
  if (payload && !(payload instanceof FormData) && !h["Content-Type"]) {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(payload);
  }

  const res = await fetch(`${API_BASE}${path}`, {
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
          message = data.detail.map(d => d.msg || d.detail || JSON.stringify(d)).join("\n");
        } else if (typeof data.detail === "string") {
          message = data.detail;
        } else {
          message = JSON.stringify(data.detail);
        }
      } else if (data?.message) {
        message = data.message;
      } else {
        message = JSON.stringify(data);
      }
    } else {
      const text = await res.text();
      if (text) message = text;
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return ct.includes("application/json") ? res.json() : res.text();
}

export async function apiLogin(email, password) {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    credentials: "include",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.detail || res.statusText);
  }
  // cookie is set by backend; nothing else to return
  return;
}


export const apiLogout   = () => request("/auth/logout", { method: "POST" });
export const apiRegister = ({ email, password }) =>
  request("/auth/register", { method: "POST", body: { email, password } });

export const apiMe       = () => request("/me");

// -------- Lists / Items --------
export const apiGetLists   = () => request("/lists/");
export const apiCreateList = (name) => request("/lists/", { method: "POST", body: { name } });

export const apiGetItems   = (listId) => request(`/lists/${listId}/items`);
export const apiAddItem    = (listId, { name, quantity = 1, expiry = null }) =>
  request(`/lists/${listId}/items`, { method: "POST", body: { name, quantity, expiry } });
export const apiUpdateItem = (itemId, patch) =>
  request(`/lists/items/${itemId}`, { method: "PATCH", body: patch });
export const apiDeleteItem = (itemId) =>
  request(`/lists/items/${itemId}`, { method: "DELETE" });

export const apiDeleteList = (listId) =>
  request(`/lists/${listId}`, { method: "DELETE" });

// Update profile (name, picture)
export const apiUpdateMe = (patch) =>
  request("/me", { method: "PATCH", body: patch });

// Change/set password
export const apiChangePassword = ({ current_password, new_password }) =>
  request("/auth/change-password", {
    method: "POST",
    body: { current_password, new_password },
  });

// Rename a list (owner-only)
export const apiRenameList = (listId, name) =>
  request(`/lists/${listId}`, { method: "PATCH", body: { name } });

// Sharing APIs (owner-only)
export const apiListShares   = (listId) => request(`/lists/${listId}/share`);
export const apiCreateShare  = (listId, { email, role }) =>
  request(`/lists/${listId}/share`, { method: "POST", body: { email, role } });

export const apiUpdateShare  = (listId, shareId, { role }) =>
+  request(`/lists/${listId}/share/${shareId}`, { method: "PATCH", body: { role } });

export const apiRevokeShare  = (listId, shareId) =>
  request(`/lists/${listId}/share/${shareId}`, { method: "DELETE" });