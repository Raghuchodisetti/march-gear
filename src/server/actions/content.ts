"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { siteContent } from "@/db/schema";
import { BLOCKS, isBlockKey } from "@/content/registry";
import type { ActionResult } from "@/lib/action-result";
import { audit } from "@/server/audit";
import { requireStaff } from "@/server/auth";
import { expireCatalog } from "@/server/catalog";
import { invalid } from "@/server/validation";

/** Saves one content block after validating it against the block's schema. */
export async function saveContentAction(key: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  const me = await requireStaff();
  if (typeof key !== "string" || !isBlockKey(key)) return { ok: false, error: "Unknown content block." };
  const block = BLOCKS[key];
  const parsed = block.schema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  await getDb()
    .insert(siteContent)
    .values({ key, data: parsed.data, updatedBy: me.id })
    .onDuplicateKeyUpdate({ set: { data: parsed.data, updatedBy: me.id } });
  await audit(me.id, "update", "content", key, `Updated “${block.title}”`);
  expireCatalog();
  revalidatePath("/admin/content", "layout");
  return { ok: true, id: key };
}

/** Drops the saved version so the block goes back to its launch defaults. */
export async function resetContentAction(key: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  if (typeof key !== "string" || !isBlockKey(key)) return { ok: false, error: "Unknown content block." };
  await getDb().delete(siteContent).where(eq(siteContent.key, key));
  await audit(me.id, "reset", "content", key, `Reset “${BLOCKS[key].title}” to the default`);
  expireCatalog();
  revalidatePath("/admin/content", "layout");
  return { ok: true };
}
