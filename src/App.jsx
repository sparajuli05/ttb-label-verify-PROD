import { useEffect, useRef, useState } from "react";
import ApplicationForm from "./components/ApplicationForm";
import UploadPanel from "./components/UploadPanel";
import ResultCard from "./components/ResultCard";
import MetricsDashboard from "./components/MetricsDashboard";
import { extractLabelData } from "./lib/gemini";
import { verifyLabel } from "./lib/compliance";
import { loadMetrics, recordResult, recordError, resetMetrics } from "./lib/metrics";
import { EMPTY_APPLICATION } from "./lib/constants";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const CONCURRENCY = 2; // keeps the free-tier rate limit happy on big batches

let nextId = 1;

export default function App() {
  const [application, setApplication] = useState({ ...EMPTY_APPLICATION });
  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState(loadMetrics);
  const inFlight = useRef(0);
  const queueRef = useRef([]);
  const appRef = useRef(application);
  appRef.current = application;

  const updateItem = (id, patch) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const pump = () => {
    while (inFlight.current < CONCURRENCY && queueRef.current.length) {
      const item = queueRef.current.shift();
      inFlight.current += 1;
      updateItem(item.id, { state: "processing" });
      extractLabelData(item.file, API_KEY)
        .then(({ extracted, elapsedMs }) => {
          const result = verifyLabel(appRef.current, extracted);
          updateItem(item.id, { state: "done", result, extracted, elapsedMs });
          setMetrics((m) => recordResult(m, result, elapsedMs));
        })
        .catch((err) => {
          updateItem(item.id, { state: "error", error: err.message });
          setMetrics((m) => recordError(m));
        })
        .finally(() => {
          inFlight.current -= 1;
          pump();
        });
    }
  };

  const handleFiles = (files) => {
    const newItems = files.map((file) => ({
      id: nextId++,
      file,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      state: "queued",
    }));
    setItems((prev) => [...newItems, ...prev]);
    queueRef.current.push(...newItems);
    pump();
  };

  // Revoke object URLs on unmount to avoid leaking memory on large batches.
  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.previewUrl)), []); // eslint-disable-line

  const busy = items.some((i) => i.state === "queued" || i.state === "processing");
  const pending = items.filter((i) => i.state === "queued" || i.state === "processing").length;

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <div className="seal" aria-hidden="true">TTB</div>
          <div>
            <h1>Label Verify</h1>
            <p>COLA label compliance — prototype</p>
          </div>
          {busy && <span className="queue-pill">{pending} in queue</span>}
        </div>
      </header>

      {!API_KEY && (
        <div className="banner-warn" role="alert">
          No Gemini API key configured. Copy <code>.env.example</code> to{" "}
          <code>.env</code> and set <code>VITE_GEMINI_API_KEY</code>, then restart.
        </div>
      )}

      <main className="layout">
        <div className="col-left">
          <ApplicationForm application={application} onChange={setApplication} disabled={false} />
          <MetricsDashboard metrics={metrics} onReset={() => setMetrics(resetMetrics())} />
        </div>

        <div className="col-right">
          <UploadPanel onFiles={handleFiles} busy={false} />
          <section aria-live="polite">
            {items.length === 0 ? (
              <div className="empty-state">
                <p>No labels checked yet.</p>
                <p className="hint">
                  Fill in the application data, then upload one label image — or a
                  batch of 200 — and each gets a verdict in about 2–4 seconds.
                </p>
              </div>
            ) : (
              items.map((item) => <ResultCard key={item.id} item={item} />)
            )}
          </section>
        </div>
      </main>

      <footer className="footer">
        Prototype for evaluation only — not connected to COLA. Verdicts marked
        “needs review” require agent judgment before final action.
      </footer>
    </div>
  );
}
