import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ORIGIN = "https://www.tobuylists.com";
const DESCRIPTION = "Create and share grocery lists with your household. Organize shopping, track expiry dates, and plan meals together with SmartGrocery Lite.";

export default function PageMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const isTerms = pathname === "/terms";
    const isPublic = ["/", "/login", "/terms"].includes(pathname);
    const title = isTerms
      ? "Terms of Service | SmartGrocery Lite"
      : "Shared Grocery Lists & Expiry Reminders | SmartGrocery Lite";
    const description = isTerms
      ? "Read the SmartGrocery Lite terms of service, including account responsibilities, data ownership, service availability, and contact information."
      : DESCRIPTION;
    const canonical = `${ORIGIN}${pathname === "/" ? "/login" : pathname}`;

    document.title = title;
    const setMeta = (attribute, name, content) => {
      let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };
    setMeta("name", "description", description);
    setMeta("name", "robots", isPublic ? "index, follow" : "noindex, follow");
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonical);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    document.head.querySelector('link[rel="canonical"]').href = canonical;
  }, [pathname]);

  return null;
}
