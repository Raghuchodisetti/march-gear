"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireStaff } from "@/server/auth";
import { audit } from "@/server/audit";
import { expireCatalog } from "@/server/catalog";
import { getMediaItem, listMedia, mediaUsage, removeMedia, setMediaAlt } from "@/server/admin/media";
import { MEDIA_ALT_MAX, MEDIA_PAGE_SIZE, type MediaItem, type MediaPage, type MediaUsage } from "@/components/admin/media-shared";

const mediaId = z.coerce.number().int().positive().max(2_147_483_647);

const listInput = z
  .object({
    q: z.string().trim().max(120).optional(),
    before: mediaId.optional(),
    limit: z.number().int().min(1).max(100).default(MEDIA_PAGE_SIZE),
  })
  .default({ limit: MEDIA_PAGE_SIZE });

export async function listMediaAction(input?: unknown): Promise<ActionResult<MediaPage>> {
  await requireStaff(["catalogue", "content", "site", "dealers", "advertising", "insurance"]);
  const parsed = listInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid search" };
  return { ok: true, ...(await listMedia(parsed.data)) };
}

export async function updateMediaAltAction(id: unknown, alt: unknown): Promise<ActionResult<{ item: MediaItem }>> {
  const me = await requireStaff(["catalogue", "content", "site", "dealers", "advertising", "insurance"]);
  const parsed = z
    .tuple([
      mediaId,
      z
        .string()
        .trim()
        .max(MEDIA_ALT_MAX, `Keep alt text under ${MEDIA_ALT_MAX} characters`)
        .transform((v) => v || null),
    ])
    .safeParse([id, alt]);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid alt text", fieldErrors: { alt: parsed.error.issues[0]?.message ?? "Invalid alt text" } };
  const [mid, text] = parsed.data;
  const before = await getMediaItem(mid);
  if (!before) return { ok: false, error: "That image no longer exists." };
  if (before.alt !== text) {
    await setMediaAlt(mid, text);
    await audit(me.id, "update", "media", mid, `Alt text for ${before.filename}: ${text ? `“${text}”` : "cleared"}`);
    // Credited photos' alt text is read through the cached photo credits (car pages, /photo-credits).
    if (before.credit) expireCatalog();
  }
  return { ok: true, item: { ...before, alt: text } };
}

export async function mediaUsageAction(id: unknown): Promise<ActionResult<{ usage: MediaUsage[] }>> {
  await requireStaff(["catalogue", "content", "site", "dealers", "advertising", "insurance"]);
  const mid = mediaId.safeParse(id);
  if (!mid.success) return { ok: false, error: "Invalid image" };
  return { ok: true, usage: await mediaUsage(mid.data) };
}

export async function deleteMediaAction(id: unknown): Promise<ActionResult> {
  const me = await requireStaff("site");
  const mid = mediaId.safeParse(id);
  if (!mid.success) return { ok: false, error: "Invalid image" };
  const item = await getMediaItem(mid.data);
  if (!item) return { ok: false, error: "That image was already deleted." };
  const usage = await mediaUsage(mid.data);
  await removeMedia(mid.data);
  await audit(me.id, "delete", "media", mid.data, `Deleted ${item.filename}${usage.length ? ` (was used in ${usage.length} ${usage.length === 1 ? "place" : "places"})` : ""}`);
  return { ok: true };
}
