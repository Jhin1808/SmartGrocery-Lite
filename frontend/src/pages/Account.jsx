import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../pages/AuthContext";
import { apiUpdateMe, apiChangePassword } from "../api";

function sanitizeImageUrl(u) {
  if (!u) return "";
  const s = String(u).trim();
  if (!s || s.startsWith("<")) return "";
  if (s.startsWith("data:")) {
    const head = s.slice(5, 40).toLowerCase();
    const ok = ["image/png", "image/jpeg", "image/gif", "image/webp"].some((t) => head.startsWith(t));
    return ok ? s : "";
  }
  try {
    const url = new URL(s, window.location.origin);
    const proto = url.protocol.replace(":", "");
    if (["http", "https", "blob"].includes(proto)) return url.href;
  } catch {}
  return "";
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 2200);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div className="lm-toast-host" aria-live="polite">
      <div className={`lm-toast lm-toast--${toast.variant}`}>
        <span className="lm-toast__icon">
          <i className={`bi ${toast.variant === "success" ? "bi-check-lg" : "bi-exclamation-lg"}`} />
        </span>
        <div className="lm-toast__body">{toast.msg}</div>
        <button type="button" className="lm-toast__close" onClick={onClose}><i className="bi bi-x" /></button>
      </div>
    </div>
  );
}

function Avatar({ user, url, size = 80 }) {
  const label = (user?.name || user?.email || "U").trim();
  const initials = label.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";
  const palette = [
    "linear-gradient(135deg, #14b8a6, #0f766e)",
    "linear-gradient(135deg, #f59e0b, #d97706)",
    "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    "linear-gradient(135deg, #f43f5e, #be123c)",
    "linear-gradient(135deg, #0ea5e9, #0369a1)",
  ];
  const idx = (label.charCodeAt(0) || 0) % palette.length;

  if (url) {
    return (
      <span className="lm-avatar lm-avatar--lg" style={{ width: size, height: size, background: palette[idx] }}>
        <img src={url} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      </span>
    );
  }
  return (
    <span className="lm-avatar lm-avatar--lg" style={{ width: size, height: size, background: palette[idx] }}>
      {initials}
    </span>
  );
}

export default function Account() {
  const { user, refresh } = useAuth();

  const [activeTab, setActiveTab] = useState("profile");

  const [name, setName] = useState("");
  const [picture, setPicture] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setPicture(user?.picture || "");
  }, [user]);

  const savedAvatarSrc = useMemo(() => sanitizeImageUrl(user?.picture), [user?.picture]);

  const dirtyProfile = name !== (user?.name || "") || picture !== (user?.picture || "");
  const clearPicture = () => setPicture("");

  const [toast, setToast] = useState(null);
  const showToast = (variant, msg) => setToast({ variant, msg });

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!dirtyProfile) return;
    setSavingProfile(true);
    try {
      await apiUpdateMe({ name, picture });
      await refresh();
      showToast("success", "Profile updated");
    } catch (err) {
      showToast("danger", err.message || "Update failed");
    } finally {
      setSavingProfile(false);
    }
  };

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const canSavePwd = newPwd.length >= 8 && newPwd === confirmPwd;

  const savePassword = async (e) => {
    e.preventDefault();
    if (!canSavePwd) return;
    setSavingPwd(true);
    try {
      await apiChangePassword({ current_password: currentPwd || null, new_password: newPwd });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      showToast("success", "Password updated");
    } catch (err) {
      showToast("danger", err.message || "Password update failed");
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="lm-container" style={{ paddingTop: 24, paddingBottom: 60, maxWidth: 820 }}>
      <div className="lm-hero">
        <h1 className="lm-hero__title">Account</h1>
        <p className="lm-hero__subtitle">Manage your profile, security, and preferences.</p>
      </div>

      <div className="lm-card lm-card--elevated anim-fade" style={{ overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid var(--border)", background: "var(--surface-hover)" }}>
          <Avatar user={user} url={savedAvatarSrc} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }} className="truncate">{user?.name || "Welcome"}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }} className="truncate">{user?.email}</div>
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
          <div className="lm-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "profile"}
              className={"lm-tab" + (activeTab === "profile" ? " is-active" : "")}
              onClick={() => setActiveTab("profile")}
            >
              <i className="bi bi-person" style={{ marginRight: 6 }} /> Profile
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "security"}
              className={"lm-tab" + (activeTab === "security" ? " is-active" : "")}
              onClick={() => setActiveTab("security")}
            >
              <i className="bi bi-shield-lock" style={{ marginRight: 6 }} /> Security
            </button>
          </div>
        </div>

        <div className="lm-card__body">
          {activeTab === "profile" ? (
            <form onSubmit={saveProfile} className="anim-fade">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="form-field">
                  <label className="form-label" htmlFor="accName">Display name</label>
                  <input
                    id="accName"
                    type="text"
                    className="form-control"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="accEmail">Email</label>
                  <input
                    id="accEmail"
                    type="email"
                    className="form-control"
                    value={user?.email || ""}
                    disabled
                    readOnly
                  />
                  <span className="form-help">Contact support to change your email.</span>
                </div>
                <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label" htmlFor="accPicture">Avatar URL</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      id="accPicture"
                      type="url"
                      className="form-control"
                      placeholder="https://example.com/photo.jpg"
                      value={picture}
                      onChange={(e) => setPicture(e.target.value)}
                    />
                    {picture && (
                      <button type="button" className="btn btn-ghost-danger" onClick={clearPicture} title="Remove picture">
                        Remove
                      </button>
                    )}
                  </div>
                  <span className="form-help">Provide a direct link to an image. Leave blank to use your initials.</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" disabled={!dirtyProfile || savingProfile}>
                  {savingProfile ? <><span className="lm-spinner" /> Saving…</> : <><i className="bi bi-check-lg" /> Save changes</>}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!dirtyProfile || savingProfile}
                  onClick={() => { setName(user?.name || ""); setPicture(user?.picture || ""); }}
                >
                  Reset
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={savePassword} className="anim-fade">
              <div className="lm-alert lm-alert--info" style={{ marginBottom: 20 }}>
                <i className="bi bi-info-circle lm-alert__icon" />
                <span>If you signed in with Google and never set a password, you can leave "Current password" empty to create one.</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="form-field">
                  <label className="form-label" htmlFor="curPwd">Current password</label>
                  <div className="password-input">
                    <input
                      id="curPwd"
                      type={showCurrent ? "text" : "password"}
                      className="form-control"
                      placeholder="Leave empty if you never set one"
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button type="button" className="password-input__toggle" onClick={() => setShowCurrent((v) => !v)} tabIndex={-1} aria-label={showCurrent ? "Hide" : "Show"}>
                      <i className={`bi ${showCurrent ? "bi-eye-slash" : "bi-eye"}`} />
                    </button>
                  </div>
                </div>
                <div />
                <div className="form-field">
                  <label className="form-label" htmlFor="newPwd">New password</label>
                  <div className="password-input">
                    <input
                      id="newPwd"
                      type={showNew ? "text" : "password"}
                      className="form-control"
                      placeholder="At least 8 characters"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <button type="button" className="password-input__toggle" onClick={() => setShowNew((v) => !v)} tabIndex={-1} aria-label={showNew ? "Hide" : "Show"}>
                      <i className={`bi ${showNew ? "bi-eye-slash" : "bi-eye"}`} />
                    </button>
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="confirmPwd">Confirm new password</label>
                  <div className="password-input">
                    <input
                      id="confirmPwd"
                      type={showConfirm ? "text" : "password"}
                      className="form-control"
                      placeholder="Repeat your new password"
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button type="button" className="password-input__toggle" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1} aria-label={showConfirm ? "Hide" : "Show"}>
                      <i className={`bi ${showConfirm ? "bi-eye-slash" : "bi-eye"}`} />
                    </button>
                  </div>
                  {confirmPwd && confirmPwd !== newPwd && (
                    <span className="form-error">Passwords don't match</span>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" disabled={!canSavePwd || savingPwd}>
                  {savingPwd ? <><span className="lm-spinner" /> Updating…</> : <><i className="bi bi-shield-check" /> Update password</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
