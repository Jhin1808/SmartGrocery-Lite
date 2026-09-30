import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import {
  apiLogin,
  apiRegister,
  AUTH_FALLBACK_STORAGE_KEY,
  AUTH_HEADER_FALLBACK_ENABLED,
  googleLoginUrl,
} from "../api";
import googleIcon from "../googleicon.png";

const AUTH_ERRORS = {
  google_cancelled: "Google sign-in was cancelled. You can try again when you're ready.",
  google_failed: "Google sign-in could not be completed. Please try again from this page.",
  google_unavailable: "Google sign-in is temporarily unavailable. Please try again later or sign in with your email.",
  session_missing: "Google sign-in finished, but your session could not be saved. Please try again. If this continues, contact support.",
};

function PasswordField({ value, onChange, placeholder, show, onToggle, disabled, autoComplete, name, id }) {
  return (
    <div className="password-input">
      <input
        id={id}
        type={show ? "text" : "password"}
        className="form-control"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoComplete={autoComplete}
        name={name}
        required
      />
      <button
        type="button"
        className="password-input__toggle"
        onClick={onToggle}
        aria-label={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        <i className={`bi ${show ? "bi-eye-slash" : "bi-eye"}`} />
      </button>
    </div>
  );
}

function StrengthMeter({ password }) {
  const score = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^a-zA-Z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  }, [password]);

  const level = ["", "Weak", "Fair", "Good", "Strong"][score];
  const cls = ["", "weak", "weak", "fair", "strong"][score];

  if (!password) return null;

  return (
    <div className="strength-meter">
      <div className={`strength-meter__bar ${cls}`}>
        <div /><div /><div /><div />
      </div>
      <div className="strength-meter__label">
        <span>Password strength</span>
        <span>{level}</span>
      </div>
    </div>
  );
}

function AuthAside() {
  return <aside className="auth-aside market-auth-story">
    <Link to="/" className="brand">ToBuyLists</Link>
    <div><p className="intro-note">A place for your everyday groceries.</p>
    <h1>Good food.<br />A little less guesswork.</h1>
    <p>Keep a shared list, check what’s in the fridge, and decide what’s for dinner.</p></div>
    <img src="/images/market.jpg" alt="Fresh vegetables at the market" />
    <p>For the people you share a kitchen with.</p>
  </aside>;
}

function GoogleButton({ onClick, disabled, children }) {
  return (
    <button
      type="button"
      className="btn btn-secondary btn-block btn-social"
      onClick={onClick}
      disabled={disabled}
    >
      <img src={googleIcon} alt="" width={18} height={18} />
      {children}
    </button>
  );
}

export default function EnhancedAuthTabs() {
  const { refresh, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [demoLoading, setDemoLoading] = useState(false);

  const tryDemo = async () => {
    setDemoLoading(true);
    try {
      await loginAsDemo();
      navigate("/lists", { replace: true });
    } catch {
      setDemoLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState(new URLSearchParams(search).get("mode") === "register" ? "register" : "login");
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(search).get("auth_error");
    if (code) setLoginError(AUTH_ERRORS[code] || "Sign-in could not be completed. Please try again.");
  }, [search]);

  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");

  useEffect(() => {
    try {
      const p = new URLSearchParams(search);
      const err = p.get("error");
      const reason = p.get("reason");
      if (err) {
        setLoginError(reason || err);
        window.history.replaceState({}, "", "/login");
      }
    } catch {}
  }, [search]);

  useEffect(() => {
    const prev = document.title;
    document.title = activeTab === "login" ? "Sign in · ToBuyLists" : "Create account · ToBuyLists";
    return () => { document.title = prev; };
  }, [activeTab]);

  const passwordsMatch = registerPassword === confirmPassword && registerPassword.length > 0;
  const registerValid = registerEmail && registerPassword && confirmPassword && agreeTerms && passwordsMatch && registerPassword.length >= 8;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const tok = await apiLogin(loginEmail.trim(), loginPassword);
      try {
        const val = tok?.access_token || tok?.token || (typeof tok === "string" ? tok : "");
        if (AUTH_HEADER_FALLBACK_ENABLED && typeof val === "string" && val) {
          localStorage.setItem(AUTH_FALLBACK_STORAGE_KEY, val);
        }
      } catch {}
      const user = await refresh();
      if (!user) throw new Error(AUTH_ERRORS.session_missing);
      navigate("/lists", { replace: true });
    } catch (error) {
      setLoginError(error.message || "Sign in failed. Check your email and password.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterLoading(true);
    setRegisterError("");

    if (!agreeTerms) {
      setRegisterError("Please accept the Terms of Service and Privacy Policy.");
      setRegisterLoading(false);
      return;
    }
    if (registerPassword !== confirmPassword) {
      setRegisterError("Passwords don't match.");
      setRegisterLoading(false);
      return;
    }
    if (registerPassword.length < 8) {
      setRegisterError("Password must be at least 8 characters.");
      setRegisterLoading(false);
      return;
    }

    try {
      await apiRegister({ email: registerEmail.trim(), password: registerPassword });
      const tok = await apiLogin(registerEmail.trim(), registerPassword);
      try {
        const val = tok?.access_token || tok?.token || (typeof tok === "string" ? tok : "");
        if (AUTH_HEADER_FALLBACK_ENABLED && typeof val === "string" && val) {
          localStorage.setItem(AUTH_FALLBACK_STORAGE_KEY, val);
        }
      } catch {}
      const user = await refresh();
      if (!user) throw new Error(AUTH_ERRORS.session_missing);
      navigate("/lists", { replace: true });
    } catch (error) {
      setRegisterError(error.message || "Couldn't create your account. Try again.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleSocialLogin = () => {
    window.location.assign(googleLoginUrl());
  };

  return (
    <div className="auth-shell">
      <AuthAside />

      <section className="auth-panel anim-fade">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div className="lm-md-hide" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <i className="bi bi-basket2" aria-hidden="true" />
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>ToBuyLists</span>
          </div>
          <div className="lm-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "login"}
              className={"lm-tab" + (activeTab === "login" ? " is-active" : "")}
              onClick={() => setActiveTab("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "register"}
              className={"lm-tab" + (activeTab === "register" ? " is-active" : "")}
              onClick={() => setActiveTab("register")}
            >
              Create account
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <h1>
            {activeTab === "login" ? "Welcome back" : "Get started"}
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--text-secondary)", margin: "8px 0 0" }}>
            {activeTab === "login"
              ? "Sign in to access your lists and pick up where you left off."
              : "Create a free account — no credit card required."}
          </p>
        </div>

        {activeTab === "login" ? (
          <form onSubmit={handleLogin} className="anim-fade" noValidate>
            <div className="flex flex-col" style={{ gap: 16 }}>
              <GoogleButton onClick={handleSocialLogin} disabled={loginLoading}>
                Continue with Google
              </GoogleButton>

              <div className="lm-divider">or use email</div>

              <div className="form-field">
                <label className="form-label" htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  className="form-control"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  disabled={loginLoading}
                  autoComplete="email"
                />
              </div>

              <div className="form-field">
                <div className="flex items-center justify-between">
                  <label className="form-label" htmlFor="login-pwd">Password</label>
                  <Link to="/reset" style={{ fontSize: 12.5, fontWeight: 600 }}>Forgot?</Link>
                </div>
                <PasswordField
                  id="login-pwd"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  show={showLoginPwd}
                  onToggle={() => setShowLoginPwd((v) => !v)}
                  disabled={loginLoading}
                  autoComplete="current-password"
                  name="password"
                />
              </div>

              <label className="form-check" style={{ marginTop: 4 }}>
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loginLoading}
                />
                <span style={{ fontSize: 13.5 }}>Keep me signed in</span>
              </label>

              {loginError && (
                <div className="lm-alert lm-alert--danger" role="alert">
                  <i className="bi bi-exclamation-circle lm-alert__icon" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-block"
                disabled={loginLoading || !loginEmail || !loginPassword}
              >
                {loginLoading ? <><span className="lm-spinner" /> Signing in…</> : "Sign in"}
              </button>

              <div className="lm-divider" style={{ marginTop: 4 }}>or just explore</div>

              <button
                type="button"
                className="btn btn-accent btn-lg btn-block"
                onClick={tryDemo}
                disabled={demoLoading || loginLoading}
              >
                {demoLoading ? <><span className="lm-spinner" /> Loading demo…</> : <><i className="bi bi-magic" /> Try the demo</>}
              </button>

              <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", margin: 0, marginTop: -4 }}>
                No signup, no backend — explore every page with sample data.
              </p>

              <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => setActiveTab("register")}
                  style={{ background: "none", border: 0, color: "var(--color-primary)", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 13 }}
                >
                  Create an account
                </button>
              </p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="anim-fade" noValidate>
            <div className="flex flex-col" style={{ gap: 16 }}>
              <GoogleButton onClick={handleSocialLogin} disabled={registerLoading}>
                Continue with Google
              </GoogleButton>

              <div className="lm-divider">or sign up with email</div>

              <div className="form-field">
                <label className="form-label" htmlFor="reg-email">Email</label>
                <input
                  id="reg-email"
                  type="email"
                  className="form-control"
                  placeholder="you@example.com"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                  disabled={registerLoading}
                  autoComplete="email"
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="reg-pwd">Password</label>
                <PasswordField
                  id="reg-pwd"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  show={showRegPwd}
                  onToggle={() => setShowRegPwd((v) => !v)}
                  disabled={registerLoading}
                  autoComplete="new-password"
                  name="new-password"
                />
                <StrengthMeter password={registerPassword} />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="reg-confirm">Confirm password</label>
                <PasswordField
                  id="reg-confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  show={showConfirmPwd}
                  onToggle={() => setShowConfirmPwd((v) => !v)}
                  disabled={registerLoading}
                  autoComplete="new-password"
                  name="confirm-password"
                />
                {confirmPassword && !passwordsMatch && (
                  <span className="form-error">Passwords don't match</span>
                )}
              </div>

              <div className="flex flex-col" style={{ gap: 10, marginTop: 4 }}>
                <label className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    disabled={registerLoading}
                    required
                  />
                  <span style={{ fontSize: 13 }}>
                    I agree to the{" "}
                    <Link to="/terms">Terms</Link> and{" "}
                    <Link to="/terms">Privacy Policy</Link>.
                  </span>
                </label>
              </div>

              {registerError && (
                <div className="lm-alert lm-alert--danger" role="alert">
                  <i className="bi bi-exclamation-circle lm-alert__icon" />
                  <span>{registerError}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-block"
                disabled={registerLoading || !registerValid}
              >
                {registerLoading ? <><span className="lm-spinner" /> Creating account…</> : "Create account"}
              </button>

              <div className="lm-divider" style={{ marginTop: 4 }}>or just explore</div>

              <button
                type="button"
                className="btn btn-accent btn-lg btn-block"
                onClick={tryDemo}
                disabled={demoLoading || registerLoading}
              >
                {demoLoading ? <><span className="lm-spinner" /> Loading demo…</> : <><i className="bi bi-magic" /> Try the demo</>}
              </button>

              <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", margin: 0, marginTop: -4 }}>
                No signup, no backend — explore every page with sample data.
              </p>

              <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setActiveTab("login")}
                  style={{ background: "none", border: 0, color: "var(--color-primary)", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 13 }}
                >
                  Sign in
                </button>
              </p>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
