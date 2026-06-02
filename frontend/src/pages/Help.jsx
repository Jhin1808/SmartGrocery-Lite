import { useMemo, useState } from "react";

const TOPICS = [
  {
    icon: "bi-folder-plus",
    iconClass: "lm-topic__icon",
    title: "Create a list",
    desc: "Open the sidebar and use the input at the top to spin up a new list. Give it a name and you're ready to add items.",
  },
  {
    icon: "bi-cart-plus",
    iconClass: "lm-topic__icon lm-topic__icon--accent",
    title: "Add items",
    desc: "Type a name, pick a quantity, and (optionally) an expiry date. Add a description if you want extra context.",
  },
  {
    icon: "bi-bag-check",
    iconClass: "lm-topic__icon lm-topic__icon--violet",
    title: "Shopping mode",
    desc: "Hit the Shop button to switch to a tap-friendly view. Check items off as you walk the aisles.",
  },
  {
    icon: "bi-people",
    iconClass: "lm-topic__icon lm-topic__icon--sky",
    title: "Share with others",
    desc: "Owners can invite by email. Choose Viewer for read-only access or Editor to let them make changes.",
  },
  {
    icon: "bi-clock-history",
    iconClass: "lm-topic__icon lm-topic__icon--rose",
    title: "Track expiry",
    desc: "Items with upcoming expiry dates get color-coded dots and badges — never let food go to waste again.",
  },
  {
    icon: "bi-moon-stars",
    iconClass: "lm-topic__icon lm-topic__icon--emerald",
    title: "Light & dark",
    desc: "Toggle the sun/moon icon in the navigation bar. The app remembers your preference on this device.",
  },
  {
    icon: "bi-bell",
    iconClass: "lm-topic__icon lm-topic__icon--accent",
    title: "Stay in sync",
    desc: "Edits and shares update in real time. Open the app on your phone while you shop and check things off there.",
  },
  {
    icon: "bi-shield-lock",
    iconClass: "lm-topic__icon lm-topic__icon--violet",
    title: "Privacy first",
    desc: "Your lists belong to you. We don't sell your data, and you can delete your account at any time.",
  },
];

export default function Help() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return TOPICS;
    return TOPICS.filter((t) => t.title.toLowerCase().includes(query) || t.desc.toLowerCase().includes(query));
  }, [q]);

  return (
    <div className="lm-container" style={{ paddingTop: 24, paddingBottom: 60, maxWidth: 980 }}>
      <div className="lm-hero" style={{ alignItems: "center", textAlign: "center" }}>
        <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <i className="bi bi-life-preserver" /> Help center
        </span>
        <h1 className="lm-hero__title font-display" style={{ fontSize: 38 }}>How can we help?</h1>
        <p className="lm-hero__subtitle" style={{ margin: "0 auto" }}>
          Quick answers to the most common questions about using SmartGrocery.
        </p>

        <div style={{ position: "relative", width: "100%", maxWidth: 480, margin: "20px auto 0" }}>
          <i className="bi bi-search" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search topics…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ height: 48, paddingLeft: 44, fontSize: 15, borderRadius: "var(--radius-md)" }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="lm-empty anim-fade">
          <div className="lm-empty__art"><i className="bi bi-search" /></div>
          <h3 className="lm-empty__title">No matches</h3>
          <p className="lm-empty__desc">Try a different keyword or clear your search.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {filtered.map((t, i) => (
            <article
              key={t.title}
              className="lm-topic"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <span className={t.iconClass}>
                <i className={`bi ${t.icon}`} />
              </span>
              <div>
                <h3 className="lm-topic__title">{t.title}</h3>
                <p className="lm-topic__desc">{t.desc}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="lm-card lm-card--elevated" style={{ marginTop: 32, padding: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--color-primary-soft)", color: "var(--color-primary)", display: "grid", placeItems: "center", fontSize: 20 }}>
          <i className="bi bi-chat-dots" />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Still need help?</h3>
          <p style={{ fontSize: 13.5, color: "var(--text-secondary)", margin: "2px 0 0" }}>
            Reach out — we usually reply within a day.
          </p>
        </div>
        <a className="btn btn-primary" href="mailto:support@smartgrocery.app">
          <i className="bi bi-envelope" /> Contact support
        </a>
      </div>
    </div>
  );
}
