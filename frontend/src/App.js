import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import AuthTabs from "./pages/AuthTabs";
import Lists from "./pages/Lists";
import ListDetail from "./pages/ListDetail";
import Account from "./pages/Account";
import Help from "./pages/Help";
import OAuthCallback from "./pages/OAuthCallback";
import Terms from "./pages/Terms";

import NavBar from "./components/NavBar";

import { AuthProvider, useAuth } from "./pages/AuthContext";

// Guard
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;             // or a spinner
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function AppShell() {
  const { user } = useAuth();           // <— if no user, hide the NavBar entirely
  return (
    <>
      {user ? <NavBar /> : null}
      <div className="container py-4">
        <Routes>
          <Route path="/" element={<Navigate to={user ? "/lists" : "/login"} replace />} />

          {/* Public */}
          <Route path="/login" element={<AuthTabs />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/terms" element={<Terms />} />

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
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}
