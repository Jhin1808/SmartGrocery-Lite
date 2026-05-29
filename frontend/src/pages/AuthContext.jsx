import { createContext, useCallback, useContext, useEffect, useState } from "react";
// Clear any stale cached data from previous auth sessions
let __listsCache = null;
let __listsCacheHidden = null;
let __itemsCache = {};
const clearCaches = () => {
  try { window.__sg_listsCache = null; window.__sg_listsCacheHidden = null; window.__sg_itemsCache = {}; } catch {}
};
import { apiLogout, apiMe, AUTH_FALLBACK_STORAGE_KEY } from "../api";

const AuthCtx = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const u = await apiMe();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Avoid early /me on public routes; callback/login handle their own flow
    try {
      const path = window?.location?.pathname || "";
      const skip = ["/login", "/oauth/callback", "/reset", "/terms"];
      if (skip.some((p) => path.startsWith(p))) return;
    } catch {}
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      // Clear header token fallback
      try { localStorage.removeItem(AUTH_FALLBACK_STORAGE_KEY); } catch {}
      await apiLogout();
    } catch {}
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
