import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { demoAddItem, demoCreateList, demoDeleteItem, demoGetItems, demoGetLists } from "../demo";
import "./DemoLists.css";

export default function DemoLists() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [lists, setLists] = useState(() => demoGetLists());
  const [selectedId, setSelectedId] = useState(() => demoGetLists()[0]?.id ?? null);
  const [listName, setListName] = useState("");
  const [itemName, setItemName] = useState("");
  const [items, setItems] = useState(() => demoGetItems(selectedId));
  const [notice, setNotice] = useState("");
  const itemInput = useRef(null);
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
        <p className="simple-demo-intro">Try the basics: create a list, add groceries, and remove what you don’t need.</p>
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
              <form onSubmit={addItem} className="simple-demo-add">
                <label htmlFor="demo-item-name">Add a grocery</label>
                <div className="simple-demo-input-row">
                  <input id="demo-item-name" ref={itemInput} value={itemName} onChange={(event) => setItemName(event.target.value)}
                    placeholder="e.g. Apples" maxLength={100} required />
                  <button type="submit" disabled={!itemName.trim()}>Add item</button>
                </div>
              </form>
              {items.length ? (
                <ul className="simple-demo-items">
                  {items.map((item) => <li key={item.id}>
                    <span>{item.name}</span>
                    <button type="button" className="simple-demo-remove" aria-label={`Remove ${item.name}`} onClick={() => {
                      demoDeleteItem(item.id); setItems(demoGetItems(selectedId)); setNotice(`Removed ${item.name}.`);
                      itemInput.current?.focus();
                    }}>Remove</button>
                  </li>)}
                </ul>
              ) : <p className="simple-demo-empty">Your list is ready. Add the first thing you need above.</p>}
              <p className="simple-demo-count">{items.length} {items.length === 1 ? "item" : "items"}</p>
            </>
          ) : <p className="simple-demo-empty">Give your list a name above to get started.</p>}
        </section>
        <p role="status" className="simple-demo-status">{notice}</p>
      </main>
    </div>
  );
}
