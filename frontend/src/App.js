import { useState } from "react";
import { setToken } from "./api";
import AuthTabs from "./pages/AuthTabs";
import Lists from "./pages/Lists";

export default function App() {
  const [token, setTok] = useState(null);
  const onLoggedIn = (t) => { setTok(t); setToken(t); };
  const logout = () => { setTok(null); setToken(null); };

  if (!token) return <AuthTabs onLoggedIn={onLoggedIn} />;

  return (
    <div>
      <div className="header">
        <button className="btn-ghost" onClick={logout}>Log out</button>
      </div>
      <Lists />
    </div>
  );
}
