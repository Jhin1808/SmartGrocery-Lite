import { useState } from "react";
import { apiLogin } from "../api";

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("alice@example.com");
  const [password, setPassword] = useState("pass12345");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const tok = await apiLogin(email, password);
      onLoggedIn(tok);
    } catch (ex) {
      setErr(ex.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{display:"grid",gap:12,maxWidth:320,margin:"40px auto",fontFamily:"system-ui, sans-serif"}}>
      <h2>Log in</h2>
      <form onSubmit={submit} style={{display:"grid",gap:8}}>
        <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      {err && <div style={{color:"crimson"}}>{err}</div>}
    </div>
  );
}
