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
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.detail || JSON.stringify(j); } catch {}
    throw new Error(msg);
  }
  return res.json();
}

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
