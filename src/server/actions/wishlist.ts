"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { getSessionUser } from "@/server/auth";
import { clearWishlist, setWishlistItem } from "@/server/wishlist";

const kind = z.enum(["cars", "used"]);
const itemId = z.string().min(1).max(120);

/** Saves or un-saves a car for the signed-in user. Signed-out visitors keep their list on the device. */
export async function setWishlistItemAction(k: unknown, id: unknown, saved: unknown): Promise<ActionResult> {
  const user = await getSessionUser("customer");
  if (!user) return { ok: false, error: "Not signed in" };
  const parsed = z.tuple([kind, itemId, z.boolean()]).safeParse([k, id, saved]);
  if (!parsed.success) return { ok: false, error: "Invalid item" };
  if (!(await setWishlistItem(user.id, ...parsed.data))) return { ok: false, error: "Your saved list is full. Remove a car to save another." };
  return { ok: true };
}

export async function clearWishlistAction(k?: unknown): Promise<ActionResult> {
  const user = await getSessionUser("customer");
  if (!user) return { ok: false, error: "Not signed in" };
  const parsed = kind.optional().safeParse(k);
  if (!parsed.success) return { ok: false, error: "Invalid list" };
  await clearWishlist(user.id, parsed.data);
  return { ok: true };
}
