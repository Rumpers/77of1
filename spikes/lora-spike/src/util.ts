import { existsSync, mkdirSync, readdirSync, createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

export const SPIKE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const OUTPUTS_DIR = join(SPIKE_ROOT, "outputs");
export const GALLERY_DIR = join(OUTPUTS_DIR, "gallery");
export const TRAINING_RESULT = join(OUTPUTS_DIR, "training-result.json");

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[lora-spike] ${msg}`);
}

export function die(msg: string): never {
  // eslint-disable-next-line no-console
  console.error(`[lora-spike] ERROR: ${msg}`);
  process.exit(1);
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) die(`Missing env var ${name}. Copy .env.example → .env and fill it in.`);
  return v.trim();
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** List real image files in a dir, skipping macOS cruft (._*, .DS_Store) and videos. */
export function listImages(dir: string): string[] {
  if (!existsSync(dir)) die(`Photos dir not found: ${dir}`);
  return readdirSync(dir)
    .filter((f) => !f.startsWith("._") && f !== ".DS_Store")
    .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .map((f) => join(dir, f))
    .sort();
}

/** Zip a list of files into destZip. Resolves when the archive is fully written. */
export function zipFiles(files: string[], destZip: string): Promise<void> {
  ensureDir(dirname(destZip));
  return new Promise((resolve, reject) => {
    const output = createWriteStream(destZip);
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.on("close", () => resolve());
    archive.on("error", reject);
    archive.pipe(output);
    for (const f of files) archive.file(f, { name: f.split("/").pop()! });
    void archive.finalize();
  });
}

/** Download a URL to a local path using native fetch (Node 18+). */
export async function downloadTo(url: string, dest: string): Promise<void> {
  ensureDir(dirname(dest));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  ensureDir(dirname(path));
  await writeFile(path, JSON.stringify(data, null, 2));
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
