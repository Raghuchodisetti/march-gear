import { and, count, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  adCampaigns,
  adCreatives,
  insCampaigns,
  insCovers,
  insPayments,
  insProducts,
  insTickets,
  insVendors,
  leads,
  ownerReviews,
  partnerOffers,
  partnerVehicles,
  partners,
} from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { AdminShell } from "@/components/admin/admin-shell";

// Each page and action re-checks access too; this only builds the chrome.
export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  const db = getDb();
  const n = (q: Promise<{ n: number }[]>) => q.then((r) => r[0]?.n ?? 0);
  const [newLeads, pendingReviews, pendingDealers, pendingVehicles, pendingOffers, vendors, products, coverage, addOns, campaigns, payments, tickets, adCampaignsPending, adCreativesPending] =
    await Promise.all([
      n(db.select({ n: count() }).from(leads).where(eq(leads.status, "new"))),
      n(db.select({ n: count() }).from(ownerReviews).where(eq(ownerReviews.status, "pending"))),
      n(db.select({ n: count() }).from(partners).where(inArray(partners.status, ["submitted", "pending_approval", "under_review"]))),
      // Only used cars wait for review — new-car listings go live when the dealer publishes them.
      n(db.select({ n: count() }).from(partnerVehicles).where(and(eq(partnerVehicles.kind, "used"), eq(partnerVehicles.status, "pending_approval")))),
      n(db.select({ n: count() }).from(partnerOffers).where(inArray(partnerOffers.status, ["submitted", "pending_approval"]))),
      n(db.select({ n: count() }).from(insVendors).where(inArray(insVendors.status, ["submitted", "pending_approval", "under_review"]))),
      n(db.select({ n: count() }).from(insProducts).where(inArray(insProducts.status, ["submitted", "pending_approval"]))),
      n(db.select({ n: count() }).from(insCovers).where(and(eq(insCovers.type, "coverage"), eq(insCovers.status, "pending_approval")))),
      n(db.select({ n: count() }).from(insCovers).where(and(eq(insCovers.type, "addon"), eq(insCovers.status, "pending_approval")))),
      n(db.select({ n: count() }).from(insCampaigns).where(eq(insCampaigns.status, "pending_approval"))),
      n(db.select({ n: count() }).from(insPayments).where(eq(insPayments.status, "submitted"))),
      n(db.select({ n: count() }).from(insTickets).where(inArray(insTickets.status, ["open", "awaiting_support"]))),
      n(db.select({ n: count() }).from(adCampaigns).where(eq(adCampaigns.status, "pending_approval"))),
      n(db.select({ n: count() }).from(adCreatives).where(eq(adCreatives.status, "pending"))),
    ]);
  return (
    <AdminShell
      user={{ name: user.name, email: user.email, role: user.role }}
      newLeads={newLeads}
      pendingReviews={pendingReviews}
      partnerQueue={{ dealers: pendingDealers, vehicles: pendingVehicles, offers: pendingOffers }}
      insuranceQueue={{ vendors, products, coverage, addOns, campaigns, payments, tickets, ads: adCampaignsPending + adCreativesPending }}
    >
      {children}
    </AdminShell>
  );
}
