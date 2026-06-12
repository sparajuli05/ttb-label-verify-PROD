# Deployment Guide — AWS Free Tier

Everything below stays inside the AWS Free Tier:
- **S3**: 5 GB storage, 20k GET / 2k PUT per month (this app is ~300 KB)
- **CloudFront** (optional): 1 TB transfer + 10M requests/month, always free
- **GitHub Actions**: 2,000 free minutes/month on public/private repos
- **Gemini API**: free tier via Google AI Studio (no card required)

---

## Step 0 — Prerequisites (10 min)

1. **Gemini key**: go to https://aistudio.google.com/apikey → *Create API key* → copy it.
2. **AWS account**: https://aws.amazon.com/free → sign up (card required for identity, you won't be charged at this scale).
3. **GitHub account** with this code pushed to a repo:
   ```bash
   cd ttb-label-verify
   git init && git add -A && git commit -m "TTB label verification prototype"
   git branch -M main
   git remote add origin https://github.com/<you>/ttb-label-verify.git
   git push -u origin main
   ```

---

## Step 1 — Create the S3 bucket (AWS Console)

> Prefer the CLI? Run `bash infrastructure/setup-aws.sh ttb-label-verify-<yourname> us-east-1` and skip to Step 3.

1. Console → search **S3** → **Create bucket**
   - Bucket name: `ttb-label-verify-<yourname>` (globally unique, lowercase)
   - Region: `us-east-1` (or nearest)
   - **Uncheck** "Block all public access" → tick the acknowledgement box
   - Create bucket
2. Open the bucket → **Properties** tab → scroll to **Static website hosting** → Edit
   - Enable · Index document: `index.html` · Error document: `index.html` → Save
   - Note the **Bucket website endpoint** URL shown there — that's your app URL.
3. **Permissions** tab → **Bucket policy** → Edit → paste (replace `BUCKET_NAME`):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicReadGetObject",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::BUCKET_NAME/*"
     }]
   }
   ```

## Step 2 — Create a deploy-only IAM user

1. Console → **IAM** → **Users** → **Create user** → name: `ttb-verify-deployer` → Next
2. **Attach policies directly** → **Create policy** → JSON tab → paste (replace `BUCKET_NAME`):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"],
         "Resource": ["arn:aws:s3:::BUCKET_NAME", "arn:aws:s3:::BUCKET_NAME/*"]
       },
       { "Effect": "Allow", "Action": "cloudfront:CreateInvalidation", "Resource": "*" }
     ]
   }
   ```
   Name it `ttb-verify-deploy` → create, then attach it to the user → finish.
3. Open the user → **Security credentials** tab → **Create access key** →
   *Third-party service* → create → **copy both the Access key ID and Secret** (shown once).

## Step 3 — Wire up CI/CD (GitHub Actions)

The pipeline file is already in the repo at `.github/workflows/deploy.yml`.

1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**, add five secrets:

   | Secret | Value |
   |---|---|
   | `AWS_ACCESS_KEY_ID` | from Step 2 |
   | `AWS_SECRET_ACCESS_KEY` | from Step 2 |
   | `AWS_REGION` | e.g. `us-east-1` |
   | `S3_BUCKET` | e.g. `ttb-label-verify-suresh` |
   | `VITE_GEMINI_API_KEY` | from Step 0 |

2. Trigger the pipeline: push any commit to `main`, or repo → **Actions** tab →
   **Deploy to AWS** → **Run workflow**.
3. Watch it go green: checkout → install → lint → build → sync to S3.

## Step 4 — Launch and verify

1. Open the **bucket website endpoint** from Step 1, e.g.
   `http://ttb-label-verify-suresh.s3-website-us-east-1.amazonaws.com`
2. Click **Fill sample**, upload a test label image, confirm a verdict comes back
   in a few seconds.
3. That endpoint URL is your **Deployed Application URL** deliverable.

---

## Optional — CloudFront for HTTPS (still free)

S3 website endpoints are HTTP-only. For an `https://` URL:

1. Console → **CloudFront** → **Create distribution**
   - Origin domain: paste the **S3 website endpoint** (the `s3-website-…` one, *not* the bucket REST endpoint)
   - Viewer protocol policy: *Redirect HTTP to HTTPS*
   - Default root object: `index.html`
   - Create (takes ~5–10 min to deploy)
2. Copy the **Distribution ID** → add it as GitHub secret `CLOUDFRONT_DIST_ID`
   so deploys auto-invalidate the cache.
3. Your HTTPS URL: `https://dxxxxxxxxxxxx.cloudfront.net`

## Optional — All-AWS pipeline instead of GitHub Actions

If the reviewer wants to see AWS-native CI/CD, `buildspec.yml` is included:

1. Console → **CodePipeline** → Create pipeline → Source: GitHub (connect via
   *AWS CodeStar connection*) → branch `main`
2. Build stage: **CodeBuild**, environment *Amazon Linux 2, standard image*,
   use the repo's `buildspec.yml`
3. In the CodeBuild project's environment variables set `S3_BUCKET` and
   `VITE_GEMINI_API_KEY` (store the key in **SSM Parameter Store** and reference
   it as type *Parameter* — better hygiene than plaintext)
4. Skip the deploy stage (the buildspec's `post_build` does the S3 sync itself),
   and give the CodeBuild service role the same S3 permissions as Step 2.

## Troubleshooting

| Symptom | Fix |
|---|---|
| 403 on the website URL | Bucket policy missing/typo, or "Block public access" still on |
| Blank page after deploy | Hard-refresh; confirm `index.html` is at bucket root (not in a `dist/` folder) |
| "No Gemini API key configured" banner | `VITE_GEMINI_API_KEY` secret missing when the build ran — add it and re-run the workflow |
| Gemini 429 errors on big batches | Free-tier rate limit; the app already throttles to 2 concurrent — wait a minute and re-drop the failed images |
| GitHub Action fails at S3 sync | IAM policy bucket name doesn't match `S3_BUCKET` secret |
