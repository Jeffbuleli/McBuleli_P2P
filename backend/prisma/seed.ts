import { config } from "dotenv";
import bcrypt from "bcrypt";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

config({
  path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env"),
  override: true,
});

const prisma = new PrismaClient();

/** Compte local pour tester le login (inchangé si l’utilisateur existe déjà). */
const DEV_EMAIL = "dev@mcbuleli.local";
const DEV_USERNAME = "devuser";
const DEV_PASSWORD = "DevPassword12";

async function main() {
  await prisma.systemConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      dailyWithdrawLimitFiat: 500000,
    },
    update: {},
  });
  console.info("Seed: systemConfig ready.");

  let dev = await prisma.user.findUnique({ where: { email: DEV_EMAIL } });
  if (!dev) {
    const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);
    dev = await prisma.user.create({
      data: {
        email: DEV_EMAIL,
        username: DEV_USERNAME,
        passwordHash,
        fullName: "Dev User",
        country: "CD",
      },
    });
    await prisma.walletAccount.createMany({
      data: [
        { userId: dev.id, kind: "FIAT", currencyCode: "CDF" },
        { userId: dev.id, kind: "FIAT", currencyCode: "USD" },
        { userId: dev.id, kind: "CRYPTO", currencyCode: "USDT" },
      ],
      skipDuplicates: true,
    });
    console.info(`Seed: compte dev créé → email ${DEV_EMAIL} / mot de passe ${DEV_PASSWORD}`);
  } else {
    console.info(`Seed: compte dev déjà présent (${DEV_EMAIL}).`);
  }

  await prisma.stakingPool.upsert({
    where: { slug: "usdt-30d" },
    create: {
      slug: "usdt-30d",
      asset: "USDT",
      nameFr: "USDT · 30 jours",
      nameEn: "USDT · 30 days",
      apyAnnual: "8.5",
      lockDays: 30,
      minAmount: "10",
      maxStakePerUser: "50000",
      sortOrder: 0,
    },
    update: {
      nameFr: "USDT · 30 jours",
      nameEn: "USDT · 30 days",
      apyAnnual: "8.5",
      lockDays: 30,
      minAmount: "10",
      maxStakePerUser: "50000",
      isActive: true,
      sortOrder: 0,
    },
  });
  await prisma.stakingPool.upsert({
    where: { slug: "usdt-90d" },
    create: {
      slug: "usdt-90d",
      asset: "USDT",
      nameFr: "USDT · 90 jours",
      nameEn: "USDT · 90 days",
      apyAnnual: "12",
      lockDays: 90,
      minAmount: "25",
      maxStakePerUser: "100000",
      sortOrder: 1,
    },
    update: {
      nameFr: "USDT · 90 jours",
      nameEn: "USDT · 90 days",
      apyAnnual: "12",
      lockDays: 90,
      minAmount: "25",
      maxStakePerUser: "100000",
      isActive: true,
      sortOrder: 1,
    },
  });
  console.info("Seed: staking pools upserted (usdt-30d, usdt-90d).");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
