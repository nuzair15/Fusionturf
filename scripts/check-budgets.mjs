import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "client", "dist");
const files = [];
async function walk(directory) {
  for (const name of await readdir(directory)) {
    const full = path.join(directory, name);
    const info = await stat(full);
    if (info.isDirectory()) await walk(full);
    else files.push({ full, name, size: info.size });
  }
}
await walk(dist);

const failures = [];
for (const file of files) {
  if (/\.(avif|webp|png|jpe?g)$/i.test(file.name) && file.size > 350_000) failures.push(`${file.name} image is ${file.size} bytes (limit 350000)`);
  if (/\.js$/i.test(file.name) && file.size > 500_000) failures.push(`${file.name} script is ${file.size} bytes (limit 500000)`);
}
if (failures.length) throw new Error(`Performance budget exceeded:\n${failures.join("\n")}`);
console.log(`Performance budgets passed for ${files.length} built files.`);
