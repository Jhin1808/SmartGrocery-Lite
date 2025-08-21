import { useEffect, useState } from "react";
import { apiGetLists, apiCreateList } from "../api";

export default function Lists() {
  const [lists,setLists]=useState([]);
  const [name,setName]=useState("");
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState(null);

  const load = async () => {
    try { setErr(null); setLists(await apiGetLists()); }
    catch (e) { setErr(e.message || "Failed to load"); }
  };
  useEffect(()=>{ load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { setBusy(true); await apiCreateList(name.trim()); setName(""); await load(); }
    catch (e) { setErr(e.message || "Failed to create"); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <h2>Your Lists</h2>
      <form onSubmit={add} style={{display:"flex",gap:8,marginBottom:12}}>
        <input className="input" placeholder="List name" value={name} onChange={e=>setName(e.target.value)} />
        <button className="btn" disabled={busy || !name.trim()}>{busy ? "Adding…" : "Add"}</button>
      </form>
      {err && <div className="error">{err}</div>}
      <ul>{lists.map(l => <li key={l.id}>{l.name}</li>)}</ul>
    </div>
  );
}
