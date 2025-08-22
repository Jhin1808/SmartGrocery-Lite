import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setToken } from "../api";

export default function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const tok = params.get("token");
    if (tok) {
      setToken(tok);
      localStorage.setItem("token", tok); // if you want persistence like your email/password login
      navigate("/lists", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [params, navigate]);

  return null; // just redirecting
}
