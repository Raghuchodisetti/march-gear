import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Megaphone, Plus } from "lucide-react";
import { requireInsurer } from "@/server/insurance/context";
import { campaignSlotsUsed, getInsPlans } from "@/server/insurance/subscription";
import { PortalHeader, StatCard, strParam } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { insPlanName } from "@/components/insurance/vendor/billing/shared";
import { CampaignList } from "@/components/insurance/vendor/campaigns/campaign-list";
import { listCampaigns } from "./_lib/data";

export const metadata: Metadata = { title: "Campaigns" };

const DAY = 86_400_000;

export default async function Page({ searchParams }: PageProps<"/insurance-vendor/campaigns">) {
  const ctx = await requireInsurer({ perm: "campaigns.manage" });
  const sp = await searchParams;
  const now = new Date();
  const [items, used, plans] = await Promise.all([listCampaigns(ctx.vendor.id, now), campaignSlotsUsed(ctx.vendor.id), getInsPlans()]);
  const limit = plans.find((p) => p.id === ctx.vendor.plan)?.limits.activeCampaigns ?? null;
  const live = items.filter((i) => i.display === "active");
  const ending = live.filter((i) => new Date(i.endsAt).getTime() - now.getTime() < 7 * DAY);
  const review = items.filter((i) => i.display === "pending_approval").length;
  const changes = items.filter((i) => i.display === "changes_requested").length;
  const views = items.reduce((s, i) => s + i.views, 0);
  const clicks = items.reduce((s, i) => s + i.clicks, 0);
  const enquiries = items.reduce((s, i) => s + i.enquiries, 0);
  const canAds = ctx.can("ads.manage");

  return (
    <>
      <PortalHeader
        title="Campaigns"
        description="Promotional campaigns for your products, shown on MarchGear's insurance pages once approved. They go live on their start date and end on their own."
        actions={
          <>
            {canAds && (
              <Button href="/insurance-vendor/advertising" variant="outline" size="sm" icon={<Megaphone className="size-4" aria-hidden />}>
                Paid advertising
              </Button>
            )}
            <Button href="/insurance-vendor/campaigns/new" size="sm" icon={<Plus className="size-4" aria-hidden />}>
              New campaign
            </Button>
          </>
        }
      />

      {items.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Live now" value={live.length} note={ending.length ? `${ending.length} ending within 7 days` : `${items.filter((i) => i.display === "scheduled").length} scheduled`} />
          <StatCard label="In review" value={review} note={changes ? `${changes} need changes` : "With MarchGear"} tone={changes ? "red" : undefined} />
          <StatCard label="Views · clicks" value={`${views.toLocaleString("en-IN")} · ${clicks.toLocaleString("en-IN")}`} note={views ? `${((clicks / views) * 100).toFixed(1)}% click-through` : "From the insurance pages"} />
          <StatCard
            label="Plan slots"
            value={limit === null ? `${used}` : `${used} / ${limit}`}
            note={limit === null ? `Unlimited on ${insPlanName(plans, ctx.vendor.plan)}` : used >= limit ? "All slots in use" : `${limit - used} free on ${insPlanName(plans, ctx.vendor.plan)}`}
            tone={limit !== null && used >= limit ? "red" : undefined}
          />
        </div>
      )}

      <CampaignList items={items} canManage={ctx.can("campaigns.manage")} initial={{ status: strParam(sp.status), q: strParam(sp.q), type: strParam(sp.type), view: strParam(sp.view) }} />

      <div className="mt-10 grid gap-4 border border-line bg-white p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-6">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">Campaigns or paid advertising?</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
            Campaigns are free promotions included in your plan ({limit === null ? "unlimited" : `${limit} at a time`}) — {enquiries.toLocaleString("en-IN")} enquir{enquiries === 1 ? "y" : "ies"} so far. Paid
            placements — homepage and insurance banners, sponsored listings — are booked and invoiced separately in Advertising.
          </p>
        </div>
        {canAds ? (
          <Link href="/insurance-vendor/advertising" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium hover:text-red">
            Go to advertising <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <p className="text-[12.5px] text-muted">Ask someone with advertising access to book placements.</p>
        )}
      </div>
    </>
  );
}
