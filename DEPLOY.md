# Déploiement Vercel + Render (McBuleli P2P)

Checklist pour **`mcbulelip2p.vercel.app`** → API **`mcbuleli-api.onrender.com`**.  
(Si tu as encore l’ancien domaine Vercel, garde les deux dans `CORS_ORIGIN` le temps de la bascule.)

## 1. Render (API)

**Réglages du service Web** (dépôt Git → dossier racine du backend = `backend/` si monorepo).

| Champ | Valeur typique |
|--------|----------------|
| **Root Directory** | `backend` |
| **Build Command** | `npm ci && npm run build` |
| **Start Command** | `npm start` (= `node dist/index.js`) |

**Variables d’environnement** (copier depuis `backend/.env.example`, secrets remplis à la main) :

- **`DATABASE_URL`** — Postgres (Render Postgres ou autre ; même principe que ton autre projet).
- **`JWT_ACCESS_SECRET`**, **`JWT_REFRESH_SECRET`**, **`ENCRYPTION_KEY`** — chaînes longues, uniques en prod.
- **`CORS_ORIGIN`** — **obligatoire** pour le front Vercel :

  `https://mcbulelip2p.vercel.app`

  *(Ajoute une virgule et l’URL preview Vercel si tu testes des PR : `https://mcbulelip2p-git-xxx.vercel.app`.)*

- **`APP_URL`** — `https://mcbulelip2p.vercel.app` (liens e-mail / redirects si utilisés).
- **`API_URL`** — `https://mcbuleli-api.onrender.com` (cohérence des URLs côté serveur).

**Base de données** : après la première mise en ligne ou à chaque migration :

```bash
npx prisma migrate deploy
```

À lancer dans le contexte où `DATABASE_URL` pointe sur la **même** base que Render (CI, ou shell Render avec les env chargés).

## 2. Vercel (front Next.js)

### Si tu vois `404: NOT_FOUND` sur l’URL Vercel

Presque toujours : le site est build **sans** le dossier `frontend` (monorepo).

**À faire dans Vercel → Project → Settings → General :**

| Champ | Valeur |
|--------|--------|
| **Root Directory** | `frontend` |

Enregistrer, puis **Deployments → … → Redeploy** (sans cache si proposé).

*(Alternative sans changer le Root Directory : laisser la racine du repo et s’assurer que le build utilise le script `vercel-build` du `package.json` racine — il installe et build uniquement `frontend/`.)*

### Réglages du projet

| Champ | Valeur |
|--------|--------|
| **Root Directory** | `frontend` (**recommandé**) |
| **Framework** | Next.js (auto) |
| **Install Command** | *(vide ou défaut si Root = `frontend`)* |
| **Build Command** | *(vide ou défaut si Root = `frontend`)* |
| **Output** | défaut Next |

**Variable d’environnement (Production + Preview)** :

| Nom | Valeur |
|-----|--------|
| **`NEXT_PUBLIC_API_URL`** | `https://mcbuleli-api.onrender.com` |

Sans slash final.  
Le navigateur appelle l’API **directement** sur Render ; pas besoin de `BACKEND_INTERNAL_URL` en prod.

Redéployer le front après modification des variables.

## 3. Vérification rapide

1. Ouvre `https://mcbuleli-api.onrender.com/health` → JSON `ok`.
2. Sur `https://mcbulelip2p.vercel.app`, connexion : dans les outils développeur → **Réseau**, la requête login doit partir vers **`mcbuleli-api.onrender.com`**, pas vers `localhost`.

Si le login échoue encore : erreur **CORS** → compléter **`CORS_ORIGIN`** sur Render avec l’URL exacte affichée dans la barre d’adresse (y compris preview).
