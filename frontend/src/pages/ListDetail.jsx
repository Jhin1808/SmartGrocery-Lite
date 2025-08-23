// src/pages/ListDetail.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import { Table, Button, Form, Row, Col, Spinner, Alert } from "react-bootstrap";
import { apiGetItems, apiAddItem, apiDeleteItem, apiUpdateItem } from "../api";

function isExpired(yyyyMmDd) {
  if (!yyyyMmDd) return false;
  const d = new Date(yyyyMmDd + "T23:59:59");
  return d < new Date();
}

export default function ListDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const loc = useLocation();
  const listNameFromLink = loc.state?.listName;
  const listName = listNameFromLink || `List #${id}`;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // add form
  const [nm, setNm] = useState("");
  const [qty, setQty] = useState(1);
  const [exp, setExp] = useState("");

  // inline edit state
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({ name: "", quantity: 1, expiry: "" });

  // ui controls
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All"); // All | Fresh | Expired
  const [sortKey, setSortKey] = useState("name"); // name | quantity | expiry
  const [asc, setAsc] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiGetItems(Number(id));
      setItems(data || []);
    } catch (e) {
      setErr(e?.message || "Failed to load items");
      if (e?.status === 401) navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const filteredSorted = useMemo(() => {
    let arr = [...items];
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(i => i.name.toLowerCase().includes(q));
    }
    if (filter === "Fresh") arr = arr.filter(i => !isExpired(i.expiry));
    else if (filter === "Expired") arr = arr.filter(i => isExpired(i.expiry));

    arr.sort((a, b) => {
      let c = 0;
      if (sortKey === "name") c = a.name.localeCompare(b.name);
      else if (sortKey === "quantity") c = (a.quantity || 0) - (b.quantity || 0);
      else if (sortKey === "expiry") {
        const da = a.expiry ? new Date(a.expiry) : new Date("9999-12-31");
        const db = b.expiry ? new Date(b.expiry) : new Date("9999-12-31");
        c = da - db;
      }
      return asc ? c : -c;
    });
    return arr;
  }, [items, search, filter, sortKey, asc]);

  const onAdd = async (e) => {
    e.preventDefault();
    if (!nm.trim()) return;
    try {
      const payload = { name: nm.trim(), quantity: Number(qty || 1), expiry: exp || null };
      const created = await apiAddItem(Number(id), payload);
      setItems(prev => [created, ...prev]);
      setNm(""); setQty(1); setExp("");
    } catch (e) {
      setErr(e?.message || "Failed to add item");
      if (e?.status === 401) navigate("/login", { replace: true });
    }
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    setEdit({ name: it.name, quantity: it.quantity, expiry: it.expiry || "" });
  };
  const cancelEdit = () => { setEditingId(null); setEdit({ name: "", quantity: 1, expiry: "" }); };
  const saveEdit = async (itId) => {
    try {
      const patch = { name: edit.name.trim(), quantity: Number(edit.quantity || 1), expiry: edit.expiry || null };
      const updated = await apiUpdateItem(itId, patch);
      setItems(prev => prev.map(x => x.id === itId ? updated : x));
      cancelEdit();
    } catch (e) {
      setErr(e?.message || "Failed to update item");
      if (e?.status === 401) navigate("/login", { replace: true });
    }
  };

  const onDelete = async (itId) => {
    try {
      await apiDeleteItem(itId);
      setItems(prev => prev.filter(x => x.id !== itId));
      if (editingId === itId) cancelEdit();
    } catch (e) {
      setErr(e?.message || "Failed to delete item");
      if (e?.status === 401) navigate("/login", { replace: true });
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Clear all items?")) return;
    await Promise.all(items.map(i => apiDeleteItem(i.id).catch(() => null)));
    setItems([]);
    cancelEdit();
  };

  return (
    <div>
      <p><Link to="/lists">← Back to My Lists</Link></p>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <h3 className="mb-0">{listName}</h3>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" size="sm" onClick={load}>Refresh</Button>
          <Button variant="danger" size="sm" onClick={clearAll}>Clear All</Button>
        </div>
      </div>

      {err && <Alert variant="danger" dismissible onClose={() => setErr(null)}>{err}</Alert>}

      <Form onSubmit={onAdd} className="mb-3">
        <Row className="g-2 align-items-end">
          <Col md={5} sm={12}>
            <Form.Label>Item</Form.Label>
            <Form.Control placeholder="e.g., Milk" value={nm} onChange={e => setNm(e.target.value)} required />
          </Col>
          <Col md={2} sm={6}>
            <Form.Label>Qty</Form.Label>
            <Form.Control type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
          </Col>
          <Col md={3} sm={6}>
            <Form.Label>Expiry</Form.Label>
            <Form.Control type="date" value={exp} onChange={e => setExp(e.target.value)} />
          </Col>
          <Col md="auto">
            <Button type="submit">Add</Button>
          </Col>
        </Row>
      </Form>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <Form.Control placeholder="Search items…" style={{ maxWidth: 220 }} value={search} onChange={e => setSearch(e.target.value)} />
        <Form.Select style={{ maxWidth: 160 }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option>All</option>
          <option>Fresh</option>
          <option>Expired</option>
        </Form.Select>
        <Form.Select style={{ maxWidth: 170 }} value={sortKey} onChange={e => setSortKey(e.target.value)}>
          <option value="name">Sort: Name</option>
          <option value="quantity">Sort: Quantity</option>
          <option value="expiry">Sort: Expiry</option>
        </Form.Select>
        <Button variant="outline-secondary" size="sm" onClick={() => setAsc(a => !a)}>
          {asc ? "Asc ⬆️" : "Desc ⬇️"}
        </Button>
      </div>

      <div className="table-responsive">
        <Table striped bordered hover>
          <thead>
            <tr>
              <th style={{minWidth: 180}}>Item</th>
              <th style={{width: 100}}>Qty</th>
              <th style={{width: 160}}>Expiry</th>
              <th style={{width: 200}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4}><Spinner animation="border" size="sm" className="me-2" />Loading…</td></tr>
            )}
            {!loading && filteredSorted.length === 0 && (
              <tr><td colSpan={4} className="text-muted text-center">No items</td></tr>
            )}
            {!loading && filteredSorted.map(it => {
              const isEd = editingId === it.id;
              const expired = isExpired(it.expiry);
              return (
                <tr key={it.id}>
                  <td>
                    {isEd ? (
                      <Form.Control value={edit.name} onChange={e => setEdit(s => ({ ...s, name: e.target.value }))} />
                    ) : <span>{it.name}</span>}
                  </td>
                  <td className="text-center">
                    {isEd ? (
                      <Form.Control type="number" min="1" value={edit.quantity} onChange={e => setEdit(s => ({ ...s, quantity: e.target.value }))} />
                    ) : it.quantity}
                  </td>
                  <td className="text-center">
                    {isEd ? (
                      <div className="d-flex gap-2">
                        <Form.Control type="date" value={edit.expiry || ""} onChange={e => setEdit(s => ({ ...s, expiry: e.target.value }))} />
                        <Button size="sm" variant="outline-secondary" onClick={() => setEdit(s => ({ ...s, expiry: "" }))}>Clear</Button>
                      </div>
                    ) : <span className={expired ? "text-danger" : ""}>{it.expiry || "—"}</span>}
                  </td>
                  <td className="text-end">
                    {!isEd ? (
                      <>
                        <Button size="sm" variant="outline-secondary" onClick={() => startEdit(it)}>Edit</Button>{" "}
                        <Button size="sm" variant="outline-danger" onClick={() => onDelete(it.id)}>Delete</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => saveEdit(it.id)}>Save</Button>{" "}
                        <Button size="sm" variant="outline-secondary" onClick={cancelEdit}>Cancel</Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
