// Lightweight metrics store, persisted locally (prototype scope — no PII,
// no server). Tracks throughput, outcomes, latency and per-field failures.

const KEY = "ttb-verify-metrics-v1";

const empty = () => ({
  totalProcessed: 0,
  pass: 0,
  review: 0,
  fail: 0,
  errors: 0,
  totalMs: 0,
  fieldFailures: {}, // fieldKey -> count (FAIL or REVIEW)
});

export function loadMetrics() {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return empty();
  }
}

export function recordResult(metrics, result, elapsedMs) {
  const next = {
    ...metrics,
    totalProcessed: metrics.totalProcessed + 1,
    totalMs: metrics.totalMs + elapsedMs,
    fieldFailures: { ...metrics.fieldFailures },
  };
  next[result.overall] = (next[result.overall] || 0) + 1;
  for (const [field, check] of Object.entries(result.checks)) {
    if (check.status === "fail" || check.status === "review") {
      next.fieldFailures[field] = (next.fieldFailures[field] || 0) + 1;
    }
  }
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function recordError(metrics) {
  const next = { ...metrics, errors: metrics.errors + 1 };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function resetMetrics() {
  localStorage.removeItem(KEY);
  return empty();
}
