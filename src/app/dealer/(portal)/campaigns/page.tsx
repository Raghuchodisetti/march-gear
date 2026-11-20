import type { Metadata } from "next";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { Plus, Sparkles } from "lucide-react";
import { getDb } from "@/db";
import { partnerLeads } from "@/db/schema";
import { requirePartner } from "@/server/partner/context";
import { listOffers } from "@/server/partner/offers";
import { PortalHeader, StatCard } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { istDay } from "@/components/offers/offer-utils";
import { CampaignBoard, type OfferLead } from "@/components/portal/offers/campaign-board";

export const metadata: Metadata = { title: "Campaigns" };

const DAY = 86_400_000;

export default async function CampaignsPage() {
  const ctx = await requirePartner({ perm: "offers.view" });
  const now = new Date();
  const t = now.getTime();
  const items = await listOffers(ctx, now);

  // Recent enquiries per offer — only what this person may see in the CRM.
  const canAll = ctx.can("leads.view_all");
  const canOwn = ctx.can("leads.view_own");
  let leads: OfferLead[] = [];
  if ((canAll || canOwn) && items.length) {
    const rows = await getDb()
      .select({ id: partnerLeads.id, reference: partnerLeads.reference, name: partnerLeads.name, carLabel: partnerLeads.carLabel, status: partnerLeads.status, offerId: partnerLeads.offerId, createdAt: partnerLeads.createdAt })
      .from(partnerLeads)
      .where(
        and(
          eq(partnerLeads.partnerId, ctx.partner.id),
          isNotNull(partnerLeads.offerId),
          inArray(
            partnerLeads.offerId,
            items.map((i) => i.id),
          ),
          canAll ? undefined : eq(partnerLeads.assignedMemberId, ctx.member.id),
        ),
      )
      .orderBy(desc(partnerLeads.createdAt))
      .limit(400);
    leads = rows.map((r) => ({ ...r, offerId: r.offerId!, createdAt: r.createdAt.toISOString() }));
  }

  const live = items.filter((i) => i.display === "active");
  const soon = items.filter((i) => i.display === "scheduled" && new Date(i.startsAt).getTime() - t < 14 * DAY);
  const ending = live.filter((i) => new Date(i.endsAt).getTime() - t < 7 * DAY);
  const enquiries = items.reduce((s, i) => s + i.enquiries, 0);
  const conversions = items.reduce((s, i) => s + i.conversions, 0);

  return (
    <>
      <PortalHeader
        title="Campaigns"
        description="Every offer on one calendar, how it's scheduled and how it performs. Approved offers go live on their start date and expire automatically on their end date — no action needed."
        actions={
          <>
            <Button href="/dealer/offers" variant="outline" size="sm" icon={<Sparkles className="size-4" aria-hidden />}>
              All offers
            </Button>
            {ctx.can("offers.manage") && (
              <Button href="/dealer/offers/create" size="sm" icon={<Plus className="size-4" aria-hidden />}>
                Create offer
              </Button>
            )}
          </>
        }
      />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Live now" value={live.length} note={live.length ? `${live.reduce((s, i) => s + i.views, 0).toLocaleString("en-IN")} views so far` : "No offers running"} />
        <StatCard label="Starting in 14 days" value={soon.length} note={`${items.filter((i) => i.display === "scheduled").length} scheduled in total`} />
        <StatCard label="Ending in 7 days" value={ending.length} note="They expire automatically" tone={ending.length ? "red" : undefined} />
        <StatCard label="Offer conversion" value={enquiries ? `${Math.round((conversions / enquiries) * 100)}%` : "—"} note={`${conversions} of ${enquiries} enquiries won`} />
      </div>
      <CampaignBoard items={items} leads={leads} canManage={ctx.can("offers.manage")} canSeeLeads={canAll || canOwn} renderedAt={t} initialMonth={istDay(now).slice(0, 7)} />
    </>
  );
}
