# Deploy the web app (free tier)

The web app is a **static export** (`apps/web/out`). Host it on **Cloudflare Pages**. The API is a separate repo (`erp-backend`); follow that repo’s `DEPLOY.md` first so you have a live `https://….onrender.com` origin.

`NEXT_PUBLIC_API_URL` is baked in at **build** time. Changing the API URL requires a new Pages build.

## 0. GitHub repo

This folder is not a git repository until you initialize it:

```bash
cd erp-frontend
git init
git add .
git commit -m "Initial web frontend"
# create an empty GitHub repo, then:
git remote add origin git@github.com:<org>/erp-frontend.git
git branch -M main
git push -u origin main
```

Do not commit `.env.local`. CI uses the committed OpenAPI snapshot; it does not need a running API.

## 1. Cloudflare Pages (Git integration — recommended)

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create → Pages → **Connect to Git**.
2. Select `erp-frontend`.
3. Build settings:

| Field | Value |
| --- | --- |
| Framework preset | None |
| Build command | `corepack enable && yarn install --immutable && yarn build` |
| Build output directory | `apps/web/out` |
| Root directory | `/` (repo root) |
| Node version | `22` (or add env `NODE_VERSION=22`) |

4. Environment variables (Production, and Preview if you use it):

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `22` |
| `NEXT_PUBLIC_API_URL` | API origin, **no** trailing slash, **no** `/api/v1`. Example: `https://erp-api.onrender.com` |

5. Deploy. The default URL looks like `https://erp-web.pages.dev` (or `https://<project>.pages.dev`).

6. Copy that origin into the API’s Render env `CORS_ORIGINS` (comma-separated if you also add a custom domain). Restart the API.

## 2. GitHub Actions

`.github/workflows/ci.yml` typechecks and produces the static export on every push. It uploads `apps/web/out` as an artifact.

Set repository **variable** `NEXT_PUBLIC_API_URL` so CI bakes the real API origin (otherwise it falls back to `https://erp-api.onrender.com`).

`.github/workflows/deploy-pages.yml` is **manual only** (`workflow_dispatch`). Use it if you do not connect Pages to Git:

1. Cloudflare API token with Pages edit permission; account ID from the dashboard.
2. GitHub secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
3. GitHub variable `NEXT_PUBLIC_API_URL`.
4. Actions → Deploy Pages → Run workflow.

Do not run both Git integration **and** this workflow, or they will overwrite each other.

## 3. Custom domain (optional)

Pages → Custom domains → add `erp.yourcompany.com`. Then add that origin to Render `CORS_ORIGINS`.

## 4. Verify

1. Open the Pages URL → login screen.
2. Sign in with the seeded admin from the API deploy.
3. Open browser devtools → Network: calls go to `NEXT_PUBLIC_API_URL/api/v1/…` with no CORS errors.
4. Hit a deep link such as `/clients/` after refresh (static export + `trailingSlash`).

Cold API: the first click after Render sleeps can take 30–60 seconds.

## 5. Staging vs production (free)

Pages preview deployments (PRs) can point at the same API if you set `NEXT_PUBLIC_API_URL` on Preview. Shared data — do not use Preview against production once real clients exist. For UAT, use the production Pages project against the staging API until sign-off.

## Headers

`apps/web/public/_headers` is copied into `out/` and applied by Pages (frame deny, nosniff, long cache for `/_next/static`).
