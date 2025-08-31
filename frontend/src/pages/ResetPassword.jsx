import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiForgotPassword, apiResetPassword } from "../api";

export default function ResetPassword() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(search).get("token") || "", [search]);
  const [manualCode, setManualCode] = useState("");

  // Request state
  const [email, setEmail] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  const [reqMsg, setReqMsg] = useState("");
  const [devCode, setDevCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");

  // Reset state
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetErr, setResetErr] = useState("");
  const [resetOk, setResetOk] = useState(false);

  const canReset = pw1.length >= 8 && pw1 === pw2;

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!email.trim().includes("@")) return;
    setReqBusy(true);
    setReqMsg("");
    setDevCode("");
    try {
      const res = await apiForgotPassword(email.trim(), captchaToken || undefined);
      setReqMsg("If that email exists, we sent a reset code.");
      if (res?.dev_code) setDevCode(res.dev_code);
    } catch (e) {
      setReqMsg("If that email exists, we sent a reset code.");
    } finally {
      setReqBusy(false);
    }
  };

  const looksLikeJwt = token.includes(".");

  const submitReset = async (e) => {
    e.preventDefault();
    if (!canReset) return;
    setResetBusy(true);
    setResetErr("");
    try {
      if (looksLikeJwt) {
        await apiResetPassword({ token, new_password: pw1 });
      } else {
        const code = token.trim();
        await apiResetPassword({ code, email, new_password: pw1 });
      }
      setResetOk(true);
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (e) {
      setResetErr(e.message || "Could not reset password");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      {!token && (
        <form onSubmit={submitRequest} className="row" style={{ gap: 12 }}>
          <h3 className="center">Forgot your password?</h3>
          <p className="center" style={{ color: "#666" }}>
            Enter your email and we'll send you a reset code.
          </p>
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Turnstile onVerify={setCaptchaToken} />
          <button className="btn" disabled={reqBusy || !email.trim().includes("@")}> 
            {reqBusy ? "Sending..." : "Send reset code"}
          </button>
          {reqMsg && <div className="center" style={{ color: "#666" }}>{reqMsg}</div>}
          {devCode && (
            <div className="center" style={{ fontSize: 12 }}>
              Dev code: <code>{devCode}</code>
            </div>
          )}

          <div className="center" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 14, color: "#666", marginBottom: 6 }}>Have a reset code?</div>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <input
                className="input"
                placeholder="Paste reset code here"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
              <button
                type="button"
                className="btn"
                disabled={!manualCode.trim()}
                onClick={() => navigate(`/reset?token=${encodeURIComponent(manualCode.trim())}`, { replace: true })}
              >
                Use code
              </button>
            </div>
          </div>
        </form>
      )}

      {!!token && (
        <form onSubmit={submitReset} className="row" style={{ gap: 12 }}>
          <h3 className="center">Set a new password</h3>
          {!looksLikeJwt && (
            <>
              <input
                className="input"
                type="email"
                placeholder="Your account email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="center" style={{ color: "#666", fontSize: 12 }}>
                Using reset code method
              </div>
            </>
          )}
          <input
            className="input"
            type="password"
            placeholder="New password (min 8)"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Confirm new password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
          {resetErr && <div className="error">{resetErr}</div>}
          <button className="btn" disabled={resetBusy || !canReset}>
            {resetBusy ? "Updating..." : resetOk ? "Updated" : "Update password"}
          </button>
          <p className="center" style={{ color: "#666" }}>
            You'll be redirected to login after success.
          </p>
        </form>
      )}
    </div>
  );
}

function Turnstile({ onVerify }) {
  const [ready, setReady] = useState(false);
  const siteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY || "";

  useEffect(() => {
    if (!siteKey) return; // no widget if no site key configured
    if (window.turnstile) {
      setReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => setReady(true);
    document.body.appendChild(s);
    return () => {
      // leave script in place; widget handles lifecycle
    };
  }, [siteKey]);

  useEffect(() => {
    if (!ready || !siteKey) return;
    const el = document.getElementById("cf-turnstile");
    if (!el) return;
    const ts = window.turnstile;
    if (!ts) return;
    ts.render("#cf-turnstile", {
      sitekey: siteKey,
      callback: (token) => onVerify?.(token),
      "error-callback": () => onVerify?.(""),
      "expired-callback": () => onVerify?.(""),
    });
  }, [ready, siteKey, onVerify]);

  if (!siteKey) return null;
  return (
    <div className="center">
      <div id="cf-turnstile" style={{ display: "inline-block" }} />
    </div>
  );
}

