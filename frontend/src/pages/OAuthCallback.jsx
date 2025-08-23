// src/pages/OAuthCallback.jsx
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function OAuthCallback() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();

  useEffect(() => {
    (async () => {
      await refresh(); // will set user if backend just set the cookie
      // Optional: support ?next=... after OAuth
      const p = new URLSearchParams(search);
      const next = p.get("next") || "/lists";
      navigate(next, { replace: true });
    })();
  }, [refresh, navigate, search]);

  return null;
}


// // frontend/src/pages/OAuthCallback.jsx
// import { useEffect } from "react";
// import { useNavigate } from "react-router-dom";

// export default function OAuthCallback() {
//   const navigate = useNavigate();
//   useEffect(() => { navigate("/lists", { replace: true }); }, [navigate]);
//   return null;
// }

// // src/pages/OAuthCallback.jsx
// import { useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import { apiMe } from "../api";

// export default function OAuthCallback() {
//   const navigate = useNavigate();

//   useEffect(() => {
//     (async () => {
//       try {
//         await apiMe(); // if cookie works, this succeeds
//         navigate("/lists", { replace: true });
//       } catch {
//         navigate("/login", { replace: true });
//       }
//     })();
//   }, [navigate]);

//   return null;
// }

