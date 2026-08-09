# Deploy: Vercel (app) + Railway (Postgres)

## 1. Railway Postgres

1. Create a project on [Railway](https://railway.app) → **Add PostgreSQL**.
2. Open the database → **Variables** / **Connect** → copy **DATABASE_URL** (public).
3. If the URL has no SSL flag, append `?sslmode=require` (or `&sslmode=require`).

## 2. Vercel project

1. Import this Git repo into [Vercel](https://vercel.com).
2. Framework preset: **Next.js** (uses `vercel.json` / `npm run build`).
3. Set environment variables (Production + Preview as needed):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Railway Postgres URL |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://YOUR_PROJECT.vercel.app` (or custom domain) |
| `APP_URL` | Same as `AUTH_URL` (used in QR links; keep host short) |
| `ADMIN_EMAIL` | Bootstrap admin email |
| `ADMIN_PASSWORD` | Strong password (change after first login) |
| `PHOTO_STORAGE_DIR` | `/tmp/nsc-photos` (ephemeral on Vercel) |

4. Deploy. Build runs:

```bash
prisma generate → db push + seed → next build
```

Seeding happens only in that build step (via `scripts/bootstrap-db.ts`). Do not seed from Next.js `instrumentation` — it pulls Node-only `pg` into the webpack graph and breaks the Vercel build.

## 3. Local against Railway

```bash
cp .env.example .env
# paste Railway DATABASE_URL + AUTH_SECRET
npm install
npm run db:setup
npm run dev
```

## 4. Verify

- Open `https://YOUR_PROJECT.vercel.app/login`
- Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- Staff list should include sample `AKUTAH` / ID `1234567890`

## Notes

- Seed is **upsert**-based; redeploys will not wipe staff you add later (except the seeded sample’s fixed fields are refreshed).
- Set `SKIP_DB_SEED=1` to skip the build-time seed (schema push still runs unless you skip the whole bootstrap).
- Photos on Vercel `/tmp` are not durable — plan object storage for production photos.
- QR public URL length is capped (~62 bytes); prefer a short custom domain for `APP_URL`.
