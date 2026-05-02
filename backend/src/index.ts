import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env } from "./config/env.js";
import { globalLimiter } from "./middlewares/rateLimit.js";
import { processExpiredTrades } from "./services/p2p.service.js";
import { prisma } from "./lib/prisma.js";

import authRoutes from "./modules/auth.routes.js";
import userRoutes from "./modules/user.routes.js";
import walletRoutes from "./modules/wallet.routes.js";
import p2pRoutes from "./modules/p2p.routes.js";
import marketRoutes from "./modules/market.routes.js";
import adminRoutes from "./modules/admin.routes.js";
import { createWebhookRouter } from "./modules/webhook.routes.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env().CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(globalLimiter);

app.get("/health", (_req, res) => res.json({ ok: true, service: "mcbuleli-api" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/p2p", p2pRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/admin", adminRoutes);
app.use("/webhooks", createWebhookRouter());

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
      processExpiredTrades().catch(console.error);
    }, 60_000);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
