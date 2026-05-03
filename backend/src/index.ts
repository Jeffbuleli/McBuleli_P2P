// Toujours en premier : charge backend/.env avant tout import qui touche Prisma
import { env } from "./config/env.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { prisma } from "./lib/prisma.js";
import { globalLimiter } from "./middlewares/rateLimit.js";
import { processExpiredTrades } from "./services/p2p.service.js";

import authRoutes from "./modules/auth.routes.js";
import userRoutes from "./modules/user.routes.js";
import walletRoutes from "./modules/wallet.routes.js";
import p2pRoutes from "./modules/p2p.routes.js";
import marketRoutes from "./modules/market.routes.js";
import adminRoutes from "./modules/admin.routes.js";
import stakingRoutes from "./modules/staking.routes.js";
import { createWebhookRouter } from "./modules/webhook.routes.js";
import paymentsRoutes from "./modules/payments.routes.js";
import { processDueStakes } from "./services/staking.service.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env().CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  }),
);
// Webhooks first: router uses JSON + raw capture for signature verification
app.use("/webhooks", createWebhookRouter());
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(globalLimiter);

app.get("/", (_req, res) =>
  res.json({
    ok: true,
    service: "mcbuleli-api",
    health: "/health",
    api: "/api",
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true, service: "mcbuleli-api" }));

app.use("/api", paymentsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/p2p", p2pRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/staking", stakingRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "INTERNAL" });
});

async function ensureSingletons() {
  await prisma.systemConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

const port = env().PORT;

ensureSingletons()
  .then(() => {
    app.listen(port, () => {
      console.info(`McBuleli API listening on :${port}`);
    });
    setInterval(() => {
      processExpiredTrades().catch((e: unknown) => {
        const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
        if (code === "P1001") {
          console.warn("[p2p] Database unreachable — fix DATABASE_URL or start Postgres; skipping expired trades.");
          return;
        }
        console.error(e);
      });
      processDueStakes().catch((e: unknown) => {
        const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
        if (code === "P1001") {
          console.warn("[staking] Database unreachable; skipping mature stakes.");
          return;
        }
        console.error(e);
      });
    }, 60_000);
  })
  .catch((e) => {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";

    if (code === "P2021") {
      console.error(`
P2021 = la table n’existe pas dans la base. Applique le schéma Prisma :

  npx prisma migrate deploy
  # ou en dev :
  npx prisma migrate dev

(Depuis le dossier backend, avec le bon DATABASE_URL vers McBuleli_P2P.)
`);
    } else if (msg.includes("Authentication failed") || msg.includes("P1000")) {
      const masked = env().DATABASE_URL.replace(/:([^:/?#]+)@/, ":****@");
      console.error(`
Échec auth Postgres — DATABASE_URL utilisée (masquée) :
  ${masked}

→ Mets le vrai mot de passe Postgres dans backend/.env (après postgresql://postgres: … ).
→ Mot de passe avec caractères spéciaux : encode-le (node -e "console.log(encodeURIComponent('…'))").
→ Test : npm run db:check   (doit afficher Connexion OK)
→ Si db:check OK mais pas dev : unset DATABASE_URL && npm run dev   (un export shell peut perturber).
`);
    }
    process.exit(1);
  });
