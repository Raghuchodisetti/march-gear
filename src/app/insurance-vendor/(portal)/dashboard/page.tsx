import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarClock, CheckCircle2, Eye, FilePlus2, Inbox, Megaphone, MonitorPlay, Package, ShieldAlert, ShieldPlus, Sparkles, Wallet } from "lucide-react";
import { INS_VENDOR_CATEGORY_SHORT } from "@/insurance/labels";
import { requireInsurer, vendorName } from "@/server/insurance/context";
import { getInsDashboard } from "@/server/insurance/dashboard";
import { Badge, PortalHeader } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Card, CardLink, Delta, Metric, MiniStat, PendingList, Quiet, relTime } from "@/components/portal/dashboard/sections";
import { ChartStyles, Funnel } from "@/components/portal/analytics/charts";
import { MonthBars } from "@/components/insurance/vendor/dashboard/month-bars";
import { CampaignTable, Conversions, FollowUpList, InsSetupSteps, ProductPerformance, QuickActions } from "@/components/insurance/vendor/dashboard/sections";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(now: Date) {
  const h = Number(now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage(props: PageProps<"/insurance-vendor/dashboard">) {
  // No `perm` here: the permission redirect lands on this page, so it must never loop.
  const ctx = await requireInsurer({ next: "/insurance-vendor/dashboard" });
  const sp = await props.searchParams;
  const denied = sp.denied === "1";
  const now = new Date();
  const first = ctx.user.name.split(" ")[0];
  const name = vendorName(ctx.vendor);

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

  const d = await getInsDashboard(ctx);
  const { kpi, show } = d;
  const own = d.scope === "own";
  const setupOpen = d.setup.some((s) => !s.done);
  const manage = ctx.can("products.manage");
  const enquiriesHref = "/insurance-vendor/enquiries";

  const actions = [
    manage && { href: "/insurance-vendor/products/create", label: "Add a product", icon: <FilePlus2 className="size-4" /> },
    manage && { href: "/insurance-vendor/add-ons", label: "Add-on covers", icon: <Sparkles className="size-4" /> },
    show.enquiries && { href: enquiriesHref, label: own ? "My enquiries" : "Enquiries", icon: <Inbox className="size-4" /> },
    show.renewals && { href: "/insurance-vendor/renewals", label: "Renewals", icon: <CalendarClock className="size-4" /> },
    ctx.can("campaigns.manage") && { href: "/insurance-vendor/campaigns", label: "Campaigns", icon: <Megaphone className="size-4" /> },
    ctx.can("ads.manage") && { href: "/insurance-vendor/advertising", label: "Advertising", icon: <MonitorPlay className="size-4" /> },
    show.analytics && { href: "/insurance-vendor/analytics", label: "Analytics", icon: <BarChart3 className="size-4" /> },
  ].filter((a): a is { href: string; label: string; icon: React.JSX.Element } => Boolean(a)).slice(0, 6);

  const camp = d.campaign30;

  return (
    <>
      <ChartStyles />
      <PortalHeader
        title={`${greeting(now)}, ${first}`}
        description={own ? `Your enquiries and follow-ups at ${name}.` : `Here's how ${name} is doing on MarchGear.`}
        actions={
          <span className="inline-flex items-center gap-2 text-[12.5px] text-muted">
            {ctx.vendor.category && <Badge tone="neutral">{INS_VENDOR_CATEGORY_SHORT[ctx.vendor.category]}</Badge>}
            <span>
              {d.usage.planName} plan · <span className="num">{d.usage.published}</span>
              {d.usage.limit !== null ? ` / ${d.usage.limit}` : ""} live products
            </span>
          </span>
        }
      />

      {denied && <DeniedNote />}

      <div className="space-y-6">
        {setupOpen && d.setup.length > 0 && <InsSetupSteps steps={d.setup} />}

        <QuickActions items={actions} />

        {show.products && (
          <section aria-label="Products" className="flex flex-wrap gap-px overflow-hidden border border-line bg-line">
            <Metric label="Insurance products" value={kpi.products} href="/insurance-vendor/products" note={kpi.attentionProducts ? <span className="text-[#9a5b00]">{kpi.attentionProducts} sent back for changes</span> : "All your products, any status"} />
            <Metric label="Active (published)" value={kpi.published} href="/insurance-vendor/products?tab=live" note={d.usage.limit !== null ? `${Math.max(0, d.usage.limit - d.usage.published)} more allowed on ${d.usage.planName}` : "Unlimited on your plan"} />
            <Metric
              label="Pending product approvals"
              value={kpi.pendingProducts}
              href="/insurance-vendor/approvals"
              accent={kpi.pendingProducts ? <span aria-hidden className="size-2 animate-pulse rounded-full bg-[#2456a6] [animation-duration:2.4s]" /> : undefined}
              note={kpi.pendingProducts ? "With the MarchGear team" : "Nothing waiting"}
            />
          </section>
        )}

        {show.enquiries && (
          <section aria-label="Enquiries" className="flex flex-wrap gap-px overflow-hidden border border-line bg-line">
            <MiniStat icon={<Inbox className="size-4" />} label={own ? "Your enquiries" : "Customer enquiries"} value={kpi.enquiries.toLocaleString("en-IN")} note={<Delta now={kpi.enquiries30} before={kpi.enquiriesPrev} label="vs prior 30 days" />} href={enquiriesHref} />
            <MiniStat icon={<Sparkles className="size-4" />} label="New enquiries" value={kpi.newLeads} note={kpi.newLeads ? "not yet contacted" : "all picked up"} href={`${enquiriesHref}?status=new`} />
            <MiniStat icon={<FilePlus2 className="size-4" />} label="Quotes submitted" value={kpi.quotesSubmitted.toLocaleString("en-IN")} note="sent to customers" href={ctx.can("quotes.manage") ? "/insurance-vendor/quotes" : undefined} />
            <MiniStat icon={<CalendarClock className="size-4" />} label="Renewal enquiries" value={kpi.renewalEnquiries.toLocaleString("en-IN")} note="from customers" href={show.renewals ? "/insurance-vendor/renewals" : undefined} />
          </section>
        )}

        {(show.campaigns || show.ads) && camp && (
          <section aria-label="Campaigns, last 30 days" className="flex flex-wrap gap-px overflow-hidden border border-line bg-line">
            <MiniStat icon={<Megaphone className="size-4" />} label="Campaign views · 30 days" value={camp.views.toLocaleString("en-IN")} note={`${camp.clicks.toLocaleString("en-IN")} clicks`} href={ctx.can("campaigns.manage") ? "/insurance-vendor/campaigns" : undefined} />
            <MiniStat icon={<Inbox className="size-4" />} label="Campaign enquiries · 30 days" value={camp.enquiries.toLocaleString("en-IN")} note="attributed" />
            <MiniStat icon={<MonitorPlay className="size-4" />} label="Ad impressions · 30 days" value={camp.adImpressions.toLocaleString("en-IN")} note={`${camp.adClicks.toLocaleString("en-IN")} clicks`} href={ctx.can("ads.manage") ? "/insurance-vendor/advertising" : undefined} />
            <MiniStat icon={<Eye className="size-4" />} label="Ad click-through" value={camp.adImpressions ? `${((camp.adClicks / camp.adImpressions) * 100).toFixed(1)}%` : "—"} note={`${camp.adEnquiries} enquiries`} />
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            {show.enquiries && (
              <Card
                title="Monthly enquiries"
                subtitle={`${d.monthly.reduce((s, m) => s + m.value, 0).toLocaleString("en-IN")} in the last 12 months${own ? " assigned to you" : ""}`}
                action={show.analytics ? <CardLink href="/insurance-vendor/analytics">Analytics</CardLink> : undefined}
              >
                <MonthBars
                  points={d.monthly.map((m) => ({ key: m.key, label: m.label, year: m.year, values: [m.value] }))}
                  names={["Enquiries"]}
                  caption="Enquiries per month"
                  empty="No enquiries yet. They arrive when customers ask for quotes on your published products."
                />
              </Card>
            )}

            {show.enquiries && (
              <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
                <Card title="Enquiry conversion" subtitle="Enquiries from the last 12 months, by how far they got">
                  {d.funnel[0].value ? (
                    <Funnel stages={d.funnel} />
                  ) : (
                    <Quiet icon={<Inbox className="size-4" />} title="No enquiries yet">
                      Quotes, interested customers and issued policies show here as stages.
                    </Quiet>
                  )}
                </Card>
                <Card title="Policy conversions" subtitle="Reported by your team vs verified by MarchGear — kept apart">
                  <Conversions reported={kpi.reported} verified={kpi.verified} enquiries={kpi.enquiries} />
                  <p className="mt-3 text-[12px] leading-relaxed text-muted">Mark an enquiry &ldquo;Policy issued&rdquo; with the policy number; MarchGear verifies it against your evidence.</p>
                </Card>
              </div>
            )}

            {show.products && (
              <Card title="Product performance" subtitle="Views and enquiries per product" action={<CardLink href="/insurance-vendor/products">Products</CardLink>}>
                {d.productPerf.length ? (
                  <ProductPerformance rows={d.productPerf} />
                ) : (
                  <Quiet
                    icon={<Package className="size-4" />}
                    title="No products in review or live yet"
                    action={manage ? <Button href="/insurance-vendor/products/create" size="sm" variant="dark">Create a product</Button> : undefined}
                  >
                    Submitted, approved and published products appear here with their views and enquiries.
                  </Quiet>
                )}
              </Card>
            )}

            {(show.campaigns || show.ads) && (
              <Card title="Campaign performance" subtitle="Promotional campaigns and advertising, all time" action={ctx.can("campaigns.manage") ? <CardLink href="/insurance-vendor/campaigns">Campaigns</CardLink> : undefined}>
                {d.campaigns.length ? (
                  <CampaignTable rows={d.campaigns} />
                ) : (
                  <Quiet
                    icon={<Megaphone className="size-4" />}
                    title="No campaigns yet"
                    action={ctx.can("campaigns.manage") ? <Button href="/insurance-vendor/campaigns" size="sm" variant="outline">Plan a campaign</Button> : undefined}
                  >
                    Views, clicks and enquiries from your promotions and ads show here once they run.
                  </Quiet>
                )}
              </Card>
            )}

            {show.spend && (
              <Card title="Advertising spend" subtitle="Advertising invoices by month, incl. GST — invoiced vs paid" action={ctx.can("billing.manage") ? <CardLink href="/insurance-vendor/invoices">Invoices</CardLink> : undefined}>
                <MonthBars
                  points={d.adSpend.map((m) => ({ key: m.key, label: m.label, year: m.year, values: [m.invoiced, m.paid] }))}
                  names={["Invoiced", "Paid"]}
                  money
                  caption="Advertising invoiced and paid per month"
                  empty="No advertising invoices yet. Booking an ad placement raises one when MarchGear approves it."
                />
              </Card>
            )}
          </div>

          <aside className="min-w-0 space-y-6">
            <Card title="Follow-ups due today" subtitle={d.followUps.length ? `${d.followUps.filter((f) => f.overdue).length} overdue` : undefined}>
              {d.followUps.length ? (
                <FollowUpList items={d.followUps} now={now} />
              ) : (
                <Quiet icon={<CalendarClock className="size-4" />} title="Nothing due today">
                  Follow-up reminders you set on enquiries and renewals show here on the day.
                </Quiet>
              )}
            </Card>

            <Card title="Pending actions" subtitle={d.pending.length ? "Things that need you" : undefined}>
              {d.pending.length ? (
                <PendingList items={d.pending} />
              ) : (
                <Quiet icon={<CheckCircle2 className="size-4" />} title="You're all caught up">
                  Changes requested by MarchGear, waiting enquiries and due invoices show here.
                </Quiet>
              )}
            </Card>

            <Card title="Recent activity" subtitle={ctx.can("team.manage") || ctx.can("settings.manage") ? "Everyone at your company" : "Your actions"} action={<CardLink href="/insurance-vendor/settings?tab=activity">Activity log</CardLink>}>
              {d.activity.length ? (
                <ol className="relative space-y-4 before:absolute before:bottom-1 before:left-[3px] before:top-1 before:w-px before:bg-line">
                  {d.activity.map((a) => (
                    <li key={a.id} className="relative flex gap-3">
                      <span aria-hidden className="relative z-[1] mt-[6px] size-[7px] shrink-0 rounded-full border border-ink/30 bg-white" />
                      <div className="min-w-0">
                        <p className="break-words text-[13px] leading-snug text-ink">{a.summary}</p>
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

            {ctx.can("billing.manage") && (
              <Link href="/insurance-vendor/billing" className="group flex items-center gap-3 border border-line bg-white px-5 py-4 transition-colors hover:border-ink/30">
                <Wallet aria-hidden className="size-4 text-muted" />
                <span className="min-w-0 flex-1 text-[13px]">
                  <span className="font-medium">{d.usage.planName} plan</span>
                  <span className="block text-[12px] text-muted">Plans, invoices and payments</span>
                </span>
                <ShieldPlus aria-hidden className="size-4 text-muted transition-colors group-hover:text-red" />
              </Link>
            )}
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
      <p>You don&apos;t have access to that page. Ask your company&apos;s owner or administrator if you need it.</p>
    </div>
  );
}
