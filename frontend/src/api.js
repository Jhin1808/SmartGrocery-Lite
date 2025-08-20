const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

let token = null;
export function setToken(t) { token = t; }
export function getToken() { return token; }

async function request(path, { method = "GET", headers = {}, body } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData) && !h["Content-Type"]) {
    h["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, { method, headers: h, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

// auth
export async function apiLogin(email, password) {
  const params = new URLSearchParams();
  params.append("username", email);
  params.append("password", password);
  const res = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Login failed");
  }
  const data = await res.json();
  setToken(data.access_token);
  return data.access_token;
}

// lists
export const apiGetLists = () => request("/lists");
export const apiCreateList = (name) => request("/lists/", { method: "POST", body: { name } });

export default request;
