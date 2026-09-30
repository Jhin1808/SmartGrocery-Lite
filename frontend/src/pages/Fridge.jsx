import { useEffect, useState } from "react";
import { isDemo } from "../demo";
import { Link } from "react-router-dom";
import { apiFridge, apiSaveFood, apiRemoveFood, apiFridgeMeals, apiGetLists, apiMissingToList } from "../api";

const empty = { name: "", quantity: 1, unit: "items", expiry: "" };
const today = () => new Date().toLocaleDateString("en-CA");

export default function Fridge() {
  const [foods, setFoods] = useState([]);
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [lists, setLists] = useState([]);
  const [list, setList] = useState("");
  const [ingredient, setIngredient] = useState("");
  const [meals, setMeals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const usable = foods.filter(f => !f.expiry || f.expiry >= today());
  useEffect(() => {
    if (isDemo()) { setLoading(false); return; }
    let active = true;
    Promise.all([apiFridge(), apiGetLists()]).then(([f, l]) => {
      if (active) { setFoods(f); setLists(l); }
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function save(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await apiSaveFood({ ...draft, quantity: Number(draft.quantity), expiry: draft.expiry || null }, editing);
      setFoods(await apiFridge()); setDraft(empty); setEditing(null); setMeals(null); setNotice("Fridge updated.");
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  async function remove(id) {
    setBusy(true); setError("");
    try { await apiRemoveFood(id); setFoods(f => f.filter(i => i.id !== id)); setIngredient(""); setEditing(null); setDraft(empty); setMeals(null); setNotice("Food removed from your fridge."); }
    catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  async function find(e) {
    e.preventDefault(); setFinding(true); setError(""); setMeals(null);
    try { setMeals(await apiFridgeMeals(ingredient)); }
    catch(e) { setError(e.message); } finally { setFinding(false); }
  }
  async function addMissing(id) {
    setBusy(true); setError("");
    try { const r = await apiMissingToList(id, list); setNotice(`${r.added} missing ingredients added. Ingredients already on the list were skipped.`); }
    catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  if (isDemo()) return <div className="fridge-page"><h1>Inside your fridge.</h1><p>Fridge inventory is saved to your account. Exit the demo from the account menu, then sign in to add your own food and find meals.</p></div>;
  return <div className="fridge-page">
    <p className="workspace-eyebrow">MAKE THE MOST OF WHAT YOU HAVE</p>
    <h1>Inside your fridge.</h1>
    <p className="fridge-intro">A quick stocktake before the next shop. Keep food here, use up the ingredients you have, and find something good for dinner.</p>
    {error && <div className="lm-alert lm-alert--danger" role="alert">{error}</div>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Opening your fridge…</p> : <div className="fridge-layout">
      <section className="fridge-section" aria-labelledby="food-heading">
        <h2 id="food-heading">What’s on hand</h2>
        <p>Your own inventory, saved to your account.</p>
        <form className="fridge-form" onSubmit={save}>
          <label>Food<input className="form-control" required maxLength={120} placeholder="e.g. Chicken, tomatoes, eggs" value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} /></label>
          <label>Quantity<input className="form-control" type="number" min="1" max="9999" required value={draft.quantity} onChange={e => setDraft({...draft, quantity: e.target.value})} /></label>
          <label>Unit<select className="form-select" value={draft.unit} onChange={e => setDraft({...draft, unit: e.target.value})}>{["items", "g", "kg", "ml", "litres", "packs", "bunches"].map(u => <option key={u}>{u}</option>)}</select></label>
          <label>Use-by date (optional)<input className="form-control" type="date" value={draft.expiry} onChange={e => setDraft({...draft, expiry: e.target.value})} /></label>
          <button className="btn btn-primary" disabled={busy || finding}>{busy ? "Saving…" : editing ? "Save food" : "Add food"}</button>
          {editing && <button type="button" className="btn btn-secondary" onClick={() => {setEditing(null);setDraft(empty);}}>Cancel edit</button>}
        </form>
        {!foods.length && <p className="fridge-empty">Start with a few things you already have. The ingredients for your next meal might be here.</p>}
        {[...foods].sort((a,b) => (a.expiry || "9999").localeCompare(b.expiry || "9999")).map(f => <div className="food-row" key={f.id}>
          <div><strong>{f.name}</strong><small>{f.quantity} {f.unit}</small>{f.expiry && <small className={f.expiry < today() ? "food-expired" : ""}>{f.expiry < today() ? "Past use-by · " : "Use by "}{f.expiry}</small>}</div>
          <div><button aria-label={`Edit ${f.name}`} disabled={busy || finding} onClick={() => {setEditing(f.id);setDraft({...f, expiry:f.expiry || ""});}}>Edit</button><button aria-label={`Remove ${f.name}`} disabled={busy || finding} onClick={() => remove(f.id)}><i className="bi bi-x-lg" aria-hidden="true" /></button></div>
        </div>)}
      </section>
      <section className="fridge-section" aria-labelledby="meal-heading">
        <h2 id="meal-heading">What’s for dinner?</h2>
        <p>Choose an ingredient to use first. Recipes come from TheMealDB.</p>
        <form className="meal-controls" onSubmit={find}>
          <select aria-label="Ingredient to cook with" className="form-select" required value={ingredient} onChange={e => setIngredient(e.target.value)}><option value="">Choose something in your fridge</option>{usable.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select>
          <button className="btn btn-primary" disabled={finding || !usable.length}>{finding ? "Finding meals…" : "Find meals"}</button>
        </form>
        <p className="form-help">Matches use ingredient names, not quantities. Check measures and use-by dates before cooking. Past use-by food is excluded.</p>
        {!usable.length && <p className="fridge-empty">Add food above to start finding meals.</p>}
        {meals && !meals.length && <p role="status">No meals found for that ingredient. Try a simple name such as chicken, potato or tomato.</p>}
        {meals?.length > 0 && <label className="form-field">Grocery list for missing ingredients<select className="form-select" value={list} onChange={e => setList(e.target.value)}><option value="">Choose a list</option>{lists.filter(l => l.role !== "viewer").map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>{!lists.length && <Link to="/lists">Create a grocery list</Link>}</label>}
        {meals?.map(m => <article className="fridge-meal" key={m.external_id}>
          <h3>{m.title}</h3><p><strong>{m.have.length} on hand</strong> · {m.missing.length} to pick up</p>
          <details><summary>Check ingredients</summary><p><strong>On hand:</strong> {m.have.map(i => i.original).join(", ") || "None"}</p><p><strong>Missing:</strong> {m.missing.map(i => i.original).join(", ") || "You have every ingredient. Check quantities."}</p></details>
          <footer><button className="btn btn-secondary" disabled={!list || busy || !m.missing.length} onClick={() => addMissing(m.external_id)}>Add missing to list</button>{m.source_url && /^https?:\/\//.test(m.source_url) && <a href={m.source_url} target="_blank" rel="noreferrer">Read recipe ↗</a>}</footer>
        </article>)}
      </section>
    </div>}
  </div>;
}
