/**
 * Step 3 — build a self-contained gallery.html from outputs/gallery/manifest.json.
 * Rows = prompts, columns = LoRA strengths, with seeds stacked. Opens in any browser.
 * Optionally DMs a summary + a few images to the FOUNDER's own Telegram (internal only).
 *
 * Run:  pnpm gallery
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.ts";
import { GALLERY_DIR, die, log, writeJson } from "./util.ts";
import { writeFile } from "node:fs/promises";

interface GalleryItem {
  file: string;
  promptId: string;
  prompt: string;
  loraScale: number;
  seed: number;
  bleedCheck: boolean;
}
interface Manifest {
  model: string;
  trigger: string;
  generatedCount: number;
  approxImageCostUsd: number;
  loraScales: number[];
  seeds: number[];
  items: GalleryItem[];
}

function cell(items: GalleryItem[]): string {
  if (items.length === 0) return `<td class="empty">—</td>`;
  const imgs = items
    .map((it) => `<figure><img src="./${it.file}" loading="lazy"/><figcaption>seed ${it.seed}</figcaption></figure>`)
    .join("");
  return `<td>${imgs}</td>`;
}

function buildHtml(m: Manifest): string {
  const scales = m.loraScales;
  const promptIds = config.prompts.map((p) => p.id);

  const headRow = `<tr><th>prompt \\ lora_scale</th>${scales.map((s) => `<th>${s}</th>`).join("")}</tr>`;
  const rows = promptIds
    .map((pid) => {
      const label = config.prompts.find((p) => p.id === pid)?.text.replace("{trigger}", m.trigger) ?? pid;
      const cells = scales
        .map((s) => cell(m.items.filter((it) => it.promptId === pid && it.loraScale === s)))
        .join("");
      return `<tr><th class="rowlabel"><code>${pid}</code><span>${label}</span></th>${cells}</tr>`;
    })
    .join("");

  const bleed = m.items.filter((it) => it.bleedCheck);
  const bleedHtml = bleed.length
    ? `<section class="bleed"><h2>Bleed / overfit check</h2>
       <p>LoRA active, <strong>no trigger word</strong>. If these still look like the subject, the LoRA has overfit and bled into the base model.</p>
       <div class="strip">${bleed.map((it) => `<figure><img src="./${it.file}"/><figcaption>${it.file}</figcaption></figure>`).join("")}</div>
       </section>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>LoRA spike — eval gallery</title>
<style>
  :root { color-scheme: dark; }
  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px; background:#0e0e12; color:#e8e8ef; }
  h1 { margin: 0 0 4px; } .meta { color:#9a9ab0; margin-bottom:20px; font-size:13px; }
  .meta code { color:#c9b8ff; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #2a2a36; padding: 6px; vertical-align: top; }
  thead th { position: sticky; top: 0; background:#16161e; }
  .rowlabel { text-align:left; max-width:200px; } .rowlabel span { display:block; color:#9a9ab0; font-size:12px; margin-top:2px; }
  figure { margin: 0 0 6px; } img { width: 220px; height: auto; border-radius: 8px; display:block; }
  figcaption { color:#9a9ab0; font-size:11px; } td.empty { color:#444; text-align:center; }
  .bleed { margin-top: 32px; } .strip { display:flex; gap:12px; flex-wrap:wrap; }
  .note { margin-top:28px; padding:12px 14px; background:#1a1410; border:1px solid #4a3a20; border-radius:8px; color:#d8c9a8; font-size:13px; }
</style></head><body>
<h1>LoRA spike — eval gallery</h1>
<div class="meta">model <code>${m.model}</code> · trigger <code>${m.trigger}</code> · ${m.generatedCount} images · ~$${m.approxImageCostUsd.toFixed(2)} inference</div>
<table><thead>${headRow}</thead><tbody>${rows}</tbody></table>
${bleedHtml}
<div class="note">Founder-internal evaluation only (GATE-04: SFW, not for distribution). Do not share these images or the LoRA file. A signed consent addendum is required before anything leaves founder-internal scope.</div>
</body></html>`;
}

async function notifyTelegram(m: Manifest): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) return;
  const text = `🖼️ LoRA spike gallery ready\nmodel: ${m.model}\n${m.generatedCount} images, ~$${m.approxImageCostUsd.toFixed(2)}\nOpen gallery.html to review.`;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    log("sent summary to founder Telegram");
  } catch (e) {
    log(`telegram notify failed (non-fatal): ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main(): Promise<void> {
  let m: Manifest;
  try {
    m = JSON.parse(await readFile(join(GALLERY_DIR, "manifest.json"), "utf8")) as Manifest;
  } catch {
    die("no outputs/gallery/manifest.json — run pnpm generate first");
  }
  const html = buildHtml(m);
  const htmlPath = join(GALLERY_DIR, "gallery.html");
  await writeFile(htmlPath, html);
  await writeJson(join(GALLERY_DIR, "manifest.json"), m); // round-trip (no-op normalize)
  log(`✓ wrote ${htmlPath}`);
  log(`Open it: outputs/gallery/gallery.html  (or run: pnpm serve)`);
  await notifyTelegram(m);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
