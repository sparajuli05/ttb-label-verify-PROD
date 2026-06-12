import { SAMPLE_APPLICATION, EMPTY_APPLICATION } from "../lib/constants";

const FIELD_DEFS = [
  { key: "brandName", label: "Brand name", placeholder: "OLD TOM DISTILLERY" },
  { key: "classType", label: "Class / type designation", placeholder: "Kentucky Straight Bourbon Whiskey" },
  { key: "alcoholContent", label: "Alcohol content (% ABV)", placeholder: "45" },
  { key: "netContents", label: "Net contents", placeholder: "750 mL" },
  { key: "bottlerInfo", label: "Bottler / producer name & address", placeholder: "Old Tom Distillery Co., Bardstown, KY" },
];

export default function ApplicationForm({ application, onChange, disabled }) {
  const set = (key, value) => onChange({ ...application, [key]: value });

  return (
    <section className="card" aria-labelledby="app-form-title">
      <div className="card-head">
        <h2 id="app-form-title">1 · Application data</h2>
        <div className="card-head-actions">
          <button type="button" className="btn-ghost" disabled={disabled}
            onClick={() => onChange({ ...SAMPLE_APPLICATION })}>
            Fill sample
          </button>
          <button type="button" className="btn-ghost" disabled={disabled}
            onClick={() => onChange({ ...EMPTY_APPLICATION })}>
            Clear
          </button>
        </div>
      </div>
      <p className="hint">Enter the values from the COLA application. The label must match these.</p>

      {FIELD_DEFS.map((f) => (
        <label className="field" key={f.key}>
          <span>{f.label}</span>
          <input
            type="text"
            value={application[f.key]}
            placeholder={f.placeholder}
            disabled={disabled}
            onChange={(e) => set(f.key, e.target.value)}
          />
        </label>
      ))}

      <label className="field-check">
        <input
          type="checkbox"
          checked={application.isImport}
          disabled={disabled}
          onChange={(e) => set("isImport", e.target.checked)}
        />
        <span>Imported product (country of origin required on label)</span>
      </label>

      {application.isImport && (
        <label className="field">
          <span>Country of origin</span>
          <input
            type="text"
            value={application.countryOfOrigin}
            placeholder="France"
            disabled={disabled}
            onChange={(e) => set("countryOfOrigin", e.target.value)}
          />
        </label>
      )}
    </section>
  );
}
