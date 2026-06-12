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
Browser (React + Vite SPA, static hosting on S3)
   │  label image (base64)
   ▼
Google Gemini 2.0 Flash  ──►  structured JSON extraction (exact transcription)
   │
   ▼
Client-side compliance engine ──► PASS / REVIEW / FAIL per field + overall verdict
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

Generate test labels with any AI image tool (the brief suggests this). Useful cases:

- A clean label matching the sample application → all PASS
- Brand in different capitalization → brand row shows NEEDS REVIEW
- Warning with "Government Warning:" in title case → warning row FAIL
- Warning with a word changed/omitted → FAIL with explanation
- Label missing net contents → FAIL (not found)
- Photo at an angle/with glare → result includes an image-quality banner
