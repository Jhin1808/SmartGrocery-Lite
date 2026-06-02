import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../pages/AuthContext";
import { isDemo } from "../demo";
import { FEATURE_KROGER, FEATURE_RECIPES, FEATURE_TEMPLATES } from "../api";
import ThemeToggle from "./ThemeToggle";

function Brand() {
  return (
    <NavLink to="/lists" className="lm-nav__brand">
      <span className="lm-nav__brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h8.5a2 2 0 0 0 2-1.6L21 8H6" />
          <circle cx="9" cy="20" r="1.4" />
          <circle cx="18" cy="20" r="1.4" />
        </svg>
      </span>
      <span>SmartGrocery</span>
    </NavLink>
  );
}

function Avatar({ user, size = 32 }) {
  const label = (user?.name || user?.email || "U").trim();
  const initials = label
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
  const palette = [
    "linear-gradient(135deg, #14b8a6, #0f766e)",
    "linear-gradient(135deg, #f59e0b, #d97706)",
    "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    "linear-gradient(135deg, #f43f5e, #be123c)",
    "linear-gradient(135deg, #0ea5e9, #0369a1)",
  ];
  const idx = (label.charCodeAt(0) || 0) % palette.length;
  const sizeClass = size <= 28 ? "lm-avatar--sm" : size >= 64 ? "lm-avatar--lg" : "lm-avatar--md";

  if (user?.picture) {
    return (
      <span className={`lm-avatar ${sizeClass}`} style={{ width: size, height: size }}>
        <img
          src={user.picture}
          alt=""
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      </span>
    );
  }
  return (
    <span
      className={`lm-avatar ${sizeClass}`}
      style={{ width: size, height: size, background: palette[idx] }}
    >
      {initials}
    </span>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="lm-menu-host" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        style={{ padding: 4, borderRadius: 999 }}
      >
        <Avatar user={user} size={32} />
        <i className="bi bi-chevron-down d-none d-sm-inline" style={{ fontSize: 11, marginLeft: 2 }} />
      </button>

      {open && (
        <div className="lm-menu" role="menu">
          <div className="lm-menu__header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar user={user} size={32} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }} className="truncate">
                  {user?.name || user?.email || "Account"}
                </div>
                {user?.email && (
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }} className="truncate">
                    {user.email}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="lm-menu__divider" />
          <NavLink to="/account" className="lm-menu__item" role="menuitem" onClick={() => setOpen(false)}>
            <i className="bi bi-person" /> Profile
          </NavLink>
          <NavLink to="/help" className="lm-menu__item" role="menuitem" onClick={() => setOpen(false)}>
            <i className="bi bi-question-circle" /> Help
          </NavLink>
          {isDemo() && (
            <>
              <div className="lm-menu__divider" />
              <button type="button" className="lm-menu__item lm-menu__item--accent" role="menuitem" onClick={() => { setOpen(false); onLogout(); }}>
                <i className="bi bi-magic" /> Exit demo
              </button>
            </>
          )}
          <div className="lm-menu__divider" />
          <button type="button" className="lm-menu__item lm-menu__item--danger" role="menuitem" onClick={() => { setOpen(false); onLogout(); }}>
            <i className="bi bi-box-arrow-right" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const { user, refresh, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const onLogout = async () => {
    try {
      await logout();
      await refresh();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const links = [
    { to: "/lists", icon: "bi-list-check", label: "Lists" },
    ...(FEATURE_KROGER ? [{ to: "/stores", icon: "bi-shop", label: "Stores" }] : []),
    ...(FEATURE_RECIPES ? [{ to: "/recipes", icon: "bi-journal-text", label: "Recipes" }] : []),
    ...(FEATURE_TEMPLATES ? [{ to: "/templates", icon: "bi-collection", label: "Templates" }] : []),
    { to: "/account", icon: "bi-person", label: "Account" },
    { to: "/help", icon: "bi-question-circle", label: "Help" },
  ];

  return (
    <header className="lm-nav" role="banner">
      <div className="lm-nav__inner">
        <Brand />
        {user && (
          <nav className="lm-nav__links" aria-label="Primary">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => "lm-nav__link" + (isActive ? " active" : "")}
              >
                <i className={`bi ${l.icon}`} aria-hidden="true" />
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}

        <span className="lm-nav__spacer" />

        <div className="lm-nav__actions">
          <ThemeToggle />
          {user ? (
            <UserMenu user={user} onLogout={onLogout} />
          ) : (
            !location.pathname.startsWith("/login") && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate("/login")}>
                Sign in
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
}
