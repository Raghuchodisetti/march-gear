import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { Megaphone, Presentation } from "lucide-react";
import { INS_CAMPAIGN_TYPES } from "@/db/enums";
import { INS_CAMPAIGN_STATUS_LABEL, INS_CAMPAIGN_TYPE_LABEL, campaignDisplayStatus } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { CAMPAIGN_VIEWS, listInsCampaigns, oneOf, PAGE_SIZE, vendorLabel, vendorOptions, type CampaignView } from "@/server/admin/insurance-ops";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { LinkTabs, overdue, waitingLabel } from "@/components/admin/partner-ui";
import { CampaignPill, EmptyBox } from "@/components/admin/insurance/ops/kit";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Promotional campaigns" };

const BASE = "/admin/insurance/campaigns";
const TAB_LABEL: Record<CampaignView, string> = { pending: "Waiting for review", active: "Active", scheduled: "Scheduled", ended: "Ended", all: "All" };
const dayFmt = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const view = oneOf(CAMPAIGN_VIEWS, strParam(sp.view)) ?? "pending";
  const filters = { q: strParam(sp.q)?.slice(0, 80), vendor: strParam(sp.vendor), type: strParam(sp.type) };
  const [{ rows, total, page, counts }, vendors] = await Promise.all([listInsCampaigns(view, filters, pageParam(sp.page)), vendorOptions()]);
  const hasFilters = Object.values(filters).some(Boolean);
  const params = { ...filters, view: view === "pending" ? undefined : view };
  const now = new Date();

  return (
    <>
      <AdminHeader
        title="Promotional campaigns"
        description="Vendor promotions shown on the insurance pages once approved. They go live and end on their own dates. Paid ad placements are reviewed in Advertising."
        actions={
          <Link href="/admin/advertising" className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-ink/15 px-3.5 text-[13px] font-medium hover:border-ink">
            <Presentation aria-hidden className="size-4" /> Ad campaigns
          </Link>
        }
      />

      <LinkTabs active={view} items={CAMPAIGN_VIEWS.map((v) => ({ key: v, label: TAB_LABEL[v], count: counts[v], href: hrefWith(BASE, filters, { view: v === "pending" ? undefined : v }) }))} />

      <FilterForm resetHref={hrefWith(BASE, { view: params.view }, {})} hasFilters={hasFilters}>
        {params.view && <input type="hidden" name="view" value={params.view} />}
        <SearchInput value={filters.q} placeholder="Title, CMP-…, vendor" />
        <FilterSelect name="vendor" label="All vendors" value={filters.vendor} options={vendors} />
        <FilterSelect name="type" label="Any type" value={filters.type} options={INS_CAMPAIGN_TYPES.map((t) => ({ value: t, label: INS_CAMPAIGN_TYPE_LABEL[t] }))} />
      </FilterForm>

      {rows.length === 0 ? (
        <EmptyBox icon={<Megaphone aria-hidden className="size-5" />} title={view === "pending" && !hasFilters ? "No campaigns waiting for review" : "No campaigns match"}>
          {view === "pending" && !hasFilters ? "Campaigns vendors submit for approval appear here, oldest first." : "Try another tab, vendor or search."}
        </EmptyBox>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map(({ c, ...v }) => {
            const shown = campaignDisplayStatus(c, now);
            const pending = c.status === "pending_approval";
            const willBe = campaignDisplayStatus({ ...c, status: "approved" }, now);
            return (
              <Link key={c.id} href={`${BASE}/${c.id}`} className="group flex min-w-0 flex-col overflow-hidden border border-line bg-white transition-colors hover:border-ink/40">
                <span className="relative block aspect-[3/1] overflow-hidden bg-mist">
                  {c.banner ? (
                    // Vendor-uploaded media — plain <img> on purpose.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img decoding="async" src={c.banner} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
                  ) : (
                    <span className="flex size-full flex-col items-center justify-center gap-1 text-[12px] text-muted">
                      <Megaphone aria-hidden className="size-6" /> No banner
                    </span>
                  )}
                  <span className="absolute left-3 top-3">
                    <CampaignPill status={shown} />
                  </span>
                </span>
                <span className="flex flex-1 flex-col p-4">
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">{INS_CAMPAIGN_TYPE_LABEL[c.type]}</span>
                  <span className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-red">{c.title}</span>
                  <span className="mt-1 truncate text-[12.5px] text-muted">
                    {vendorLabel(v)} · <span className="num">{c.reference}</span>
                  </span>
                  <span className="mt-2 line-clamp-2 text-[12.5px]">{c.summary}</span>
                  <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-[12px]">
                    <span className="text-muted">
                      {dayFmt(c.startsAt)} – {dayFmt(c.endsAt)} · {c.productIds.length} product{c.productIds.length === 1 ? "" : "s"}
                    </span>
                    {pending ? (
                      <span className={cn(overdue(c.submittedAt, now.getTime()) ? "font-semibold text-red" : "text-muted")}>
                        Waiting {waitingLabel(c.submittedAt ?? c.createdAt, now.getTime())} · {c.endsAt < now ? "already ended" : `would be ${INS_CAMPAIGN_STATUS_LABEL[willBe].toLowerCase()}`}
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
      <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}
