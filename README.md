# NSC Staff ID & QR Portal

Nigerian Shippers' Council staff identity card management: admin portal, template-faithful PDF export, and public QR verification.

## Quick start

```bash
npm install
cp .env.example .env
# Ensure Postgres is running and DATABASE_URL points at nsc_qrcode
createdb nsc_qrcode   # once
npx prisma db push
npm run db:seed
# templates already committed under design/templates — re-extract with:
# source .tmp-pdf/venv/bin/activate && npm run extract-templates
npm run dev
```

Sign in: `admin@shipperscouncil.gov.ng` / `ChangeMeAdmin1!`

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run db:setup` | push schema + seed |
| `npm run extract-templates` | strip sample PDF → templates |
| `npm run test:qr-budget` | assert public URL ≤ 62 bytes |
| `npm run test:fidelity` | structural fidelity checks + sample PDF render |

## Deploy

See [deploy/README.md](deploy/README.md) for DMZ proxy allowlist, TLS, backups, and docker-compose.
