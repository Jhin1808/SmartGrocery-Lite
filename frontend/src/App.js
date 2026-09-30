import React, { Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./pages/AuthContext";

const Landing = React.lazy(() => import("./pages/Landing"));
const Fridge = React.lazy(() => import("./pages/Fridge"));
const AuthTabs = React.lazy(() => import("./pages/EnhancedAuthTabs"));
const Lists = React.lazy(() => import("./pages/EnhancedLists"));
const ListDetail = React.lazy(() => import("./pages/ListDetail"));
const Account = React.lazy(() => import("./pages/Account"));
const Help = React.lazy(() => import("./pages/Help"));
const OAuthCallback = React.lazy(() => import("./pages/OAuthCallback"));
const Terms = React.lazy(() => import("./pages/Terms"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const Stores = React.lazy(() => import("./pages/Stores"));
const Recipes = React.lazy(() => import("./pages/Recipes"));
const Templates = React.lazy(() => import("./pages/Templates"));
const NavBar = React.lazy(() => import("./components/NavBar"));

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/lists" replace /> : children;
}

function AppShell() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  useEffect(() => {
    const titles = {"/": "Groceries for shared kitchens", "/login": "Sign in", "/lists": "Grocery lists", "/fridge": "My fridge", "/stores": "Stores", "/recipes": "Recipes", "/templates": "List templates", "/account": "Account"};
    document.title = `${titles[pathname] || "Your kitchen"} · ToBuyLists`;
  }, [pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Suspense fallback={null}>
        {user && <NavBar />}
      </Suspense>
      <main id="main-content" tabIndex={-1} className={"app-main" + (user ? " app-main--nav" : "")}>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={user ? <Navigate to="/lists" replace /> : <Landing />} />
            <Route path="/fridge" element={<RequireAuth><Fridge /></RequireAuth>} />

            <Route path="/login" element={<PublicOnly><AuthTabs /></PublicOnly>} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/reset" element={<ResetPassword />} />
            <Route path="/terms" element={<Terms />} />

            <Route path="/lists" element={<RequireAuth><Lists /></RequireAuth>} />
            <Route path="/lists/:id" element={<RequireAuth><ListDetail /></RequireAuth>} />
            <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
            <Route path="/help" element={<RequireAuth><Help /></RequireAuth>} />
            <Route path="/stores" element={<RequireAuth><Stores /></RequireAuth>} />
            <Route path="/recipes" element={<RequireAuth><Recipes /></RequireAuth>} />
            <Route path="/templates" element={<RequireAuth><Templates /></RequireAuth>} />

            <Route path="*" element={<Navigate to="/lists" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
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
