import { useState } from "react";
import { apiLogin, apiRegister, API_BASE } from "../api";


export default function AuthTabs({ onLoggedIn }) {
  const [tab, setTab] = useState("login");

  // login state
  const [loginEmail, setLoginEmail] = useState("alice@example.com");
  const [loginPwd, setLoginPwd] = useState("pass12345");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginErr, setLoginErr] = useState(null);

  // register state
  const [regEmail, setRegEmail] = useState("");
  const [regPwd, setRegPwd] = useState("");
  const [agree, setAgree] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [regErr, setRegErr] = useState(null);

  const googleLogin = () => {
    // backend endpoint you’ll add when we do SSO
    window.location.href = `${API_BASE}/auth/google/login`;
  };

  const doLogin = async (e) => {
    e.preventDefault();
    setLoginBusy(true); setLoginErr(null);
    try {
      const tok = await apiLogin(loginEmail, loginPwd);
      onLoggedIn(tok);
    } catch (e) {
      setLoginErr(e.message || "Login failed");
    } finally {
      setLoginBusy(false);
    }
  };

  const doRegister = async (e) => {
    e.preventDefault();
    if (!agree) { setRegErr("Please agree to the terms."); return; }
    setRegBusy(true); setRegErr(null);
    try {
      await apiRegister(regEmail, regPwd);
      const tok = await apiLogin(regEmail, regPwd);
      onLoggedIn(tok);
    } catch (e) {
      setRegErr(e.message || "Registration failed");
    } finally {
      setRegBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="tabs">
        <button className={`tab ${tab === "login" ? "active" : ""}`} onClick={() => setTab("login")}>Login</button>
        <button className={`tab ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>Register</button>
      </div>

      {tab === "login" && (
        <form onSubmit={doLogin} className="row">
          <div className="center">
            <p>Sign in with:</p>
            <div className="socials">
              <button type="button" className="btn-ghost" onClick={googleLogin}>🔵 Google</button>
              <button type="button" className="btn-ghost" disabled>🐙 GitHub</button>
            </div>
            <p className="center" style={{color:"#666"}}>or</p>
          </div>

          <input className="input" type="email" placeholder="Email address"
                 value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Password"
                 value={loginPwd} onChange={e=>setLoginPwd(e.target.value)} />

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <label style={{display:"flex",gap:6,alignItems:"center"}}>
              <input type="checkbox" /> Remember me
            </label>
            <a href="#!">Forgot password?</a>
          </div>

          {loginErr && <div className="error">{loginErr}</div>}
          <button className="btn" disabled={loginBusy}>{loginBusy ? "Signing in…" : "Sign in"}</button>
          <p className="center">Not a member? <a href="#!" onClick={()=>setTab("register")}>Register</a></p>
        </form>
      )}

      {tab === "register" && (
        <form onSubmit={doRegister} className="row">
          <div className="center">
            <p>Sign up with:</p>
            <div className="socials">
              <button type="button" className="btn-ghost" onClick={googleLogin}>🔵 Google</button>
              <button type="button" className="btn-ghost" disabled>🐙 GitHub</button>
            </div>
            <p className="center" style={{color:"#666"}}>or</p>
          </div>

          <input className="input" type="email" placeholder="Email"
                 value={regEmail} onChange={e=>setRegEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Password"
                 value={regPwd} onChange={e=>setRegPwd(e.target.value)} />

          <label style={{display:"flex",gap:6,alignItems:"center"}}>
            <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} /> I agree to the terms
          </label>

          {regErr && <div className="error">{regErr}</div>}
          <button className="btn" disabled={regBusy}>{regBusy ? "Signing up…" : "Sign up"}</button>
        </form>
      )}
    </div>
  );
}
