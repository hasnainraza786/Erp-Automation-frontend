# Automation ERP — Web frontend

Yarn 4 workspace. The **web app is the only client for now**. Desktop (Electron) and mobile (Expo) will be added later under `apps/` and will reuse `packages/api-client`, `packages/ui`, and `packages/core`.

The backend is a separate repo (`erp-backend`). This app talks to it over REST only. Typed hooks come from **Orval** (`packages/api-client`).

## Local run

Terminal 1 — API (from `erp-backend`):

```bash
corepack enable
yarn install
cp .env.example .env
yarn db:local          # or: docker compose up -d postgres
yarn prisma migrate deploy
yarn db:seed --demo
yarn dev               # http://localhost:4000/docs
```

Terminal 2 — web:

```bash
corepack enable
yarn install
cp apps/web/.env.example apps/web/.env.local
yarn api:generate      # Orval from API_SPEC_URL or the committed snapshot
yarn dev               # http://localhost:3000
```

Default login (seeded): `admin@erp.local` / `Admin@12345`.

`NEXT_PUBLIC_API_URL` must point at the API origin (no `/api/v1` suffix).

## Scripts (Yarn)

| Script | Purpose |
| --- | --- |
| `yarn dev` | Next.js web app on :3000 |
| `yarn api:generate` | Regenerate Orval client from OpenAPI |
| `yarn build` | Generate client, then static export to `apps/web/out` |
| `yarn typecheck` | Typecheck every workspace |

The web app is a static export (`output: 'export'`), so it can sit on Cloudflare Pages while the API sits on Render.

## Deploy

Step-by-step (GitHub, Cloudflare Pages, CORS): **[DEPLOY.md](./DEPLOY.md)**. The API runbook lives in `erp-backend/DEPLOY.md`.
