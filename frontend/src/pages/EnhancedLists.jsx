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
import { useAuth } from "../pages/AuthContext";
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
import "../enhanced-styles.css"; // Import the enhanced CSS

// Enhanced expiry display helpers
const parseDate = (s) => (s ? new Date(`${s}T00:00:00`) : null);
const daysUntil = (s) => {
  const d = parseDate(s);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
};

// Enhanced Expiry Badge with organic styling
const ExpiryBadge = ({ expiry }) => {
  const n = daysUntil(expiry);
  if (n === null) return <Badge bg="secondary">—</Badge>;
  if (n < 0) return <Badge bg="danger" className="expiry-expired">Expired</Badge>;
  if (n === 0)
    return (
      <Badge bg="warning" text="dark" className="expiry-warning">
        Today
      </Badge>
    );
  if (n <= 3)
    return (
      <Badge bg="warning" text="dark" className="expiry-warning">
        in {n}d
      </Badge>
    );
  return <Badge bg="success" className="expiry-fresh">in {n}d</Badge>;
};

// Dot indicators for visual expiry status
const ExpiryDot = ({ expiry }) => {
  const n = daysUntil(expiry);
  if (n === null) return null;
  if (n < 0) return <span className="dot dot-expired" title="Expired" />;
  if (n <= 3) return <span className="dot dot-soon" title="Expiring soon" />;
  return null;
};

export default function EnhancedLists() {
  const { user: me } = useAuth();

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
  const [itemsByList, setItemsByList] = useState({});
  const [loadingItems, setLoadingItems] = useState(new Set());

  // create list
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);

  // per-list add-item draft
  const [drafts, setDrafts] = useState({});

  // per-list UI state
  const [filters, setFilters] = useState({});
  const [sortBy, setSortBy] = useState({});

  // inline edit state
  const [editing, setEditing] = useState(new Set());
  const [editDrafts, setEditDrafts] = useState({});
  const [expandedIds, setExpandedIds] = useState(new Set());

  const [showHidden, setShowHidden] = useState(false);
  const [shoppingMode, setShoppingMode] = useState(false);
  const [hidePurchased, setHidePurchased] = useState(true);

  // UX
  const [err, setErr] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmDelList, setConfirmDelList] = useState(false);

  // share modal state
  const [shareOpen, setShareOpen] = useState(false);
  const [shares, setShares] = useState([]);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("viewer");
  const [shareBusy, setShareBusy] = useState(false);

  // Enhanced state for animations and theme
  const [isLoading, setIsLoading] = useState(true);
  const [shoppingProgress, setShoppingProgress] = useState(0);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('sg-theme') || ''; } catch { return ''; }
  });

  // owner/permission
  const selectedList = lists.find((l) => l.id === selectedId) || null;
  const isOwner = !!(selectedList && me && selectedList.owner_id === me.id);
  const myRole =
    selectedList?.role ||
    (isOwner ? "owner" : selectedList?.shared ? "viewer" : "owner");
  const canEdit = isOwner || myRole === "editor";

  // computed lists for left pane
  const listFilter = listQuery.toLowerCase();
  const visibleLists = useMemo(() => {
    const base = showHidden ? lists : lists.filter((l) => !l.hidden);
    const filtered = base.filter((l) => l.name.toLowerCase().includes(listFilter));
    const dir = listSort.dir === "asc" ? 1 : -1;
    const tItems = (id) => itemsByList[id]?.length ?? 0;
    const pItems = (id) => (itemsByList[id]?.filter((i) => !i.purchased).length ?? 0);
    return [...filtered].sort((a, b) => {
      if (listSort.key === "name") return a.name.localeCompare(b.name) * dir;
      if (listSort.key === "created") return (a.id - b.id) * dir;
      if (listSort.key === "items") return (tItems(a.id) - tItems(b.id)) * dir;
      if (listSort.key === "pending") return (pItems(a.id) - pItems(b.id)) * dir;
      return 0;
    });
  }, [lists, listFilter, listSort, showHidden, itemsByList]);

  // items view (filter + sort per list)
  const viewItems = useMemo(() => {
    if (!selectedId) return [];
    const items = itemsByList[selectedId] || [];
    const filterText = (filters[selectedId] || "").toLowerCase();
    const s = sortBy[selectedId] || { key: "name", dir: "asc" };
    let filtered = items.filter((it) => it.name.toLowerCase().includes(filterText));
    if (shoppingMode && hidePurchased) filtered = filtered.filter((i) => !i.purchased);
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
  }, [selectedId, itemsByList, filters, sortBy, shoppingMode, hidePurchased]);

  const loading = selectedId && loadingItems.has(selectedId);
  const totalItems = (id) => itemsByList[id]?.length ?? 0;
  const pendingItems = (id) => (itemsByList[id]?.filter((i) => !i.purchased).length ?? 0);

  // Calculate shopping progress
  useEffect(() => {
    if (selectedId && itemsByList[selectedId]) {
      const items = itemsByList[selectedId];
      const purchased = items.filter(item => item.purchased).length;
      const progress = items.length > 0 ? (purchased / items.length) * 100 : 0;
      setShoppingProgress(progress);
    }
  }, [selectedId, itemsByList]);

  // Apply theme attribute for dark mode toggle
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    try { localStorage.setItem('sg-theme', theme); } catch {}
  }, [theme]);

  // helpers
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

  const updateDraft = (listId, patch) =>
    setDrafts((d) => ({
      ...d,
      [listId]: {
        name: "",
        quantity: 1,
        expiry: "",
        description: "",
        ...(d[listId] || {}),
        ...patch,
      },
    }));

  // Using real API functions from ../api

  // Load lists on component mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const data = await apiGetLists(showHidden);
        setLists(data);
        setSelectedId((prev) => (prev ?? (data[0]?.id || null)));
        setIsLoading(false);
      } catch (e) {
        setErr(e.message || "Failed to load lists");
        setIsLoading(false);
      }
    };
    
    loadInitialData();
  }, [showHidden]);

  // Load items when list is selected
  useEffect(() => {
    const loadItems = async () => {
      if (!selectedId || itemsByList[selectedId]) return;
      
      try {
        setLoadingItems((s) => new Set(s).add(selectedId));
        const items = await apiGetItems(selectedId);
        setItemsByList((m) => ({ ...m, [selectedId]: items }));
      } catch (e) {
        setErr(e.message || "Failed to load items");
      } finally {
        setLoadingItems((s) => {
          const n = new Set(s);
          n.delete(selectedId);
          return n;
        });
      }
    };
    
    loadItems();
  }, [selectedId, itemsByList]);

  // Event Handlers
  const onCreateList = async (e) => {
    e.preventDefault();
    const nm = newListName.trim();
    if (!nm) return;
    
    try {
      setCreating(true);
      await apiCreateList(nm);
      setNewListName("");
      const data = await apiGetLists(showHidden);
      setLists(data);
      setToast({ message: "List created", variant: "success" });
    } catch (e) {
      setErr(e.message || "Failed to create list");
      setToast({ message: "Create failed", variant: "danger" });
    } finally {
      setCreating(false);
    }
  };

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
        description: draft.description ? draft.description : undefined,
      };
      
      const item = await apiAddItem(selectedId, payload);
      setItemsByList((m) => ({
        ...m,
        [selectedId]: [item, ...(m[selectedId] || [])],
      }));
      
      setDrafts((d) => ({
        ...d,
        [selectedId]: { name: "", quantity: 1, expiry: "", description: "" },
      }));
      
      setToast({ message: "Item added", variant: "success" });
    } catch (e) {
      setErr(e.message || "Failed to add item");
      setToast({ message: "Add failed", variant: "danger" });
    }
  };

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

  const startEdit = (it) => {
    setEditing((s) => new Set(s).add(it.id));
    setEditDrafts((d) => ({
      ...d,
      [it.id]: {
        name: it.name,
        quantity: it.quantity,
        expiry: it.expiry || "",
        description: it.description || "",
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
      description: typeof draft.description === "string" ? draft.description : undefined,
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

  const rename = async () => {
    if (!selectedId) return;
    const curr = lists.find((l) => l.id === selectedId);
    const nm = window.prompt("Rename list:", curr?.name || "");
    if (nm == null) return;
    const newName = nm.trim();
    if (!newName) return;
    
    try {
      await apiRenameList(selectedId, newName);
      const data = await apiGetLists(showHidden);
      setLists(data);
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
      setSelectedId(null);
      const data = await apiGetLists(showHidden);
      setLists(data);
    } catch (e) {
      setToast({ message: e.message || "Delete failed", variant: "danger" });
    }
  };

  const hideSelected = async () => {
    if (!selectedId || isOwner) return;
    if (!window.confirm("Hide this shared list from your view?")) return;
    try {
      await apiHideList(selectedId);
      setToast({ message: "Hidden", variant: "success" });
      setSelectedId(null);
      // If user is viewing hidden lists, turn off to remove immediately
      if (showHidden) setShowHidden(false);
      const data = await apiGetLists(false);
      setLists(data);
    } catch (e) {
      setToast({ message: e.message || "Hide failed", variant: "danger" });
    }
  };

  // Load shares when modal opens (owner-only)
  useEffect(() => {
    if (shareOpen && isOwner && selectedId) {
      (async () => {
        try {
          const data = await apiListShares(selectedId);
          setShares(data);
        } catch (e) {
          setToast({ message: e.message || "Failed to load shares", variant: "danger" });
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
      setToast({ message: e.message || "Update role failed", variant: "danger" });
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

  // UI Rendering
  if (isLoading) {
    return (
      <Container fluid="md" style={{ marginTop: 24 }}>
        <Row className="g-4">
          <Col xs={12} className="text-center">
            <Spinner animation="border" variant="success" size="lg" />
            <p className="mt-3 text-muted">Loading your lists...</p>
          </Col>
        </Row>
      </Container>
    );
  }

  return (
    <>
      <div className="organic-pattern"></div>
      <Container fluid="md" style={{ marginTop: 24 }} className="fade-in">
        <Row className="g-4">
          {/* LEFT: Lists Sidebar */}
          <Col xs={12} md={4}>
            <Card className="shadow-sm hover-lift sticky-md-top" style={{ top: '100px' }}>
              <Card.Header className="bg-gradient-to-r from-leaf-green to-mint-light text-white">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-list-task fs-5" aria-hidden="true" />
                  <span className="fw-semibold fs-5">My Lists</span>
                  <Badge bg="light" text="dark" className="ms-auto">
                    {visibleLists.length}
                  </Badge>
                </div>
              </Card.Header>

              <Card.Body className="p-4">
                {/* Create list */}
                <Form onSubmit={onCreateList} className="mb-4">
                  <InputGroup>
                    <Form.Control
                      placeholder="New list name..."
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      className="border-0 bg-light"
                    />
                    <Button
                      type="submit"
                      variant="success"
                      disabled={!newListName.trim() || creating}
                      title="Create list"
                      className="px-3"
                    >
                      {creating ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        <i className="bi bi-plus-lg"></i>
                      )}
                    </Button>
                  </InputGroup>
                </Form>

                {/* Search lists */}
                <InputGroup className="mb-3">
                  <Form.Control
                    placeholder="Search lists..."
                    value={listQuery}
                    onChange={(e) => setListQuery(e.target.value)}
                    className="border-0 bg-light"
                  />
                  <InputGroup.Text className="bg-light border-0">
                    <i className="bi bi-search text-muted" />
                  </InputGroup.Text>
                </InputGroup>

                {/* Sort controls */}
                <div className="d-flex gap-2 align-items-center mb-3">
                  <Form.Select
                    style={{ maxWidth: 140 }}
                    value={listSort.key}
                    onChange={(e) => setSortKey(e.target.value)}
                    aria-label="Sort lists by"
                    className="border-0 bg-light py-2"
                    size="sm"
                  >
                    <option value="name">Name</option>
                    <option value="created">Created</option>
                    <option value="items">Items (total)</option>
                    <option value="pending">Items (pending)</option>
                  </Form.Select>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={toggleSortDir}
                    title="Toggle sort direction"
                    className="border-0 bg-light"
                  >
                    {listSort.dir === "asc" ? "▲" : "▼"}
                  </Button>

                  <Form.Check
                    type="checkbox"
                    id="show-hidden"
                    label="Show hidden"
                    checked={showHidden}
                    onChange={(e) => setShowHidden(e.target.checked)}
                    className="ms-auto small"
                  />
                </div>

                {/* Lists */}
                <div style={{ maxHeight: 400, overflowY: "auto" }} className="custom-scrollbar">
                  <ListGroup variant="flush">
                    {visibleLists.length === 0 && (
                      <ListGroup.Item className="text-center text-muted border-0">
                        <div className="empty py-4">
                          <div className="icon"><i className="bi bi-card-checklist fs-1" /></div>
                          <div className="mt-2">No lists yet</div>
                          <small>Create your first list above</small>
                        </div>
                      </ListGroup.Item>
                    )}

                    {visibleLists.map((list) => (
                      <ListGroup.Item
                        key={list.id}
                        action
                        active={selectedId === list.id}
                        onClick={() => setSelectedId(list.id)}
                        className="d-flex align-items-center justify-content-between border-0 mb-2 p-3 rounded-3"
                        title={list.shared ? "Shared with you" : "Owned by you"}
                      >
                        <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 0 }}>
                          {list.shared && (
                            <i className="bi bi-people text-leaf-green" aria-hidden="true" />
                          )}
                          <span className="text-truncate fw-medium" title={list.name}>
                            {list.name}
                          </span>

                          {list.shared && list.hidden && showHidden && (
                            <Badge bg="secondary" title="Hidden from your view" className="ms-1">
                              Hidden
                            </Badge>
                          )}
                        </div>

                        <Badge bg="light" text="dark" className="ms-2" title="Pending items">
                          {pendingItems(list.id)}
                        </Badge>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </div>

                {/* Quick Stats */}
                <div className="mt-4 pt-3 border-top">
                  <div className="row g-2">
                    <div className="col-6">
                      <div className="text-center p-2 bg-light rounded-3">
                        <div className="h5 mb-0 text-forest-dark">{visibleLists.length}</div>
                        <small className="text-muted">Active Lists</small>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="text-center p-2 bg-light rounded-3">
                        <div className="h5 mb-0 text-forest-dark">
                          {Object.values(itemsByList).reduce((sum, items) => sum + (items?.filter(i => !i.purchased).length || 0), 0)}
                        </div>
                        <small className="text-muted">Items Pending</small>
                      </div>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* RIGHT: Items Main Content */}
          <Col xs={12} md={8}>
            <Card className="shadow-sm hover-lift">
              <Card.Header className="d-flex align-items-center flex-wrap gap-3 py-3">
                {/* Title and Progress */}
                <div className="d-flex align-items-center me-auto gap-3 flex-grow-1" style={{ minWidth: 0 }}>
                  <i className="bi bi-bag-check fs-4 text-leaf-green" aria-hidden="true" />
                  <div className="flex-grow-1">
                    <h3 className="mb-0 truncate text-forest-dark fw-bold">
                      {selectedId
                        ? lists.find((l) => l.id === selectedId)?.name || "List"
                        : "Select a list"}
                    </h3>
                    <small className="text-muted">
                      {selectedId && (
                        <>
                          {totalItems(selectedId)} items • {shoppingMode ? 'Shopping Mode Active' : 'Last updated 2 hours ago'}
                        </>
                      )}
                    </small>
                  </div>

                  {selectedId && (
                    <Badge bg="secondary" className="ms-2" title="Pending / Total">
                      {(itemsByList[selectedId]?.filter(i => !i.purchased).length || 0)} / {totalItems(selectedId)}
                    </Badge>
                  )}

                  {selectedId && !isOwner && (
                    <Badge bg="info" className="ms-2">
                      Shared
                    </Badge>
                  )}
                </div>

                {/* Loading spinner */}
                {selectedId && loading && (
                  <Spinner size="sm" animation="border" variant="success" />
                )}

                {/* Shopping Mode Toggle */}
                <Button
                  size="sm"
                  variant={shoppingMode ? "success" : "outline-success"}
                  onClick={() => setShoppingMode((v) => !v)}
                  title="Toggle shopping mode"
                  className="d-flex align-items-center gap-1"
                >
                  <i className={`bi ${shoppingMode ? 'bi-bag-check' : 'bi-bag'}`} /> 
                  {shoppingMode ? 'Shopping' : 'Shop Mode'}
                </Button>

                {/* Action Buttons */}
                {selectedId && !loading && (
                  <div className="d-flex align-items-center gap-2">
                    {isOwner ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={rename}
                          title="Rename list"
                          className="d-flex align-items-center gap-1"
                        >
                          <i className="bi bi-pencil-square" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-success"
                          onClick={() => setShareOpen(true)}
                          title="Share list"
                          className="d-flex align-items-center gap-1"
                        >
                          <i className="bi bi-people" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => setConfirmDelList(true)}
                          title="Delete list"
                          className="d-flex align-items-center gap-1"
                        >
                          <i className="bi bi-trash" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={hideSelected}
                        title="Hide this shared list from your view"
                        className="d-flex align-items-center gap-1"
                      >
                        <i className="bi bi-eye-slash" />
                      </Button>
                    )}
                    <Form.Check
                      type="switch"
                      id="dark-toggle"
                      label="Dark"
                      checked={theme === 'dark'}
                      onChange={(e) => setTheme(e.target.checked ? 'dark' : '')}
                      className="ms-2"
                    />
                  </div>
                )}
              </Card.Header>

              <Card.Body className="p-4">
                {err && <div className="alert alert-warning my-3">{err}</div>}

                {!selectedId ? (
                  <div className="text-center py-5 text-muted">
                    <i className="bi bi-list-task fs-1 mb-3 d-block text-leaf-green" />
                    <h4>Choose a list to get started</h4>
                    <p>Select a list from the sidebar to view and manage your items.</p>
                  </div>
                ) : (
                  <>
                    {/* Shopping Mode Progress */}
                    {shoppingMode && (
                      <div className="mb-4 p-3 bg-light rounded-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="fw-semibold text-forest-dark">Shopping Progress</span>
                          <span className="text-muted">
                            {viewItems.filter(item => item.purchased).length} of {viewItems.length} items
                          </span>
                        </div>
                        <div className="progress" style={{height: '8px'}}>
                          <div 
                            className="progress-bar bg-success" 
                            style={{width: `${shoppingProgress}%`}}
                          ></div>
                        </div>
                        <div className="d-flex justify-content-between mt-2">
                          <Form.Check
                            type="checkbox"
                            id="hide-purchased"
                            label="Hide purchased items"
                            checked={hidePurchased}
                            onChange={(e) => setHidePurchased(e.target.checked)}
                            className="small"
                          />
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => setShoppingMode(false)}
                            className="small"
                          >
                            Exit Shopping Mode
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Add Item Form */}
                    <Form onSubmit={submitItem} className="mb-4">
                      <Row className="g-3">
                        <Col md={6}>
                          <Form.Control
                            placeholder="Item name (e.g., Organic Bananas)"
                            value={drafts[selectedId]?.name ?? ""}
                            onChange={(e) => updateDraft(selectedId, { name: e.target.value })}
                            disabled={!canEdit}
                            className="border-0 bg-light"
                          />
                        </Col>
                        <Col md={2}>
                          <Form.Control
                            type="number"
                            min="1"
                            step="1"
                            placeholder="Qty"
                            value={drafts[selectedId]?.quantity ?? 1}
                            onChange={(e) => updateDraft(selectedId, { quantity: e.target.value })}
                            disabled={!canEdit}
                            className="border-0 bg-light"
                          />
                        </Col>
                        <Col md={3}>
                          <InputGroup>
                            <Form.Control
                              type="date"
                              value={drafts[selectedId]?.expiry ?? ""}
                              onChange={(e) => updateDraft(selectedId, { expiry: e.target.value })}
                              disabled={!canEdit}
                              className="border-0 bg-light"
                            />
                            <Button
                              variant="outline-secondary"
                              type="button"
                              onClick={() => updateDraft(selectedId, { name: "", quantity: 1, expiry: "", description: "" })}
                              disabled={!canEdit}
                              title="Clear fields"
                              className="border-0 bg-light"
                            >
                              <i className="bi bi-x-lg"></i>
                            </Button>
                          </InputGroup>
                        </Col>
                        <Col md={1}>
                          <Button
                            type="submit"
                            className="w-100 btn-success"
                            disabled={!canEdit}
                          >
                            <i className="bi bi-plus-lg"></i>
                          </Button>
                        </Col>
                      </Row>
                      <Row className="g-2 mt-2">
                        <Col md={12}>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            placeholder="Description (optional, e.g., 'For salad' or 'Get the ripe ones')"
                            value={drafts[selectedId]?.description ?? ""}
                            onChange={(e) => updateDraft(selectedId, { description: e.target.value })}
                            disabled={!canEdit}
                            className="border-0 bg-light"
                          />
                        </Col>
                      </Row>
                    </Form>

                    {/* Filter */}
                    <Row className="g-2 mb-4">
                      <Col md={7}>
                        <InputGroup>
                          <Form.Control
                            placeholder="Search items..."
                            value={filters[selectedId] || ""}
                            onChange={(e) => setFilter(selectedId, e.target.value)}
                            className="border-0 bg-light"
                          />
                          <InputGroup.Text className="bg-light border-0">
                            <i className="bi bi-search text-muted" />
                          </InputGroup.Text>
                        </InputGroup>
                      </Col>
                      <Col md={5} className="d-flex justify-content-end">
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => toggleSort(selectedId, 'name')}
                          className="d-flex align-items-center gap-1"
                        >
                          Sort Name {sortIndicator(selectedId, 'name')}
                        </Button>
                      </Col>
                    </Row>

                    {/* Items Display */}
                    {!shoppingMode ? (
                      <div className="table-responsive">
                        <Table hover size="sm" className="align-middle">
                          <thead className="table-light">
                            <tr>
                              <th
                                style={{ cursor: "pointer" }}
                                onClick={() => toggleSort(selectedId, "name")}
                                className="border-0"
                              >
                                Item {sortIndicator(selectedId, "name")}
                              </th>
                              <th
                                style={{ width: 110, cursor: "pointer", textAlign: "center" }}
                                onClick={() => toggleSort(selectedId, "quantity")}
                                className="border-0"
                              >
                                Qty {sortIndicator(selectedId, "quantity")}
                              </th>
                              <th
                                style={{ width: 240, cursor: "pointer", textAlign: "center" }}
                                onClick={() => toggleSort(selectedId, "expiry")}
                                className="border-0"
                              >
                                Expiry {sortIndicator(selectedId, "expiry")}
                              </th>
                              <th style={{ width: 220 }} className="text-end border-0">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewItems.length === 0 && (
                              <tr>
                                <td colSpan={4} className="text-center py-4">
                                  <div className="empty">
                                    <div className="icon"><i className="bi bi-inbox fs-1" /></div>
                                    <div className="mt-2 text-muted">
                                      {filters[selectedId]?.trim()
                                        ? "No matching items"
                                        : "No items yet — add one using the form above."}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}

                            {viewItems.map((item) => {
                              const isEditing = editing.has(item.id);
                              const draft = editDrafts[item.id] || {};
                              const isExpanded = expandedIds.has(item.id);
                              
                              return (
                                <>
                                <tr key={item.id} className="slide-up">
                                  <td>
                                    <Button
                                      size="sm"
                                      variant="outline-secondary"
                                      className="me-2"
                                      onClick={() => setExpandedIds((s) => {
                                        const n = new Set(s);
                                        if (n.has(item.id)) n.delete(item.id); else n.add(item.id);
                                        return n;
                                      })}
                                      title={isExpanded ? 'Hide details' : 'Show details'}
                                    >
                                      <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
                                    </Button>
                                    {isEditing ? (
                                      <Form.Control
                                        value={draft.name}
                                        onChange={(e) =>
                                          updateEditDraft(item.id, {
                                            name: e.target.value,
                                          })
                                        }
                                        style={{ minWidth: 240 }}
                                        className="border-0 bg-light"
                                      />
                                    ) : (
                                      <div className="d-flex align-items-center gap-2">
                                        <ExpiryDot expiry={item.expiry} />
                                        <div className="truncate fw-medium" title={item.name}>
                                          {item.name}
                                        </div>
                                      </div>
                                    )}
                                  </td>

                                  <td className="text-center">
                                    {isEditing ? (
                                      <Form.Control
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={draft.quantity}
                                        onChange={(e) =>
                                          updateEditDraft(item.id, {
                                            quantity: e.target.value,
                                          })
                                        }
                                        style={{ minWidth: 90, maxWidth: 120 }}
                                        className="border-0 bg-light text-center"
                                      />
                                    ) : (
                                      <span className="fw-semibold">{item.quantity}</span>
                                    )}
                                  </td>

                                  <td className="text-center">
                                    {isEditing ? (
                                      <InputGroup>
                                        <Form.Control
                                          type="date"
                                          value={draft.expiry || ""}
                                          onChange={(e) =>
                                            updateEditDraft(item.id, {
                                              expiry: e.target.value,
                                            })
                                          }
                                          className="border-0 bg-light"
                                        />
                                        <Button
                                          variant="outline-secondary"
                                          type="button"
                                          onClick={() =>
                                            updateEditDraft(item.id, { expiry: "" })
                                          }
                                          title="Clear date"
                                          className="border-0 bg-light"
                                        >
                                          <i className="bi bi-x-lg"></i>
                                        </Button>
                                      </InputGroup>
                                    ) : (
                                      <div className="d-flex flex-column align-items-center gap-1">
                                        <div className="small">{item.expiry ?? "—"}</div>
                                        <ExpiryBadge expiry={item.expiry} />
                                      </div>
                                    )}
                                  </td>

                                  <td className="text-end">
                                    {!isEditing ? (
                                      <div className="d-flex gap-1 justify-content-end">
                                        <Button
                                          variant="outline-secondary"
                                          size="sm"
                                          onClick={() => startEdit(item)}
                                          disabled={!canEdit}
                                          title="Edit item"
                                          className="border-0"
                                        >
                                          <i className="bi bi-pencil" />
                                        </Button>
                                        <Button
                                          variant="outline-danger"
                                          size="sm"
                                          onClick={() => askDelete(selectedId, item)}
                                          disabled={!canEdit}
                                          title="Delete item"
                                          className="border-0"
                                        >
                                          <i className="bi bi-trash" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="d-flex gap-1 justify-content-end">
                                        <Button
                                          size="sm"
                                          onClick={() => saveEdit(item.id)}
                                          disabled={!canEdit}
                                          title="Save changes"
                                          className="d-flex align-items-center gap-1"
                                        >
                                          <i className="bi bi-check2" />
                                        </Button>
                                        <Button
                                          variant="outline-secondary"
                                          size="sm"
                                          onClick={() => cancelEdit(item.id)}
                                          title="Cancel editing"
                                          className="border-0"
                                        >
                                          <i className="bi bi-x" />
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr key={`details-${item.id}`}>
                                    <td colSpan={4} className="text-muted">
                                      <div>
                                        <strong>Description:</strong>{' '}
                                        {item.description ? item.description : <em>None</em>}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                </>
                              );
                            })}
                          </tbody>
                        </Table>
                      </div>
                    ) : (
                      /* Shopping Mode */
                      <div className="shopping-mode-view">
                        {viewItems.length === 0 ? (
                          <div className="empty text-center py-5">
                            <div className="icon"><i className="bi bi-bag fs-1" /></div>
                            <div className="mt-2">No items to shop</div>
                          </div>
                        ) : (
                          <div className="row g-3">
                            {viewItems.map((item) => (
                              <div key={item.id} className="col-12 col-md-6 col-lg-4">
                                <div 
                                  className={`shopping-mode-item p-3 ${item.purchased ? 'purchased' : ''}`}
                                  onClick={async () => {
                                    if (!canEdit) return;
                                    try {
                                      const updated = await apiUpdateItem(item.id, { purchased: !item.purchased });
                                      setItemsByList((m) => ({
                                        ...m,
                                        [selectedId]: (m[selectedId] || []).map((x) =>
                                          x.id === item.id ? updated : x
                                        ),
                                      }));
                                    } catch (err) {
                                      setToast({ message: err.message || 'Failed to update', variant: 'danger' });
                                    }
                                  }}
                                >
                                  <div className="d-flex align-items-center gap-3">
                                    <Form.Check
                                      type="checkbox"
                                      checked={!!item.purchased}
                                      onChange={() => {}}
                                      className="m-0"
                                      disabled={!canEdit}
                                    />
                                    <div className="flex-grow-1">
                                      <div className="d-flex align-items-center gap-2 mb-1">
                                        <ExpiryDot expiry={item.expiry} />
                                        <span className={`item-name fw-semibold ${item.purchased ? 'text-decoration-line-through' : ''}`}>
                                          {item.name}
                                        </span>
                                      </div>
                                      {item.description && (
                                        <div className="small text-muted mb-1">
                                          {item.description}
                                        </div>
                                      )}
                                      <div className="small text-muted">
                                        Qty: {item.quantity}
                                      </div>
                                    </div>
                                    <div className="text-end">
                                      <ExpiryBadge expiry={item.expiry} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Share Modal */}
      <Modal show={shareOpen} onHide={() => setShareOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Share List</Modal.Title>
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
                  style={{ minWidth: '120px' }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </Form.Select>
              </Col>
              <Col xs="auto">
                <Button
                  type="submit"
                  disabled={!isOwner || shareBusy || !shareEmail.trim()}
                  variant="success"
                >
                  {shareBusy ? "Adding…" : "Invite"}
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
                    <td colSpan={3} className="text-center">
                      <div className="empty py-3">
                        <div className="icon"><i className="bi bi-people" /></div>
                        <div className="mt-1 text-muted">No shares yet</div>
                      </div>
                    </td>
                  </tr>
                )}
                {shares.map((share) => (
                  <tr key={share.id}>
                    <td>{share.email}</td>
                    <td>
                      <Form.Select
                        value={share.role}
                        onChange={(e) => { changeRole(share, e.target.value); }}
                        disabled={!isOwner}
                        size="sm"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </Form.Select>
                    </td>
                    <td className="text-end">
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => { revoke(share); }}
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

      {/* Confirm Delete Item Modal */}
      <Modal show={!!confirmDel} onHide={() => setConfirmDel(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete Item</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirmDel ? (
            <>
              Are you sure you want to delete <strong>{confirmDel.item.name}</strong>?
              This action cannot be undone.
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

      {/* Confirm Delete List Modal */}
      <Modal
        show={!!confirmDelList}
        onHide={() => setConfirmDelList(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Delete List</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedId ? (
            <>
              Are you sure you want to delete the list "<strong>
                {lists.find((l) => l.id === selectedId)?.name || "this list"}
              </strong>" and all its items? This action cannot be undone.
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

      {/* Toast Notifications */}
      <ToastContainer position="top-end" className="p-3">
        {toast && (
          <Toast
            bg={toast.variant}
            onClose={() => setToast(null)}
            show
            delay={3000}
            autohide
            className="border-0 shadow-lg"
          >
            <Toast.Body
              className={toast.variant === "warning" ? "" : "text-white d-flex align-items-center gap-2"}
            >
              <i className={`bi ${
                toast.variant === 'success' ? 'bi-check-circle-fill' :
                toast.variant === 'danger' ? 'bi-exclamation-circle-fill' :
                toast.variant === 'warning' ? 'bi-exclamation-triangle-fill' :
                'bi-info-circle-fill'
              }`} />
              {toast.message}
            </Toast.Body>
          </Toast>
        )}
      </ToastContainer>
    </>
  );
}
