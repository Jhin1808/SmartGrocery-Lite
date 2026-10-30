const KEY = "sg-demo-transfer";
export function pendingDemo() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    return draft?.import_key && typeof draft.name === "string" && Array.isArray(draft.items) ? draft : null;
  } catch { return null; }
}
export function stageDemoList(list, items) {
  if (!list) throw new Error("Create a list before keeping it.");
  if (items.length > 200) throw new Error("A saved demo list can contain up to 200 groceries.");
  const draft = { import_key: crypto.randomUUID(), name: list.name,
    items: items.map((item) => ({ name: item.name, quantity: item.quantity || 1, purchased: Boolean(item.purchased) })) };
  try { sessionStorage.setItem(KEY, JSON.stringify(draft)); }
  catch { throw new Error("Your browser couldn’t keep this draft. Allow session storage and try again."); }
  return draft;
}
export function clearPendingDemo() { sessionStorage.removeItem(KEY); }
