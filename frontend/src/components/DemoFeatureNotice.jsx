import { Link } from "react-router-dom";
import { useAuth } from "../pages/AuthContext";

export default function DemoFeatureNotice({ feature }) {
  const { logout } = useAuth();
  return <section className="container py-4" style={{maxWidth: 960}}>
    <p className="workspace-eyebrow">DEMO PREVIEW</p>
    <h1>{feature === "stores" ? "Your neighborhood store." : "A head start on your next list."}</h1>
    <p>{feature === "stores"
      ? "Sign in to find nearby stores and connect real prices to your grocery lists. Store connections aren’t available in the demo."
      : "Sign in to browse templates and add their ingredients to your grocery lists. Templates aren’t available in the demo."}</p>
    <div className="d-flex flex-wrap gap-3">
      <Link className="btn btn-primary" to="/login" onClick={logout}>Exit demo and sign in</Link>
      <Link className="btn btn-outline-secondary" to="/lists">Back to demo lists</Link>
    </div>
  </section>;
}
