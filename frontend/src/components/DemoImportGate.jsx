import { useEffect, useState } from "react";
import { apiImportDemo } from "../api";
import { pendingDemo, clearPendingDemo } from "../demoTransfer";

// Reuse the effect request in StrictMode. The server also deduplicates retries
// and OAuth returns by account and import key.
const inFlight = new Map();
export default function DemoImportGate({ userId, children }) {
  const draft = pendingDemo();
  const key = draft && userId ? `${userId}:${draft.import_key}` : null;
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    setError("");
    if (!inFlight.has(key)) {
      const request = apiImportDemo(pendingDemo());
      inFlight.set(key, request);
      request.finally(() => inFlight.delete(key)).catch(() => {});
    }
    inFlight.get(key).then((result) => {
      if (!alive) return;
      clearPendingDemo();
      setConfirmation(`Saved “${result.name}” to your account, including checked-off groceries.`);
      setDone(true);
    }).catch((failure) => { if (alive) setError(failure.message || "Your draft couldn’t be saved yet."); });
    return () => { alive = false; };
  }, [key, attempt]);
  if (draft && userId && !done) return <main className="demo-import-message">
    <h1>Keep your grocery list</h1>
    <p>Your account is ready. We’re saving a copy of “{draft.name}”.</p>
    {error ? <><p role="alert">{error} Your draft is still available in this tab.</p>
      <button className="btn btn-primary" onClick={() => setAttempt((value) => value + 1)}>Retry saving list</button>
      <button className="btn btn-secondary" onClick={() => { clearPendingDemo(); setDone(true); }}>Continue without this list</button>
    </> : <p role="status">Saving your list…</p>}
  </main>;
  return <>
    {confirmation && <div className="demo-import-confirmation" role="status">{confirmation}<button type="button" onClick={() => setConfirmation("")} aria-label="Dismiss saved list message">Dismiss</button></div>}
    {children}
  </>;
}
