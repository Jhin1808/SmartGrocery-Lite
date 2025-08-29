import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiForgotPassword, apiResetPassword } from "../api";

export default function ResetPassword() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(search).get("token") || "", [search]);

  // Request state
  const [email, setEmail] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  const [reqMsg, setReqMsg] = useState("");
  const [devLink, setDevLink] = useState("");

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
    setDevLink("");
    try {
      const res = await apiForgotPassword(email.trim());
      setReqMsg("If that email exists, we sent a reset link.");
      if (res?.reset_url) setDevLink(res.reset_url);
    } catch (e) {
      setReqMsg("If that email exists, we sent a reset link.");
    } finally {
      setReqBusy(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (!canReset) return;
    setResetBusy(true);
    setResetErr("");
    try {
      await apiResetPassword({ token, new_password: pw1 });
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
            Enter your email and we'll send you a reset link.
          </p>
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn" disabled={reqBusy || !email.trim().includes("@")}> 
            {reqBusy ? "Sending…" : "Send reset link"}
          </button>
          {reqMsg && <div className="center" style={{ color: "#666" }}>{reqMsg}</div>}
          {devLink && (
            <div className="center" style={{ fontSize: 12 }}>
              Dev link: <a href={devLink}>{devLink}</a>
            </div>
          )}
        </form>
      )}

      {!!token && (
        <form onSubmit={submitReset} className="row" style={{ gap: 12 }}>
          <h3 className="center">Set a new password</h3>
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
            {resetBusy ? "Updating…" : resetOk ? "Updated" : "Update password"}
          </button>
          <p className="center" style={{ color: "#666" }}>
            You'll be redirected to login after success.
          </p>
        </form>
      )}
    </div>
  );
}

