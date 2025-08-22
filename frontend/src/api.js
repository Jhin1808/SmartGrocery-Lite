// frontend/src/api.js
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";
export { API_BASE };

// We are cookie-based now: no Authorization header, no localStorage token needed.
async function request(path, { method = "GET", headers = {}, body } = {}) {
  const h = { ...headers };
  if (body && !(body instanceof FormData) && !h["Content-Type"]) {
    h["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: h,
    body,
    credentials: "include",       // <<— IMPORTANT for cookies
  });

  const ct = res.headers.get("content-type") || "";
  if (res.status === 204) return null;

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    if (ct.includes("application/json")) {
      const data = await res.json().catch(() => ({}));
      if (data?.detail) {
        message = Array.isArray(data.detail)
          ? data.detail.map(d => d.msg || d.detail || JSON.stringify(d)).join("\n")
          : (data.detail || message);
      } else if (data?.message) message = data.message;
      else message = JSON.stringify(data);
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

// Email/password login now sets cookie server-side; expect 204 on success
export async function apiLogin(email, password) {
  const params = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    credentials: "include",     // <<— IMPORTANT
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.detail || res.statusText);
  }
  return true; // cookie is set
}

export const apiLogout    = () => request("/auth/logout", { method: "POST" });
export const apiRegister  = ({ email, password }) =>
  request("/auth/register", { method: "POST", body: { email, password } });

export const apiGetLists   = () => request("/lists/");
export const apiCreateList = (name) => request("/lists/", { method: "POST", body: { name } });

export const apiGetItems   = (listId) => request(`/lists/${listId}/items`);
export const apiAddItem    = (listId, payload) => request(`/lists/${listId}/items`, { method: "POST", body: payload });
export const apiUpdateItem = (itemId, patch) => request(`/lists/items/${itemId}`, { method: "PATCH", body: patch });
export const apiDeleteItem = (itemId) => request(`/lists/items/${itemId}`, { method: "DELETE" });


// // src/api.js
// const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";
// export { API_BASE };

// // If you keep token for legacy/SO login, it's fine—but for cookie auth it’s not needed
// export function setToken(_) { /* no-op for cookie auth */ }

// async function request(path, { method = "GET", headers = {}, body } = {}) {
//   const h = { ...headers };
//   if (body && !(body instanceof FormData) && !h["Content-Type"]) {
//     h["Content-Type"] = "application/json";
//     body = JSON.stringify(body);
//   }

//   const res = await fetch(`${API_BASE}${path}`, {
//     method,
//     headers: h,
//     body,
//     credentials: "include",        // ✅ send/receive cookies
//   });

//   const ct = res.headers.get("content-type") || "";

//   if (res.status === 204) return null;

//   if (!res.ok) {
//     let message = `HTTP ${res.status}`;
//     if (ct.includes("application/json")) {
//       const data = await res.json().catch(() => ({}));
//       if (data?.detail) {
//         if (Array.isArray(data.detail)) {
//           message = data.detail.map(d => d.msg || d.detail || JSON.stringify(d)).join("\n");
//         } else if (typeof data.detail === "string") {
//           message = data.detail;
//         } else {
//           message = JSON.stringify(data.detail);
//         }
//       } else if (data?.message) {
//         message = data.message;
//       } else {
//         message = JSON.stringify(data);
//       }
//     } else {
//       const text = await res.text();
//       if (text) message = text;
//     }
//     const err = new Error(message);
//     err.status = res.status;
//     throw err;
//   }

//   return ct.includes("application/json") ? res.json() : res.text();
// }

// // ---------- Auth ----------
// export async function apiLogin(email, password) {
//   const params = new URLSearchParams({ username: email, password });
//   const res = await fetch(`${API_BASE}/auth/token`, {
//     method: "POST",
//     headers: { "Content-Type": "application/x-www-form-urlencoded" },
//     body: params.toString(),
//     credentials: "include",
//   });
//   if (!res.ok) {
//     const j = await res.json().catch(() => ({}));
//     throw new Error(j.detail || res.statusText);
//   }
//   // You may still return JSON, but you don't need to store a token
//   return res.json();
// }

// export const apiRegister = ({ email, password }) =>
//   request("/auth/register", { method: "POST", body: { email, password } });

// // ---------- Lists ----------
// export const apiGetLists   = () => request("/lists/");
// export const apiCreateList = (name) => request("/lists/", { method: "POST", body: { name } });

// // ---------- Items ----------
// export const apiGetItems   = (listId) => request(`/lists/${listId}/items`);
// export const apiAddItem    = (listId, { name, quantity = 1, expiry = null }) =>
//   request(`/lists/${listId}/items`, { method: "POST", body: { name, quantity, expiry } });
// export const apiUpdateItem = (itemId, patch) =>
//   request(`/lists/items/${itemId}`, { method: "PATCH", body: patch });
// export const apiDeleteItem = (itemId) =>
//   request(`/lists/items/${itemId}`, { method: "DELETE" });


// // src/api.js
// const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";
// export { API_BASE };

// let authToken = null;
// export function setToken(t) {
//   authToken = typeof t === "string" ? t : (t?.access_token || t?.token || null);
//   if (authToken) localStorage.setItem("token", authToken);
//   else localStorage.removeItem("token");
// }

// function authHeaders(extra = {}) {
//   const t = authToken || localStorage.getItem("token");
//   return t ? { ...extra, Authorization: `Bearer ${t}` } : extra;
// }

// async function request(path, { method = "GET", headers = {}, body } = {}) {
//   const h = { ...headers };
//   if (body && !(body instanceof FormData) && !h["Content-Type"]) {
//     h["Content-Type"] = "application/json";
//     body = JSON.stringify(body);
//   }

//   const res = await fetch(`${API_BASE}${path}`, {
//     method,
//     headers: authHeaders(h),
//     body,
//   });

//   const ct = res.headers.get("content-type") || "";

//   if (res.status === 204) return null;

//   if (!res.ok) {
//     let message = `HTTP ${res.status}`;
//     if (ct.includes("application/json")) {
//       const data = await res.json().catch(() => ({}));
//       if (data?.detail) {
//         if (Array.isArray(data.detail)) {
//           // Turn FastAPI validation error array into readable lines
//           message = data.detail.map(d => d.msg || d.detail || JSON.stringify(d)).join("\n");
//         } else if (typeof data.detail === "string") {
//           message = data.detail;
//         } else {
//           message = JSON.stringify(data.detail);
//         }
//       } else if (data?.message) {
//         message = data.message;
//       } else {
//         message = JSON.stringify(data);
//       }
//     } else {
//       const text = await res.text();
//       if (text) message = text;
//     }
//     const err = new Error(message);
//     err.status = res.status;
//     throw err;
//   }

//   return ct.includes("application/json") ? res.json() : res.text();
// }

// // ---------- Auth ----------
// export async function apiLogin(email, password) {
//   // If your backend expects JSON {email,password}, use this:
//   // const data = await request("/auth/token", { method: "POST", body: { email, password } });

//   // If your backend expects OAuth2 form (username/password), use this:
//   const params = new URLSearchParams({ username: email, password });
//   const res = await fetch(`${API_BASE}/auth/token`, {
//     method: "POST",
//     headers: { "Content-Type": "application/x-www-form-urlencoded" },
//     body: params.toString(),
//   });
//   if (!res.ok) {
//     const j = await res.json().catch(() => ({}));
//     throw new Error(j.detail || res.statusText);
//   }
//   const data = await res.json();
//   setToken(data?.access_token || data?.token);
//   return data;
// }

// // Match your caller: object arg with { email, password }
// export const apiRegister = ({ email, password }) =>
//   request("/auth/register", { method: "POST", body: { email, password } });



// // ---------- Lists ----------
// export const apiGetLists   = () => request("/lists/");
// export const apiCreateList = (name) => request("/lists/", { method: "POST", body: { name } });

// // ---------- Items ----------
// export const apiGetItems   = (listId) => request(`/lists/${listId}/items`);
// export const apiAddItem    = (listId, { name, quantity = 1, expiry = null }) =>
//   request(`/lists/${listId}/items`, { method: "POST", body: { name, quantity, expiry } });
// export const apiUpdateItem = (itemId, patch) =>
//   request(`/lists/items/${itemId}`, { method: "PATCH", body: patch });
// export const apiDeleteItem = (itemId) =>
//   request(`/lists/items/${itemId}`, { method: "DELETE" });
