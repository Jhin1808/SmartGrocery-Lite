import { useState } from "react";
import Login from "./pages/Login";
import Lists from "./pages/Lists";
import { setToken } from "./api";

export default function App() {
  const [token, setTok] = useState(null);

  const onLoggedIn = (t) => { setTok(t); setToken(t); };
  const logout = () => { setTok(null); setToken(null); };

  if (!token) return <Login onLoggedIn={onLoggedIn} />;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",padding:12}}>
        <button onClick={logout}>Log out</button>
      </div>
      <Lists />
    </div>
  );
}
