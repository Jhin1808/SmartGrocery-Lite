import { useEffect, useState } from "react";
import {
  apiGetLists, apiCreateList,
  apiGetItems, apiAddItem, apiDeleteItem
} from "../api";

export default function Lists() {
  const [lists, setLists] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // which list panels are open
  const [openIds, setOpenIds] = useState(new Set());
  // cache items per list id: { [listId]: Item[] }
  const [itemsByList, setItemsByList] = useState({});
  // per-list add-item form state
  const [drafts, setDrafts] = useState({}); // { [listId]: {name, quantity, expiry} }

  const loadLists = async () => {
    try {
      setErr(null);
      const data = await apiGetLists();
      setLists(data);
    } catch (e) {
      setErr(e.message || "Failed to load lists");
    }
  };

  useEffect(() => { loadLists(); }, []);

  const addList = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setBusy(true);
      await apiCreateList(name.trim());
      setName("");
      await loadLists();
    } catch (e) {
      setErr(e.message || "Failed to create list");
    } finally {
      setBusy(false);
    }
  };

  const toggleOpen = async (listId) => {
    const next = new Set(openIds);
    if (next.has(listId)) {
      next.delete(listId);
      setOpenIds(next);
      return;
    }
    next.add(listId);
    setOpenIds(next);
    // lazy-load items the first time we open
    if (!itemsByList[listId]) {
      try {
        const items = await apiGetItems(listId);
        setItemsByList((m) => ({ ...m, [listId]: items }));
      } catch (e) {
        setErr(e.message || "Failed to load items");
      }
    }
  };

  const updateDraft = (listId, patch) =>
    setDrafts((d) => ({ ...d, [listId]: { name: "", quantity: 1, expiry: "", ...(d[listId] || {}), ...patch } }));

  const submitItem = async (e, listId) => {
    e.preventDefault();
    const draft = drafts[listId] || {};
    const nm = (draft.name || "").trim();
    if (!nm) return;
    try {
      const payload = {
        name: nm,
        quantity: Number(draft.quantity || 1),
        // HTML date input gives 'YYYY-MM-DD' or "" → send null when empty
        expiry: draft.expiry ? draft.expiry : null,
      };
      const item = await apiAddItem(listId, payload);
      setItemsByList((m) => ({ ...m, [listId]: [item, ...(m[listId] || [])] }));
      // clear just this draft
      setDrafts((d) => ({ ...d, [listId]: { name: "", quantity: 1, expiry: "" } }));
    } catch (e) {
      setErr(e.message || "Failed to add item");
    }
  };

  const removeItem = async (listId, itemId) => {
    try {
      await apiDeleteItem(itemId);
      setItemsByList((m) => ({ ...m, [listId]: (m[listId] || []).filter(i => i.id !== itemId) }));
    } catch (e) {
      setErr(e.message || "Failed to delete item");
    }
  };

  return (
    <div className="auth-wrap">
      <h2>Your Lists</h2>
      <form onSubmit={addList} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input className="input" placeholder="List name"
               value={name} onChange={e => setName(e.target.value)} />
        <button className="btn" disabled={busy || !name.trim()}>
          {busy ? "Adding…" : "Add"}
        </button>
      </form>

      {err && <div className="error" style={{ marginBottom: 8 }}>{err}</div>}

      <div style={{ display: "grid", gap: 12 }}>
        {lists.map((l) => {
          const open = openIds.has(l.id);
          const draft = drafts[l.id] || { name: "", quantity: 1, expiry: "" };
          const items = itemsByList[l.id] || [];
          return (
            <div key={l.id} style={{ border: "1px solid #eee", borderRadius: 10 }}>
              <button
                className={`tab ${open ? "active" : ""}`}
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => toggleOpen(l.id)}
              >
                {l.name}
              </button>

              {open && (
                <div style={{ padding: 12 }}>
                  {/* Add-item form */}
                  <form onSubmit={(e) => submitItem(e, l.id)} style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8 }}>
                      <input className="input" placeholder="Item name"
                             value={draft.name} onChange={e => updateDraft(l.id, { name: e.target.value })} />
                      <input className="input" type="number" min="1" step="1" placeholder="Qty"
                             value={draft.quantity}
                             onChange={e => updateDraft(l.id, { quantity: e.target.value })} />
                      <input className="input" type="date"
                             value={draft.expiry}
                             onChange={e => updateDraft(l.id, { expiry: e.target.value })} />
                      <button className="btn">Add</button>
                    </div>
                  </form>

                  {/* Items table */}
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{textAlign:"left"}}>Item</th>
                          <th>Qty</th>
                          <th>Expiry</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 && (
                          <tr><td colSpan={4} style={{ color: "#666", textAlign:"center" }}>No items yet</td></tr>
                        )}
                        {items.map((it) => (
                          <tr key={it.id}>
                            <td style={{textAlign:"left"}}>{it.name}</td>
                            <td style={{ textAlign: "center", width: 80 }}>{it.quantity}</td>
                            <td style={{ textAlign: "center", width: 140 }}>{it.expiry ?? "—"}</td>
                            <td style={{ textAlign: "right", width: 80 }}>
                              <button className="btn-ghost" onClick={() => removeItem(l.id, it.id)}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

