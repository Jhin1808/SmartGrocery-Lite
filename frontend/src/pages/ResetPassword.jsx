import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiForgotPassword, apiPasswordResetConfig, apiResetPassword } from "../api";

function Turnstile({ siteKey, onVerify, onError }) {
  const mount = useRef(null);

  useEffect(() => {
    if (!siteKey) return;
    let active = true;
    let widgetId;
    const error = () => {
      if (active) {
        onVerify("");
        onError("Verification could not load. Please refresh and try again.");
      }
    };
    const render = () => {
      if (!active || !mount.current || !window.turnstile) return error();
      try {
        widgetId = window.turnstile.render(mount.current, {
          sitekey: siteKey,
          callback: (value) => { onVerify(value); onError(""); },
          "error-callback": error,
          "expired-callback": () => onVerify(""),
        });
      } catch {
        error();
      }
    };
    let script = document.querySelector('script[data-turnstile-script="true"]');
    if (window.turnstile) render();
    else {
      if (!script) {
        script = document.createElement("script");
        script.dataset.turnstileScript = "true";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
      script.addEventListener("error", error);
    }
    return () => {
      active = false;
      script?.removeEventListener("load", render);
      script?.removeEventListener("error", error);
      if (widgetId !== undefined) window.turnstile?.remove(widgetId);
    };
  }, [siteKey, onVerify, onError]);

  return <div style={{ display: "flex", justifyContent: "center" }}><div ref={mount} aria-label="Human verification" /></div>;
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span className="lm-mark lm-mark--md" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h8.5a2 2 0 0 0 2-1.6L21 8H6" />
          <circle cx="9" cy="20" r="1.4" />
          <circle cx="18" cy="20" r="1.4" />
        </svg>
      </span>
      <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>SmartGrocery</span>
    </div>
  );
}

function PasswordField({ value, onChange, placeholder, show, onToggle, autoComplete }) {
  return (
    <div className="password-input">
      <input
        type={show ? "text" : "password"}
        className="form-control"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required
        style={{ height: 44 }}
      />
      <button
        type="button"
        className="password-input__toggle"
        onClick={onToggle}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
      >
        <i className={`bi ${show ? "bi-eye-slash" : "bi-eye"}`} />
      </button>
    </div>
  );
}

export default function ResetPassword() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const token = useMemo(() => params.get("token") || params.get("code") || "", [params]);
  const initialEmail = useMemo(() => params.get("email") || "", [params]);
  const [manualCode, setManualCode] = useState("");

  const [email, setEmail] = useState(initialEmail);
  const [reqBusy, setReqBusy] = useState(false);
  const [reqMsg, setReqMsg] = useState("");
  const [reqErr, setReqErr] = useState("");
  const [devCode, setDevCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [captchaConfig, setCaptchaConfig] = useState({ loading: true, required: false, siteKey: "", error: "" });

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetErr, setResetErr] = useState("");
  const [resetOk, setResetOk] = useState(false);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (token) return;
    let active = true;
    apiPasswordResetConfig().then((config) => {
      if (!active) return;
      const required = Boolean(config?.captcha_required);
      const siteKey = config?.site_key || "";
      setCaptchaConfig({
        loading: false, required, siteKey,
        error: required && !siteKey ? "Verification is temporarily unavailable. Please try again later." : "",
      });
    }).catch(() => {
      if (active) setCaptchaConfig({ loading: false, required: false, siteKey: "", error: "Verification is temporarily unavailable. Please try again later." });
    });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    const prev = document.title;
    document.title = token ? "Reset password · SmartGrocery" : "Forgot password · SmartGrocery";
    return () => { document.title = prev; };
  }, [token]);

  const looksLikeJwt = token.includes(".");
  const canReset = pw1.length >= 8 && pw1 === pw2 && (looksLikeJwt || email.trim().includes("@"));
  const passwordsMatch = pw1.length > 0 && pw1 === pw2;

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!email.trim().includes("@")) return;
    if (captchaConfig.loading || captchaConfig.error || captchaError || (captchaConfig.required && !captchaToken)) return;
    setReqBusy(true);
    setReqMsg("");
    setReqErr("");
    setDevCode("");
    try {
      const res = await apiForgotPassword(email.trim(), captchaToken || undefined);
      setReqMsg("If that email exists, check your inbox for a reset code. It may take a few minutes.");
      if (res?.dev_code) setDevCode(res.dev_code);
    } catch (error) {
      setReqErr(error.status === 429 ? "Too many requests. Please try again later."
        : /captcha/i.test(error.message || "") ? "Verification failed or expired. Please try again."
        : "Could not request a reset code. Please try again later.");
    } finally {
      setReqBusy(false);
      setCaptchaToken("");
      setCaptchaAttempt((attempt) => attempt + 1);
    }
  };

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
        await apiResetPassword({ code, email: email.trim(), new_password: pw1 });
      }
      setResetOk(true);
      setTimeout(() => navigate("/login", { replace: true }), 1400);
    } catch (e) {
      setResetErr(e.message || "Could not reset password");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-aside" aria-hidden="true" style={{ display: "none" }} />

      <section className="auth-panel anim-fade" style={{ maxWidth: 460 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <Brand />
          <a href="/login" className="btn btn-ghost btn-sm">
            <i className="bi bi-arrow-left" /> Back to sign in
          </a>
        </div>

        {!token ? (
          <form onSubmit={submitRequest} noValidate>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
                Forgot your password?
              </h1>
              <p style={{ fontSize: 14.5, color: "var(--text-secondary)", margin: "8px 0 0" }}>
                Enter your email and we'll send you a reset code.
              </p>
            </div>

            <div className="flex flex-col" style={{ gap: 16 }}>
              <div className="form-field">
                <label className="form-label" htmlFor="resetEmail">Email</label>
                <input
                  id="resetEmail"
                  type="email"
                  className="form-control"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ height: 44 }}
                />
              </div>

              {captchaConfig.required && captchaConfig.siteKey && (
                <Turnstile key={captchaAttempt} siteKey={captchaConfig.siteKey} onVerify={setCaptchaToken} onError={setCaptchaError} />
              )}

              {(captchaConfig.error || captchaError || reqErr) && (
                <div className="lm-alert lm-alert--danger" role="alert">
                  <i className="bi bi-exclamation-circle lm-alert__icon" />
                  <span>{captchaConfig.error || captchaError || reqErr}</span>
                </div>
              )}

              {reqMsg && (
                <div className="lm-alert lm-alert--info">
                  <i className="bi bi-info-circle lm-alert__icon" />
                  <span>{reqMsg}</span>
                </div>
              )}

              {devCode && (
                <div className="lm-alert lm-alert--warning">
                  <i className="bi bi-key lm-alert__icon" />
                  <span>Dev code: <code style={{ background: "var(--surface-hover)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{devCode}</code></span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-block"
                disabled={reqBusy || captchaConfig.loading || Boolean(captchaConfig.error || captchaError) ||
                  !email.trim().includes("@") || (captchaConfig.required && !captchaToken)}
              >
                {reqBusy ? <><span className="lm-spinner" /> Sending…</> : "Send reset code"}
              </button>
            </div>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
              <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
                Already have a reset code?
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Paste code here"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  style={{ height: 40 }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!manualCode.trim()}
                  onClick={() => {
                    const qs = new URLSearchParams();
                    qs.set("code", manualCode.trim());
                    if (email.trim()) qs.set("email", email.trim());
                    navigate(`/reset?${qs.toString()}`, { replace: true });
                  }}
                >
                  Use code
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={submitReset} noValidate>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
                Set a new password
              </h1>
              <p style={{ fontSize: 14.5, color: "var(--text-secondary)", margin: "8px 0 0" }}>
                Choose a strong password you don't use anywhere else.
              </p>
            </div>

            <div className="flex flex-col" style={{ gap: 16 }}>
              {!looksLikeJwt && (
                <div className="form-field">
                  <label className="form-label" htmlFor="resetEmail2">Email</label>
                  <input
                    id="resetEmail2"
                    type="email"
                    className="form-control"
                    placeholder="Your account email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ height: 44 }}
                  />
                </div>
              )}

              <div className="form-field">
                <label className="form-label" htmlFor="newPwd">New password</label>
                <PasswordField
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  placeholder="At least 8 characters"
                  show={show1}
                  onToggle={() => setShow1((v) => !v)}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="confirmNewPwd">Confirm password</label>
                <PasswordField
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="Repeat your password"
                  show={show2}
                  onToggle={() => setShow2((v) => !v)}
                  autoComplete="new-password"
                />
                {pw2 && !passwordsMatch && (
                  <span className="form-error">Passwords don't match</span>
                )}
              </div>

              {resetErr && (
                <div className="lm-alert lm-alert--danger" role="alert">
                  <i className="bi bi-exclamation-circle lm-alert__icon" />
                  <span>{resetErr}</span>
                </div>
              )}

              {resetOk && (
                <div className="lm-alert lm-alert--success" role="status">
                  <i className="bi bi-check-circle lm-alert__icon" />
                  <span>Password updated — taking you to sign in…</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-block"
                disabled={resetBusy || !canReset || resetOk}
              >
                {resetBusy ? <><span className="lm-spinner" /> Updating…</> : resetOk ? "Updated" : "Update password"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
