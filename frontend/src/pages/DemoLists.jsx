import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { demoAddItem, demoCreateList, demoDeleteItem, demoGetItems, demoGetLists, demoUpdateItem } from "../demo";
import { stageDemoList } from "../demoTransfer";
import "./DemoLists.css";

export default function DemoLists() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [lists, setLists] = useState(() => demoGetLists());
  const [selectedId, setSelectedId] = useState(() => demoGetLists()[0]?.id ?? null);
  const [listName, setListName] = useState("");
  const [itemName, setItemName] = useState("");
  const [items, setItems] = useState(() => demoGetItems(selectedId));
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const itemInput = useRef(null);
  const boughtCount = items.filter((item) => item.purchased).length;
  const selectedList = lists.find((list) => list.id === selectedId);

  function createList(event) {
    event.preventDefault();
    if (!listName.trim()) return;
    const list = demoCreateList(listName.trim());
    setLists(demoGetLists());
    setSelectedId(list.id);
    setItems([]);
    setListName("");
    setItemName("");
    setNotice(`Created ${list.name}. Add your first grocery below.`);
    itemInput.current?.focus();
  }

  function addItem(event) {
    event.preventDefault();
    if (!selectedId || !itemName.trim()) return;
    const name = itemName.trim();
    demoAddItem(selectedId, { name, quantity: 1 });
    setItems(demoGetItems(selectedId));
    setItemName("");
    setNotice(`Added ${name}.`);
    itemInput.current?.focus();
  }

  async function leaveDemo() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="simple-demo">
      <header className="simple-demo-header">
        <span className="simple-demo-brand">ToBuyLists</span>
        <button type="button" className="simple-demo-link" onClick={leaveDemo}>Exit demo</button>
      </header>
      <main className="simple-demo-main">
        <h1>A little list goes a long way.</h1>
        <p className="simple-demo-intro">Write your groceries down, then tap each one to cross it off as you shop.</p>
        <p className="simple-demo-note">Demo only. Your changes are temporary and reset when you refresh or leave.</p>

        <form className="simple-demo-create" onSubmit={createList}>
          <label htmlFor="demo-list-name">Create a grocery list</label>
          <div className="simple-demo-input-row">
            <input id="demo-list-name" value={listName} onChange={(event) => setListName(event.target.value)}
              placeholder="e.g. Saturday groceries" maxLength={100} required />
            <button type="submit" disabled={!listName.trim()}>Create list</button>
          </div>
        </form>

        <section className="simple-demo-paper" aria-label="Your grocery list">
          <div className="simple-demo-list-heading">
            <h2>{selectedList?.name || "Your first list"}</h2>
            {lists.length > 1 && (
              <div className="simple-demo-picker">
                <label htmlFor="demo-list-picker">Switch list</label>
                <select id="demo-list-picker" value={selectedId ?? ""} onChange={(event) => {
                  const id = Number(event.target.value);
                  setSelectedId(id); setItems(demoGetItems(id)); setItemName(""); setNotice("");
                }}>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select>
              </div>
            )}
          </div>
          {selectedList ? (
            <>
              <p className="simple-demo-instruction">Tap a bullet or item to cross it off. Tap again to undo.</p>
              {items.length ? (
                <ul className="simple-demo-items">
                  {items.map((item) => <li key={item.id} className={item.purchased ? "is-bought" : ""}>
                    <label className="simple-demo-item-toggle">
                      <input type="checkbox" className="simple-demo-check" checked={Boolean(item.purchased)}
                        onChange={(event) => {
                          const purchased = event.target.checked;
                          demoUpdateItem(item.id, { purchased });
                          setItems(demoGetItems(selectedId));
                          setNotice(purchased ? `${item.name} crossed off as bought.` : `${item.name} is back on your list.`);
                        }} />
                      <span className="simple-demo-item-name">{item.name}</span>
                      <span className="simple-demo-item-state">{item.purchased ? "Bought" : ""}</span>
                    </label>
                    <button type="button" className="simple-demo-remove" aria-label={`Remove ${item.name}`} onClick={() => {
                      demoDeleteItem(item.id); setItems(demoGetItems(selectedId)); setNotice(`Removed ${item.name}.`);
                      itemInput.current?.focus();
                    }}>Remove</button>
                  </li>)}
                </ul>
              ) : <p className="simple-demo-empty">Your list is ready. Add the first thing you need below.</p>}
              <form onSubmit={addItem} className="simple-demo-add">
                <label htmlFor="demo-item-name">Add a grocery</label>
                <div className="simple-demo-input-row">
                  <input id="demo-item-name" ref={itemInput} value={itemName} onChange={(event) => setItemName(event.target.value)}
                    placeholder="e.g. Apples" maxLength={100} required />
                  <button type="submit" disabled={!itemName.trim()}>Add item</button>
                </div>
              </form>
              <p className="simple-demo-count">{items.length - boughtCount} to buy · {boughtCount} bought</p>
            </>
          ) : <p className="simple-demo-empty">Give your list a name above to get started.</p>}
        </section>
        <p role="status" className="simple-demo-status">{notice}</p>
        <section className="simple-demo-keep" aria-labelledby="demo-keep-title">
          <h2 id="demo-keep-title">Make this list yours</h2>
          <p>Sign in or create an account to keep a copy of this list, including the groceries you’ve crossed off.</p>
          <button type="button" disabled={!selectedList} onClick={async () => {
            try {
              stageDemoList(selectedList, items);
              await logout();
              navigate("/login?tab=register&keep_demo=1", { replace: true });
            } catch (error) { setSaveError(error.message || "Couldn’t keep this draft. Please retry."); }
          }}>Keep this list</button>
          {saveError && <p role="alert">{saveError}</p>}
        </section>
      </main>
    </div>
  );
}
