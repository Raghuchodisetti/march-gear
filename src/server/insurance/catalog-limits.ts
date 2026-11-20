import "server-only";
import { and, count, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { insProducts } from "@/db/schema";
import { getCatalog } from "@/server/catalog";

/* ──────────────────────────────────────────────────────────────
   Plan limits on a vendor's product catalogue (the `insurerPlans`
   content block, by ins_vendors.plan). Only published products
   count — drafts, products in review and approved-but-offline ones
   don't use a slot.
   ────────────────────────────────────────────────────────────── */

export interface InsurerPlanInfo {
  id: string;
  name: string;
  /** Published products allowed; null = unlimited. */
  products: number | null;
}

/** The vendor's plan from the content block (unknown ids fall back to the most restrictive plan). */
export async function insurerPlanFor(planId: string): Promise<InsurerPlanInfo> {
  const plans = (await getCatalog()).content.insurerPlans.plans;
  const plan = plans.find((p) => p.id === planId);
  if (plan) return { id: plan.id, name: plan.name, products: plan.products };
  const fallback = [...plans].sort((a, b) => (a.products ?? Infinity) - (b.products ?? Infinity))[0];
  return { id: planId, name: planId.charAt(0).toUpperCase() + planId.slice(1), products: fallback?.products ?? 3 };
}

export async function publishedProductCount(vendorId: number, excludeId?: number) {
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(insProducts)
    .where(and(eq(insProducts.vendorId, vendorId), eq(insProducts.status, "published"), excludeId ? ne(insProducts.id, excludeId) : undefined));
  return n;
}

/** Live products against the plan, for the list and the dashboard. */
export async function productUsage(vendorId: number, planId: string) {
  const [plan, published] = await Promise.all([insurerPlanFor(planId), publishedProductCount(vendorId)]);
  return { plan, published, limit: plan.products, left: plan.products === null ? null : Math.max(0, plan.products - published) };
}

/** Null when one more published product fits the plan; otherwise a message for the vendor. */
export async function publishLimitError(vendorId: number, planId: string, productId?: number) {
  const [plan, published] = await Promise.all([insurerPlanFor(planId), publishedProductCount(vendorId, productId)]);
  if (plan.products === null || published < plan.products) return null;
  return `Your ${plan.name} plan allows ${plan.products} published product${plan.products === 1 ? "" : "s"} and you have ${published}. Unpublish one, or upgrade your plan in Billing.`;
}
