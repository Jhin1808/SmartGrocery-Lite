import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { apiEveryday, apiGetLists, apiGetItems, apiCreateList, apiPinStaple, apiUnpinStaple, apiQuickAdd, apiRestock } from "../api";
import "./Everyday.css";

const normalize = (name) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const dateLabel = (days) => days < 0 ? "Past entered date" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;

export default function Everyday() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [lists, setLists] = useState([]);
  const [targetId, setTargetId] = useState("");
  const [targetItems, setTargetItems] = useState([]);
  const [targetAttempt, setTargetAttempt] = useState(0);
  const [targetLoading, setTargetLoading] = useState(false);
  const [tab, setTab] = useState("staples");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [newListName, setNewListName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [targetError, setTargetError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const nameInput = useRef(null);
  const target = lists.find((list) => String(list.id) === targetId);

  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const [next, allLists] = await Promise.all([apiEveryday(), apiGetLists(false)]);
      const editable = allLists.filter((list) => !list.hidden && (list.owner_id === user.id || list.role === "editor"));
      setData(next); setLists(editable);
      setTargetId((current) => editable.some((list) => String(list.id) === current) ? current : String(editable[0]?.id || ""));
    } catch (error) { setLoadError(error.message || "Couldn’t load your regulars. Please retry."); }
    finally { setLoading(false); }
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let alive = true;
    setTargetItems([]); setTargetError("");
    if (!targetId) { setTargetLoading(false); return; }
    setTargetLoading(true);
    apiGetItems(Number(targetId)).then((items) => { if (alive) setTargetItems(items); })
      .catch((error) => { if (alive) setTargetError(error.message || "Couldn’t check your destination list."); })
      .finally(() => { if (alive) setTargetLoading(false); });
    return () => { alive = false; };
  }, [targetId, targetAttempt]);

  async function run(task) {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setStatus(""); setActionError("");
    try { await task(); }
    catch (error) { setActionError(error.message || "That didn’t save. Please try again."); }
    finally { actionLock.current = false; setBusy(false); }
  }

  async function pin(grocery) {
    const pinned = await apiPinStaple({ name: grocery.name, quantity: grocery.quantity });
    setData((current) => ({ ...current, staples: [...current.staples.filter((item) => item.id !== pinned.id), pinned] }));
    setStatus(`${pinned.name} is a staple. Use “We’re out” whenever you need it.`);
  }

  function quickAdd(grocery) {
    run(async () => {
      const result = await apiQuickAdd({ list_id: Number(targetId), name: grocery.name, quantity: grocery.quantity });
      // Reflect the successful write immediately; don't make a second GET part of success.
      setTargetItems((items) => [...items.filter((item) => normalize(item.name) !== normalize(grocery.name)), { name: grocery.name, purchased: false }]);
      setData((current) => ({ ...current, use_first: current.use_first.filter((item) => !(result.result === "restored" && item.id === result.item_id)) }));
      setStatus(result.result === "already_present" ? `${grocery.name} is already on ${target.name}.` : `${grocery.name} added to ${target.name}.`);
    });
  }

  const pending = (grocery) => targetItems.some((item) => !item.purchased && normalize(item.name) === normalize(grocery.name));
  const canAdd = Boolean(targetId) && !targetLoading && !targetError && !busy;
  const stapleKeys = new Set((data?.staples || []).map((item) => normalize(item.name)));

  return (
    <div className="everyday-page">
      <header className="everyday-heading">
        <h1>Everyday</h1>
        <p>Restock your regulars, buy something again, or use what’s already at home.</p>
        <Link to="/lists">Back to shopping lists</Link>
      </header>
      {loading ? <p role="status">Loading your regulars…</p> : loadError ? (
        <div role="alert"><p>{loadError}</p><button className="btn btn-secondary" onClick={load}>Retry</button></div>
      ) : (
        <>
          <section className="everyday-destination" aria-label="Shopping destination">
            {lists.length ? <>
              <label htmlFor="everyday-list">Add groceries to</label>
              <select id="everyday-list" value={targetId} disabled={busy} onChange={(event) => { setTargetId(event.target.value); setStatus(""); }}>
                {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
              </select>
              {targetLoading && <p role="status">Checking this list…</p>}
              {targetError && <p role="alert">{targetError} <button className="everyday-text-button" onClick={() => setTargetAttempt((attempt) => attempt + 1)}>Retry</button></p>}
            </> : <form onSubmit={(event) => { event.preventDefault(); if (!newListName.trim()) return; run(async () => {
              const list = await apiCreateList(newListName.trim()); setLists([list]); setTargetId(String(list.id)); setNewListName("");
              setStatus(`Created ${list.name}. Your shortcuts are ready.`);
            }); }}>
              <label htmlFor="everyday-new-list">Create a list for your groceries</label>
              <div className="everyday-input-row"><input id="everyday-new-list" value={newListName} onChange={(event) => setNewListName(event.target.value)} maxLength={100} placeholder="e.g. This week" required />
                <button type="submit" disabled={busy || !newListName.trim()}>Create list</button></div>
              <p>Only lists you can edit appear here.</p>
            </form>}
          </section>
          <div className="everyday-tabs" role="group" aria-label="Everyday view">
            {[["staples", "Staples"], ["recent", "Buy again"], ["use_first", "Use first"]].map(([key, label]) => (
              <button key={key} type="button" aria-pressed={tab === key} onClick={() => { setTab(key); setStatus(""); setActionError(""); }}>{label}</button>
            ))}
          </div>
          <div role="status" className="everyday-feedback">{status}</div>
          {actionError && <p role="alert" className="everyday-error">{actionError}</p>}
          <section className="everyday-paper" aria-labelledby="everyday-section-title">
            <h2 id="everyday-section-title">{tab === "staples" ? "The things you always need" : tab === "recent" ? "Back on the list" : "Use what you have"}</h2>
            {tab === "staples" && <>
              <p>Pin your regular groceries. Tap “We’re out” to put one on your chosen list.</p>
              <form className="everyday-pin-form" onSubmit={(event) => { event.preventDefault(); if (!name.trim()) return; run(async () => {
                await pin({ name: name.trim(), quantity: Number(quantity) }); setName(""); nameInput.current?.focus();
              }); }}>
                <div><label htmlFor="staple-name">Grocery</label><input id="staple-name" ref={nameInput} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Milk" maxLength={100} required disabled={busy} /></div>
                <div><label htmlFor="staple-quantity">Quantity</label><input id="staple-quantity" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} min="1" max="9999" required disabled={busy} /></div>
                <button type="submit" disabled={busy || !name.trim()}>Pin staple</button>
              </form>
              {!data.staples.length && <p className="everyday-empty">Start with something you buy most weeks. Your staples stay with your account.</p>}
            </>}
            {tab === "recent" && <p>Groceries you checked off as bought. Adding again leaves their old expiry dates behind.</p>}
            {tab === "use_first" && <p>Bought groceries across your accessible lists, with entered dates up to three days away. These dates are the ones you entered.</p>}
            {tab === "recent" && !data.recent.length && <p className="everyday-empty">Check off a grocery in your shopping list to find it here next time.</p>}
            {tab === "use_first" && !data.use_first.length && <p className="everyday-empty">Nothing with an upcoming entered date. Add expiry dates to groceries you buy to see them here.</p>}
            <ul className="everyday-rows">
              {data[tab].map((grocery) => <li key={grocery.id}>
                <div className="everyday-row-copy"><strong>{grocery.name}</strong>
                  <span>{tab === "use_first" ? `${dateLabel(grocery.days_left)} · ${grocery.list_name}` : `Quantity ${grocery.quantity}`}</span>
                  {tab === "use_first" && <time dateTime={grocery.expiry}>{new Date(`${grocery.expiry}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time>}
                </div>
                <div className="everyday-row-actions">
                  {tab === "use_first" ? <Link className="everyday-recipe-link" to={`/recipes?ingredient=${encodeURIComponent(grocery.name)}`}>Find recipes</Link> : <>
                    <button type="button" disabled={!canAdd || pending(grocery)} onClick={() => quickAdd(grocery)} aria-label={`${pending(grocery) ? "Already on list" : tab === "staples" ? "We’re out of" : "Buy again:"} ${grocery.name}`}>
                      {pending(grocery) ? "Already on list" : tab === "staples" ? "We’re out" : "Add to list"}
                    </button>
                    {tab === "staples" ? <button type="button" className="everyday-text-button" disabled={busy} aria-label={`Unpin ${grocery.name}`} onClick={() => run(async () => {
                      await apiUnpinStaple(grocery.id); setData((current) => ({ ...current, staples: current.staples.filter((item) => item.id !== grocery.id) })); setStatus(`Unpinned ${grocery.name}.`);
                    })}>Unpin</button> : <button type="button" className="everyday-text-button" disabled={busy || stapleKeys.has(normalize(grocery.name))} onClick={() => run(() => pin(grocery))} aria-label={`Make ${grocery.name} a staple`}>{stapleKeys.has(normalize(grocery.name)) ? "Pinned" : "Make a staple"}</button>}
                  </>}
                </div>
              </li>)}
            </ul>
            {tab === "staples" && data.staples.length > 0 && <div className="everyday-restock">
              <h3>Your weekly restock</h3>
              <p>Add missing staples and restore bought ones. Groceries already waiting and other items stay as they are. Nothing runs automatically.</p>
              <button type="button" disabled={!canAdd} onClick={() => run(async () => {
                const result = await apiRestock(Number(targetId));
                setTargetItems((items) => [...items.filter((item) => !stapleKeys.has(normalize(item.name))), ...data.staples.map((item) => ({ ...item, purchased: false }))]);
                setData((current) => ({ ...current, restocked_list_ids: [...new Set([...current.restocked_list_ids, Number(targetId)])], use_first: current.use_first.filter((item) => !(result.restored_item_ids || []).includes(item.id)) }));
                setStatus(`Restocked ${target.name}: ${result.added} added, ${result.restored} restored, ${result.already_present} already waiting.`);
              })}>Restock staples</button>
              {data.restocked_list_ids.includes(Number(targetId)) && <p className="everyday-restock-note">You’ve restocked this list this week. You can top it up again without duplicates.</p>}
            </div>}
          </section>
        </>
      )}
    </div>
  );
}
