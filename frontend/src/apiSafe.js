// Thin defensive wrapper around the API. Normalizes all responses so the
// rest of the app can safely call .map() / .find() on them. Falls back to
// in-memory demo data when the backend is unreachable or returns errors.

import * as api from "./api";
import { isDemo, demoGetLists, demoGetItems, demoGetShares, demoAddItem, demoUpdateItem, demoDeleteItem, demoCreateList, demoRenameList, demoDeleteList, demoHideList, demoUnhideList, demoAddShare, demoUpdateShare, demoRevokeShare, demoGetShareLink } from "./demo";

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (isPlainObject(v)) {
    if (Array.isArray(v.items)) return v.items;
    if (Array.isArray(v.data)) return v.data;
    if (Array.isArray(v.results)) return v.results;
  }
  return [];
}

function safeCall(fn, fallback) {
  try {
    const out = fn();
    if (out && typeof out.then === "function") {
      return out.catch(() => fallback);
    }
    return Promise.resolve(out ?? fallback);
  } catch {
    return Promise.resolve(fallback);
  }
}

export async function safeGetLists(includeHidden = false) {
  if (isDemo()) return demoGetLists(includeHidden);
  return safeCall(() => api.apiGetLists(includeHidden), []).then(toArray);
}

export async function safeGetItems(listId) {
  if (isDemo()) return demoGetItems(listId);
  return safeCall(() => api.apiGetItems(listId), []).then(toArray);
}

export async function safeGetShares(listId) {
  if (isDemo()) return demoGetShares();
  return safeCall(() => api.apiListShares(listId), []).then(toArray);
}

export async function safeAddItem(listId, patch) {
  if (isDemo()) return demoAddItem(listId, patch);
  return api.apiAddItem(listId, patch);
}

export async function safeUpdateItem(itemId, patch) {
  if (isDemo()) return demoUpdateItem(itemId, patch);
  return api.apiUpdateItem(itemId, patch);
}

export async function safeDeleteItem(itemId) {
  if (isDemo()) return demoDeleteItem(itemId);
  return api.apiDeleteItem(itemId);
}

export async function safeCreateList(name) {
  if (isDemo()) return demoCreateList(name);
  return api.apiCreateList(name);
}

export async function safeRenameList(listId, name) {
  if (isDemo()) return demoRenameList(listId, name);
  return api.apiRenameList(listId, name);
}

export async function safeDeleteList(listId) {
  if (isDemo()) return demoDeleteList(listId);
  return api.apiDeleteList(listId);
}

export async function safeHideList(listId) {
  if (isDemo()) return demoHideList(listId);
  return api.apiHideList(listId);
}

export async function safeUnhideList(listId) {
  if (isDemo()) return demoUnhideList(listId);
  return api.apiUnhideList(listId);
}

export async function safeAddShare(listId, { email, role }) {
  if (isDemo()) return demoAddShare(email, role);
  return api.apiCreateShare(listId, { email, role });
}

export async function safeUpdateShare(listId, shareId, { role }) {
  if (isDemo()) return demoUpdateShare(shareId, { role });
  return api.apiUpdateShare(listId, shareId, { role });
}

export async function safeRevokeShare(listId, shareId) {
  if (isDemo()) return demoRevokeShare(shareId);
  return api.apiRevokeShare(listId, shareId);
}

export async function safeGetShareLink(listId) {
  if (isDemo()) return demoGetShareLink(listId);
  const origin = (typeof window !== "undefined" && window.location && window.location.origin) || "";
  // Backend may return { url, token }; fall back to a /share/:id URL.
  return safeCall(() => api.apiGetShareLink(listId), { url: `${origin}/share/${listId}` })
    .then((r) => (r && r.url) || `${origin}/share/${listId}`);
}
