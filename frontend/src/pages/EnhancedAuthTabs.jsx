import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import {
  apiLogin,
  apiRegister,
  API_BASE,
  AUTH_FALLBACK_STORAGE_KEY,
  AUTH_HEADER_FALLBACK_ENABLED,
  googleLoginUrl,
} from "../api";
import googleIcon from "../googleicon.png";

function BrandMark({ size = 32 }) {
  return (
    <span
      className="lm-mark"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h8.5a2 2 0 0 0 2-1.6L21 8H6" />
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
      </svg>
    </span>
  );
}

function PasswordField({ value, onChange, placeholder, show, onToggle, disabled, autoComplete, name }) {
  return (
    <div className="password-input">
      <input
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
  return (
    <aside className="auth-aside" aria-hidden="true">
      <div className="flex items-center gap-3" style={{ color: "var(--neutral-50)" }}>
        <BrandMark size={40} />
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>SmartGrocery</span>
      </div>

      <div className="lm-cta" style={{ flex: 1, justifyContent: "center" }}>
        <span className="lm-cta__eyebrow">
          <i className="bi bi-stars" /> New • Real-time sharing
        </span>
        <h1 className="lm-cta__headline">
          Grocery lists that <em>actually</em> get done.
        </h1>
        <p className="lm-cta__sub">
          Plan together, share instantly, and check items off as you walk the aisles.
          SmartGrocery keeps your household in sync — no more duplicate buys or forgotten staples.
        </p>

        <div className="flex flex-col" style={{ gap: 12, marginTop: 12 }}>
          <div className="lm-feature">
            <span className="lm-feature__icon"><i className="bi bi-list-check" /></span>
            <div>
              <p className="lm-feature__title">Smart lists</p>
              <p className="lm-feature__desc">Group items by aisle, mark favourites, track expiry dates.</p>
            </div>
          </div>
          <div className="lm-feature">
            <span className="lm-feature__icon lm-feature__icon--accent"><i className="bi bi-people-fill" /></span>
            <div>
              <p className="lm-feature__title">Live sharing</p>
              <p className="lm-feature__desc">Invite your partner, roommates or family in a single tap.</p>
            </div>
          </div>
          <div className="lm-feature">
            <span className="lm-feature__icon lm-feature__icon--violet"><i className="bi bi-bag-check-fill" /></span>
            <div>
              <p className="lm-feature__title">Shop mode</p>
              <p className="lm-feature__desc">Tap to check off, see live progress, never miss an item again.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="lm-trust">
        <div className="lm-trust__avatars">
          <span className="lm-avatar">A</span>
          <span className="lm-avatar">M</span>
          <span className="lm-avatar">S</span>
          <span className="lm-avatar">+</span>
        </div>
        <div className="lm-trust__text">
          Trusted by <strong>thousands of households</strong> to plan their week.
        </div>
      </div>
    </aside>
  );
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

  const [activeTab, setActiveTab] = useState("login");
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

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
    document.title = activeTab === "login" ? "Sign in · SmartGrocery" : "Create account · SmartGrocery";
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
      await refresh();
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
      await refresh();
      navigate("/lists", { replace: true });
    } catch (error) {
      setRegisterError(error.message || "Couldn't create your account. Try again.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleSocialLogin = () => {
    try {
      const url = googleLoginUrl ? googleLoginUrl() : `${API_BASE}/auth/google/login`;
      window.location.href = url;
    } catch {
      window.location.href = `${API_BASE}/auth/google/login`;
    }
  };

  return (
    <div className="auth-shell">
      <AuthAside />

      <section className="auth-panel anim-fade">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div className="lm-md-hide" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <BrandMark size={32} />
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>SmartGrocery</span>
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
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
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
