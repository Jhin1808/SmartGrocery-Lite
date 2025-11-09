import React, { Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./pages/AuthContext";

// Code-split pages to reduce initial JS for login route
const AuthTabs = React.lazy(() => import("./pages/AuthTabs"));
const Lists = React.lazy(() => import("./pages/Lists"));
const ListDetail = React.lazy(() => import("./pages/ListDetail"));
const Account = React.lazy(() => import("./pages/Account"));
const Help = React.lazy(() => import("./pages/Help"));
const OAuthCallback = React.lazy(() => import("./pages/OAuthCallback"));
const Terms = React.lazy(() => import("./pages/Terms"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));

const NavBar = React.lazy(() => import("./components/NavBar"));

// Guard
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null; // or a spinner
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function AppShell() {
  const { user } = useAuth(); // if no user, hide the NavBar entirely
  // Load Bootstrap Icons CSS only after auth to reduce initial bytes on /login
  useEffect(() => {
    if (user) {
      import("bootstrap-icons/font/bootstrap-icons.css");
    }
  }, [user]);

  return (
    <>
      <Suspense fallback={null}>{user ? <NavBar /> : null}</Suspense>
      <div className="container py-4">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Navigate to={user ? "/lists" : "/login"} replace />} />

            {/* Public */}
            <Route path="/login" element={<AuthTabs />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/reset" element={<ResetPassword />} />
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
        </Suspense>
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
