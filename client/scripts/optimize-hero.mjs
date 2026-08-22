import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "assets-source", "hero.jpeg");
const output = path.join(root, "public");

for (const width of [640, 960, 1440, 1920]) {
  const pipeline = sharp(source).rotate().resize({ width, withoutEnlargement: true });
  await pipeline.clone().webp({ quality: 72, effort: 6 }).toFile(path.join(output, `hero-${width}.webp`));
  await pipeline.clone().avif({ quality: 50, effort: 6 }).toFile(path.join(output, `hero-${width}.avif`));
}

const metadata = await sharp(source).metadata();
console.log(`Optimized hero from ${metadata.width}x${metadata.height}.`);
