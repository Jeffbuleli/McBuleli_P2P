/**
 * Icônes PWA : dégradé aligné McBuleli APP (#10b981 → marron #5d4037).
 * Usage: npm run generate-icons
 */
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/icons");

await mkdir(outDir, { recursive: true });

function gradientSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#10b981"/>
      <stop offset="55%" style="stop-color:#059669"/>
      <stop offset="100%" style="stop-color:#5d4037"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" rx="${Math.round(size * 0.18)}" fill="url(#g)"/>
</svg>`;
}

for (const size of [192, 512]) {
  const out = join(outDir, `icon-${size}.png`);
  await sharp(Buffer.from(gradientSvg(size))).resize(size, size).png().toFile(out);
  console.log("Wrote", out);
}
