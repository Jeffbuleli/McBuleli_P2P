import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

config({
  path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env"),
  override: true,
});

const prisma = new PrismaClient();

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
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
