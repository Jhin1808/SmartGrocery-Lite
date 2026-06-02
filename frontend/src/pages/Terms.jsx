import { useEffect, useState } from "react";

const SECTIONS = [
  {
    id: "use",
    title: "1. Use of the service",
    body: "You may use SmartGrocery only for lawful purposes and in accordance with these Terms. You are responsible for your account and for any activity that occurs under your credentials.",
  },
  {
    id: "data",
    title: "2. Data and content",
    body: "You own the data you enter into the app. Do not store sensitive or confidential information. We may process and store your data solely to provide features of the service.",
  },
  {
    id: "disclaimer",
    title: "3. Disclaimer",
    body: 'The app is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, express or implied. We do not warrant that the app will be uninterrupted, secure, or error-free.',
  },
  {
    id: "liability",
    title: "4. Limitation of liability",
    body: "To the maximum extent permitted by law, in no event shall we be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data, revenue, profits, or goodwill, arising out of or related to your use of the app.",
  },
  {
    id: "termination",
    title: "5. Termination",
    body: "We may suspend or terminate access to the app at any time for any reason, including if you breach these Terms. You can delete your account at any time from the Account page.",
  },
  {
    id: "changes",
    title: "6. Changes to these terms",
    body: "We may update these Terms from time to time. We'll post the new version on this page and, where appropriate, notify you by email. Continued use of the app after changes indicates acceptance of the updated Terms.",
  },
  {
    id: "contact",
    title: "7. Contact",
    body: "If you have questions about these Terms, please reach out via the Help page inside the app.",
  },
];

export default function Terms() {
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const onScroll = () => {
      let cur = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top < 140) cur = s.id;
      }
      setActive(cur);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="lm-container" style={{ paddingTop: 24, paddingBottom: 60, maxWidth: 980 }}>
      <div className="lm-hero">
        <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <i className="bi bi-file-text" /> Legal
        </span>
        <h1 className="lm-hero__title font-display" style={{ fontSize: 38 }}>Terms of Service</h1>
        <p className="lm-hero__subtitle">
          Last updated · {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) 1fr", gap: 32, alignItems: "start" }}
           className="lm-terms-grid">
        <aside className="lm-card lm-card--elevated" style={{ padding: 16, position: "sticky", top: "calc(var(--nav-height) + 16px)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
            On this page
          </div>
          <nav className="lm-list" aria-label="Terms sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(s.id)}
                className={"lm-list__item" + (active === s.id ? " is-active" : "")}
                style={{ padding: "10px 12px", fontSize: 13.5 }}
              >
                {s.title}
              </button>
            ))}
          </nav>
        </aside>

        <article className="lm-card" style={{ padding: "32px clamp(20px, 4vw, 40px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} style={{ scrollMarginTop: "calc(var(--nav-height) + 16px)" }}>
                <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>{s.title}</h2>
                <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.75, margin: 0 }}>{s.body}</p>
              </section>
            ))}
          </div>

          <div className="lm-alert lm-alert--info" style={{ marginTop: 32 }}>
            <i className="bi bi-info-circle lm-alert__icon" />
            <span>By continuing to use SmartGrocery, you agree to these terms. Need a copy? Email us and we'll send a PDF.</span>
          </div>
        </article>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .lm-terms-grid { grid-template-columns: 1fr !important; }
          .lm-terms-grid > aside { position: static !important; }
        }
      `}</style>
    </div>
  );
}
