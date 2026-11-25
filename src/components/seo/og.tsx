import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactElement, ReactNode } from "react";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { imageBytes } from "@/server/media-store";
import { media } from "@/db/schema";

/* ──────────────────────────────────────────────────────────────
   Building blocks for the generated share cards (opengraph-image
   files): brand fonts, colours, the wordmark and a safe loader for
   the photo behind a card. Server-only (reads font files).
   ────────────────────────────────────────────────────────────── */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export const C = { ink: "#111111", ink2: "#202020", ink3: "#2c2c2c", red: "#E31E24", line: "#E8E8E8", muted: "#777777", mist: "#F6F6F6", white: "#FFFFFF" };

const FONT_DIR = join(process.cwd(), "src/components/seo/fonts");
let fontCache: Promise<{ name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }[]> | null = null;

/** Archivo (display, semi-expanded bold) and Geist (text), the site's own typefaces — OFL-licensed TTFs. */
function fonts() {
  fontCache ??= Promise.all([
    readFile(join(FONT_DIR, "archivo-semiexpanded-700.ttf")),
    readFile(join(FONT_DIR, "geist-400.ttf")),
    readFile(join(FONT_DIR, "geist-600.ttf")),
  ]).then(([archivo, geist, geistSemi]) => [
    { name: "Archivo", data: archivo, weight: 700, style: "normal" },
    { name: "Geist", data: geist, weight: 400, style: "normal" },
    { name: "Geist", data: geistSemi, weight: 600, style: "normal" },
  ]);
  return fontCache;
}

/** Render a 1200×630 PNG with the brand fonts loaded. */
export async function ogImage(element: ReactElement) {
  return new ImageResponse(element, { ...OG_SIZE, fonts: await fonts() });
}

/**
 * A photo as a data URL for the card, or null if it can't be fetched (the card then renders without it).
 * Unsplash photos are requested at the needed size as JPEG (the renderer doesn't read WebP/AVIF); uploads under
 * /media are converted to JPEG on the server.
 */
export async function photo(src: string | undefined, width: number, height: number): Promise<string | null> {
  if (src && src.startsWith("/media/")) return mediaPhoto(src, width, height);
  if (!src || !/^https:\/\/images\.unsplash\.com\//.test(src)) return null;
  try {
    const url = new URL(src);
    for (const [k, v] of Object.entries({ w: String(width), h: String(height), fit: "crop", crop: "entropy", fm: "jpg", q: "75" })) url.searchParams.set(k, v);
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * A /media upload (e.g. an imported catalogue photo, stored as WebP) cropped to the card as JPEG. Needs `sharp` at
 * run time (installed with Next); without it the card has no photo.
 */
async function mediaPhoto(src: string, width: number, height: number): Promise<string | null> {
  const m = /^\/media\/(\d{1,10})\/([^/?#]+)$/.exec(src);
  if (!m) return null;
  try {
    const [row] = await getDb()
      .select({ id: media.id, filename: media.filename, storage: media.storage, data: media.data })
      .from(media)
      .where(eq(media.id, Number(m[1])))
      .limit(1);
    if (!row || row.filename !== m[2]) return null;
    // In the database, or in the cloud folder (read from disk or fetched from MEDIA_CLOUD_URL).
    const bytes = await imageBytes(row);
    if (!bytes) return null;
    const { default: sharp } = await import("sharp");
    const jpeg = await sharp(bytes).rotate().resize(width, height, { fit: "cover", position: "attention" }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

/** The H-pattern gear-gate mark + "MarchGear" wordmark. */
export function Wordmark({ tone = "light", scale = 1 }: { tone?: "light" | "dark"; scale?: number }) {
  const fg = tone === "light" ? C.white : C.ink;
  const s = 44 * scale;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 * scale }}>
      <svg width={s} height={s} viewBox="0 0 32 32">
        <rect x="1" y="1" width="30" height="30" rx="3" fill="none" stroke={fg} strokeWidth="2" />
        <path d="M9 8v16M16 8v16M23 8v8M9 16h14" stroke={fg} strokeWidth="2.25" strokeLinecap="round" fill="none" />
        <circle cx="23" cy="23" r="2.75" fill={C.red} />
      </svg>
      <div style={{ display: "flex", fontFamily: "Archivo", fontSize: 30 * scale, color: fg, letterSpacing: -1 * scale }}>
        March
        <span style={{ fontFamily: "Geist", fontWeight: 400, opacity: 0.8 }}>Gear</span>
      </div>
    </div>
  );
}

/** Small uppercase label with the red rule, as on the site's eyebrows. */
export function Eyebrow({ children, color = "rgba(255,255,255,0.7)" }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "Geist", fontWeight: 600, fontSize: 20, letterSpacing: 3.2, textTransform: "uppercase", color }}>
      <div style={{ width: 36, height: 2, background: C.red }} />
      {children}
    </div>
  );
}

/** Trim to a length that fits the card, on a word boundary. */
export function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 12)).replace(/[\s,.;:—–-]+$/, "")}…`;
}
