const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";
export { API_BASE };

let token = null;
export function setToken(t) { token = t; }

async function request(path, { method="GET", headers={}, body } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData) && !h["Content-Type"]) {
    h["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, { method, headers: h, body });

  const raw = await res.text(); // read once
  const tryJson = () => {
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  };

  if (!res.ok) {
    const err = tryJson();
    const msg = (err && (err.detail || err.message)) || raw || res.statusText;
    throw new Error(msg);
  }

  // 204 No Content, or empty body → return null
  if (!raw) return null;
  const data = tryJson();
  return data ?? raw;
}

// async function request(path, { method="GET", headers={}, body } = {}) {
//   const h = { ...headers };
//   if (token) h.Authorization = `Bearer ${token}`;
//   if (body && !(body instanceof FormData) && !h["Content-Type"]) {
//     h["Content-Type"] = "application/json";
//     body = JSON.stringify(body);
//   }
//   const res = await fetch(`${API_BASE}${path}`, { method, headers: h, body });
//   if (!res.ok) {
//     let msg = res.statusText;
//     try { const j = await res.json(); msg = j.detail || JSON.stringify(j); } catch {}
//     throw new Error(msg);
//   }
//   return res.json();
// }

export async function apiLogin(email, password) {
  const params = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.detail || JSON.stringify(j); } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  setToken(data.access_token);
  return data.access_token;
}

export const apiRegister  = (email, password) => request("/auth/register", { method:"POST", body:{ email, password } });
export const apiGetLists  = () => request("/lists");
export const apiCreateList= (name) => request("/lists/", { method:"POST", body:{ name } });


// add these exports next to your existing ones
export const apiGetItems = (listId) =>
  request(`/lists/${listId}/items`);

export const apiAddItem = (listId, { name, quantity = 1, expiry = null }) =>
  request(`/lists/${listId}/items`, {
    method: "POST",
    body: { name, quantity, expiry }, // expiry as 'YYYY-MM-DD' or null
  });


export const apiUpdateItem = (itemId, patch) =>
  request(`/lists/items/${itemId}`, { method: "PATCH", body: patch });

export const apiDeleteItem = (itemId) =>
  request(`/lists/items/${itemId}`, { method: "DELETE" });
