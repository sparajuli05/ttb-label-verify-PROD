# TTB Label Verify — AI-Powered Alcohol Label Verification (Prototype)

A standalone proof-of-concept that compares an alcohol beverage label image
against the data in its COLA application and returns a per-requirement
compliance verdict in ~2–4 seconds.

**Live demo:** `http://<your-bucket>.s3-website-<region>.amazonaws.com` (see DEPLOYMENT.md)

---

## What it does

| Requirement from discovery sessions | How it's addressed |
|---|---|
| Verify brand name, class/type, ABV, net contents, bottler info, country of origin, government warning | 7-field compliance engine (`src/lib/compliance.js`) |
| Results in ≤ 5 seconds (Sarah: scanning-vendor pilot failed at 30–40s) | Single Gemini 2.0 Flash round-trip, per-label timer shown in UI, flagged red if > 5s |
| "STONE'S THROW" vs "Stone's Throw" needs judgment, not auto-fail (Dave) | Three-tier verdicts: **PASS / NEEDS REVIEW / FAIL**. Case- or punctuation-only differences and ≥85% fuzzy matches route to *Needs Review* with both values shown |
| Government warning must be exact, word-for-word, "GOVERNMENT WARNING:" in all caps and bold (Jenny) | Dedicated strict check: verbatim text comparison against 27 CFR Part 16 wording, explicit all-caps prefix check, bold detection flagged for visual confirmation |
| Batch uploads of 200–300 labels (Janet/Seattle) | Multi-file drag-and-drop, client-side queue with controlled concurrency, per-label results stream in as they finish |
| Usable by low-tech-comfort agents, half the team over 50 (Sarah's "my mother" benchmark) | Two-panel layout (1: application data, 2: upload), 17px base font, large click targets, color-coded verdict badges, no hidden menus |
| Imperfect photos — angles, glare, bad lighting (Jenny) | Model extracts what it can and reports `imageQualityIssues`, surfaced as a banner on the result |
| Leadership wants visibility | Session metrics dashboard: throughput, pass rate, avg latency, most-flagged requirements |

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    End User Browser                       │
│                 (React + Vite Single Page App)            │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │ Upload Label Image
                        │ (Base64 Encoded)
                        ▼
┌───────────────────────────────────────────────────────────┐
│               Static Web Hosting (AWS S3)                │
│                                                           │
│  • React/Vite Frontend                                   │
│  • Client-side Processing                                │
│  • Compliance Validation Logic                           │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │ HTTPS Request
                        │ Image (Base64)
                        ▼
┌───────────────────────────────────────────────────────────┐
│                  Google Gemini 2.0 Flash                 │
│                                                           │
│  Vision + OCR Extraction                                 │
│  • Reads label image                                     │
│  • Performs exact transcription                          │
│  • Returns structured JSON output                        │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │ Structured JSON
                        ▼
┌───────────────────────────────────────────────────────────┐
│            Client-Side Compliance Engine                 │
│                                                           │
│  Rule Evaluation                                          │
│  • Required Fields Check                                 │
│  • Format Validation                                     │
│  • Compliance Rules                                      │
│  • Business Logic Validation                             │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────┐
│                     Compliance Result                    │
│                                                           │
│  Field-Level Status                                      │
│  • PASS                                                  │
│  • REVIEW                                                │
│  • FAIL                                                  │
│                                                           │
│  Overall Verdict                                         │
│  • Approved                                              │
│  • Needs Review                                          │
│  • Rejected                                              │
└───────────────────────────────────────────────────────────┘
```
```
**Architecture Flow**

User
 │
 ▼
React + Vite SPA (S3 Hosted)
 │
 │ Base64 Image
 ▼
Google Gemini 2.0 Flash
 │
 │ Structured JSON
 ▼
Compliance Engine
 │
 ├─ Required Field Validation
 ├─ Regulatory Rules
 ├─ Business Rules
 └─ Quality Checks
 │
 ▼
PASS / REVIEW / FAIL
```

- **No backend.** The compliance rules run in the browser; the only network
  dependency is the Gemini API. This keeps the prototype free to run, trivial
  to deploy, and avoids storing any documents (per Marcus: "we're not storing
  anything sensitive for this exercise").
- **Why Gemini 2.0 Flash:** strong OCR on stylized label typography, free tier
  via Google AI Studio, and consistently ~1.5–3.5s round trips — comfortably
  inside the 5-second budget.
- **Determinism:** temperature 0; the model is instructed to transcribe
  *exactly* as printed (never normalize), because exactness is the entire
  point of the warning-statement check.

## Run locally

```bash
git clone <your-repo-url>
cd ttb-label-verify
npm install
cp .env.example .env        # then paste your key from https://aistudio.google.com/apikey
npm run dev                 # http://localhost:5173
```

Click **Fill sample** to load the Old Tom Distillery application from the
brief, then upload a label image.

## Deploy

Full step-by-step AWS Free Tier instructions (console + CLI + CI/CD) are in
[`DEPLOYMENT.md`](./DEPLOYMENT.md). Short version: push to `main` and the
GitHub Actions workflow builds and syncs `dist/` to S3.

## Assumptions & trade-offs

1. **API key in a static build.** The Gemini key is compiled into the client
   bundle. Acceptable for a free-tier prototype; a production version would
   proxy through a small backend (Lambda + API Gateway) with the key in
   Secrets Manager. Documented deliberately rather than hidden.
2. **Batch = many labels vs one application.** The brief describes importers
   dumping 200–300 applications at once. This prototype verifies a batch of
   label *images* against one set of application data; a CSV-of-applications
   import is the natural next iteration and the queue architecture already
   supports it.
3. **Bold detection is advisory.** A vision model can usually tell bold from
   regular type but not with certainty, so an exact-text warning with
   uncertain boldness returns *Needs Review*, never a silent pass.
4. **Government firewall constraint (Marcus).** Outbound calls go to exactly
   one domain (`generativelanguage.googleapis.com`). For a network that blocks
   it, the same architecture swaps to an Azure-hosted model (their cloud)
   behind one allow-listed endpoint.
5. **Metrics are per-browser** (localStorage). Fine for a prototype; a real
   deployment would aggregate centrally.
6. **No COLA integration** — explicitly out of scope per Marcus.

## Project structure

```
src/
  App.jsx                    # state, upload queue, concurrency control
  components/
    ApplicationForm.jsx      # COLA application data entry
    UploadPanel.jsx          # single + batch drag-and-drop
    ResultCard.jsx           # per-label verdict + field table
    MetricsDashboard.jsx     # session metrics
  lib/
    gemini.js                # API client, exact-transcription prompt, timing
    compliance.js            # 7 field checks, fuzzy matching, strict warning rule
    constants.js             # 27 CFR Part 16 warning text, field definitions
    metrics.js               # localStorage-backed metrics store
.github/workflows/deploy.yml # CI/CD: GitHub Actions → S3 (+ CloudFront)
buildspec.yml                # alternative: AWS CodePipeline/CodeBuild
infrastructure/setup-aws.sh  # one-shot bucket + IAM deploy-user creation
DEPLOYMENT.md                # full AWS Free Tier launch guide
```

## Testing the checks

## Test Plan with Dummy Data

Eight ready-made dummy labels are in the `test-labels/` folder, each designed
to trigger a specific verification path. All of them (except the import label)
are tested against the same dummy application data below.

---

## Dummy application data

Use the app's **Fill sample** button, or enter manually:

| Field | Value |
|---|---|
| Brand name | `OLD TOM DISTILLERY` |
| Class / type designation | `Kentucky Straight Bourbon Whiskey` |
| Alcohol content (% ABV) | `45` |
| Net contents | `750 mL` |
| Bottler / producer | `Old Tom Distillery Co., Bardstown, KY` |
| Imported product | unchecked |

For the import test (label 07) only:

| Field | Value |
|---|---|
| Brand name | `CHATEAU VIEUX MOULIN` |
| Class / type designation | `Brandy` |
| Alcohol content (% ABV) | `40` |
| Net contents | `700 mL` |
| Bottler / producer | `Maison Vieux Moulin, Cognac` |
| Imported product | **checked** · Country of origin: `France` |

---

## Test cases

### TC-1 · Happy path
1. Open the app → click **Fill sample**
2. Upload `label-01-perfect.png`
3. **Expected:** overall **✓ PASS**, all seven requirement rows green,
   processing time badge under 5.0s
4. Metrics panel: Labels processed +1, Pass +1

### TC-2 · Brand capitalization (the "Stone's Throw" rule)
1. Same application data
2. Upload `label-02-brand-case.png` (label prints *Old Tom Distillery* in title case)
3. **Expected:** overall **◐ NEEDS REVIEW** — brand row flagged for review with
   both values shown side by side; nothing auto-fails. This demonstrates the
   judgment tier requested by senior agents.

### TC-3 · Warning prefix not in capitals
1. Upload `label-03-warning-titlecase.png` (prints *Government Warning:* in title case)
2. **Expected:** overall **✕ FAIL** — Government warning row fails with the
   reason "prefix is not in all capital letters." This is the exact violation
   described in the discovery interviews (title-case prefix → rejection).

### TC-4 · ABV mismatch
1. Upload `label-04-wrong-abv.png` (label says 40% / 80 proof; application says 45)
2. **Expected:** overall **FAIL** — Alcohol content row shows
   "application: 45%, label: 40%." Also verifies proof→ABV parsing.

### TC-5 · Missing warning statement
1. Upload `label-05-missing-warning.png`
2. **Expected:** overall **FAIL** — Government warning row: "not found on label."

### TC-6 · Reworded warning
1. Upload `label-06-reworded-warning.png` ("should not drink" changed to "must not drink")
2. **Expected:** overall **FAIL** — warning row: text "deviates from the
   mandatory word-for-word statement." Proves the check is verbatim, not fuzzy.

### TC-7 · Import / country of origin
1. **Clear** the form and enter the Chateau Vieux Moulin data above,
   check **Imported product**, country `France`
2. Upload `label-07-import-france.png`
3. **Expected:** PASS, with Country of origin row matching "PRODUCT OF FRANCE"
4. Negative variant: uncheck nothing but upload `label-01-perfect.png`
   (no origin statement) against this import application →
   Country of origin row **FAIL**: "country of origin statement missing."

### TC-8 · Poor-quality photo
1. Restore the sample application data
2. Upload `label-08-bad-photo.png` (rotated, dark)
3. **Expected:** the result includes a yellow **Image quality** banner
   describing the problem (angle/low light). Fields the model can still read
   are verified normally; unreadable ones fail as "not found" rather than crashing.

### TC-9 · Batch upload (Janet's request)
1. Select **all eight images at once** in the file picker (or drag them together)
2. **Expected:** all eight appear instantly as queued cards; two process at a
   time (free-tier rate-limit throttling); each card resolves independently
   with its own verdict and timing; the queue pill in the header counts down.

### TC-10 · Metrics dashboard
1. After TC-1 through TC-9, check the Session metrics panel
2. **Expected:** Labels processed = total uploads, pass/review/fail split
   matches the verdicts above, average time populated, and "Most flagged
   requirements" lists Government warning at or near the top
3. Click **Reset** → all counters return to zero

### TC-11 · Error handling
1. Temporarily disconnect from the internet (or rename the key in `.env`
   locally) and upload any label
2. **Expected:** the card shows a readable error message and a retry hint —
   no blank screen, no console-only failure; Metrics "errors" count increments.

---

## Regenerating or extending the dummy labels

`generate_test_labels.py` (included) produces all eight images with Pillow:

```bash
pip install pillow
python3 generate_test_labels.py
```

Edit the parameters at the bottom of the script to create new cases — e.g.
change `net="750 mL"` to `net="1 L"` for a net-contents mismatch test

