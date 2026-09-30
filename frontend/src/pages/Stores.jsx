import { isDemo } from "../demo";
import DemoFeatureNotice from "../components/DemoFeatureNotice";
import { useEffect, useState } from "react";
import { Container, Spinner, Alert, Form, Button, ListGroup, Badge } from "react-bootstrap";
import {
  apiKrogerStatus,
  apiStoreSearch,
  apiConnectStore,
  apiDisconnectStore,
  FEATURE_KROGER,
} from "../api";

function StatusRow({ krogerConfigured, connected }) {
  if (!krogerConfigured) {
    return (
      <Alert variant="warning" className="mb-3">
        <strong>Store prices are temporarily unavailable.</strong> You can still
        add groceries and scan barcodes. Try connecting a store again later.
      </Alert>
    );
  }
  if (connected) {
    return (
      <Alert variant="success" className="mb-3 d-flex align-items-center justify-content-between">
        <div>
          <strong>Connected to {connected.chain}</strong> — {connected.name}
          {connected.address ? <div className="text-muted small">{connected.address}</div> : null}
        </div>
        <Button
          size="sm"
          variant="outline-danger"
          onClick={async () => {
            await apiDisconnectStore();
            window.location.reload();
          }}
        >
          Disconnect
        </Button>
      </Alert>
    );
  }
  return (
    <Alert variant="info" className="mb-3">
      No store connected. Connect one below to see real prices, aisle info, and
      stock at the location you shop at.
    </Alert>
  );
}

function StoreResults({ results, onConnect, connecting }) {
  if (!results || results.length === 0) {
    return null;
  }
  return (
    <ListGroup className="mt-2">
      {results.map((r) => (
        <ListGroup.Item
          key={r.location_id}
          className="d-flex align-items-center justify-content-between"
        >
          <div>
            <div className="fw-semibold">
              {r.name} <Badge bg="secondary" className="ms-2">{r.chain}</Badge>
            </div>
            {r.address ? <div className="text-muted small">{r.address}</div> : null}
          </div>
          <Button
            size="sm"
            variant="primary"
            disabled={connecting}
            onClick={() =>
              onConnect({
                chain: r.chain,
                location_id: r.location_id,
                name: r.name,
                address: r.address,
                lat: r.lat,
                lng: r.lng,
              })
            }
          >
            {connecting ? "Connecting..." : "Connect"}
          </Button>
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
}

export default function Stores() {
  if (isDemo()) return <DemoFeatureNotice feature="stores" />;
  return <StoresAccount />;
}

function StoresAccount() {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState(10);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const s = await apiKrogerStatus();
      setStatus(s);
    } catch (e) {
      setError(e.message || "Failed to load status");
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const onSearch = async (e) => {
    e.preventDefault();
    setError("");
    if (!zip || !/^[0-9A-Za-z\- ]{3,10}$/.test(zip)) {
      setError("Please enter a valid ZIP or postal code.");
      return;
    }
    setSearching(true);
    try {
      const rows = await apiStoreSearch({ zip, radius });
      setResults(rows);
      if (rows.length === 0) {
        setError("No Kroger-family stores found nearby. Try a wider radius.");
      }
    } catch (e) {
      setError(e.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const onConnect = async (payload) => {
    setConnecting(true);
    setError("");
    try {
      await apiConnectStore(payload);
      await loadStatus();
      setResults([]);
    } catch (e) {
      setError(e.message || "Failed to connect store");
    } finally {
      setConnecting(false);
    }
  };

  if (!FEATURE_KROGER) {
    return (
      <Container className="py-4">
        <Alert variant="secondary">Kroger integration is disabled.</Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4 market-stores" style={{ maxWidth: 960 }}>
      <p className="workspace-eyebrow">BEFORE THE NEXT SHOP</p>
      <h1 className="mb-3">Your neighborhood store.</h1>
      <p className="text-muted">
        Connect a Kroger-family store to enable real prices, aisle info, and
        in-store stock on your list items. You can disconnect at any time.
      </p>

      {loadingStatus ? (
        <div className="d-flex align-items-center gap-2">
          <Spinner size="sm" /> <span>Loading status...</span>
        </div>
      ) : (
        <StatusRow
          krogerConfigured={status?.configured}
          connected={status?.connected_store}
        />
      )}

      {status?.configured && !status?.connected_store && (
        <Form onSubmit={onSearch} className="mb-3">
          <Form.Group className="mb-2" controlId="store-zip">
            <Form.Label>ZIP / Postal code</Form.Label>
            <Form.Control
              type="text"
              inputMode="numeric"
              placeholder="e.g. 94110"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              maxLength={10}
              required
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Search radius (miles): {radius}</Form.Label>
            <Form.Range
              min={1}
              max={30}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
          </Form.Group>
          <Button type="submit" disabled={searching}>
            {searching ? "Searching..." : "Find stores"}
          </Button>
        </Form>
      )}

      {error && <Alert variant="danger" className="mt-2">{error}</Alert>}

      <StoreResults results={results} onConnect={onConnect} connecting={connecting} />

      <hr className="my-4" />
      <p className="text-muted small mb-0">
        Store locations, availability and prices come from Kroger. Your ZIP code
        is sent to Kroger to find nearby stores. Prices can change before checkout.
      </p>
    </Container>
  );
}
