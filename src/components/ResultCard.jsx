import { FIELDS, STATUS } from "../lib/constants";

const STATUS_META = {
  [STATUS.PASS]:   { label: "PASS",        icon: "✓" },
  [STATUS.REVIEW]: { label: "NEEDS REVIEW", icon: "◐" },
  [STATUS.FAIL]:   { label: "FAIL",        icon: "✕" },
  [STATUS.SKIP]:   { label: "N/A",         icon: "—" },
};

export default function ResultCard({ item }) {
  if (item.state === "queued" || item.state === "processing") {
    return (
      <article className="result-card">
        <div className="result-top">
          <img src={item.previewUrl} alt="" className="result-thumb" />
          <div>
            <h3>{item.fileName}</h3>
            <p className="hint">{item.state === "processing" ? "Reading label…" : "Waiting in queue…"}</p>
          </div>
          <span className="spinner" aria-label="processing" />
        </div>
      </article>
    );
  }

  if (item.state === "error") {
    return (
      <article className="result-card result-error">
        <div className="result-top">
          <img src={item.previewUrl} alt="" className="result-thumb" />
          <div>
            <h3>{item.fileName}</h3>
            <p className="error-text">{item.error}</p>
            <p className="hint">Fix the issue and re-upload the image to try again.</p>
          </div>
        </div>
      </article>
    );
  }

  const { result, elapsedMs } = item;
  const overall = STATUS_META[result.overall];

  return (
    <article className={`result-card verdict-${result.overall}`}>
      <div className="result-top">
        <img src={item.previewUrl} alt={`Label: ${item.fileName}`} className="result-thumb" />
        <div className="result-headline">
          <h3>{item.fileName}</h3>
          <span className={`badge badge-${result.overall}`}>
            {overall.icon} {overall.label}
          </span>
          <span className={`timing ${elapsedMs > 5000 ? "timing-slow" : ""}`}>
            {(elapsedMs / 1000).toFixed(1)}s
          </span>
        </div>
      </div>

      {result.imageQualityIssues && (
        <p className="quality-note">Image quality: {result.imageQualityIssues}</p>
      )}

      <table className="checks-table">
        <thead>
          <tr><th>Requirement</th><th>Result</th><th>Detail</th></tr>
        </thead>
        <tbody>
          {FIELDS.map((f) => {
            const check = result.checks[f.key];
            const meta = STATUS_META[check.status];
            return (
              <tr key={f.key} className={`row-${check.status}`}>
                <td>{f.label}</td>
                <td><span className={`badge badge-${check.status}`}>{meta.icon} {meta.label}</span></td>
                <td className="detail-cell">{check.detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </article>
  );
}
