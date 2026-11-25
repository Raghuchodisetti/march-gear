"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { guides } from "@/db/schema";
import { PUBLISH_STATUS } from "@/db/enums";
import { requireStaff } from "@/server/auth";
import { audit } from "@/server/audit";
import { isDuplicate } from "@/server/db-errors";
import { invalid } from "@/server/validation";
import { expireGuides } from "@/server/guides";
import type { ActionResult } from "@/lib/action-result";
import { GUIDE_MAX_CHARS, GUIDE_SUBJECT_MAX, GUIDE_SUMMARY_MAX, GUIDE_TITLE_MAX, contentChars, countWords, summaryFrom, textToBlocks } from "@/lib/guides";

/* Editing a guide after it was created from its PDF (the PDF upload itself goes through
   /admin/guides/upload, a route handler — files are too big for a Server Action). */

const recordId = z.number().int().positive();

const guideSchema = z.object({
  subject: z.string({ error: "Enter the subject" }).trim().min(1, "Enter the subject").max(GUIDE_SUBJECT_MAX, "That's too long"),
  title: z.string({ error: "Enter the topic name" }).trim().min(1, "Enter the topic name").max(GUIDE_TITLE_MAX, "That's too long"),
  slug: z
    .string({ error: "Enter a URL slug" })
    .trim()
    .min(1, "Enter a URL slug")
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only"),
  summary: z.string().trim().max(GUIDE_SUMMARY_MAX, `Keep it under ${GUIDE_SUMMARY_MAX} characters`).default(""),
  content: z.string({ error: "The page needs some content" }).max(GUIDE_MAX_CHARS * 1.2, "That's more text than one guide page can hold"),
  status: z.enum(PUBLISH_STATUS),
  showPdf: z.boolean().default(false),
});

export async function saveGuideAction(id: unknown, input: unknown): Promise<ActionResult<{ id: number }>> {
  const me = await requireStaff("content");
  const rid = recordId.safeParse(id);
  if (!rid.success) return { ok: false, error: "Invalid guide." };
  const parsed = guideSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { content: text, summary, ...fields } = parsed.data;

  const content = textToBlocks(text);
  if (!content.length) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { content: "The page needs some content." } };
  if (contentChars(content) > GUIDE_MAX_CHARS) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { content: "That's more text than one guide page can hold — split it into separate topics." } };

  try {
    const [res] = await getDb()
      .update(guides)
      .set({ ...fields, content, summary: summary || summaryFrom(content), words: countWords(content) })
      .where(eq(guides.id, rid.data));
    if (!res.affectedRows) return { ok: false, error: "This guide no longer exists." };
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { slug: "Another guide already uses this URL." } };
    throw err;
  }
  expireGuides();
  await audit(me.id, "update", "guide", rid.data, `Updated guide “${fields.title}”`);
  return { ok: true, id: rid.data };
}

export async function deleteGuideAction(id: unknown): Promise<ActionResult> {
  const me = await requireStaff("content");
  const rid = recordId.safeParse(id);
  if (!rid.success) return { ok: false, error: "Invalid guide." };
  const db = getDb();
  const [before] = await db.select({ title: guides.title }).from(guides).where(eq(guides.id, rid.data));
  // Its PDF pieces go with it (ON DELETE CASCADE).
  await db.delete(guides).where(eq(guides.id, rid.data));
  expireGuides();
  if (before) await audit(me.id, "delete", "guide", rid.data, `Deleted guide “${before.title}”`);
  return { ok: true };
}
