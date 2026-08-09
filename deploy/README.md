# On-premise deployment (NSC)

## Topology

- **Internal network:** Next.js app (admin + API + `/v/*`) + PostgreSQL + local photo disk
- **DMZ reverse proxy:** public DNS/TLS → allowlist **only** `/v/*` (and static assets required by that page)

```
Phone → TLS → DMZ proxy (/v/* only) → Internal Next.js → Postgres + photo storage
Admin users → Internal Next.js (never via DMZ)
```

## Proxy allowlist (critical)

Default-deny. Example nginx:

```nginx
server {
  listen 443 ssl;
  server_name verify.shipperscouncil.gov.ng;

  # TLS certs managed by NSC IT

  location /v/ {
    proxy_pass http://INTERNAL_APP:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }

  # Optional: hashed static for verify page photos is served via /api/photos with token —
  # do NOT expose /api/* broadly. Photo URLs include ?token= and should stay behind the same
  # app; prefer proxying only /v/ and let the app emit absolute internal-safe photo URLs,
  # or add a narrow /api/photos/ location with rate limits.

  location / {
    return 404;
  }
}
```

## Environment

Copy `.env.example`. For production use PostgreSQL:

```
DATABASE_URL=postgresql://nsc:...@db:5432/nsc_qrcode
APP_URL=https://verify.shipperscouncil.gov.ng
AUTH_SECRET=<long random>
PHOTO_STORAGE_DIR=/var/lib/nsc-qrcode/photos
```

Keep `APP_URL` host ≤ ~35 characters so public QR URLs stay ≤ 62 bytes (QR version 4).

## Backups

Schedule both:

1. PostgreSQL dump
2. `PHOTO_STORAGE_DIR` (originals are irreplaceable)

## Air-gap

No CDN at runtime. Bundle OFL fonts under `public/fonts/` and MediaPipe assets under `public/vendor/mediapipe/` before go-live.

## Docker Compose (internal)

See `deploy/docker-compose.yml`.
