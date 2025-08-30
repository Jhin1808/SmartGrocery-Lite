import { useEffect, useState } from "react";

const STORAGE_KEY = "sg-theme"; // 'light' | 'dark'

export default function ThemeToggle({ className = "" }) {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || (prefersDark ? "dark" : "light");
    } catch {
      return prefersDark ? "dark" : "light";
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
    const el = document.documentElement;
    el.setAttribute("data-theme", theme);
    el.setAttribute("data-bs-theme", theme); // Bootstrap 5.3 variable support
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <button
      type="button"
      onClick={toggle}
      className={`btn btn-outline-secondary btn-sm ${className}`}
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <i className="bi bi-sun" aria-hidden="true" />
      ) : (
        <i className="bi bi-moon" aria-hidden="true" />
      )}
    </button>
  );
}

