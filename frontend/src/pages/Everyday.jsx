import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { apiEveryday, apiGetLists, apiGetItems, apiCreateList, apiPinStaple, apiUnpinStaple, apiQuickAdd, apiRestock } from "../api";
import "./Everyday.css";

const normalize = (name) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const dateLabel = (days) => days < 0 ? "Date passed" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;

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
  const [busyAction, setBusyAction] = useState("");
  const busy = Boolean(busyAction);
  const [addingRegular, setAddingRegular] = useState(false);
  const regularToggle = useRef(null);
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
    } catch (error) { setLoadError(error.status === 404 || error.message === "Not Found" ? "Everyday is temporarily unavailable. You can still use your shopping lists." : "We couldn’t load your saved groceries. Check your connection and try again."); }
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

  async function run(task, action = "save") {
    if (actionLock.current) return;
    actionLock.current = true; setBusyAction(action); setStatus(""); setActionError("");
    try { await task(); }
    catch (error) { setActionError(error.message || "That didn’t save. Please try again."); }
    finally { actionLock.current = false; setBusyAction(""); }
  }

  async function pin(grocery) {
    const pinned = await apiPinStaple({ name: grocery.name, quantity: grocery.quantity });
    setData((current) => ({ ...current, staples: [...current.staples.filter((item) => item.id !== pinned.id), pinned] }));
    setStatus(`${pinned.name} saved to My regulars. Tap Add to list when you need it.`);
  }

  function quickAdd(grocery) {
    run(async () => {
      const result = await apiQuickAdd({ list_id: Number(targetId), name: grocery.name, quantity: grocery.quantity });
      // Reflect the successful write immediately; don't make a second GET part of success.
      setTargetItems((items) => [...items.filter((item) => normalize(item.name) !== normalize(grocery.name)), { name: grocery.name, purchased: false }]);
      setData((current) => ({ ...current, use_first: current.use_first.filter((item) => !(result.result === "restored" && item.id === result.item_id)) }));
      setStatus(result.result === "already_present" ? `${grocery.name} is already on ${target.name}.` : `${grocery.name} added to ${target.name}.`);
    }, `add:${grocery.name}`);
  }

  const pending = (grocery) => targetItems.some((item) => !item.purchased && normalize(item.name) === normalize(grocery.name));
  const canAdd = Boolean(targetId) && !targetLoading && !targetError && !busy;
  const stapleKeys = new Set((data?.staples || []).map((item) => normalize(item.name)));

  const missingRegulars = (data?.staples || []).filter((grocery) => !pending(grocery)).length;

  function changeView(next) {
    setTab(next); setStatus(""); setActionError("");
  }

  function restock() {
    run(async () => {
      const result = await apiRestock(Number(targetId));
      setTargetItems((items) => [...items.filter((item) => !stapleKeys.has(normalize(item.name))), ...data.staples.map((item) => ({ ...item, purchased: false }))]);
      setData((current) => ({ ...current, restocked_list_ids: [...new Set([...current.restocked_list_ids, Number(targetId)])], use_first: current.use_first.filter((item) => !(result.restored_item_ids || []).includes(item.id)) }));
      const added = result.added + result.restored;
      setStatus(added ? `Added ${added} ${added === 1 ? "grocery" : "groceries"} to ${target.name}. Everything else on your list stays the same.` : `Your regulars are already on ${target.name}.`);
    }, "restock");
  }

  async function saveRegular(event) {
    event.preventDefault();
    if (!name.trim()) return;
    run(async () => {
      await pin({ name: name.trim(), quantity: Number(quantity) });
      setName(""); setQuantity(1); setAddingRegular(false);
      regularToggle.current?.focus();
    });
  }

  return (
    <div className="everyday-page">
      <header className="everyday-heading">
        <h1>Everyday groceries</h1>
        <p>{tab === "use_first" ? "Check dates on groceries you’ve already bought." : data && !lists.length ? "First, create a shopping list for your groceries." : data && !data.staples.length && tab === "staples" ? "Start by saving a grocery you buy often." : "Choose your shopping list, then add what you need."}</p>
      </header>
      {loading ? <p role="status">Loading your groceries…</p> : loadError ? (
        <div className="everyday-load-error" role="alert">
          <h2>We can’t load Everyday right now</h2><p>{loadError}</p>
          <button type="button" onClick={load}>Try again</button><Link to="/lists">Open shopping lists</Link>
        </div>
      ) : (
        <>
          <div className="everyday-tabs" role="group" aria-label="Everyday view">
            {[["staples", "My regulars"], ["recent", "Buy again"], ["use_first", "Use soon"]].map(([key, label]) => (
              <button key={key} type="button" aria-pressed={tab === key} onClick={() => changeView(key)}>{label}</button>
            ))}
          </div>
          {tab !== "use_first" && <section className="everyday-destination" aria-label="Shopping destination">
            {lists.length ? <>
              <div className="everyday-list-picker">
                <label htmlFor="everyday-list">Shopping list</label>
                <select id="everyday-list" value={targetId} disabled={busy} onChange={(event) => { setTargetId(event.target.value); setTargetItems([]); setTargetLoading(true); setStatus(""); setActionError(""); }}>
                  {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
                </select>
              </div>
              <Link className="everyday-open-list" to={`/lists/${targetId}`}>Open list <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
              {targetLoading && <p className="everyday-target-notice" role="status">Checking your list…</p>}
              {targetError && <p className="everyday-target-notice" role="alert">{targetError} <button type="button" className="everyday-text-button" onClick={() => setTargetAttempt((attempt) => attempt + 1)}>Retry</button></p>}
            </> : <form onSubmit={(event) => { event.preventDefault(); if (!newListName.trim()) return; run(async () => {
              const list = await apiCreateList(newListName.trim()); setLists([list]); setTargetId(String(list.id)); setNewListName("");
              setStatus(`Created ${list.name}. ${data.staples.length ? "Now choose a grocery below." : "Now save a grocery you buy often."}`);
            }); }}>
              <label htmlFor="everyday-new-list">First, create a shopping list</label>
              <div className="everyday-input-row"><input id="everyday-new-list" value={newListName} onChange={(event) => setNewListName(event.target.value)} maxLength={100} placeholder="e.g. This week" required />
                <button type="submit" disabled={busy || !newListName.trim()}>{busyAction === "save" ? "Creating…" : "Create list"}</button></div>
              <p>Your regular groceries will be ready to add once you have a list.</p>
            </form>}
          </section>}
          <div role="status" className="everyday-feedback">{status}</div>
          {actionError && <p role="alert" className="everyday-error">{actionError}</p>}
          <section className="everyday-paper" aria-labelledby="everyday-section-title">
            <div className="everyday-section-heading">
              <h2 id="everyday-section-title">{tab === "staples" ? data.staples.length ? "Your regular groceries" : "Start with one grocery" : tab === "recent" ? "Things you’ve bought before" : "Check these dates"}</h2>
              {tab === "staples" && data.staples.length > 1 && <button className="everyday-add-all" type="button" disabled={!canAdd || missingRegulars === 0} onClick={restock}>
                {busyAction === "restock" ? "Adding groceries…" : missingRegulars ? `Add all missing (${missingRegulars})` : "All on your list"}
              </button>}
            </div>
            {tab === "recent" && <p className="everyday-section-note">Checked-off groceries, ready for your next shop.</p>}
            {tab === "use_first" && <p className="everyday-section-note">From all your lists. Dates are the ones you entered.</p>}
            {tab === "recent" && !data.recent.length && <div className="everyday-empty"><p>Nothing here yet. Mark groceries as bought in a shopping list, then find them here next time.</p><Link to="/lists">Go to shopping lists</Link></div>}
            {tab === "use_first" && !data.use_first.length && <div className="everyday-empty"><p>No upcoming dates to check.</p><p>Add expiry dates to groceries you mark as bought. Items dated within the next three days, or earlier, appear here.</p><Link to="/lists">Go to shopping lists</Link></div>}
            <ul className="everyday-rows">
              {data[tab].map((grocery) => {
                const onList = pending(grocery);
                const adding = busyAction === `add:${grocery.name}`;
                return <li key={grocery.id}>
                  <div className="everyday-row-copy"><strong>{grocery.name}</strong>
                    {tab === "use_first" ? <><span className={grocery.days_left <= 0 ? "everyday-date-due" : ""}>{dateLabel(grocery.days_left)}</span><span>{grocery.list_name} · <time dateTime={grocery.expiry}>{new Date(`${grocery.expiry}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></span></> : grocery.quantity > 1 ? <span>Qty {grocery.quantity}</span> : null}
                  </div>
                  {tab === "use_first" ? <Link className="everyday-recipe-link" to={`/recipes?ingredient=${encodeURIComponent(grocery.name)}`}>Find recipes</Link> : <>
                    <button type="button" className="everyday-add-one" disabled={!canAdd || onList} onClick={() => quickAdd(grocery)} aria-label={adding ? `Adding ${grocery.name}` : onList ? `${grocery.name} is on your list` : `Add ${grocery.name} to list`}>
                      {adding ? "Adding…" : onList ? <><i className="bi bi-check2" aria-hidden="true" /> On list</> : "Add to list"}
                    </button>
                    <details className="everyday-item-options" name="everyday-item-options" onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
                      <summary aria-label={`Options for ${grocery.name}`}><i className="bi bi-three-dots" aria-hidden="true" /></summary>
                      {tab === "staples" ? <button type="button" className="everyday-text-button" disabled={busy} aria-label={`Remove ${grocery.name} from regulars`} onClick={() => run(async () => {
                        await apiUnpinStaple(grocery.id); setData((current) => ({ ...current, staples: current.staples.filter((item) => item.id !== grocery.id) }));
                        setStatus(`Removed ${grocery.name} from My regulars. Your shopping list hasn’t changed.`);
                        regularToggle.current?.focus();
                      }, `remove:${grocery.id}`)}>Remove from regulars</button> : <button type="button" className="everyday-text-button" disabled={busy || stapleKeys.has(normalize(grocery.name))} onClick={() => run(() => pin(grocery))} aria-label={`Save ${grocery.name} to regulars`}>{stapleKeys.has(normalize(grocery.name)) ? "Saved to regulars" : "Save to My regulars"}</button>}
                    </details>
                  </>}
                </li>;
              })}
            </ul>
            {tab === "staples" && <>
              {data.staples.length > 1 && <p className="everyday-batch-note">Add all missing keeps other groceries as they are.{data.restocked_list_ids.includes(Number(targetId)) ? " You’ve restocked this list this week." : ""}</p>}
              {lists.length > 0 && <details className="everyday-save-regular" open={addingRegular || !data.staples.length} onToggle={(event) => { if (data.staples.length) setAddingRegular(event.currentTarget.open); }}>
                <summary ref={regularToggle} hidden={!data.staples.length}>{data.staples.length ? "Save another regular grocery" : "Save a grocery you buy often"}</summary>
                <form className="everyday-pin-form" onSubmit={saveRegular}>
                  <label htmlFor="staple-name">Grocery name</label>
                  <div className="everyday-input-row"><input id="staple-name" ref={nameInput} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Milk" maxLength={100} required disabled={busy} />
                    <button type="submit" disabled={busy || !name.trim()}>{busyAction === "save" ? "Saving…" : "Save regular"}</button></div>
                  <details className="everyday-quantity"><summary>Quantity: {quantity || 1}</summary><label htmlFor="staple-quantity">Quantity</label><input id="staple-quantity" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} min="1" max="9999" required disabled={busy} /></details>
                  <p>Saving a regular makes a shortcut here. Tap Add to list when you need to buy it.</p>
                </form>
              </details>}
              {!lists.length && <p className="everyday-section-note">Create a shopping list above to start adding groceries.</p>}
            </>}
          </section>
        </>
      )}
    </div>
  );
}
