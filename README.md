# NSC Staff ID & QR Portal

Nigerian Shippers' Council staff identity card management: admin portal, template-faithful PDF export, and public QR verification.

## Quick start

```bash
npm install
cp .env.example .env
# Local Postgres or Railway DATABASE_URL
createdb nsc_qrcode   # local only, once
npm run db:setup      # prisma db push + seed
npm run dev
```

Sign in: `admin@shipperscouncil.gov.ng` / `ChangeMeAdmin1!`

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run db:setup` / `db:bootstrap` | push schema + seed |
| `npm run db:seed` | seed only |
| `npm run build` | generate client, bootstrap DB, Next build |
| `npm run extract-templates` | strip sample PDF → templates |
| `npm run test:qr-budget` | assert public URL ≤ 62 bytes |
| `npm run test:fidelity` | structural fidelity checks + sample PDF render |

## Deploy (Vercel + Railway)

1. Create **Postgres** on Railway → copy `DATABASE_URL` (add `?sslmode=require` if needed).
2. Import the repo on **Vercel** and set env vars from `.env.example` (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `APP_URL`, admin creds).
3. Deploy — build runs `prisma generate` → schema push + seed → `next build`. Seed also runs on Node startup via `src/instrumentation.ts`.

Full steps: [deploy/vercel-railway.md](deploy/vercel-railway.md).

On-premise / DMZ: [deploy/README.md](deploy/README.md).
