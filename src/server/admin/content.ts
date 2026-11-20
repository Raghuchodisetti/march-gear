import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { siteContent, users } from "@/db/schema";
import { BLOCKS, type BlockKey } from "@/content/registry";
import type { FormValues } from "@/components/admin/fields";
import { requireStaff } from "@/server/auth";

export interface ContentMeta {
  updatedAt: Date;
  updatedBy: string | null;
}

/** When each saved block was last changed, and by whom. Unsaved blocks are absent. */
export async function contentMeta(): Promise<Map<string, ContentMeta>> {
  await requireStaff();
  const rows = await getDb()
    .select({ key: siteContent.key, updatedAt: siteContent.updatedAt, updatedBy: users.name })
    .from(siteContent)
    .leftJoin(users, eq(users.id, siteContent.updatedBy));
  return new Map(rows.map((r) => [r.key, { updatedAt: r.updatedAt, updatedBy: r.updatedBy }]));
}

/** The block's current value for the edit form: what's saved (if still valid) or the defaults. */
export async function contentForm(key: BlockKey): Promise<{ values: FormValues; meta: ContentMeta | null; invalidSaved: boolean }> {
  await requireStaff();
  const [row] = await getDb()
    .select({ data: siteContent.data, updatedAt: siteContent.updatedAt, updatedBy: users.name })
    .from(siteContent)
    .leftJoin(users, eq(users.id, siteContent.updatedBy))
    .where(eq(siteContent.key, key));
  const block = BLOCKS[key];
  if (!row) return { values: block.defaults as FormValues, meta: null, invalidSaved: false };
  const parsed = block.schema.safeParse(row.data);
  return {
    values: (parsed.success ? parsed.data : block.defaults) as FormValues,
    meta: { updatedAt: row.updatedAt, updatedBy: row.updatedBy },
    invalidSaved: !parsed.success,
  };
}
