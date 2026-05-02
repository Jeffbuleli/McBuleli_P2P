# McBuleli P2P

Production-oriented **custodial crypto wallet** and **P2P marketplace** for Africa (starting with DRC): Mobile Money (PawaPay), internal ledger, escrow trades, admin controls, and a mobile-first Next.js PWA.

## Architecture

| Layer | Stack |
|--------|--------|
| API | Node.js, Express, TypeScript |
| Data | PostgreSQL, Prisma ORM |
| Cache / limits | Redis (optional; falls back to in-memory rate limits if unset) |
| Web | Next.js (App Router), Tailwind CSS, service worker + offline shell |
| References | Binance public ticker (optional keys), PawaPay webhooks |

### Backend layout

```
backend/src/
  config/          # env validation (zod)
  lib/             # prisma, redis helpers
  middlewares/     # JWT auth, admin gate, rate limits
  modules/         # route modules (auth, users, wallet, p2p, admin, webhooks)
  services/        # ledger, wallet, p2p escrow, pawapay, admin, risk
  utils/           # JWT, AES-256-GCM, hashing, reference IDs
```

### Core behaviors

- **Ledger**: `WalletAccount` per user × `(kind, currencyCode)` with `balance` and `lockedBalance`; every movement writes `LedgerEntry` + `Transaction`.
- **P2P escrow**: starting a trade moves crypto from seller **available → locked**; release sends locked funds to buyer; cancel refunds seller.
- **Secrets**: TOTP secrets stored **AES-256-GCM** encrypted (`ENCRYPTION_KEY`); never plaintext.
- **Auth**: JWT access + refresh (refresh hashed at rest), bcrypt passwords, optional TOTP.
- **Risk**: daily fiat withdrawal tracking (Redis), suspicious flags, admin tools.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 6+ (recommended for production)

## Backend setup

Run these **one line at a time** (do not paste comments from docs into the terminal as commands):

```bash
cd backend
cp .env.example .env
```

Open `.env` in your editor and fill in at least:

- `DATABASE_URL` — PostgreSQL connection string  
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — long random strings (32+ characters each)  
- `ENCRYPTION_KEY` — long random string (32+ characters)  
- `ADMIN_EMAILS` — your admin email(s), comma-separated  

Then:

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

### npm “packages are looking for funding”

Informational only; not an error.

### Do not paste into `psql`

`psql` prompts look like `postgres=#`. If you paste **npm install** output (or any multi-line text with words like `added`, `packages`) into `psql`, PostgreSQL will treat words as garbage SQL or fake “hosts”, e.g. `could not translate host name "added"`. Run `npm` in the shell; run SQL only inside `psql` or use `psql -f script.sql`.

### macOS zsh: `no matches found`

If zsh prints `zsh: no matches found` after pasting, an unquoted `*` was treated as a filename pattern. The README no longer uses patterns like `JWT_*` in shell examples. If you type globs yourself, quote them (e.g. `'JWT_*'`) or run `setopt NO_NOMATCH` so zsh leaves unmatched globs unchanged.

API listens on `http://localhost:4000` (see `PORT`). Health: `GET /health`.

### Important environment variables

| Variable | Purpose |
|-----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing keys (long random strings) |
| `ENCRYPTION_KEY` | AES key material for 2FA secrets |
| `ADMIN_EMAILS` | Comma-separated emails allowed to call `/api/admin/*` |
| `REDIS_URL` | Optional; improves rate-limit scalability |
| `PAWAPAY_API_KEY`, `PAWAPAY_WEBHOOK_SECRET`, etc. | Production deposits/payouts + webhook HMAC |

## Frontend setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Set `NEXT_PUBLIC_API_URL` to your API (Render URL in production).

### PWA

- `manifest.webmanifest` — install metadata.
- `public/sw.js` — caches offline fallback; registered in production only.
- Add real PNG icons under `frontend/public/icons/` (`icon-192.png`, `icon-512.png`) for stores / install UX.

## Deployment (recommended)

| Service | Target |
|---------|--------|
| Backend | [Render](https://render.com) — Web Service, `npm run build && npm start`, attach PostgreSQL + Redis |
| Frontend | [Vercel](https://vercel.com) — root `frontend`, env `NEXT_PUBLIC_API_URL` |

Ensure production `CORS_ORIGIN` lists your Vercel domain and `APP_URL` matches the web origin.

## Git remote (your repo)

After cloning or copying this project:

```bash
git remote add origin https://github.com/Jeffbuleli/McBuleli-Crypto.git
git branch -M main
git push -u origin main
```

If the remote already exists, use `git remote set-url origin <url>` instead.

## Security notes

- Rotate API keys and JWT secrets per environment.
- Enable HTTPS everywhere; verify PawaPay webhook signatures in production (`verifyPawapaySignature`).
- Restrict admin emails and monitor `AdminAuditLog` / `SuspiciousFlag`.
- Custodial hot-wallet keys (if you add on-chain sweep) must live in a KMS/HSM — **never** in `.env` plaintext in production.

## License

Proprietary — McBuleli P2P. All rights reserved unless you attach your own license.
