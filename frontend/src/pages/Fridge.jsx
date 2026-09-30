import { useEffect, useState } from "react";
import { isDemo } from "../demo";
import { Link } from "react-router-dom";
import { apiFridge, apiSaveFood, apiRemoveFood, apiFridgeMeals, apiGetLists, apiMissingToList } from "../api";

const groups = [
  {name: "Vegetables", foods: ["Tomato", "Onion", "Potato", "Carrot", "Spinach", "Garlic"]},
  {name: "Protein & dairy", foods: ["Chicken", "Eggs", "Beef", "Salmon", "Milk", "Cheese"]},
  {name: "Pantry", foods: ["Rice", "Pasta", "Bread", "Lentils"]},
];
const key = name => {
  const value = name.trim().toLowerCase();
  return ({tomatoes:"tomato",potatoes:"potato",onions:"onion",eggs:"egg",carrots:"carrot"})[value] || value;
};
const today = () => new Date().toLocaleDateString("en-CA");
const fresh = food => !food.expiry || food.expiry >= today();

export default function Fridge() {
  const [foods, setFoods] = useState([]);
  const [food, setFood] = useState("");
  const [query, setQuery] = useState("");
  const [lists, setLists] = useState([]);
  const [list, setList] = useState("");
  const [meals, setMeals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const usable = foods.filter(fresh);
  const locked = busy || finding;
  const common = new Set(groups.flatMap(g => g.foods.map(key)));
  const extras = usable.filter(f => !common.has(key(f.name)));
  const expired = foods.filter(f => !fresh(f));
  useEffect(() => {
    if (isDemo()) { setLoading(false); return; }
    let active = true;
    Promise.all([apiFridge(), apiGetLists()]).then(([f, l]) => {
      if (active) { setFoods(f); setLists(l.filter(l => l.role !== "viewer")); }
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function toggle(name) {
    setBusy(true); setError(""); setNotice("");
    try {
      const selected = usable.filter(f => key(f.name) === key(name));
      if (selected.length) {
        for (const item of selected) await apiRemoveFood(item.id);
        setFoods(f => f.filter(i => !selected.some(s => s.id === i.id)));
      } else {
        const saved = await apiSaveFood({name, quantity:1, unit:"items", expiry:null});
        setFoods(f => [...f, saved]);
      }
      setMeals(null); return true;
    } catch(e) { setError(e.message); setFoods(await apiFridge().catch(() => foods)); return false; }
    finally { setBusy(false); }
  }
  async function addFood(e) {
    e.preventDefault();
    const name = food.trim();
    if (!name) return;
    if (usable.some(f => key(f.name) === key(name))) { setNotice("That ingredient is already checked."); return; }
    if (await toggle(name)) setFood("");
  }
  async function removeExpired(id) {
    setBusy(true); setError("");
    try { await apiRemoveFood(id); setFoods(f => f.filter(i => i.id !== id)); }
    catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  async function find(e) {
    e.preventDefault(); setFinding(true); setError(""); setNotice(""); setMeals(null);
    try { setMeals(await apiFridgeMeals("", query.trim())); }
    catch(e) { setError(e.message); } finally { setFinding(false); }
  }
  async function addMissing(id) {
    setBusy(true); setError("");
    try { const r = await apiMissingToList(id, list); setNotice(`${r.added} ingredients added to your grocery list. Duplicates skipped.`); }
    catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  if (isDemo()) return <div className="recipe-kitchen"><h1>Cook with what you have.</h1><p>Exit the demo from the account menu and sign in to save your ingredients and find recipes.</p></div>;
  return <div className="recipe-kitchen">
    <header><p className="workspace-eyebrow">FROM YOUR FRIDGE TO DINNER</p><h1>Cook with what you have.</h1><p>Check your ingredients, add anything else, and find a recipe.</p></header>
    {error && <div className="lm-alert lm-alert--danger" role="alert">{error}</div>}
    {notice && <p className="kitchen-notice" role="status">{notice}</p>}
    {loading ? <p role="status">Loading your ingredients…</p> : <>
      <section className="ingredient-sheet" aria-labelledby="ingredients-heading">
        <div className="ingredient-heading"><h2 id="ingredients-heading">What do you have?</h2><span>{usable.length} selected · saved automatically</span></div>
        <div className="ingredient-groups">{groups.map(g => <fieldset key={g.name}><legend>{g.name}</legend><div className="common-foods">{g.foods.map(name => <label className="ingredient-check" key={name}><input type="checkbox" checked={usable.some(f => key(f.name) === key(name))} disabled={locked} onChange={() => toggle(name)} /><span>{name}</span></label>)}</div></fieldset>)}</div>
        <form className="ingredient-add" onSubmit={addFood}><label className="visually-hidden" htmlFor="other-food">Add another ingredient</label><input id="other-food" className="form-control" placeholder="Something else? e.g. mushrooms" maxLength={120} value={food} disabled={locked} onChange={e => setFood(e.target.value)} /><button className="btn btn-secondary" disabled={locked || !food.trim()}>Add ingredient</button></form>
        {extras.length > 0 && <div className="extra-ingredients" aria-label="Other ingredients">{extras.map(f => <label className="ingredient-check" key={f.id}><input type="checkbox" checked disabled={locked} onChange={() => toggle(f.name)} /><span>{f.name}</span></label>)}</div>}
        {expired.length > 0 && <details className="past-ingredients"><summary>{expired.length} past use-by · excluded from recipes</summary>{expired.map(f => <div key={f.id}>{f.name} <button type="button" disabled={locked} onClick={() => removeExpired(f.id)}>Remove</button></div>)}</details>}
      </section>
      <section className="recipe-finder" aria-labelledby="recipes-heading">
        <h2 id="recipes-heading">Find something to cook.</h2>
        <form className="recipe-search" onSubmit={find}><label className="visually-hidden" htmlFor="recipe-query">Search recipes</label><input id="recipe-query" className="form-control" placeholder="Search a recipe, or leave blank to use your ingredients" maxLength={120} value={query} disabled={locked} onChange={e => setQuery(e.target.value)} /><button className="btn btn-primary" disabled={locked || (!usable.length && !query.trim())}>{finding ? "Finding recipes…" : "Find recipes"}</button></form>
        <p className="recipe-hint">Check quantities before cooking. Recipes from TheMealDB.</p>
        {meals && !meals.length && <p role="status">No recipes found. Try another ingredient or search for a dish by name.</p>}
        {meals?.length > 0 && <div className="recipe-results-heading"><p>{meals.length} recipe ideas</p><label>Missing ingredients go to<select className="form-select" value={list} onChange={e => setList(e.target.value)}><option value="">Choose a grocery list</option>{lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>{!lists.length && <Link to="/lists">Create a grocery list</Link>}</div>}
        <div className="kitchen-recipes">{meals?.map(m => <article className="kitchen-recipe" key={m.external_id}>
          <h3>{m.title}</h3><p><strong>{m.have.length} ingredients on hand</strong> · {m.missing.length} missing</p>
          <details><summary>Ingredients</summary><p><strong>You have:</strong> {m.have.map(i => i.original).join(", ") || "None checked"}</p><p><strong>You need:</strong> {m.missing.map(i => i.original).join(", ") || "You have them all. Check quantities."}</p></details>
          <footer>{m.source_url && /^https?:\/\//.test(m.source_url) && <a href={m.source_url} target="_blank" rel="noreferrer">Read recipe ↗</a>}<button className="btn btn-secondary" disabled={!list || locked || !m.missing.length} onClick={() => addMissing(m.external_id)}>Add missing to list</button></footer>
        </article>)}</div>
      </section>
    </>}
  </div>;
}
