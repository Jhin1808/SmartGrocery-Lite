const ingredientKey = name => {
  const value = name.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  return ({tomatoes:"tomato", potatoes:"potato", onions:"onion", eggs:"egg", carrots:"carrot"})[value] || value;
};
const usable = foods => foods.filter(f => !f.expiry || f.expiry >= new Date().toLocaleDateString("en-CA"));

// Older deployments have recipe APIs but no fridge routes. Only a route-level
// 404 enables this browser-local compatibility mode; auth/server errors propagate.
export function createFridgeClient({request, me, search, detail, items, addItem, base}) {
  let browserOnly = false;
  async function storage() {
    const user = await me();
    const key = `tobuylists:fridge:v1:${base}:${user.id}`;
    let foods;
    try { foods = JSON.parse(localStorage.getItem(key) || "[]"); }
    catch { throw new Error("Your saved ingredients could not be read in this browser."); }
    if (!Array.isArray(foods)) throw new Error("Your saved ingredients could not be read in this browser.");
    return {foods, save: value => {
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch { throw new Error("This browser could not save your ingredients. Allow site storage and try again."); }
    }};
  }
  async function read() {
    try { const foods = await request("/fridge"); browserOnly = false; return foods; }
    catch(e) { if (e.status !== 404 || e.message !== "Not Found") throw e; }
    const {foods} = await storage();
    browserOnly = true;
    return foods;
  }
  async function save(payload, id) {
    if (!browserOnly) return request(`/fridge${id ? `/${id}` : ""}`, {method:id ? "PUT" : "POST", body:payload});
    const state = await storage();
    const food = {...payload, name:payload.name.trim(), id:id || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`};
    state.save(id ? state.foods.map(f => f.id === id ? food : f) : [...state.foods, food]);
    return food;
  }
  async function remove(id) {
    if (!browserOnly) return request(`/fridge/${id}`, {method:"DELETE"});
    const state = await storage(); state.save(state.foods.filter(f => f.id !== id));
  }
  function match(meal, foods) {
    const available = new Set(usable(foods).map(f => ingredientKey(f.name)));
    return {...meal, have:meal.ingredients.filter(i => available.has(ingredientKey(i.name))), missing:meal.ingredients.filter(i => !available.has(ingredientKey(i.name)))};
  }
  async function meals(ingredient = "", q = "") {
    if (!browserOnly) {
      const params = new URLSearchParams();
      if (ingredient) params.set("ingredient", ingredient);
      if (q) params.set("q", q);
      return request(`/fridge/meals/suggestions?${params}`);
    }
    const {foods} = await storage();
    const selected = usable(foods);
    if (!q && !ingredient && !selected.length) return [];
    const batches = q ? [await search({q})] : await Promise.all((ingredient ? [ingredient] : selected.slice(0,3).map(f => f.name)).map(ingredient => search({ingredient})));
    const summaries = []; const seen = new Set();
    for (let row=0; row<(q ? 12 : 4); row++) for (const batch of batches) {
      const meal = batch[row];
      if (meal && !seen.has(meal.external_id)) { summaries.push(meal); seen.add(meal.external_id); }
    }
    const results = await Promise.all(summaries.slice(0,12).map(m => detail(m.external_id)));
    return results.map(m => match(m,foods)).sort((a,b) => b.have.length-a.have.length || a.missing.length-b.missing.length);
  }
  async function missingToList(meal, list) {
    if (!browserOnly) return request(`/fridge/meals/${meal}/to-list/${list}`, {method:"POST"});
    const {foods} = await storage();
    const recipe = match(await detail(meal), foods);
    const existing = new Set((await items(list)).map(i => ingredientKey(i.name)));
    let added = 0;
    for (const i of recipe.missing) {
      const key = ingredientKey(i.name);
      if (!key || existing.has(key)) continue;
      await addItem(list, {name:i.name.slice(0,100), quantity:1, description:[i.measure,i.name].filter(Boolean).join(" "), purchased:false});
      existing.add(key); added++;
    }
    return {added};
  }
  return {read, save, remove, meals, missingToList, browserOnly:() => browserOnly};
}
