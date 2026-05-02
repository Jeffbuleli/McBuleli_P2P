/**
 * Teste la connexion Prisma → PostgreSQL sans lancer l'API.
 * Usage: cd backend && npm run db:check
 */
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __d = dirname(fileURLToPath(import.meta.url));
config({ path: join(__d, "../.env"), override: true });

function maskUrl(u: string): string {
  return u.replace(/:([^:/?#]+)@/, ":****@");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL manquant. Vérifie backend/.env");
    process.exit(1);
  }
  console.log("URL utilisée (masquée) :", maskUrl(url));

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Connexion OK — le mot de passe et l’hôte sont bons.");
  } catch (e) {
    console.error("❌ Échec connexion :", e);
    console.error(`
→ Vérifie : même mot de passe que dans pgAdmin (utilisateur postgres)
→ Port 5432, base McBuleli_P2P
→ Caractères spéciaux dans le mot de passe : utiliser encodeURIComponent dans l’URL
  Ex. : node -e "console.log(encodeURIComponent('ton mot de passe'))"
`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
