import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiLogout, apiMe } from "../api";

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
      try { localStorage.removeItem("token"); } catch {}
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
