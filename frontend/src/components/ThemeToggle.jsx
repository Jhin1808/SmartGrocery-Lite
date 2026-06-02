import { useEffect, useState } from "react";

const STORAGE_KEY = "sg-theme";

function getInitial() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState(getInitial);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
    const el = document.documentElement;
    el.setAttribute("data-theme", theme);
    el.setAttribute("data-bs-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0c0a09" : "#0d9488");
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <button
      type="button"
      onClick={toggle}
      className={`lm-theme-toggle ${className}`}
      aria-label="Toggle color theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <i className="bi bi-moon-fill" aria-hidden="true" />
      <i className="bi bi-sun-fill" aria-hidden="true" />
    </button>
  );
}
