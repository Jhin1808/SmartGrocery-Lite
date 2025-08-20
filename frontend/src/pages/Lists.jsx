import { useEffect, useState } from "react";
import { apiGetLists, apiCreateList } from "../api";

export default function Lists() {
  const [lists, setLists] = useState([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setErr(null);
      const data = await apiGetLists();
      setLists(data);
    } catch (ex) {
      setErr(ex.message || "Failed to load lists");
    }
  };

  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setBusy(true);
      await apiCreateList(name.trim());
      setName("");
      load();
    } catch (ex) {
      setErr(ex.message || "Failed to create list");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{maxWidth:560,margin:"40px auto",fontFamily:"system-ui, sans-serif"}}>
      <h2>Your Lists</h2>
      <form onSubmit={add} style={{display:"flex",gap:8,marginBottom:16}}>
        <input placeholder="List name" value={name} onChange={e=>setName(e.target.value)} />
        <button disabled={busy || !name.trim()}>{busy ? "Adding…" : "Add"}</button>
      </form>
      {err && <div style={{color:"crimson",marginBottom:8}}>{err}</div>}
      <ul>
        {lists.map(l => <li key={l.id}>{l.name}</li>)}
      </ul>
    </div>
  );
}
