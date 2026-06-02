import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiLogout, apiMe, AUTH_FALLBACK_STORAGE_KEY } from "../api";
import { isDemo, demoGetUser, enterDemo, exitDemo } from "../demo";

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
      if (isDemo()) {
        setUser(demoGetUser());
        return;
      }
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
    if (isDemo()) {
      setUser(demoGetUser());
      setLoading(false);
      return;
    }
    try {
      const path = window?.location?.pathname || "";
      const skip = ["/login", "/oauth/callback", "/reset", "/terms"];
      if (skip.some((p) => path.startsWith(p))) {
        setLoading(false);
        return;
      }
    } catch {}
    refresh();
  }, [refresh]);

  const loginAsDemo = useCallback(() => {
    enterDemo();
    setUser(demoGetUser());
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    if (isDemo()) {
      exitDemo();
      clearSessionCaches();
      setUser(null);
      return;
    }
    try {
      try { localStorage.removeItem(AUTH_FALLBACK_STORAGE_KEY); } catch {}
      await apiLogout();
    } catch {}
    clearSessionCaches();
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, refresh, logout, loginAsDemo, isDemo: isDemo() }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
