# McBuleli P2P — Statut produit vs spec architecte

Document de cartographie **production-oriented** : où vit la logique, ce qui est livré, ce qui reste à renforcer.

---

## Stack (conforme)

| Couche | Implémentation |
|--------|----------------|
| API | Node.js, TypeScript, Express (`backend/src/`) |
| Données | PostgreSQL + Prisma (`backend/prisma/schema.prisma`) |
| Cache / limites | Redis optionnel + fallback mémoire (`backend/src/lib/redis.ts`, `middlewares/rateLimit.ts`) |
| Front | Next.js App Router, Tailwind (`frontend/app/`, `components/`) |
| PWA | `manifest.webmanifest`, `public/sw.js`, `offline.html`, icônes `public/icons/` |

---

## Sécurité & auth (conforme)

| Exigence | Emplacement |
|----------|-------------|
| JWT access + refresh | `backend/src/utils/jwt.ts`, `auth.service.ts`, cookies/tokens |
| bcrypt | `backend/src/utils/hash.ts` |
| 2FA TOTP | `auth.service.ts` (secret chiffré) |
| Email verification | Flux token Redis ou sans Redis (`verifyEmailToken`) |
| Sessions / devices | `Session`, `Device`, refresh hashé |
| Rate limiting | `middlewares/rateLimit.ts`, route auth |
| Risque / flags | `risk.service.ts`, `SuspiciousFlag`, limites retraits |
| Chiffrement AES-256 | `utils/encryption.ts` |

---

## Wallet custodial & ledger (critique — implémenté)

- Comptes multi-devise + `balance` / `lockedBalance` : `WalletAccount`, `LedgerEntry`, `Transaction`.
- Mouvements centralisés : `backend/src/services/ledger.service.ts`.
- Transferts internes : `wallet.service.ts` + routes wallet.

---

## P2P & escrow (critique — implémenté)

- Offres, filtres, création : `p2p.service.ts` (`createOffer`, `listOffers`).
- Trade : séquestre vendeur (`moveToLocked`), timer (`processExpiredTrades`), étapes paid/confirm/cancel : `p2p.service.ts`.
- Chat : messages liés au trade (routes P2P).
- Litiges : modèle + résolution admin (`admin.service.ts`, `admin.routes.ts`).

---

## PawaPay & fiat

- Service & webhooks : `pawapay.service.ts`, `modules/webhook.routes.ts`.
- Modèles dépôts / retraits fiat dans Prisma.
- **Production** : exiger clés + validation signatures réelles dans `.env`.

---

## Marché / prix

- Référence prix : `prices.service.ts` (Binance public configurable).

---

## On-chain

- Aujourd’hui : utilitaires minimaux (`utils/onchain.ts` — validation adresse EVM).
- **Gap produit** : dépôt/retrait on-chain bout-en-bout (hot wallet, confirmations, indexeur) = chantier dédié hors scope d’un seul livrable.

---

## Admin

- **API** : `modules/admin.routes.ts` — utilisateurs, KYC, gel, disputes, retraits, transactions, flags.
- **Gap UI** : pas de panneau Next.js admin ; tout passe par **API + outil type Postman / futur `/admin` front**.

---

## Front utilisateur

- Landing, auth (FR/EN), dashboard, wallet, P2P, salle de trade : `frontend/app/`.
- **Gap** : pas d’interface admin embarquée ; création d’offres P2P côté UI peut être ajoutée (aujourd’hui souvent API).

---

## Déploiement (cible spec)

| Service | Cible |
|---------|--------|
| API | Render (`npm run build && npm start`) |
| Web | Vercel (`frontend`, `NEXT_PUBLIC_API_URL`) |
| DB | PostgreSQL managé (Neon, RDS, etc.) |

Variables : voir `backend/.env.example`, `frontend/.env.example`.

---

## Priorités engineering réalistes

1. **Admin UI** (Next route protégée ou app séparée) branchée sur `/api/admin/*`.
2. **Flux PawaPay** end-to-end en sandbox puis prod + monitoring webhooks.
3. **On-chain** : politique trésorerie (custodie), sweep, retraits avec file + confirmations.
4. **Notifications push** (FCM / Web Push) — optionnel.
5. **Tests** : intégration API critiques (login, ledger, trade happy path).

---

## Structure repo (réelle)

```
backend/src/
  config/       # env Zod
  lib/          # prisma, redis
  middlewares/  # auth, admin, rate limit
  modules/      # routes Express par domaine
  services/     # ledger, wallet, p2p, pawapay, admin, risk, prices
  utils/        # jwt, hash, encryption, refs, onchain

frontend/
  app/          # App Router pages + i18n
  components/   # Shell, I18nProvider, LanguageSwitcher
  lib/          # api client, i18n helpers
  messages/     # en.json / fr.json
```

Le code suit une **architecture modulaire par domaine** (pas de dossiers `controllers/` vides : la logique vit dans `services/` + `modules/`).

---

*Dernière mise à jour : alignement avec le dépôt McBuleli_P2P.*
