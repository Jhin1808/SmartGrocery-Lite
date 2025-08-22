import { useEffect, useMemo, useState } from "react";
import {
  apiGetLists, apiCreateList,
  apiGetItems, apiAddItem, apiDeleteItem, apiUpdateItem
} from "../api";

import {
  Badge, Button, Card, Col, Container, Form,
  InputGroup, ListGroup, Modal, Row, Spinner, Table, Toast, ToastContainer
} from "react-bootstrap";

// ---- helpers for expiry display ----
const parseDate = (s) => (s ? new Date(`${s}T00:00:00`) : null);
const daysUntil = (s) => {
  const d = parseDate(s);
  if (!d) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
};
const ExpiryBadge = ({ expiry }) => {
  const n = daysUntil(expiry);
  if (n === null) return <Badge bg="secondary">—</Badge>;
  if (n < 0) return <Badge bg="danger">Expired</Badge>;
  if (n === 0) return <Badge bg="warning" text="dark">Today</Badge>;
  if (n <= 3) return <Badge bg="warning" text="dark">in {n}d</Badge>;
  return <Badge bg="success">in {n}d</Badge>;
};

export default function Lists() {
  // lists + selection
  const [lists, setLists] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [listQuery, setListQuery] = useState("");

  // items + cache per list
  const [itemsByList, setItemsByList] = useState({}); // { [listId]: Item[] }
  const [loadingItems, setLoadingItems] = useState(new Set());

  // create list
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);

  // per-list add-item draft
  const [drafts, setDrafts] = useState({}); // { [listId]: {name, quantity, expiry} }

  // per-list UI state
  const [filters, setFilters] = useState({});       // { [listId]: string }
  const [sortBy, setSortBy] = useState({});         // { [listId]: {key, dir} }

  // inline edit state
  const [editing, setEditing] = useState(new Set());  // itemIds
  const [editDrafts, setEditDrafts] = useState({});   // { itemId: {name, quantity, expiry} }

  // UX
  const [err, setErr] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null); // { listId, item }

  // ---------- load lists ----------
  const loadLists = async () => {
    try {
      setErr(null);
      const data = await apiGetLists();
      setLists(data);
      // select first list if none selected
      if (!selectedId && data.length) setSelectedId(data[0].id);
    } catch (e) {
      setErr(e.message || "Failed to load lists");
    }
  };
  useEffect(() => { loadLists(); }, []);

  // ---------- select list -> lazy load items ----------
  useEffect(() => {
    const id = selectedId;
    if (!id || itemsByList[id]) return;
    (async () => {
      try {
        setLoadingItems((s) => new Set(s).add(id));
        const items = await apiGetItems(id);
        setItemsByList((m) => ({ ...m, [id]: items }));
      } catch (e) {
        setErr(e.message || "Failed to load items");
      } finally {
        setLoadingItems((s) => { const n = new Set(s); n.delete(id); return n; });
      }
    })();
  }, [selectedId, itemsByList]);

  // ---------- create list ----------
  const onCreateList = async (e) => {
    e.preventDefault();
    const nm = newListName.trim();
    if (!nm) return;
    try {
      setCreating(true);
      const before = lists.length;
      await apiCreateList(nm);
      setNewListName("");
      await loadLists();
      if (lists.length > before) {
        // try to select the just-added list (last one returned by API or find by name)
        const maybe = lists.findLast?.(l => l.name === nm) || null;
        if (maybe) setSelectedId(maybe.id);
      }
      setToast({ message: "List created", variant: "success" });
    } catch (e) {
      setErr(e.message || "Failed to create list");
      setToast({ message: "Create failed", variant: "danger" });
    } finally {
      setCreating(false);
    }
  };

  // ---------- add item ----------
  const updateDraft = (listId, patch) =>
    setDrafts((d) => ({ ...d, [listId]: { name: "", quantity: 1, expiry: "", ...(d[listId] || {}), ...patch } }));

  const submitItem = async (e) => {
    e.preventDefault();
    if (!selectedId) return;
    const draft = drafts[selectedId] || {};
    const nm = (draft.name || "").trim();
    if (!nm) return;
    try {
      const payload = {
        name: nm,
        quantity: Number(draft.quantity || 1),
        expiry: draft.expiry ? draft.expiry : null,
      };
      const item = await apiAddItem(selectedId, payload);
      setItemsByList((m) => ({ ...m, [selectedId]: [item, ...(m[selectedId] || [])] }));
      setDrafts((d) => ({ ...d, [selectedId]: { name: "", quantity: 1, expiry: "" } }));
      setToast({ message: "Item added", variant: "success" });
    } catch (e) {
      setErr(e.message || "Failed to add item");
      setToast({ message: "Add failed", variant: "danger" });
    }
  };

  // ---------- delete ----------
  const askDelete = (listId, item) => setConfirmDel({ listId, item });
  const doDelete = async () => {
    const { listId, item } = confirmDel;
    try {
      await apiDeleteItem(item.id);
      setItemsByList((m) => ({ ...m, [listId]: (m[listId] || []).filter(i => i.id !== item.id) }));
      // clean edit state
      setEditing((s) => { const n = new Set(s); n.delete(item.id); return n; });
      setEditDrafts(({ [item.id]: _, ...rest }) => rest);
      setToast({ message: "Item deleted", variant: "success" });
    } catch (e) {
      setErr(e.message || "Failed to delete item");
      setToast({ message: "Delete failed", variant: "danger" });
    } finally {
      setConfirmDel(null);
    }
  };

  // ---------- inline edit ----------
  const startEdit = (it) => {
    setEditing((s) => new Set(s).add(it.id));
    setEditDrafts((d) => ({ ...d, [it.id]: { name: it.name, quantity: it.quantity, expiry: it.expiry || "" } }));
  };
  const cancelEdit = (id) => {
    setEditing((s) => { const n = new Set(s); n.delete(id); return n; });
    setEditDrafts((d) => { const { [id]: _, ...rest } = d; return rest; });
  };
  const updateEditDraft = (id, patch) =>
    setEditDrafts((d) => ({ ...d, [id]: { ...(d[id] || {}), ...patch } }));
  const saveEdit = async (id) => {
    const draft = editDrafts[id];
    const patch = {
      name: draft.name,
      quantity: Number(draft.quantity),
      expiry: draft.expiry ? draft.expiry : null,
    };
    try {
      const updated = await apiUpdateItem(id, patch);
      setItemsByList((m) => ({
        ...m,
        [selectedId]: (m[selectedId] || []).map((x) => (x.id === id ? updated : x)),
      }));
      cancelEdit(id);
      setToast({ message: "Item updated", variant: "success" });
    } catch (e) {
      setErr(e.message || "Failed to update item");
      setToast({ message: "Update failed", variant: "danger" });
    }
  };

  // ---------- filter + sort ----------
  const setFilter = (listId, v) => setFilters((f) => ({ ...f, [listId]: v }));
  const toggleSort = (listId, key) => {
    setSortBy((s) => {
      const curr = s[listId] || { key: "name", dir: "asc" };
      const dir = curr.key === key ? (curr.dir === "asc" ? "desc" : "asc") : "asc";
      return { ...s, [listId]: { key, dir } };
    });
  };
  const sortIndicator = (listId, key) => {
    const s = sortBy[listId];
    if (!s || s.key !== key) return " ";
    return s.dir === "asc" ? " ▲" : " ▼";
  };

  const listFilter = listQuery.toLowerCase();
  const visibleLists = useMemo(
    () => lists.filter(l => l.name.toLowerCase().includes(listFilter)),
    [lists, listFilter]
  );

  const totalItems = (id) => (itemsByList[id]?.length ?? 0);
  const viewItems = useMemo(() => {
    const items = itemsByList[selectedId] || [];
    const filterText = (filters[selectedId] || "").toLowerCase();
    const s = sortBy[selectedId] || { key: "name", dir: "asc" };
    const filtered = items.filter(it => it.name.toLowerCase().includes(filterText));
    const dir = s.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (s.key === "name") return a.name.localeCompare(b.name) * dir;
      if (s.key === "quantity") return (a.quantity - b.quantity) * dir;
      if (s.key === "expiry") {
        const da = parseDate(a.expiry)?.getTime() ?? Number.POSITIVE_INFINITY;
        const db = parseDate(b.expiry)?.getTime() ?? Number.POSITIVE_INFINITY;
        return (da - db) * dir;
      }
      return 0;
    });
  }, [selectedId, itemsByList, filters, sortBy]);

  const loading = selectedId && loadingItems.has(selectedId);

  return (
    <Container fluid="md" style={{ marginTop: 24 }}>
      <Row className="g-4">
        {/* LEFT: Lists */}
        <Col xs={12} md={4}>
          <Card>
            <Card.Header>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-list-task" aria-hidden="true" />
                <span>Lists</span>
                <Badge bg="secondary" className="ms-auto">{visibleLists.length}</Badge>
              </div>
            </Card.Header>
            <Card.Body>
              <Form
                onSubmit={onCreateList}
                className="mb-3"
              >
                <InputGroup>
                  <Form.Control
                    placeholder="New list name"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                  />
                  <Button type="submit" disabled={!newListName.trim() || creating}>
                    {creating ? <Spinner size="sm" animation="border" /> : "Add"}
                  </Button>
                </InputGroup>
              </Form>

              <InputGroup className="mb-2">
                <Form.Control
                  placeholder="Search lists…"
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                />
                <InputGroup.Text><i className="bi bi-search" /></InputGroup.Text>
              </InputGroup>

              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                <ListGroup>
                  {visibleLists.length === 0 && (
                    <ListGroup.Item className="text-muted">No lists</ListGroup.Item>
                  )}
                  {visibleLists.map(l => (
                    <ListGroup.Item
                      key={l.id}
                      action
                      active={selectedId === l.id}
                      onClick={() => setSelectedId(l.id)}
                      className="d-flex align-items-center justify-content-between"
                    >
                      <span>{l.name}</span>
                      <Badge bg="light" text="dark">{totalItems(l.id)}</Badge>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* RIGHT: Items */}
        <Col xs={12} md={8}>
          <Card>
            <Card.Header className="d-flex align-items-center">
              <i className="bi bi-bag-check me-2" aria-hidden="true" />
              <strong>
                {selectedId
                  ? lists.find(l => l.id === selectedId)?.name || "List"
                  : "Select a list"}
              </strong>
              {selectedId && <Badge bg="secondary" className="ms-2">{totalItems(selectedId)}</Badge>}
              {loading && <Spinner size="sm" animation="border" className="ms-auto" />}
            </Card.Header>

            <Card.Body>
              {!selectedId ? (
                <div className="text-muted">Choose a list from the left to view items.</div>
              ) : (
                <>
                  {/* Add item */}
                  <Form onSubmit={submitItem} className="mb-3">
                    <Row className="g-2">
                      <Col md={6}>
                        <Form.Control
                          placeholder="Item name"
                          value={(drafts[selectedId]?.name) ?? ""}
                          onChange={(e) => updateDraft(selectedId, { name: e.target.value })}
                        />
                      </Col>
                      <Col md={2}>
                        <Form.Control
                          type="number" min="1" step="1" placeholder="Qty"
                          value={(drafts[selectedId]?.quantity) ?? 1}
                          onChange={(e) => updateDraft(selectedId, { quantity: e.target.value })}
                        />
                      </Col>
                      <Col md={3}>
                        <InputGroup>
                          <Form.Control
                            type="date"
                            value={(drafts[selectedId]?.expiry) ?? ""}
                            onChange={(e) => updateDraft(selectedId, { expiry: e.target.value })}
                          />
                          <Button
                            variant="outline-secondary"
                            onClick={() => updateDraft(selectedId, { expiry: "" })}
                          >
                            Clear
                          </Button>
                        </InputGroup>
                      </Col>
                      <Col md={1}>
                        <Button type="submit" className="w-100">Add</Button>
                      </Col>
                    </Row>
                  </Form>

                  {/* Filter + Sort */}
                  <Row className="g-2 mb-2">
                    <Col md={7}>
                      <InputGroup>
                        <Form.Control
                          placeholder="Search items…"
                          value={filters[selectedId] || ""}
                          onChange={(e) => setFilter(selectedId, e.target.value)}
                        />
                        <InputGroup.Text><i className="bi bi-search" /></InputGroup.Text>
                      </InputGroup>
                    </Col>
                  </Row>

                  {/* Items table */}
                  <div className="table-responsive">
                    <Table hover size="sm" className="align-middle">
                      <thead>
                        <tr>
                          <th
                            style={{ cursor:"pointer" }}
                            onClick={() => toggleSort(selectedId, "name")}
                          >
                            Item{sortIndicator(selectedId, "name")}
                          </th>
                          <th
                            style={{ width:110, cursor:"pointer", textAlign:"center" }}
                            onClick={() => toggleSort(selectedId, "quantity")}
                          >
                            Qty{sortIndicator(selectedId, "quantity")}
                          </th>
                          <th
                            style={{ width:240, cursor:"pointer", textAlign:"center" }}
                            onClick={() => toggleSort(selectedId, "expiry")}
                          >
                            Expiry{sortIndicator(selectedId, "expiry")}
                          </th>
                          <th style={{ width:220 }} className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewItems.length === 0 && (
                          <tr>
                            <td colSpan={4} className="text-center text-muted">No matching items</td>
                          </tr>
                        )}
                        {viewItems.map((it) => {
                          const isEditing = editing.has(it.id);
                          const d = editDrafts[it.id] || {};
                          return (
                            <tr key={it.id}>
                              <td>
                                {isEditing ? (
                                  <Form.Control
                                    value={d.name}
                                    onChange={(e) => updateEditDraft(it.id, { name: e.target.value })}
                                    style={{ minWidth: 240 }}
                                  />
                                ) : it.name}
                              </td>
                              <td className="text-center">
                                {isEditing ? (
                                  <Form.Control
                                    type="number" min="1" step="1"
                                    value={d.quantity}
                                    onChange={(e) => updateEditDraft(it.id, { quantity: e.target.value })}
                                    style={{ minWidth: 90 }}
                                  />
                                ) : it.quantity}
                              </td>
                              <td className="text-center">
                                {isEditing ? (
                                  <InputGroup>
                                    <Form.Control
                                      type="date"
                                      value={d.expiry || ""}
                                      onChange={(e) => updateEditDraft(it.id, { expiry: e.target.value })}
                                    />
                                    <Button variant="outline-secondary"
                                      onClick={() => updateEditDraft(it.id, { expiry: "" })}
                                    >
                                      Clear
                                    </Button>
                                  </InputGroup>
                                ) : (
                                  <div className="d-flex flex-column align-items-center gap-1">
                                    <div>{it.expiry ?? "—"}</div>
                                    <ExpiryBadge expiry={it.expiry} />
                                  </div>
                                )}
                              </td>
                              <td className="text-end">
                                {!isEditing ? (
                                  <>
                                    <Button variant="outline-secondary" size="sm" onClick={() => startEdit(it)}>
                                      <i className="bi bi-pencil" /> Edit
                                    </Button>{" "}
                                    <Button variant="outline-danger" size="sm" onClick={() => askDelete(selectedId, it)}>
                                      <i className="bi bi-trash" /> Delete
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" onClick={() => saveEdit(it.id)}>
                                      <i className="bi bi-check2" /> Save
                                    </Button>{" "}
                                    <Button variant="outline-secondary" size="sm" onClick={() => cancelEdit(it.id)}>
                                      <i className="bi bi-x" /> Cancel
                                    </Button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Confirm Delete */}
      <Modal show={!!confirmDel} onHide={() => setConfirmDel(null)} centered>
        <Modal.Header closeButton><Modal.Title>Delete item</Modal.Title></Modal.Header>
        <Modal.Body>
          {confirmDel ? <>Delete <b>{confirmDel.item.name}</b>?</> : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirmDel(null)}>Cancel</Button>
          <Button variant="danger" onClick={doDelete}>Delete</Button>
        </Modal.Footer>
      </Modal>

      {/* Toasts */}
      <ToastContainer position="top-end" className="p-3">
        {toast && (
          <Toast bg={toast.variant} onClose={() => setToast(null)} show delay={1800} autohide>
            <Toast.Body className={toast.variant === "warning" ? "" : "text-white"}>
              {toast.message}
            </Toast.Body>
          </Toast>
        )}
      </ToastContainer>
    </Container>
  );
}
