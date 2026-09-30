import { Link } from "react-router-dom";

export default function Brand({ to = "/" }) {
  return <Link className="brand" to={to} aria-label="ToBuyLists home">
    <i className="bi bi-basket2" aria-hidden="true" />
    <span>ToBuyLists</span>
  </Link>;
}
