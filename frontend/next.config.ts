import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Racine du monorepo (lockfiles à la racine, `frontend/`, `backend/`) — évite l’avertissement Vercel sur les lockfiles multiples. */
const monorepoRoot = path.join(__dirname, "..");

/** Cible Express en local — utilisée uniquement pour les rewrites (pas exposée au navigateur). */
/** Même hôte que celui où vous lancez `npm run dev` du backend (évite les soucis 127.0.0.1 vs localhost). */
const BACKEND_INTERNAL_URL =
  process.env.BACKEND_INTERNAL_URL?.replace(/\/$/, "") || "http://localhost:4000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Monorepo: trace deps from repo root. If `/_next/static/css/*.css` 404s after deploy, confirm host Root Directory = `frontend` and run `npm run build` from `frontend`. */
  outputFileTracingRoot: monorepoRoot,
  /** Quand NEXT_PUBLIC_API_URL est vide, le front appelle /api/… sur le même hôte que Next ; pas de CORS. */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_INTERNAL_URL}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
