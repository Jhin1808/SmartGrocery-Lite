import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { API_BASE } from "./api"; // cookie-based auth; we only need the URL

// pages
import AuthTabs from "./pages/AuthTabs";
import Lists from "./pages/Lists";
import ListDetail from "./pages/ListDetail";
import Account from "./pages/Account";
import Help from "./pages/Help";
import OAuthCallback from "./pages/OAuthCallback";

// navbar
import NavBar from "./components/NavBar";

// Guard that checks the cookie session by calling /me
function RequireAuth({ children }) {
  const [ok, setOk] = useState(null); // null = loading; true/false = result
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/me/`, { credentials: "include" });
        if (!cancelled) setOk(res.ok);
      } catch {
        if (!cancelled) setOk(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (ok === null) return <div className="container py-4">Checking session…</div>;
  if (!ok) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function AppRoutes({ onLoggedIn }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/lists" replace />} />

      {/* Public */}
      <Route path="/login" element={<AuthTabs onLoggedIn={onLoggedIn} />} />
      <Route path="/oauth/callback" element={<OAuthCallback />} />

      {/* Protected */}
      <Route
        path="/lists"
        element={
          <RequireAuth>
            <Lists />
          </RequireAuth>
        }
      />
      <Route
        path="/lists/:id"
        element={
          <RequireAuth>
            <ListDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/account"
        element={
          <RequireAuth>
            <Account />
          </RequireAuth>
        }
      />
      <Route
        path="/help"
        element={
          <RequireAuth>
            <Help />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/lists" replace />} />
    </Routes>
  );
}

export default function App() {
  // After a successful login (email/pw or Google), backend sets cookie.
  // We just navigate to /lists.
  const onLoggedIn = () => {
    window.location.replace("/lists");
  };

  return (
    <BrowserRouter>
      <NavBar />
      <div className="container py-4">
        <AppRoutes onLoggedIn={onLoggedIn} />
      </div>
    </BrowserRouter>
  );
}
