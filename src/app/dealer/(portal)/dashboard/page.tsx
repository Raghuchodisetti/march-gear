import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CalendarRange, CarFront, CheckCircle2, Clock3, ExternalLink, Eye, Inbox, Megaphone, ShieldAlert, Sparkles, Timer } from "lucide-react";
import { CRM_STATUS_LABEL, CRM_STATUS_TONE, LEAD_SOURCE_LABEL, OFFER_STATUS_LABEL, OFFER_STATUS_TONE, VEHICLE_STATUS_LABEL, VEHICLE_STATUS_TONE, type OfferDisplayStatus } from "@/partner/labels";
import type { LeadSource, PartnerVehicleStatus } from "@/db/enums";
import { cn } from "@/lib/utils";
import { requirePartner } from "@/server/partner/context";
import { getDashboard } from "@/server/partner/dashboard";
import { Badge, PortalHeader, formatDay } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { EnquiryChart } from "@/components/portal/dashboard/enquiry-chart";
import { Card, CardLink, Delta, Dot, Metric, MiniStat, PendingList, Quiet, SetupSteps, relTime } from "@/components/portal/dashboard/sections";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(now: Date) {
  const h = Number(now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage(props: PageProps<"/dealer/dashboard">) {
  // No `perm` here: the permission redirect lands on this page, so it must never loop.
  const ctx = await requirePartner();
  const sp = await props.searchParams;
  const denied = sp.denied === "1";
  const now = new Date();
  const first = ctx.user.name.split(" ")[0];
  const name = ctx.partner.tradeName || ctx.partner.legalName || "your dealership";

  if (!ctx.can("dashboard.view")) {
    return (
      <>
        <PortalHeader title={`${greeting(now)}, ${first}`} description={`You're signed in to ${name}.`} />
        {denied && <DeniedNote />}
        <Card title="Your workspace">
          <p className="text-[13.5px] text-muted">The dashboard isn&apos;t part of your access. Use the menu to open the sections your administrator has given you.</p>
        </Card>
      </>
    );
  }

  const range = sp.range === "30" ? 30 : 14;
  const d = await getDashboard(ctx, range);
  const { kpi, show } = d;
  const setupOpen = d.setup.some((s) => !s.done);
  const own = d.scope === "own";
  const rangeLabel = `vs previous ${range} days`;

  const metrics = [
    show.leads && (
      <Metric
        key="enq"
        label={own ? "Your enquiries" : "Total enquiries"}
        value={kpi.totalEnquiries.toLocaleString("en-IN")}
        href="/dealer/enquiries"
        accent={kpi.newEnquiries ? <Badge tone="red">{kpi.newEnquiries} new</Badge> : undefined}
        note={<Delta now={kpi.periodEnquiries} before={kpi.previousEnquiries} label={rangeLabel} />}
      />
    ),
    show.leads && (
      <Metric
        key="conv"
        label="Lead conversion"
        value={kpi.conversion === null ? "—" : `${kpi.conversion}%`}
        note={kpi.totalEnquiries ? `${kpi.won} of ${kpi.totalEnquiries} booked or converted` : "Shown once enquiries arrive"}
      />
    ),
    <Metric
      key="views"
      label="Profile views"
      value={kpi.profileViews.toLocaleString("en-IN")}
      href={ctx.can("analytics.view") ? "/dealer/analytics" : undefined}
      note={<Delta now={kpi.profileViews} before={kpi.previousProfileViews} label={rangeLabel} />}
    />,
    show.testDrives && (
      <Metric
        key="td"
        label="Test-drive requests"
        value={kpi.testDriveRequests}
        href="/dealer/test-drives?status=requested"
        accent={kpi.testDriveRequests ? <span aria-hidden className="size-2 animate-pulse rounded-full bg-red [animation-duration:2.4s]" /> : undefined}
        note={kpi.testDriveRequests ? "Waiting for your confirmation" : "No requests waiting"}
      />
    ),
  ].filter(Boolean);

  const minis = [
    show.inventory && <MiniStat key="live" icon={<CarFront className="size-4" />} label="Active listings" value={kpi.activeListings} href="/dealer/inventory?status=published" />,
    show.inventory && <MiniStat key="pv" icon={<Clock3 className="size-4" />} label="Vehicles in approval" value={kpi.pendingVehicles} href="/dealer/inventory?status=pending_approval" />,
    show.offers && <MiniStat key="ao" icon={<Sparkles className="size-4" />} label="Active offers" value={kpi.activeOffers} href="/dealer/offers" />,
    show.offers && <MiniStat key="po" icon={<Timer className="size-4" />} label="Offers in approval" value={kpi.pendingOffers} href="/dealer/offers?status=pending_approval" />,
    show.offers && (
      <MiniStat
        key="camp"
        icon={<Megaphone className="size-4" />}
        label="Campaign performance"
        value={kpi.campaign.enquiries.toLocaleString("en-IN")}
        note={kpi.campaign.offers ? `enquiries · ${kpi.campaign.conversions} won` : "no campaigns yet"}
        title={kpi.campaign.offers ? `${kpi.campaign.offers} campaigns: ${kpi.campaign.views.toLocaleString("en-IN")} views, ${kpi.campaign.enquiries} enquiries, ${kpi.campaign.conversions} conversions` : undefined}
        href="/dealer/campaigns"
      />
    ),
  ].filter(Boolean);

  return (
    <>
      <PortalHeader
        title={`${greeting(now)}, ${first}`}
        description={own ? `Your enquiries and test drives at ${name}.` : `Here's how ${name} is doing.`}
        actions={
          <>
            <nav aria-label="Period" className="inline-flex rounded-[3px] bg-white p-1 ring-1 ring-line">
              {[14, 30].map((r) => (
                <Link
                  key={r}
                  href={r === 14 ? "/dealer/dashboard" : "/dealer/dashboard?range=30"}
                  aria-current={range === r ? "page" : undefined}
                  className={cn("inline-flex h-7 items-center rounded-[2px] px-3 text-[12.5px] font-medium transition-colors duration-300", range === r ? "bg-ink text-white" : "text-muted hover:text-ink")}
                >
                  {r} days
                </Link>
              ))}
            </nav>
            {ctx.partner.publicDealerId && (
              <Button href={`/dealers/${ctx.partner.publicDealerId}`} target="_blank" variant="outline" size="sm" icon={<ExternalLink className="size-4" aria-hidden />}>
                Public page
              </Button>
            )}
          </>
        }
      />

      {denied && <DeniedNote />}

      <div className="space-y-6">
        {setupOpen && <SetupSteps steps={d.setup} />}

        <section aria-label="Key figures" className="flex flex-wrap gap-px overflow-hidden border border-line bg-line">
          {metrics}
        </section>

        {minis.length > 0 && <section aria-label="Inventory and offers" className="flex flex-wrap gap-px overflow-hidden border border-line bg-line">{minis}</section>}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            {show.leads && (
              <Card
                title="Enquiry analytics"
                subtitle={`${kpi.periodEnquiries} ${kpi.periodEnquiries === 1 ? "enquiry" : "enquiries"} in the last ${range} days${own ? " assigned to you" : ""}`}
                action={ctx.can("analytics.view") ? <CardLink href="/dealer/analytics">Full analytics</CardLink> : undefined}
              >
                <EnquiryChart series={d.series} />
              </Card>
            )}

            {show.leads && (
              <Card title="Recent customer enquiries" subtitle={own ? "Assigned to you" : "Newest first"} action={<CardLink href="/dealer/enquiries">All enquiries</CardLink>} bodyClass="px-0 pb-2 md:px-0">
                {d.recentLeads.length ? (
                  <ul className="divide-y divide-line border-t border-line">
                    {d.recentLeads.map((l) => (
                      <li key={l.id}>
                        <Link href={`/dealer/enquiries?lead=${l.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors duration-300 hover:bg-mist/50 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_96px] md:px-6">
                          <span className="min-w-0">
                            <span className="block truncate text-[13.5px] font-medium text-ink">{l.name}</span>
                            <span className="block truncate text-[12px] text-muted">
                              <span className="num">{l.reference}</span> · {LEAD_SOURCE_LABEL[l.source as LeadSource] ?? l.source}
                            </span>
                          </span>
                          <span className="order-3 col-span-2 truncate text-[12.5px] text-muted md:order-none md:col-span-1">{l.carLabel || "General enquiry"}{l.assignee && !own ? ` · ${l.assignee}` : ""}</span>
                          <span className="justify-self-end md:justify-self-start">
                            <Badge tone={CRM_STATUS_TONE[l.status]}>{CRM_STATUS_LABEL[l.status]}</Badge>
                          </span>
                          <span className="hidden text-right text-[12px] text-muted md:block">{relTime(l.createdAt, now)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Quiet icon={<Inbox className="size-4" />} title={own ? "No enquiries assigned to you yet" : "No enquiries yet"}>
                    {own ? "When a manager assigns an enquiry to you, it shows up here." : "Customer enquiries from your vehicle listings, offers and dealer page will appear here."}
                  </Quiet>
                )}
              </Card>
            )}

            {show.inventory && (
              <Card title="Vehicle performance" subtitle="Top listings by views" action={<CardLink href="/dealer/inventory">Inventory</CardLink>}>
                {d.topVehicles.length ? (
                  <VehicleBars vehicles={d.topVehicles} />
                ) : (
                  <Quiet
                    icon={<CarFront className="size-4" />}
                    title="No live vehicles yet"
                    action={ctx.can("inventory.manage") ? <Button href="/dealer/inventory/add" size="sm" variant="dark">Add a vehicle</Button> : undefined}
                  >
                    Published listings appear here with their views and enquiries.
                  </Quiet>
                )}
              </Card>
            )}
          </div>

          <aside className="min-w-0 space-y-6">
            <Card title="Pending actions" subtitle={d.pending.length ? "Things that need you" : undefined}>
              {d.pending.length ? (
                <PendingList items={d.pending} />
              ) : (
                <Quiet icon={<CheckCircle2 className="size-4" />} title="You're all caught up">
                  Changes requested by MarchGear, expiring certificates, overdue follow-ups and due invoices will show here.
                </Quiet>
              )}
            </Card>

            {show.offers && (
              <Card title="Upcoming campaigns" subtitle="Scheduled and running offers" action={<CardLink href="/dealer/campaigns">Campaigns</CardLink>}>
                {d.campaigns.length ? (
                  <ul className="space-y-4">
                    {d.campaigns.map((c) => (
                      <li key={c.id}>
                        <Link href={`/dealer/offers?q=${encodeURIComponent(c.reference)}`} className="group flex gap-3">
                          <span className="inline-flex size-10 shrink-0 flex-col items-center justify-center border border-line text-center leading-none">
                            <span className="text-[14px] font-semibold num">{c.startsAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric" })}</span>
                            <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">{c.startsAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short" })}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium text-ink group-hover:text-red">{c.title}</span>
                            <span className="block truncate text-[12px] text-muted">
                              {formatDay(c.startsAt)} – {formatDay(c.endsAt)}
                            </span>
                          </span>
                          <Badge tone={OFFER_STATUS_TONE[c.status as OfferDisplayStatus]}>{OFFER_STATUS_LABEL[c.status as OfferDisplayStatus]}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Quiet
                    icon={<CalendarRange className="size-4" />}
                    title="Nothing scheduled"
                    action={ctx.can("offers.manage") ? <Button href="/dealer/offers/create" size="sm" variant="outline">Plan an offer</Button> : undefined}
                  >
                    Approved offers with a future start date line up here.
                  </Quiet>
                )}
              </Card>
            )}

            <Card title="Notifications" action={<CardLink href="/dealer/notifications">View all</CardLink>}>
              {d.notifications.length ? (
                <ul className="space-y-3.5">
                  {d.notifications.map((n) => (
                    <li key={n.id} className="flex gap-3">
                      <Dot unread={!n.readAt} />
                      <div className="min-w-0 flex-1">
                        {n.href?.startsWith("/") && !n.href.startsWith("//") ? (
                          <Link href={n.href} className="block text-[13px] font-medium leading-snug text-ink hover:text-red">
                            {n.title}
                          </Link>
                        ) : (
                          <p className="text-[13px] font-medium leading-snug text-ink">{n.title}</p>
                        )}
                        <p className="mt-0.5 text-[11.5px] text-muted">{relTime(n.createdAt, now)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Quiet icon={<BellRing className="size-4" />} title="No notifications yet">
                  Approval decisions and updates from MarchGear arrive here.
                </Quiet>
              )}
            </Card>

            <Card title="Recent activity" subtitle={ctx.can("staff.manage") || ctx.can("settings.manage") ? "Everyone at your dealership" : "Your actions"} action={<CardLink href="/dealer/settings?tab=activity">Activity log</CardLink>}>
              {d.activity.length ? (
                <ol className="relative space-y-4 before:absolute before:bottom-1 before:left-[3px] before:top-1 before:w-px before:bg-line">
                  {d.activity.map((a) => (
                    <li key={a.id} className="relative flex gap-3 pl-0">
                      <span aria-hidden className="relative z-[1] mt-[6px] size-[7px] shrink-0 rounded-full border border-ink/30 bg-white" />
                      <div className="min-w-0">
                        <p className="text-[13px] leading-snug text-ink">{a.summary}</p>
                        <p className="mt-0.5 text-[11.5px] text-muted">
                          {a.who ?? "System"} · {relTime(a.createdAt, now)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <Quiet icon={<Eye className="size-4" />} title="No activity yet">
                  Everything your team does in the portal is recorded here.
                </Quiet>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}

function DeniedNote() {
  return (
    <div role="status" className="mb-6 flex items-start gap-3 border border-line border-l-2 border-l-red bg-white px-4 py-3 text-[13.5px]">
      <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
      <p>
        You don&apos;t have access to that page. Ask your dealership&apos;s owner or administrator if you need it.
      </p>
    </div>
  );
}

function VehicleBars({ vehicles }: { vehicles: { id: number; reference: string; title: string; kind: "new" | "used"; status: string; views: number; enquiries: number; image: string | null }[] }) {
  const max = Math.max(1, ...vehicles.map((v) => v.views));
  return (
    <ul className="space-y-4">
      {vehicles.map((v) => (
        <li key={v.id}>
          <Link href={`/dealer/inventory?q=${encodeURIComponent(v.reference)}`} className="group grid grid-cols-[56px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[64px_minmax(0,1fr)_150px]">
            <span className="block aspect-[4/3] overflow-hidden bg-mist">
              {/* Dealer-uploaded listing photo from /media. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.image ? <img src={v.image} alt="" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <CarFront aria-hidden className="m-auto mt-3 size-5 text-muted" />}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-medium text-ink group-hover:text-red">{v.title}</span>
                <Badge tone={VEHICLE_STATUS_TONE[v.status as PartnerVehicleStatus]}>{VEHICLE_STATUS_LABEL[v.status as PartnerVehicleStatus]}</Badge>
              </span>
              <span className="mt-2 block h-1 overflow-hidden rounded-full bg-mist">
                <span className="block h-full rounded-full bg-ink/80" style={{ width: `${(v.views / max) * 100}%` }} />
              </span>
            </span>
            <span className="col-start-2 flex gap-5 text-[12px] text-muted sm:col-start-3 sm:justify-end">
              <span>
                <span className="font-semibold text-ink num">{v.views.toLocaleString("en-IN")}</span> views
              </span>
              <span>
                <span className="font-semibold text-ink num">{v.enquiries}</span> enquiries
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
