import "server-only";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { wishlistItems } from "@/db/schema";
import type { WishlistData } from "@/lib/action-result";

export async function getWishlist(userId: number): Promise<WishlistData> {
  const rows = await getDb()
    .select({ kind: wishlistItems.kind, itemId: wishlistItems.itemId })
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))
    .orderBy(wishlistItems.createdAt);
  return {
    cars: rows.filter((r) => r.kind === "cars").map((r) => r.itemId),
    used: rows.filter((r) => r.kind === "used").map((r) => r.itemId),
  };
}

/** Most saved items per list. */
export const WISHLIST_MAX = 200;

const clean = (ids: string[] | undefined) => (ids ?? []).filter((id) => typeof id === "string" && id.length > 0 && id.length <= 120).slice(0, WISHLIST_MAX);

/** Adds items saved while signed out to the account (duplicates ignored). */
export async function mergeWishlist(userId: number, local: Partial<WishlistData> | undefined) {
  const rows = [
    ...clean(local?.cars).map((itemId) => ({ userId, kind: "cars" as const, itemId })),
    ...clean(local?.used).map((itemId) => ({ userId, kind: "used" as const, itemId })),
  ];
  if (rows.length) await getDb().insert(wishlistItems).ignore().values(rows);
}

/** Returns false when the list is already full. */
export async function setWishlistItem(userId: number, kind: "cars" | "used", itemId: string, saved: boolean) {
  const db = getDb();
  const mine = and(eq(wishlistItems.userId, userId), eq(wishlistItems.kind, kind));
  if (!saved) {
    await db.delete(wishlistItems).where(and(mine, eq(wishlistItems.itemId, itemId)));
    return true;
  }
  const [{ n }] = await db.select({ n: count() }).from(wishlistItems).where(mine);
  if (n >= WISHLIST_MAX) return false;
  await db.insert(wishlistItems).ignore().values({ userId, kind, itemId });
  return true;
}

export async function clearWishlist(userId: number, kind?: "cars" | "used") {
  await getDb()
    .delete(wishlistItems)
    .where(kind ? and(eq(wishlistItems.userId, userId), eq(wishlistItems.kind, kind)) : eq(wishlistItems.userId, userId));
}
