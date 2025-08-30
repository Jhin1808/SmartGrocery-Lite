// src/pages/OAuthCallback.jsx
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AUTH_FALLBACK_STORAGE_KEY, TOKEN_FRAGMENT_PARAM } from "../api";

export default function OAuthCallback() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const { search, hash, pathname } = useLocation();

  useEffect(() => {
    (async () => {
      // Safari/ITP fallback: if backend included #token=..., store it so API can send Authorization header
      try {
        if (hash && hash.startsWith("#")) {
          const p = new URLSearchParams(hash.slice(1));
          const t =
            p.get(TOKEN_FRAGMENT_PARAM) ||
            p.get("access_token") ||
            p.get("token") ||
            p.get("jwt");
          if (t) {
            try { localStorage.setItem(AUTH_FALLBACK_STORAGE_KEY, t); } catch {}
            // remove the fragment from the URL
            window.history.replaceState({}, document.title, pathname + (search || ""));
          }
        }
      } catch {}

      await refresh(); // will set user if backend just set the cookie
      // Optional: support ?next=... after OAuth
      const p = new URLSearchParams(search);
      const next = p.get("next") || "/lists";
      navigate(next, { replace: true });
    })();
  }, [refresh, navigate, search, hash, pathname]);

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

