import type { Metadata } from "next";
import { BadgePercent } from "lucide-react";
import { OFFER_CATEGORY_LABEL } from "@/partner/labels";
import { CAMPAIGN_VIEWS, listCampaigns } from "@/server/admin/partners";
import { requireStaff } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { AdminHeader, FilterForm, SearchInput, StatCard, hrefWith, strParam } from "@/components/admin/ui";
import { CampaignBoard } from "@/components/admin/partner-review";
import { LinkTabs } from "@/components/admin/partner-ui";

export const metadata: Metadata = { title: "Campaign management" };

const LABEL = { active: "Active", scheduled: "Scheduled", paused: "Paused", expired: "Expired" } as const;

export default async function CampaignsPage({ searchParams }: PageProps<"/admin/campaign-management">) {
  await requireStaff();
  const sp = await searchParams;
  const show = (CAMPAIGN_VIEWS as readonly string[]).includes(String(sp.show)) ? (sp.show as (typeof CAMPAIGN_VIEWS)[number]) : undefined;
  const q = strParam(sp.q);
  const { rows, totals, live, perf, now } = await listCampaigns({ show, q });
  const base = "/admin/campaign-management";
  const rate = perf.enquiries ? `${((perf.conversions / perf.enquiries) * 100).toFixed(1)}%` : "—";

  return (
    <>
      <AdminHeader
        title="Campaign management"
        description="Every approved dealer campaign — live, scheduled, paused and ended. Pause, resume, extend or cancel them here."
        actions={
          <Button href="/admin/offer-approvals" variant="outline" size="sm" icon={<BadgePercent className="size-4" aria-hidden />}>
            Offer approvals
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active now" value={totals.active} note={live === totals.active ? "Live on the website" : `${live} live · ${totals.active - live} hidden (dealer not approved)`} href={hrefWith(base, { q }, { show: "active" })} />
        <StatCard label="Scheduled" value={totals.scheduled} note="Approved, starting later" href={hrefWith(base, { q }, { show: "scheduled" })} />
        <StatCard label="Paused" value={totals.paused} note="Hidden until resumed" href={hrefWith(base, { q }, { show: "paused" })} tone={totals.paused ? "red" : undefined} />
        <StatCard label="Conversion rate" value={rate} note={`${perf.views.toLocaleString("en-IN")} views · ${perf.enquiries.toLocaleString("en-IN")} enquiries · ${perf.conversions.toLocaleString("en-IN")} won`} />
      </div>

      <LinkTabs
        className="mt-8"
        active={show ?? ""}
        items={[
          { key: "", label: "All", count: totals.active + totals.scheduled + totals.paused + totals.expired, href: hrefWith(base, { q }, {}) },
          ...CAMPAIGN_VIEWS.map((v) => ({ key: v, label: LABEL[v], count: totals[v], href: hrefWith(base, { q }, { show: v }) })),
        ]}
      />
      <FilterForm resetHref={hrefWith(base, { show }, {})} hasFilters={Boolean(q)}>
        {show && <input type="hidden" name="show" value={show} />}
        <SearchInput value={q} placeholder="Campaign, offer reference, dealer…" />
      </FilterForm>

      <CampaignBoard
        now={now}
        emptyText={q || show ? "No campaigns match." : "No approved campaigns yet. Approve offers in Offer approvals and they appear here."}
        rows={rows.map((r) => ({
          id: r.id,
          reference: r.reference,
          title: r.title,
          campaignName: r.campaignName,
          categoryLabel: OFFER_CATEGORY_LABEL[r.category as keyof typeof OFFER_CATEGORY_LABEL] ?? r.category,
          status: r.status,
          startsAt: r.startsAt.toISOString(),
          endsAt: r.endsAt.toISOString(),
          partnerId: r.partnerId,
          partnerName: r.partnerName ?? r.partnerRef,
          partnerStatus: r.partnerStatus,
          thumbnail: r.thumbnail,
          views: r.views,
          enquiries: r.enquiries,
          conversions: r.conversions,
        }))}
      />
    </>
  );
}
