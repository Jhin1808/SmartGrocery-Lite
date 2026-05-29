import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiLogout, apiMe, AUTH_FALLBACK_STORAGE_KEY } from "../api";

const AuthCtx = createContext({ user: null, loading: true });

export function clearSessionCaches() {
  if (typeof window === "undefined") return;
  window.__sg_listsCache = { data: null, hidden: false, time: 0 };
  window.__sg_listsCacheHidden = { data: null, hidden: true, time: 0 };
  window.__sg_itemsCache = {};
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const u = await apiMe();
      setUser(u);
    } catch {
      clearSessionCaches();
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
    clearSessionCaches();
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
