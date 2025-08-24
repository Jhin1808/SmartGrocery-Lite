// src/pages/AuthTabs.jsx
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiLogin, apiRegister, API_BASE } from "../api";
import { useAuth } from "./AuthContext";

export default function AuthTabs() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const { search } = useLocation();

  // tabs
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

  // Show an error if Google callback sent ?error=...
  useEffect(() => {
    const p = new URLSearchParams(search);
    const err = p.get("error");
    const reason = p.get("reason");
    if (err) {
      setLoginErr(reason || err);
      window.history.replaceState({}, "", "/login");
    }
  }, [search]);

  const canLogin =
    loginEmail.trim().includes("@") && loginPwd.trim().length >= 6;
  const canRegister =
    regEmail.trim().includes("@") && regPwd.trim().length >= 6 && agree;

  const googleLogin = () => {
    // Optional: add ?next=/lists if want to return to a specific page after SSO
    // const next = encodeURIComponent("/lists");
    // window.location.href = `${API_BASE}/auth/google/login?next=${next}`;
    window.location.href = `${API_BASE}/auth/google/login`;
  };

  const doLogin = async (e) => {
    e.preventDefault();
    if (!canLogin) return;
    setLoginBusy(true);
    setLoginErr(null);
    try {
      await apiLogin(loginEmail.trim(), loginPwd); // cookie set server-side
      await refresh();
      navigate("/lists", { replace: true });
    } catch (e) {
      setLoginErr(e.message || "Login failed");
    } finally {
      setLoginBusy(false);
    }
  };

  const doRegister = async (e) => {
    e.preventDefault();
    if (!canRegister) {
      setRegErr("Please fill all fields and accept terms.");
      return;
    }
    setRegBusy(true);
    setRegErr(null);
    try {
      await apiRegister({ email: regEmail.trim(), password: regPwd });
      await apiLogin(regEmail.trim(), regPwd); // sign in after register
      await refresh();
      navigate("/lists", { replace: true });
    } catch (e) {
      setRegErr(e.message || "Registration failed");
    } finally {
      setRegBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="tabs">
        <button
          className={`tab ${tab === "login" ? "active" : ""}`}
          onClick={() => setTab("login")}
        >
          Login
        </button>
        <button
          className={`tab ${tab === "register" ? "active" : ""}`}
          onClick={() => setTab("register")}
        >
          Register
        </button>
      </div>

      {tab === "login" && (
        <form onSubmit={doLogin} className="row" style={{ gap: 12 }}>
          <div className="center">
            <p>Sign in with:</p>
            <div className="socials">
              <button type="button" className="btn-ghost" onClick={googleLogin}>
                🔵 Google
              </button>
              <button type="button" className="btn-ghost" disabled>
                🐙 GitHub
              </button>
            </div>
            <p className="center" style={{ color: "#666" }}>
              or
            </p>
          </div>

          <input
            className="input"
            type="email"
            placeholder="Email address"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={loginPwd}
            onChange={(e) => setLoginPwd(e.target.value)}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" /> Remember me
            </label>
            <a href="#!">Forgot password?</a>
          </div>

          {loginErr &&
            loginErr.split("\n").map((line, i) => (
              <div key={i} className="error">
                {line}
              </div>
            ))}
          <button className="btn" disabled={loginBusy || !canLogin}>
            {loginBusy ? "Signing in…" : "Sign in"}
          </button>
          <p className="center">
            Not a member?{" "}
            <a href="#!" onClick={() => setTab("register")}>
              Register
            </a>
          </p>
        </form>
      )}

      {tab === "register" && (
        <form onSubmit={doRegister} className="row" style={{ gap: 12 }}>
          <div className="center">
            <p>Sign up with:</p>
            <div className="socials">
              <button type="button" className="btn-ghost" onClick={googleLogin}>
                🔵 Google
              </button>
              <button type="button" className="btn-ghost" disabled>
                🐙 GitHub
              </button>
            </div>
            <p className="center" style={{ color: "#666" }}>
              or
            </p>
          </div>

          <input
            className="input"
            type="email"
            placeholder="Email"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Password (min 6)"
            value={regPwd}
            onChange={(e) => setRegPwd(e.target.value)}
          />

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />{" "}
            I agree to the terms
          </label>

          {regErr &&
            regErr.split("\n").map((line, i) => (
              <div key={i} className="error">
                {line}
              </div>
            ))}
          <button className="btn" disabled={regBusy || !canRegister}>
            {regBusy ? "Signing up…" : "Sign up"}
          </button>
          <p className="center">
            Have an account?{" "}
            <a href="#!" onClick={() => setTab("login")}>
              Sign in
            </a>
          </p>
        </form>
      )}
    </div>
  );
}

// import { useState, useEffect } from "react";
// import { useLocation } from "react-router-dom";
// import { apiLogin, apiRegister, API_BASE } from "../api";

// export default function AuthTabs({ onLoggedIn }) {
//   const [tab, setTab] = useState("login");

//   // login state
//   const [loginEmail, setLoginEmail] = useState("alice@example.com");
//   const [loginPwd, setLoginPwd] = useState("pass12345");
//   const [loginBusy, setLoginBusy] = useState(false);
//   const [loginErr, setLoginErr] = useState(null);

//   // register state
//   const [regEmail, setRegEmail] = useState("");
//   const [regPwd, setRegPwd] = useState("");
//   const [agree, setAgree] = useState(false);
//   const [regBusy, setRegBusy] = useState(false);
//   const [regErr, setRegErr] = useState(null);

//   const { search } = useLocation();

//   useEffect(() => {
//     const p = new URLSearchParams(search);
//     const err = p.get("error");
//     const reason = p.get("reason");
//     if (err) {
//       setLoginErr(reason || err);
//       // optional: clean URL so the message doesn't persist after refresh
//       window.history.replaceState({}, "", "/login");
//     }
//   }, [search]);

//   const googleLogin = () => {
//     // backend endpoint you’ll add when we do SSO
//      window.location.href = `${API_BASE}/auth/google/login`;
//   };

//   const doLogin = async (e) => {
//     e.preventDefault();
//     setLoginBusy(true); setLoginErr(null);
//     try {
//       const tok = await apiLogin(loginEmail, loginPwd);
//       onLoggedIn(tok);
//     } catch (e) {
//       setLoginErr(e.message || "Login failed");
//     } finally {
//       setLoginBusy(false);
//     }
//   };

//   const doRegister = async (e) => {
//     e.preventDefault();
//     if (!agree) { setRegErr("Please agree to the terms."); return; }
//     setRegBusy(true); setRegErr(null);
//     try {
//       await apiRegister({ email: regEmail.trim(), password: regPwd });
//       const tok = await apiLogin(regEmail, regPwd);
//       onLoggedIn(tok);
//     } catch (e) {

//       setRegErr(e.message || "Registration failed");
//     } finally {
//       setRegBusy(false);
//     }
//   };

//   return (
//     <div className="auth-wrap">
//       <div className="tabs">
//         <button className={`tab ${tab === "login" ? "active" : ""}`} onClick={() => setTab("login")}>Login</button>
//         <button className={`tab ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>Register</button>
//       </div>

//       {tab === "login" && (
//         <form onSubmit={doLogin} className="row">
//           <div className="center">
//             <p>Sign in with:</p>
//             <div className="socials">
//               <button type="button" className="btn-ghost" onClick={googleLogin}>🔵 Google</button>
//               <button type="button" className="btn-ghost" disabled>🐙 GitHub</button>
//             </div>
//             <p className="center" style={{color:"#666"}}>or</p>
//           </div>

//           <input className="input" type="email" placeholder="Email address"
//                  value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} />
//           <input className="input" type="password" placeholder="Password"
//                  value={loginPwd} onChange={e=>setLoginPwd(e.target.value)} />

//           <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
//             <label style={{display:"flex",gap:6,alignItems:"center"}}>
//               <input type="checkbox" /> Remember me
//             </label>
//             <a href="#!">Forgot password?</a>
//           </div>

//           {loginErr && <div className="error">{loginErr}</div>}
//           <button className="btn" disabled={loginBusy}>{loginBusy ? "Signing in…" : "Sign in"}</button>
//           <p className="center">Not a member? <a href="#!" onClick={()=>setTab("register")}>Register</a></p>
//         </form>
//       )}

//       {tab === "register" && (
//         <form onSubmit={doRegister} className="row">
//           <div className="center">
//             <p>Sign up with:</p>
//             <div className="socials">
//               <button type="button" className="btn-ghost" onClick={googleLogin}>🔵 Google</button>
//               <button type="button" className="btn-ghost" disabled>🐙 GitHub</button>
//             </div>
//             <p className="center" style={{color:"#666"}}>or</p>
//           </div>

//           <input className="input" type="email" placeholder="Email"
//                  value={regEmail} onChange={e=>setRegEmail(e.target.value)} />
//           <input className="input" type="password" placeholder="Password"
//                  value={regPwd} onChange={e=>setRegPwd(e.target.value)} />

//           <label style={{display:"flex",gap:6,alignItems:"center"}}>
//             <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} /> I agree to the terms
//           </label>

//           {regErr && <div className="error">{regErr}</div>}
//           <button className="btn" disabled={regBusy}>{regBusy ? "Signing up…" : "Sign up"}</button>
//         </form>
//       )}
//     </div>
//   );
// }
