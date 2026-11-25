"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { isActionError, partnerAction } from "@/server/partner/context";
import { logPartnerActivity } from "@/server/partner/records";
import { removeCloudFiles } from "@/server/media-store";
import {
  getPartnerMediaItem,
  listPartnerMedia,
  partnerMediaUsage,
  type PartnerMediaItem,
  type PartnerMediaUsage,
} from "@/server/partner/inventory";

/* ──────────────────────────────────────────────────────────────
   The dealer's media library: the public images (vehicle photos,
   logos, banners) the dealership uploaded via /dealer/upload.
   Each dealership only ever sees and changes its own uploads.
   ────────────────────────────────────────────────────────────── */

const mediaId = z.coerce.number().int().positive().max(2_147_483_647);
const ALT_MAX = 300;

const listInput = z.object({
  q: z.string().trim().max(120, "Keep the search under 120 characters").optional(),
  before: mediaId.optional(),
});

export async function listPartnerMediaAction(input: unknown): Promise<ActionResult<{ items: PartnerMediaItem[]; nextCursor: number | null; total: number }>> {
  const ctx = await partnerAction("media.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = listInput.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid search" };
  return { ok: true, ...(await listPartnerMedia(ctx.partner.id, parsed.data)) };
}

export async function updatePartnerMediaAltAction(id: unknown, alt: unknown): Promise<ActionResult<{ item: PartnerMediaItem }>> {
  const ctx = await partnerAction("media.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = z
    .tuple([
      mediaId,
      z
        .string()
        .trim()
        .max(ALT_MAX, `Keep the description under ${ALT_MAX} characters`)
        .transform((v) => v || null),
    ])
    .safeParse([id, alt]);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid description";
    return { ok: false, error: message, fieldErrors: { alt: message } };
  }
  const [mid, text] = parsed.data;
  const item = await getPartnerMediaItem(ctx.partner.id, mid);
  if (!item) return { ok: false, error: "That image no longer exists." };
  if (item.alt !== text) {
    await getDb()
      .update(media)
      .set({ alt: text })
      .where(and(eq(media.id, mid), eq(media.partnerId, ctx.partner.id)));
    await logPartnerActivity(ctx.partner.id, ctx.user.id, "update", "media", mid, `Alt text for ${item.filename}: ${text ? `“${text.slice(0, 120)}”` : "cleared"}`);
  }
  return { ok: true, item: { ...item, alt: text } };
}

export async function partnerMediaUsageAction(id: unknown): Promise<ActionResult<{ usage: PartnerMediaUsage[] }>> {
  const ctx = await partnerAction("media.manage");
  if (isActionError(ctx)) return ctx;
  const mid = mediaId.safeParse(id);
  if (!mid.success) return { ok: false, error: "Choose an image." };
  if (!(await getPartnerMediaItem(ctx.partner.id, mid.data))) return { ok: false, error: "That image no longer exists." };
  return { ok: true, usage: await partnerMediaUsage(ctx.partner.id, mid.data) };
}

export async function deletePartnerMediaAction(id: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("media.manage");
  if (isActionError(ctx)) return ctx;
  const mid = mediaId.safeParse(id);
  if (!mid.success) return { ok: false, error: "Choose an image." };
  const item = await getPartnerMediaItem(ctx.partner.id, mid.data);
  if (!item) return { ok: false, error: "That image was already deleted." };
  const usage = await partnerMediaUsage(ctx.partner.id, mid.data);
  const [res] = await getDb()
    .delete(media)
    .where(and(eq(media.id, mid.data), eq(media.partnerId, ctx.partner.id)));
  if (!res.affectedRows) return { ok: false, error: "That image was already deleted." };
  await removeCloudFiles(mid.data);
  await logPartnerActivity(
    ctx.partner.id,
    ctx.user.id,
    "delete",
    "media",
    mid.data,
    `Deleted image ${item.filename}${usage.length ? ` (was used in ${usage.length} ${usage.length === 1 ? "place" : "places"})` : ""}`,
  );
  return { ok: true };
}
