"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { siteContent } from "@/db/schema";
import { BLOCKS, isBlockKey } from "@/content/registry";
import type { ActionResult } from "@/lib/action-result";
import { audit } from "@/server/audit";
import { requireStaff } from "@/server/auth";
import type { Section } from "@/lib/staff-access";
import { expireCatalog } from "@/server/catalog";
import { invalid } from "@/server/validation";

/** Who may edit a block: the insurance marketplace's own settings belong to Insurance, everything else to Site settings. */
const INSURANCE_BLOCKS = new Set(["insurancePricing", "insuranceSettings", "insurerPlans"]);
const blockSection = (key: string): Section => (INSURANCE_BLOCKS.has(key) ? "insurance" : "site");

/** Saves one content block after validating it against the block's schema. */
export async function saveContentAction(key: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (typeof key !== "string" || !isBlockKey(key)) return { ok: false, error: "Unknown content block." };
  const me = await requireStaff(blockSection(key));
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
  if (typeof key !== "string" || !isBlockKey(key)) return { ok: false, error: "Unknown content block." };
  const me = await requireStaff(blockSection(key));
  await getDb().delete(siteContent).where(eq(siteContent.key, key));
  await audit(me.id, "reset", "content", key, `Reset “${BLOCKS[key].title}” to the default`);
  expireCatalog();
  revalidatePath("/admin/content", "layout");
  return { ok: true };
}
