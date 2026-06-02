// Demo mode — in-memory sample data and a small event bus so every page
// (Lists, ListDetail, modals, toasts) sees the same state without a backend.

const KEY = "sg-demo";

const addDays = (d) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

const SAMPLE_USER = {
  id: 1,
  name: "Alex Morgan",
  email: "alex@example.com",
  picture: "",
};

function makeItems(listId) {
  const map = {
    1: [
      { name: "Whole milk", quantity: 2, expiry: addDays(5) },
      { name: "Sourdough bread", quantity: 1, expiry: addDays(3) },
      { name: "Free-range eggs", quantity: 12, expiry: addDays(14) },
      { name: "Greek yogurt", quantity: 4, expiry: addDays(7), description: "Fage 2%" },
      { name: "Butter", quantity: 1, expiry: addDays(21) },
      { name: "Cheddar cheese", quantity: 1, expiry: addDays(28) },
      { name: "Orange juice", quantity: 1, expiry: addDays(10), description: "No pulp" },
    ],
    2: [
      { name: "Bananas", quantity: 6, expiry: addDays(4) },
      { name: "Honeycrisp apples", quantity: 8, expiry: addDays(12) },
      { name: "Avocados", quantity: 3, expiry: addDays(2) },
      { name: "Baby spinach", quantity: 1, expiry: addDays(3) },
      { name: "Cherry tomatoes", quantity: 1, expiry: addDays(6) },
      { name: "Blueberries", quantity: 1, expiry: addDays(5) },
    ],
    3: [
      { name: "Chicken breast", quantity: 2, expiry: addDays(2) },
      { name: "Salmon fillet", quantity: 1, expiry: addDays(1) },
      { name: "Pasta", quantity: 3, expiry: addDays(180) },
      { name: "Olive oil", quantity: 1, expiry: addDays(365) },
      { name: "Garlic", quantity: 1, expiry: addDays(14) },
    ],
    4: [
      { name: "Toilet paper", quantity: 12 },
      { name: "Dish soap", quantity: 1 },
      { name: "Laundry detergent", quantity: 1 },
      { name: "Hand soap", quantity: 2 },
    ],
  };
  return (map[listId] || []).map((it, i) => ({
    id: listId * 1000 + i + 1,
    list_id: listId,
    purchased: false,
    description: it.description || "",
    ...it,
  }));
}

const SAMPLE_LISTS = [
  {
    id: 1,
    name: "Weekly groceries",
    hidden: false,
    shared: false,
    role: "owner",
    owner_id: 1,
  },
  {
    id: 2,
    name: "Fresh produce",
    hidden: false,
    shared: false,
    role: "owner",
    owner_id: 1,
  },
  {
    id: 3,
    name: "Meal prep",
    hidden: false,
    shared: true,
    role: "editor",
    owner_id: 1,
  },
  {
    id: 4,
    name: "Household",
    hidden: true,
    shared: false,
    role: "owner",
    owner_id: 1,
  },
];

const SAMPLE_SHARES = [
  { id: 1, email: "sam@example.com", role: "editor" },
  { id: 2, email: "jordan@example.com", role: "viewer" },
];

let state = null;
const subscribers = new Set();

function buildInitialState() {
  const itemsByList = {};
  SAMPLE_LISTS.forEach((l) => { itemsByList[l.id] = makeItems(l.id); });
  return { lists: [...SAMPLE_LISTS], itemsByList, shares: [...SAMPLE_SHARES] };
}

export function isDemo() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function enterDemo() {
  try { localStorage.setItem(KEY, "1"); } catch {}
  state = buildInitialState();
  emit();
}

export function exitDemo() {
  try { localStorage.removeItem(KEY); } catch {}
  state = null;
  emit();
}

function emit() {
  subscribers.forEach((cb) => { try { cb(); } catch {} });
}

export function subscribeDemo(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function ensure() {
  if (!state) state = buildInitialState();
  return state;
}

function uid() {
  return Math.floor(Date.now() + Math.random() * 1000);
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

// Public read API — returns fresh clones so React re-renders.
export function demoGetLists(includeHidden = false) {
  const s = ensure();
  const arr = includeHidden ? s.lists : s.lists.filter((l) => !l.hidden);
  return clone(arr);
}

export function demoGetItems(listId) {
  const s = ensure();
  return clone(s.itemsByList[listId] || []);
}

export function demoGetShares() {
  const s = ensure();
  return clone(s.shares);
}

export function demoGetUser() {
  return { ...SAMPLE_USER };
}

// Public write API — mutates in-memory state and emits.
export function demoAddItem(listId, patch) {
  const s = ensure();
  const item = {
    id: uid(),
    list_id: listId,
    name: patch.name,
    quantity: Number(patch.quantity || 1),
    expiry: patch.expiry || null,
    description: patch.description || "",
    purchased: false,
  };
  s.itemsByList[listId] = [item, ...(s.itemsByList[listId] || [])];
  emit();
  return clone(item);
}

export function demoUpdateItem(itemId, patch) {
  const s = ensure();
  for (const listId of Object.keys(s.itemsByList)) {
    const arr = s.itemsByList[listId];
    const idx = arr.findIndex((x) => x.id === itemId);
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], ...patch };
      emit();
      return clone(arr[idx]);
    }
  }
  return null;
}

export function demoDeleteItem(itemId) {
  const s = ensure();
  for (const listId of Object.keys(s.itemsByList)) {
    const before = s.itemsByList[listId].length;
    s.itemsByList[listId] = s.itemsByList[listId].filter((x) => x.id !== itemId);
    if (s.itemsByList[listId].length !== before) {
      emit();
      return true;
    }
  }
  return false;
}

export function demoCreateList(name) {
  const s = ensure();
  const id = Math.max(0, ...s.lists.map((l) => l.id)) + 1;
  const list = { id, name, hidden: false, shared: false, role: "owner", owner_id: 1 };
  s.lists = [list, ...s.lists];
  s.itemsByList[id] = [];
  emit();
  return clone(list);
}

export function demoRenameList(listId, name) {
  const s = ensure();
  const l = s.lists.find((x) => x.id === listId);
  if (l) { l.name = name; emit(); }
  return clone(l);
}

export function demoDeleteList(listId) {
  const s = ensure();
  s.lists = s.lists.filter((l) => l.id !== listId);
  delete s.itemsByList[listId];
  emit();
}

export function demoHideList(listId) {
  const s = ensure();
  const l = s.lists.find((x) => x.id === listId);
  if (l) { l.hidden = true; emit(); }
}

export function demoUnhideList(listId) {
  const s = ensure();
  const l = s.lists.find((x) => x.id === listId);
  if (l) { l.hidden = false; emit(); }
}

export function demoAddShare(email, role) {
  const s = ensure();
  const share = { id: uid(), email, role };
  s.shares = [...s.shares, share];
  emit();
  return clone(share);
}

export function demoUpdateShare(shareId, patch) {
  const s = ensure();
  const sh = s.shares.find((x) => x.id === shareId);
  if (sh) { Object.assign(sh, patch); emit(); return clone(sh); }
  return null;
}

export function demoRevokeShare(shareId) {
  const s = ensure();
  s.shares = s.shares.filter((x) => x.id !== shareId);
  emit();
}

// Build a synthetic shareable link for demo mode. The real backend can swap
// this for a signed token URL.
export function demoGetShareLink(listId) {
  const origin = (typeof window !== "undefined" && window.location && window.location.origin) || "";
  return `${origin}/share/${listId}`;
}
