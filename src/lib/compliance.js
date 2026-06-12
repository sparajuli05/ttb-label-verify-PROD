// Compliance engine — compares extracted label data against the COLA
// application. Three-tier verdicts mirror how agents actually work:
//   PASS   → machine-verifiable match, agent can move on
//   REVIEW → likely the same thing, but needs human judgment
//            (e.g. "STONE'S THROW" vs "Stone's Throw")
//   FAIL   → mismatch or missing — grounds for rejection

import { GOVERNMENT_WARNING, STATUS } from "./constants.js";

// ---------- text utilities ----------

const collapseWs = (s) => (s || "").replace(/\s+/g, " ").trim();
const lower = (s) => collapseWs(s).toLowerCase();
// Strict-ish normalization: case + whitespace only (preserves punctuation)
const normCase = (s) => lower(s);
// Loose normalization: also strips punctuation/diacritics
const normLoose = (s) =>
  lower(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

function similarity(a, b) {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 1;
  return 1 - levenshtein(a, b) / longest;
}

// ---------- field checks ----------

function checkTextField(appValue, labelValue, fieldLabel) {
  const app = collapseWs(appValue);
  const label = collapseWs(labelValue);
  if (!app) return { status: STATUS.SKIP, detail: "Not provided in application." };
  if (!label)
    return { status: STATUS.FAIL, detail: `${fieldLabel} not found on label.` };

  if (app === label)
    return { status: STATUS.PASS, detail: "Exact match." };

  if (normCase(app) === normCase(label))
    return {
      status: STATUS.REVIEW,
      detail: `Matches except for capitalization — application: "${app}", label: "${label}". Agent judgment required.`,
    };

  if (normLoose(app) === normLoose(label))
    return {
      status: STATUS.REVIEW,
      detail: `Matches except punctuation/formatting — application: "${app}", label: "${label}".`,
    };

  const sim = similarity(normLoose(app), normLoose(label));
  if (sim >= 0.85)
    return {
      status: STATUS.REVIEW,
      detail: `Close match (${Math.round(sim * 100)}% similar) — application: "${app}", label: "${label}".`,
    };

  return {
    status: STATUS.FAIL,
    detail: `Mismatch — application: "${app}", label: "${label}".`,
  };
}

function parseAbv(s) {
  if (!s) return null;
  // Handles "45", "45%", "45% Alc./Vol.", "Alc. 45% by Vol.", "90 proof"
  const pct = String(s).match(/(\d{1,2}(?:\.\d+)?)\s*%/);
  if (pct) return parseFloat(pct[1]);
  const proof = String(s).match(/(\d{1,3}(?:\.\d+)?)\s*proof/i);
  if (proof) return parseFloat(proof[1]) / 2;
  const bare = String(s).match(/^(\d{1,2}(?:\.\d+)?)$/);
  if (bare) return parseFloat(bare[1]);
  return null;
}

function checkAlcoholContent(appValue, labelValue) {
  if (!collapseWs(appValue))
    return { status: STATUS.SKIP, detail: "Not provided in application." };
  const appAbv = parseAbv(appValue);
  const labelAbv = parseAbv(labelValue);
  if (labelAbv == null)
    return { status: STATUS.FAIL, detail: "Alcohol content not found on label." };
  if (appAbv == null)
    return {
      status: STATUS.REVIEW,
      detail: `Could not parse application ABV "${appValue}". Label shows "${labelValue}".`,
    };
  if (Math.abs(appAbv - labelAbv) < 0.05)
    return {
      status: STATUS.PASS,
      detail: `ABV matches: ${labelAbv}% (label: "${collapseWs(labelValue)}").`,
    };
  return {
    status: STATUS.FAIL,
    detail: `ABV mismatch — application: ${appAbv}%, label: ${labelAbv}%.`,
  };
}

function parseVolumeMl(s) {
  if (!s) return null;
  const m = String(s).toLowerCase().match(/(\d+(?:\.\d+)?)\s*(ml|cl|l|liter|litre|oz|fl\.?\s*oz)/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const unit = m[2].replace(/\s|\./g, "");
  if (unit === "ml") return v;
  if (unit === "cl") return v * 10;
  if (unit === "l" || unit === "liter" || unit === "litre") return v * 1000;
  if (unit.includes("oz")) return v * 29.5735;
  return null;
}

function checkNetContents(appValue, labelValue) {
  if (!collapseWs(appValue))
    return { status: STATUS.SKIP, detail: "Not provided in application." };
  if (!collapseWs(labelValue))
    return { status: STATUS.FAIL, detail: "Net contents not found on label." };
  const appMl = parseVolumeMl(appValue);
  const labelMl = parseVolumeMl(labelValue);
  if (appMl != null && labelMl != null) {
    if (Math.abs(appMl - labelMl) < 0.5)
      return { status: STATUS.PASS, detail: `Net contents match: ${collapseWs(labelValue)}.` };
    return {
      status: STATUS.FAIL,
      detail: `Net contents mismatch — application: "${collapseWs(appValue)}", label: "${collapseWs(labelValue)}".`,
    };
  }
  return checkTextField(appValue, labelValue, "Net contents");
}

function checkCountryOfOrigin(application, labelValue) {
  if (!application.isImport)
    return { status: STATUS.SKIP, detail: "Domestic product — not required." };
  if (!collapseWs(labelValue))
    return {
      status: STATUS.FAIL,
      detail: "Import: country of origin statement missing from label.",
    };
  if (!collapseWs(application.countryOfOrigin))
    return {
      status: STATUS.REVIEW,
      detail: `Label shows "${collapseWs(labelValue)}" but application left country blank.`,
    };
  if (normLoose(labelValue).includes(normLoose(application.countryOfOrigin)))
    return { status: STATUS.PASS, detail: `Country of origin matches: ${collapseWs(labelValue)}.` };
  return {
    status: STATUS.FAIL,
    detail: `Country mismatch — application: "${application.countryOfOrigin}", label: "${collapseWs(labelValue)}".`,
  };
}

// The warning is the one field where "close enough" is never acceptable.
// Word-for-word, and the GOVERNMENT WARNING: prefix must be ALL CAPS (and bold).
function checkGovernmentWarning(extracted) {
  const raw = extracted.governmentWarningText || "";
  if (!collapseWs(raw))
    return {
      status: STATUS.FAIL,
      detail: "Government warning statement not found on label. Mandatory on all alcohol beverages (27 CFR Part 16).",
    };

  const issues = [];

  // 1) Prefix must be ALL CAPS, verbatim.
  if (!raw.includes("GOVERNMENT WARNING:")) {
    if (/government warning:/i.test(raw)) {
      issues.push('"GOVERNMENT WARNING:" prefix is not in all capital letters.');
    } else {
      issues.push('Required "GOVERNMENT WARNING:" prefix is missing.');
    }
  }

  // 2) Body must match word-for-word (whitespace-normalized; capitalization
  //    of the body per the regulation text).
  if (collapseWs(raw) !== collapseWs(GOVERNMENT_WARNING)) {
    if (lower(raw) === lower(GOVERNMENT_WARNING)) {
      issues.push("Wording matches but capitalization deviates from the required text.");
    } else {
      issues.push("Warning text deviates from the mandatory word-for-word statement.");
    }
  }

  if (issues.length)
    return { status: STATUS.FAIL, detail: issues.join(" ") };

  // 3) Bold check — extraction can only estimate this, so flag for review
  //    rather than auto-pass/fail.
  if (extracted.warningPrefixAppearsBold === false)
    return {
      status: STATUS.REVIEW,
      detail: 'Text is exact, but "GOVERNMENT WARNING:" may not be in bold type. Visually confirm.',
    };

  return { status: STATUS.PASS, detail: "Exact match, prefix in capitals and bold." };
}

// ---------- main entry ----------

export function verifyLabel(application, extracted) {
  const checks = {
    brandName: checkTextField(application.brandName, extracted.brandName, "Brand name"),
    classType: checkTextField(application.classType, extracted.classType, "Class/type"),
    alcoholContent: checkAlcoholContent(application.alcoholContent, extracted.alcoholContent),
    netContents: checkNetContents(application.netContents, extracted.netContents),
    bottlerInfo: checkTextField(application.bottlerInfo, extracted.bottlerInfo, "Bottler information"),
    countryOfOrigin: checkCountryOfOrigin(application, extracted.countryOfOrigin),
    governmentWarning: checkGovernmentWarning(extracted),
  };

  const statuses = Object.values(checks).map((c) => c.status);
  let overall = STATUS.PASS;
  if (statuses.includes(STATUS.FAIL)) overall = STATUS.FAIL;
  else if (statuses.includes(STATUS.REVIEW)) overall = STATUS.REVIEW;

  return { checks, overall, imageQualityIssues: extracted.imageQualityIssues || null };
}
