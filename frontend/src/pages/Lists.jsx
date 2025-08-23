import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  InputGroup,
  ListGroup,
  Modal,
  Row,
  Spinner,
  Table,
  Toast,
  ToastContainer,
} from "react-bootstrap";

import {
  apiGetLists,
  apiCreateList,
  apiGetItems,
  apiAddItem,
  apiDeleteItem,
  apiUpdateItem,
  apiRenameList,
  apiListShares,
  apiCreateShare,
  apiUpdateShare,
  apiRevokeShare,
  apiDeleteList,
  apiHideList,
} from "../api";

import { useAuth } from "../pages/AuthContext";

// ---- helpers for expiry display ----
const parseDate = (s) => (s ? new Date(`${s}T00:00:00`) : null);
const daysUntil = (s) => {
  const d = parseDate(s);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
};
const ExpiryBadge = ({ expiry }) => {
  const n = daysUntil(expiry);
  if (n === null) return <Badge bg="secondary">—</Badge>;
  if (n < 0) return <Badge bg="danger">Expired</Badge>;
  if (n === 0)
    return (
      <Badge bg="warning" text="dark">
        Today
      </Badge>
    );
  if (n <= 3)
    return (
      <Badge bg="warning" text="dark">
        in {n}d
      </Badge>
    );
  return <Badge bg="success">in {n}d</Badge>;
};

export default function Lists() {
  const { user: me } = useAuth(); // { id, email, name, ... }

  // lists + selection
  const [lists, setLists] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [listQuery, setListQuery] = useState("");

  // left pane sort
  const [listSort, setListSort] = useState({ key: "name", dir: "asc" });
  const setSortKey = (key) => setListSort((s) => ({ key, dir: s.dir }));
  const toggleSortDir = () =>
    setListSort((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }));

  // items + cache per list
  const [itemsByList, setItemsByList] = useState({}); // { [listId]: Item[] }
  const [loadingItems, setLoadingItems] = useState(new Set());

  // create list
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);

  // per-list add-item draft
  const [drafts, setDrafts] = useState({}); // { [listId]: {name, quantity, expiry} }

  // per-list UI state
  const [filters, setFilters] = useState({}); // { [listId]: string }
  const [sortBy, setSortBy] = useState({}); // { [listId]: {key, dir} }

  // inline edit state
  const [editing, setEditing] = useState(new Set()); // itemIds
  const [editDrafts, setEditDrafts] = useState({}); // { itemId: {name, quantity, expiry} }

  const [showHidden, setShowHidden] = useState(false);

  // UX
  const [err, setErr] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null); // { listId, item }
  const [confirmDelList, setConfirmDelList] = useState(false);

  // ---- share modal state ----
  const [shareOpen, setShareOpen] = useState(false);
  const [shares, setShares] = useState([]);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("viewer");
  const [shareBusy, setShareBusy] = useState(false);

  // ---------- owner/permission ----------
  const selectedList = lists.find((l) => l.id === selectedId) || null;
  const isOwner = !!(selectedList && me && selectedList.owner_id === me.id);
  const myRole =
    selectedList?.role ||
    (isOwner ? "owner" : selectedList?.shared ? "viewer" : "owner");
  const canEdit = isOwner || myRole === "editor";

  // ---------- computed lists for left pane ----------
  const listFilter = listQuery.toLowerCase();
  const visibleLists = useMemo(() => {
    const filtered = lists.filter((l) =>
      l.name.toLowerCase().includes(listFilter)
    );
    const dir = listSort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (listSort.key === "name") return a.name.localeCompare(b.name) * dir;
      if (listSort.key === "created") return (a.id - b.id) * dir; // id as created proxy
      return 0;
    });
  }, [lists, listFilter, listSort]);

  // ---------- items view (filter + sort per list) ----------
  const viewItems = useMemo(() => {
    if (!selectedId) return [];
    const items = itemsByList[selectedId] || [];
    const filterText = (filters[selectedId] || "").toLowerCase();
    const s = sortBy[selectedId] || { key: "name", dir: "asc" };
    const filtered = items.filter((it) =>
      it.name.toLowerCase().includes(filterText)
    );
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
  const totalItems = (id) => itemsByList[id]?.length ?? 0;

  // ---------- helpers ----------
  const setFilter = (listId, v) => setFilters((f) => ({ ...f, [listId]: v }));

  const toggleSort = (listId, key) => {
    setSortBy((s) => {
      const curr = s[listId] || { key: "name", dir: "asc" };
      const dir =
        curr.key === key ? (curr.dir === "asc" ? "desc" : "asc") : "asc";
      return { ...s, [listId]: { key, dir } };
    });
  };
  const sortIndicator = (listId, key) => {
    const s = sortBy[listId];
    if (!s || s.key !== key) return " ";
    return s.dir === "asc" ? " ▲" : " ▼";
  };

  const updateDraft = (listId, patch) =>
    setDrafts((d) => ({
      ...d,
      [listId]: {
        name: "",
        quantity: 1,
        expiry: "",
        ...(d[listId] || {}),
        ...patch,
      },
    }));

  // ---------- load lists ----------
  const loadLists = async () => {
    try {
      setErr(null);
      const data = await apiGetLists(showHidden); // <-- pass toggle
      setLists(data);
      if (!selectedId && data.length) setSelectedId(data[0].id);
    } catch (e) {
      setErr(e.message || "Failed to load lists");
    }
  };
  // re-load whenever the toggle changes
  useEffect(() => {
    loadLists(); /* eslint-disable-next-line */
  }, [showHidden]);

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
        setLoadingItems((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
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
      await apiCreateList(nm);
      setNewListName("");
      await loadLists();
      setToast({ message: "List created", variant: "success" });
    } catch (e) {
      setErr(e.message || "Failed to create list");
      setToast({ message: "Create failed", variant: "danger" });
    } finally {
      setCreating(false);
    }
  };

  // ---------- add item ----------
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
      setItemsByList((m) => ({
        ...m,
        [selectedId]: [item, ...(m[selectedId] || [])],
      }));
      setDrafts((d) => ({
        ...d,
        [selectedId]: { name: "", quantity: 1, expiry: "" },
      }));
      setToast({ message: "Item added", variant: "success" });
    } catch (e) {
      setErr(e.message || "Failed to add item");
      setToast({ message: "Add failed", variant: "danger" });
    }
  };

  // ---------- delete item ----------
  const askDelete = (listId, item) => setConfirmDel({ listId, item });
  const doDelete = async () => {
    const { listId, item } = confirmDel;
    try {
      await apiDeleteItem(item.id);
      setItemsByList((m) => ({
        ...m,
        [listId]: (m[listId] || []).filter((i) => i.id !== item.id),
      }));
      setEditing((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
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
    setEditDrafts((d) => ({
      ...d,
      [it.id]: {
        name: it.name,
        quantity: it.quantity,
        expiry: it.expiry || "",
      },
    }));
  };
  const cancelEdit = (id) => {
    setEditing((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    setEditDrafts((d) => {
      const { [id]: _, ...rest } = d;
      return rest;
    });
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
        [selectedId]: (m[selectedId] || []).map((x) =>
          x.id === id ? updated : x
        ),
      }));
      cancelEdit(id);
      setToast({ message: "Item updated", variant: "success" });
    } catch (e) {
      setErr(e.message || "Failed to update item");
      setToast({ message: "Update failed", variant: "danger" });
    }
  };

  // ---------- rename / delete list (owner) ----------
  const rename = async () => {
    if (!selectedId) return;
    const curr = lists.find((l) => l.id === selectedId);
    const nm = window.prompt("Rename list:", curr?.name || "");
    if (nm == null) return;
    const newName = nm.trim();
    if (!newName) return;
    try {
      await apiRenameList(selectedId, newName);
      await loadLists();
      setToast({ message: "List renamed", variant: "success" });
    } catch (e) {
      setToast({ message: e.message || "Rename failed", variant: "danger" });
    }
  };

  const onDeleteList = async () => {
    if (!selectedId) return;
    setConfirmDelList(false);
    try {
      await apiDeleteList(selectedId);
      setToast({ message: "List deleted", variant: "success" });
      setSelectedId(null); // let loadLists pick the first available
      await loadLists();
    } catch (e) {
      setToast({ message: e.message || "Delete failed", variant: "danger" });
    }
  };

  // ---------- hide shared list (non-owner) ----------
  const hideSelected = async () => {
    if (!selectedId || isOwner) return;
    if (!window.confirm("Hide this shared list from your view?")) return;
    try {
      await apiHideList(selectedId);
      setToast({ message: "Hidden", variant: "success" });
      setSelectedId(null);
      await loadLists();
    } catch (e) {
      setToast({ message: e.message || "Hide failed", variant: "danger" });
    }
  };

  // ---------- load shares when modal opens (owner only) ----------
  useEffect(() => {
    if (shareOpen && isOwner && selectedId) {
      (async () => {
        try {
          const data = await apiListShares(selectedId);
          setShares(data);
        } catch (e) {
          setToast({
            message: e.message || "Failed to load shares",
            variant: "danger",
          });
        }
      })();
    }
  }, [shareOpen, isOwner, selectedId]);

  const addShare = async (e) => {
    e.preventDefault();
    if (!shareEmail.trim()) return;
    setShareBusy(true);
    try {
      const added = await apiCreateShare(selectedId, {
        email: shareEmail.trim(),
        role: shareRole,
      });
      setShares((s) => [...s, added]);
      setShareEmail("");
      setShareRole("viewer");
    } catch (e) {
      setToast({ message: e.message || "Share failed", variant: "danger" });
    } finally {
      setShareBusy(false);
    }
  };

  const changeRole = async (share, role) => {
    try {
      const updated = await apiUpdateShare(selectedId, share.id, { role });
      setShares((s) => s.map((x) => (x.id === share.id ? updated : x)));
    } catch (e) {
      setToast({
        message: e.message || "Update role failed",
        variant: "danger",
      });
    }
  };

  const revoke = async (share) => {
    if (!window.confirm(`Stop sharing with ${share.email}?`)) return;
    try {
      await apiRevokeShare(selectedId, share.id);
      setShares((s) => s.filter((x) => x.id !== share.id));
    } catch (e) {
      setToast({ message: e.message || "Revoke failed", variant: "danger" });
    }
  };

  // ---------- UI ----------
  // ---------- UI ----------
  return (
    <Container fluid="md" style={{ marginTop: 24 }}>
      <Row className="g-4">
        {/* LEFT: Lists */}
        <Col xs={12} md={4}>
          <Card className="shadow-sm">
            <Card.Header>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-list-task" aria-hidden="true" />
                <span className="fw-semibold">Lists</span>
                <Badge bg="secondary" className="ms-auto">
                  {visibleLists.length}
                </Badge>
              </div>
            </Card.Header>

            <Card.Body>
              {/* Create list */}
              <Form onSubmit={onCreateList} className="mb-3">
                <InputGroup>
                  <Form.Control
                    placeholder="New list name (e.g. Costco run)"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                  />
                  <Button
                    type="submit"
                    disabled={!newListName.trim() || creating}
                    title="Create list"
                  >
                    {creating ? (
                      <Spinner size="sm" animation="border" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </InputGroup>
              </Form>

              {/* Search lists */}
              <InputGroup className="mb-2">
                <Form.Control
                  placeholder="Search lists…"
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                />
                <InputGroup.Text>
                  <i className="bi bi-search" />
                </InputGroup.Text>
              </InputGroup>

              {/* Sort + show hidden */}
              <div className="d-flex gap-2 align-items-center mb-2">
                <Form.Select
                  style={{ maxWidth: 200 }}
                  value={listSort.key}
                  onChange={(e) => setSortKey(e.target.value)}
                  aria-label="Sort lists by"
                >
                  <option value="name">Sort: Name</option>
                  <option value="created">Sort: Created</option>
                </Form.Select>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={toggleSortDir}
                  title="Toggle sort direction"
                >
                  {listSort.dir === "asc" ? "▲ Asc" : "▼ Desc"}
                </Button>

                <Form.Check
                  type="checkbox"
                  id="show-hidden"
                  label="Show hidden"
                  checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)}
                  className="ms-auto"
                />
              </div>

              {/* Lists */}
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                <ListGroup>
                  {visibleLists.length === 0 && (
                    <ListGroup.Item className="text-muted">
                      No lists
                    </ListGroup.Item>
                  )}

                  {visibleLists.map((l) => (
                    <ListGroup.Item
                      key={l.id}
                      action
                      active={selectedId === l.id}
                      onClick={() => setSelectedId(l.id)}
                      className="d-flex align-items-center justify-content-between"
                      title={l.shared ? "Shared with you" : "Owned by you"}
                    >
                      <span className="d-flex align-items-center gap-2">
                        {l.shared && (
                          <i
                            className="bi bi-people text-secondary"
                            aria-hidden="true"
                          />
                        )}
                        <span className="text-truncate">{l.name}</span>

                        {/* Hidden badge only when user opted to show hidden */}
                        {l.shared && l.hidden && showHidden && (
                          <Badge bg="secondary" title="Hidden from your view">
                            Hidden
                          </Badge>
                        )}
                      </span>

                      {/* Count bubble (optional; remove if you don’t have totalItems) */}
                      <Badge bg="light" text="dark">
                        {totalItems(l.id)}
                      </Badge>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* RIGHT: Items */}
        <Col xs={12} md={8}>
          <Card className="shadow-sm">
            <Card.Header className="d-flex align-items-center flex-wrap gap-2">
              {/* Title + count */}
              <div className="d-flex align-items-center me-auto gap-2">
                <i className="bi bi-bag-check" aria-hidden="true" />
                <strong>
                  {selectedId
                    ? lists.find((l) => l.id === selectedId)?.name || "List"
                    : "Select a list"}
                </strong>

                {selectedId && (
                  <Badge bg="secondary" className="ms-1">
                    {totalItems(selectedId)}
                  </Badge>
                )}

                {/* Shared badge when not owner */}
                {selectedId && !isOwner && (
                  <Badge bg="info" className="ms-1">
                    Shared
                  </Badge>
                )}
              </div>

              {/* Loading spinner */}
              {selectedId && loading && (
                <Spinner size="sm" animation="border" />
              )}

              {/* Actions */}
              {selectedId &&
                !loading &&
                (isOwner ? (
                  <div className="d-flex align-items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={rename}
                      title="Rename list"
                    >
                      <i className="bi bi-pencil-square" /> Rename
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => setShareOpen(true)}
                      title="Share list"
                    >
                      <i className="bi bi-people" /> Share
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => setConfirmDelList(true)}
                      title="Delete list"
                    >
                      <i className="bi bi-trash" /> Delete
                    </Button>
                  </div>
                ) : (
                  <div className="d-flex align-items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={hideSelected}
                      title="Hide this shared list from your view"
                    >
                      <i className="bi bi-eye-slash" /> Hide
                    </Button>
                  </div>
                ))}
            </Card.Header>

            <Card.Body>
              {err && <div className="alert alert-warning my-2">{err}</div>}

              {!selectedId ? (
                <div className="text-muted">
                  Choose a list from the left to view items.
                </div>
              ) : (
                <>
                  {/* Add item */}
                  <Form onSubmit={submitItem} className="mb-3">
                    <Row className="g-2">
                      <Col md={6}>
                        <Form.Control
                          placeholder="Item name"
                          value={drafts[selectedId]?.name ?? ""}
                          onChange={(e) =>
                            updateDraft(selectedId, { name: e.target.value })
                          }
                          disabled={!canEdit}
                        />
                      </Col>
                      <Col md={2}>
                        <Form.Control
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Qty"
                          value={drafts[selectedId]?.quantity ?? 1}
                          onChange={(e) =>
                            updateDraft(selectedId, {
                              quantity: e.target.value,
                            })
                          }
                          disabled={!canEdit}
                        />
                      </Col>
                      <Col md={3}>
                        <InputGroup>
                          <Form.Control
                            type="date"
                            value={drafts[selectedId]?.expiry ?? ""}
                            onChange={(e) =>
                              updateDraft(selectedId, {
                                expiry: e.target.value,
                              })
                            }
                            disabled={!canEdit}
                          />
                          <Button
                            variant="outline-secondary"
                            type="button"
                            onClick={() =>
                              updateDraft(selectedId, {
                                name: "",
                                quantity: 1,
                                expiry: "",
                              })
                            }
                            disabled={!canEdit}
                            title="Clear fields"
                          >
                            Clear
                          </Button>
                        </InputGroup>
                      </Col>
                      <Col md={1}>
                        <Button
                          type="submit"
                          className="w-100"
                          disabled={!canEdit}
                        >
                          Add
                        </Button>
                      </Col>
                    </Row>
                  </Form>

                  {/* Filter */}
                  <Row className="g-2 mb-2">
                    <Col md={7}>
                      <InputGroup>
                        <Form.Control
                          placeholder="Search items…"
                          value={filters[selectedId] || ""}
                          onChange={(e) =>
                            setFilter(selectedId, e.target.value)
                          }
                        />
                        <InputGroup.Text>
                          <i className="bi bi-search" />
                        </InputGroup.Text>
                      </InputGroup>
                    </Col>
                  </Row>

                  {/* Items table */}
                  <div className="table-responsive">
                    <Table hover size="sm" className="align-middle">
                      <thead>
                        <tr>
                          <th
                            style={{ cursor: "pointer" }}
                            onClick={() => toggleSort(selectedId, "name")}
                          >
                            Item{sortIndicator(selectedId, "name")}
                          </th>
                          <th
                            style={{
                              width: 110,
                              cursor: "pointer",
                              textAlign: "center",
                            }}
                            onClick={() => toggleSort(selectedId, "quantity")}
                          >
                            Qty{sortIndicator(selectedId, "quantity")}
                          </th>
                          <th
                            style={{
                              width: 240,
                              cursor: "pointer",
                              textAlign: "center",
                            }}
                            onClick={() => toggleSort(selectedId, "expiry")}
                          >
                            Expiry{sortIndicator(selectedId, "expiry")}
                          </th>
                          <th style={{ width: 220 }} className="text-end">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewItems.length === 0 && (
                          <tr>
                            <td colSpan={4} className="text-center text-muted">
                              {filters[selectedId]?.trim()
                                ? "No matching items"
                                : "No items yet"}
                            </td>
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
                                    onChange={(e) =>
                                      updateEditDraft(it.id, {
                                        name: e.target.value,
                                      })
                                    }
                                    style={{ minWidth: 240 }}
                                  />
                                ) : (
                                  it.name
                                )}
                              </td>

                              <td className="text-center">
                                {isEditing ? (
                                  <Form.Control
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={d.quantity}
                                    onChange={(e) =>
                                      updateEditDraft(it.id, {
                                        quantity: e.target.value,
                                      })
                                    }
                                    style={{ minWidth: 90 }}
                                  />
                                ) : (
                                  it.quantity
                                )}
                              </td>

                              <td className="text-center">
                                {isEditing ? (
                                  <InputGroup>
                                    <Form.Control
                                      type="date"
                                      value={d.expiry || ""}
                                      onChange={(e) =>
                                        updateEditDraft(it.id, {
                                          expiry: e.target.value,
                                        })
                                      }
                                    />
                                    <Button
                                      variant="outline-secondary"
                                      type="button"
                                      onClick={() =>
                                        updateEditDraft(it.id, { expiry: "" })
                                      }
                                      title="Clear date"
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
                                    <Button
                                      variant="outline-secondary"
                                      size="sm"
                                      onClick={() => startEdit(it)}
                                      disabled={!canEdit}
                                    >
                                      <i className="bi bi-pencil" /> Edit
                                    </Button>{" "}
                                    <Button
                                      variant="outline-danger"
                                      size="sm"
                                      onClick={() => askDelete(selectedId, it)}
                                      disabled={!canEdit}
                                    >
                                      <i className="bi bi-trash" /> Delete
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => saveEdit(it.id)}
                                      disabled={!canEdit}
                                    >
                                      <i className="bi bi-check2" /> Save
                                    </Button>{" "}
                                    <Button
                                      variant="outline-secondary"
                                      size="sm"
                                      onClick={() => cancelEdit(it.id)}
                                    >
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

      {/* Share modal (owner-only) */}
      <Modal show={shareOpen} onHide={() => setShareOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Share list</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={addShare} className="mb-3">
            <Row className="g-2">
              <Col>
                <Form.Control
                  placeholder="friend@example.com"
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  disabled={!isOwner}
                />
              </Col>
              <Col xs="auto">
                <Form.Select
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value)}
                  disabled={!isOwner}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </Form.Select>
              </Col>
              <Col xs="auto">
                <Button
                  type="submit"
                  disabled={!isOwner || shareBusy || !shareEmail.trim()}
                >
                  {shareBusy ? "Adding…" : "Add"}
                </Button>
              </Col>
            </Row>
          </Form>

          <div className="table-responsive">
            <Table hover size="sm" className="align-middle">
              <thead>
                <tr>
                  <th>Email</th>
                  <th style={{ width: 180 }}>Role</th>
                  <th className="text-end" style={{ width: 120 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {shares.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-muted text-center">
                      No shares yet
                    </td>
                  </tr>
                )}
                {shares.map((s) => (
                  <tr key={s.id}>
                    <td>{s.email}</td>
                    <td>
                      <Form.Select
                        value={s.role}
                        onChange={(e) => changeRole(s, e.target.value)}
                        disabled={!isOwner}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </Form.Select>
                    </td>
                    <td className="text-end">
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => revoke(s)}
                        disabled={!isOwner}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
      </Modal>

      {/* Confirm Delete ITEM */}
      <Modal show={!!confirmDel} onHide={() => setConfirmDel(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete item</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirmDel ? (
            <>
              Delete <b>{confirmDel.item.name}</b>?
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirmDel(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={doDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Confirm Delete LIST */}
      <Modal
        show={!!confirmDelList}
        onHide={() => setConfirmDelList(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Delete list</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedId ? (
            <>
              Delete list{" "}
              <b>
                {lists.find((l) => l.id === selectedId)?.name || "this list"}
              </b>{" "}
              and all its items?
            </>
          ) : (
            "Delete this list and all its items?"
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirmDelList(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onDeleteList}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Toasts */}
      <ToastContainer position="top-end" className="p-3">
        {toast && (
          <Toast
            bg={toast.variant}
            onClose={() => setToast(null)}
            show
            delay={1800}
            autohide
          >
            <Toast.Body
              className={toast.variant === "warning" ? "" : "text-white"}
            >
              {toast.message}
            </Toast.Body>
          </Toast>
        )}
      </ToastContainer>
    </Container>
  );
}
