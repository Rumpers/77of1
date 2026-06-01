/**
 * Tiny static server for the gallery — so you can view results in a browser,
 * including on Replit (binds 0.0.0.0). Founder-internal viewing only.
 *
 * Run:  pnpm serve   then open the forwarded port.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { GALLERY_DIR, log } from "./util.ts";

const PORT = Number(process.env.PORT ?? 22480);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const server = createServer(async (req, res) => {
  const rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const name = rel === "/" ? "gallery.html" : normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const path = join(GALLERY_DIR, name);
  if (!path.startsWith(GALLERY_DIR)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  try {
    const body = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path).toLowerCase()] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found — run pnpm generate && pnpm gallery first");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  log(`serving outputs/gallery/ at http://0.0.0.0:${PORT}  (Replit: open the forwarded port)`);
});
