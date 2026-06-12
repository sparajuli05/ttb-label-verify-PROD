import { FIELDS } from "../lib/constants";

export default function MetricsDashboard({ metrics, onReset }) {
  const avgSec = metrics.totalProcessed
    ? (metrics.totalMs / metrics.totalProcessed / 1000).toFixed(1)
    : "—";
  const passRate = metrics.totalProcessed
    ? Math.round((metrics.pass / metrics.totalProcessed) * 100) + "%"
    : "—";

  const topFailures = Object.entries(metrics.fieldFailures || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <section className="card metrics" aria-labelledby="metrics-title">
      <div className="card-head">
        <h2 id="metrics-title">Session metrics</h2>
        <button type="button" className="btn-ghost" onClick={onReset}>Reset</button>
      </div>
      <div className="metrics-grid">
        <Stat label="Labels processed" value={metrics.totalProcessed} />
        <Stat label="Pass" value={metrics.pass} tone="pass" />
        <Stat label="Needs review" value={metrics.review} tone="review" />
        <Stat label="Fail" value={metrics.fail} tone="fail" />
        <Stat label="Pass rate" value={passRate} />
        <Stat label="Avg. time" value={avgSec === "—" ? "—" : `${avgSec}s`} />
      </div>
      {topFailures.length > 0 && (
        <div className="metrics-failures">
          <h3>Most flagged requirements</h3>
          <ul>
            {topFailures.map(([key, count]) => (
              <li key={key}>
                <span>{FIELDS.find((f) => f.key === key)?.label || key}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      {metrics.errors > 0 && (
        <p className="hint">Processing errors this session: {metrics.errors}</p>
      )}
    </section>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
