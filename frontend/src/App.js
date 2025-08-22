// import { useState } from "react";
// import { setToken } from "./api";
// import AuthTabs from "./pages/AuthTabs";
// import Lists from "./pages/Lists";


// export default function App() {
//   const [token, setTok] = useState(null);
//   const onLoggedIn = (t) => { setTok(t); setToken(t); };
//   const logout = () => { setTok(null); setToken(null); };

//   if (!token) return <AuthTabs onLoggedIn={onLoggedIn} />;

//   return (
//     <div>
//       <div className="header">
//         <button className="btn-ghost" onClick={logout}>Log out</button>
//       </div>
//       <Lists />
//     </div>
//   );
// }
// src/App.js
// src/App.js
import React, { useEffect} from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { setToken as setApiToken } from "./api";

// pages you already have/added
import AuthTabs from "./pages/AuthTabs";
import Lists from "./pages/Lists";
import ListDetail from "./pages/ListDetail";
import Account from "./pages/Account";
import Help from "./pages/Help";

// navbar
import NavBar from "./components/NavBar";

// Protect routes by checking localStorage token
function RequireAuth({ children }) {
  const token = localStorage.getItem("token");
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function AppRoutes({ onLoggedIn }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/lists" replace />} />

      {/* Public */}
      <Route path="/login" element={<AuthTabs onLoggedIn={onLoggedIn} />} />

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
  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) setApiToken(t);          // primes the API layer so it sends Authorization header
  }, []);
  
  const onLoggedIn = (t) => {
    const val = (t && (t.access_token || t.token)) || t || "";
    if (val) {
      localStorage.setItem("token", val);
      setApiToken(val);
      // after login, go to /lists (no useNavigate needed)
      window.location.replace("/lists");
    }
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
