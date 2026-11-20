import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import type { ReactNode } from "react";
import { CalendarClock, CircleCheck, Clock3, Info, MessageSquareWarning, PauseCircle, Send, ShieldCheck } from "lucide-react";
import { getDb } from "@/db";
import { insApprovals, insEnquiries, insEvents, insProducts, users } from "@/db/schema";
import { cn } from "@/lib/utils";
import { INS_CAMPAIGN_STATUS_LABEL, INS_CAMPAIGN_STATUS_TONE, INS_CAMPAIGN_TYPE_LABEL, INS_LEAD_STATUS_LABEL, INS_LEAD_STATUS_TONE, INS_PRODUCT_CATEGORY_LABEL, campaignDisplayStatus } from "@/insurance/labels";
import { requireInsurer, vendorName } from "@/server/insurance/context";
import { Badge, Panel, PortalHeader, formatDateTime } from "@/components/portal/ui";
import { Funnel, ChartStyles } from "@/components/portal/analytics/charts";
import { Callout } from "@/components/portal/offers/offer-ui";
import { addDays, durationDays, formatIst, formatWindow, istDay } from "@/components/offers/offer-utils";
import { CampaignPreview } from "@/components/insurance/vendor/campaigns/campaign-preview";
import { CampaignDetailActions } from "@/components/insurance/vendor/campaigns/campaign-actions";
import { CTA_DEFAULT } from "@/components/insurance/vendor/campaigns/shared";
import { getCampaignMetrics, getVendorCampaign } from "../_lib/data";

export const metadata: Metadata = { title: "Campaign" };

const ACTION_TEXT: Record<string, string> = {
  submitted: "Submitted for approval",
  resubmitted: "Resubmitted for approval",
  withdrawn: "Withdrawn to draft",
  approved: "Approved by MarchGear",
  rejected: "Rejected by MarchGear",
  changes_requested: "Changes requested",
  paused: "Paused",
  resumed: "Resumed",
  cancelled: "Cancelled",
  suspended: "Suspended by MarchGear",
};

export default async function Page({ params }: PageProps<"/insurance-vendor/campaigns/[id]">) {
  const ctx = await requireInsurer({ perm: "campaigns.manage" });
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const row = await getVendorCampaign(ctx.vendor.id, Number(id));
  if (!row) notFound();
  const db = getDb();
  const now = new Date();
  const display = campaignDisplayStatus(row, now);
  const canAll = ctx.can("enquiries.view_all");
  const canOwn = ctx.can("enquiries.view_own");
  // The chart covers the campaign's days so far (at least the last 14 days, at most the last 30), in IST.
  const today = istDay(now);
  const startDay = istDay(row.startsAt);
  const first = startDay < addDays(today, -29) ? addDays(today, -29) : startDay < addDays(today, -13) ? startDay : addDays(today, -13);
  const since = new Date(`${first}T00:00:00+05:30`);

  const [products, metrics, history, daily, enquiries] = await Promise.all([
    row.productIds.length
      ? db
          .select({ id: insProducts.id, name: insProducts.name, reference: insProducts.reference, category: insProducts.category, status: insProducts.status })
          .from(insProducts)
          .where(and(eq(insProducts.vendorId, ctx.vendor.id), inArray(insProducts.id, row.productIds)))
      : Promise.resolve([]),
    getCampaignMetrics(ctx.vendor.id, [row.id]).then((m) => m.get(row.id)!),
    db
      .select({ a: insApprovals, actor: users.name })
      .from(insApprovals)
      .leftJoin(users, eq(users.id, insApprovals.actorUserId))
      .where(and(eq(insApprovals.vendorId, ctx.vendor.id), eq(insApprovals.target, "campaign"), eq(insApprovals.targetId, row.id), ne(insApprovals.action, "internal_note")))
      .orderBy(desc(insApprovals.createdAt), desc(insApprovals.id))
      .limit(50),
    db
      .select({ day: sql<string>`DATE(DATE_ADD(${insEvents.createdAt}, INTERVAL 330 MINUTE))`, kind: insEvents.kind, n: count() })
      .from(insEvents)
      .where(and(eq(insEvents.vendorId, ctx.vendor.id), eq(insEvents.refId, row.id), inArray(insEvents.kind, ["campaign_view", "campaign_click"]), gte(insEvents.createdAt, since)))
      .groupBy(sql`DATE(DATE_ADD(${insEvents.createdAt}, INTERVAL 330 MINUTE))`, insEvents.kind),
    canAll || canOwn
      ? db
          .select({ id: insEnquiries.id, reference: insEnquiries.reference, name: insEnquiries.name, status: insEnquiries.status, createdAt: insEnquiries.createdAt, product: insProducts.name })
          .from(insEnquiries)
          .leftJoin(insProducts, eq(insProducts.id, insEnquiries.productId))
          .where(and(eq(insEnquiries.vendorId, ctx.vendor.id), eq(insEnquiries.campaignId, row.id), canAll ? undefined : eq(insEnquiries.assignedMemberId, ctx.member.id)))
          .orderBy(desc(insEnquiries.createdAt))
          .limit(10)
      : Promise.resolve(null),
  ]);

  const days: { day: string; views: number; clicks: number }[] = [];
  if (startDay <= today) for (let d = first; d <= today; d = addDays(d, 1)) days.push({ day: d, views: 0, clicks: 0 });
  for (const r of daily) {
    const slot = days.find((x) => x.day === String(r.day).slice(0, 10));
    if (!slot) continue;
    if (r.kind === "campaign_view") slot.views += r.n;
    else slot.clicks += r.n;
  }
  const peak = Math.max(1, ...days.map((d) => d.views));
  const ctr = metrics.views ? `${((metrics.clicks / metrics.views) * 100).toFixed(1)}%` : "—";
  const item = {
    id: row.id,
    reference: row.reference,
    title: row.title,
    status: row.status,
    display,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
  };

  const state: { tone: "amber" | "red" | "blue" | "neutral"; icon: ReactNode; title: string; body: string } | null =
    display === "draft"
      ? { tone: "neutral", icon: <Info />, title: "Draft", body: "Only you can see this campaign. Submit it when it's ready — MarchGear reviews it before it goes live." }
      : display === "pending_approval"
        ? { tone: "blue", icon: <Send />, title: "With MarchGear for review", body: `Submitted ${row.submittedAt ? formatIst(row.submittedAt) : ""}. You'll get a notification when it's decided. Withdraw it to make changes.` }
        : display === "scheduled"
          ? { tone: "blue", icon: <CalendarClock />, title: "Approved and scheduled", body: `Goes live on the insurance pages on ${formatIst(row.startsAt)} and ends on ${formatIst(row.endsAt)}.` }
          : display === "active"
            ? { tone: "neutral", icon: <CircleCheck />, title: "Live on the insurance pages", body: `Ends on its own on ${formatIst(row.endsAt)}. Pause it any time; editing sends it back for approval.` }
            : display === "paused"
              ? { tone: "amber", icon: <PauseCircle />, title: "Paused", body: `Hidden from the insurance pages. Resume it before ${formatIst(row.endsAt)} — no new approval needed.` }
              : display === "expired"
                ? { tone: "neutral", icon: <Clock3 />, title: "Ended", body: `Ran ${formatWindow(row.startsAt, row.endsAt)}. Duplicate it, or edit the dates and resubmit, to run it again.` }
                : display === "cancelled"
                  ? { tone: "neutral", icon: <Info />, title: "Cancelled", body: "This campaign won't run again. Duplicate it to start a new draft with the same details." }
                  : null;
  const remarks = row.adminRemarks && (display === "changes_requested" || display === "rejected");

  return (
    <>
      <ChartStyles />
      <PortalHeader
        back={{ href: "/insurance-vendor/campaigns", label: "Campaigns" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="break-words">{row.title}</span>
            <span className="tracking-normal"><Badge tone={INS_CAMPAIGN_STATUS_TONE[display]}>{INS_CAMPAIGN_STATUS_LABEL[display]}</Badge></span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[13px]">{row.reference}</span>
            <span>·</span>
            <span>{INS_CAMPAIGN_TYPE_LABEL[row.type]}</span>
            <span>·</span>
            <span>{formatWindow(row.startsAt, row.endsAt)}</span>
          </span>
        }
        actions={<CampaignDetailActions item={item} canManage={ctx.can("campaigns.manage")} />}
      />

      {remarks ? (
        <Callout tone={display === "rejected" ? "red" : "amber"} icon={<MessageSquareWarning />} title={display === "rejected" ? "Rejected — MarchGear says" : "Changes requested — MarchGear says"} className="mb-6">
          <p className="whitespace-pre-line">{row.adminRemarks}</p>
        </Callout>
      ) : (
        state && (
          <Callout tone={state.tone} icon={state.icon} title={state.title} className="mb-6">
            {state.body}
          </Callout>
        )
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Performance">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {(
                [
                  ["Views", metrics.views.toLocaleString("en-IN")],
                  ["Clicks", metrics.clicks.toLocaleString("en-IN")],
                  ["Click-through", ctr],
                  ["Enquiries", metrics.enquiries.toLocaleString("en-IN")],
                  ["Policies reported", metrics.conversions.toLocaleString("en-IN")],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[12px] text-muted">{k}</dt>
                  <dd className="mt-1 font-display text-[24px] font-semibold leading-none tracking-[-0.02em] num">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
              <div>
                <p className="mb-3 text-[12.5px] font-medium text-muted">Funnel</p>
                <Funnel
                  stages={[
                    { key: "views", label: "Campaign views", value: metrics.views },
                    { key: "clicks", label: "Clicks to products", value: metrics.clicks },
                    { key: "enquiries", label: "Quote requests", value: metrics.enquiries },
                    { key: "policies", label: "Policies reported", value: metrics.conversions },
                  ]}
                />
              </div>
              <div className="min-w-0">
                <p className="mb-3 text-[12.5px] font-medium text-muted">Daily views {days.length ? `· last ${days.length} day${days.length === 1 ? "" : "s"}` : ""}</p>
                {days.length === 0 ? (
                  <p className="flex h-[150px] items-center justify-center border border-dashed border-line text-[13px] text-muted">Starts {formatIst(row.startsAt, false)} — daily figures appear once it runs.</p>
                ) : (
                  <>
                    <div className="flex h-[150px] items-end gap-[3px] border-b border-line" role="img" aria-label={`Daily views over the last ${days.length} days`}>
                      {days.map((d) => (
                        <div key={d.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.day}: ${d.views} views, ${d.clicks} clicks`}>
                          <div className={cn("w-full rounded-t-[2px] transition-colors", d.views ? "bg-ink group-hover:bg-red" : "bg-[#EFEFEF]")} style={{ height: `${d.views ? Math.max(4, (d.views / peak) * 100) : 2}%` }} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] text-muted">
                      <span>{formatIst(`${days[0].day}T12:00:00+05:30`, false)}</span>
                      <span>Today</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <p className="mt-5 text-[12px] leading-relaxed text-muted">
              Views and clicks come from the public insurance pages. Policies are as reported by your team on the enquiry, until MarchGear verifies them.
            </p>
          </Panel>

          <Panel title="Details">
            <dl className="grid gap-x-8 gap-y-4 text-[13.5px] sm:grid-cols-2">
              <div>
                <dt className="text-[12px] text-muted">Starts</dt>
                <dd className="mt-0.5 font-medium">{formatIst(row.startsAt)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Ends</dt>
                <dd className="mt-0.5 font-medium">
                  {formatIst(row.endsAt)} <span className="font-normal text-muted">· {durationDays(row.startsAt, row.endsAt)} days</span>
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Button label</dt>
                <dd className="mt-0.5 font-medium">{row.ctaLabel || `${CTA_DEFAULT} (default)`}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Last updated</dt>
                <dd className="mt-0.5 font-medium">{formatDateTime(row.updatedAt)}</dd>
              </div>
            </dl>
            <div className="mt-5 border-t border-line pt-5">
              <p className="text-[12px] text-muted">Summary</p>
              <p className="mt-1 whitespace-pre-line break-words text-[14px] leading-relaxed">{row.summary || "—"}</p>
              {row.description && (
                <>
                  <p className="mt-4 text-[12px] text-muted">Description</p>
                  <p className="mt-1 whitespace-pre-line break-words text-[14px] leading-relaxed">{row.description}</p>
                </>
              )}
            </div>
            <div className="mt-5 border-t border-line pt-5">
              <p className="text-[12px] text-muted">Products promoted</p>
              {products.length === 0 ? (
                <p className="mt-1 text-[13.5px] text-muted">None selected yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line border border-line">
                  {products.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium">{p.name}</span>
                        <span className="block text-[12px] text-muted">
                          <span className="font-mono">{p.reference}</span> · {INS_PRODUCT_CATEGORY_LABEL[p.category]}
                        </span>
                      </span>
                      {p.status === "published" ? <Badge tone="green">Published</Badge> : <Badge tone="amber">Not published</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          {enquiries && (
            <Panel title="Enquiries from this campaign" padded={false}>
              {enquiries.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13.5px] text-muted">No quote requests from this campaign yet{canAll ? "" : " assigned to you"}.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {enquiries.map((e) => (
                    <li key={e.id}>
                      <Link href={`/insurance-vendor/enquiries/${e.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-[#FAFAFA]">
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium">{e.name}</span>
                          <span className="block truncate text-[12px] text-muted">
                            <span className="font-mono">{e.reference}</span>
                            {e.product ? ` · ${e.product}` : ""} · {formatDateTime(e.createdAt)}
                          </span>
                        </span>
                        <Badge tone={INS_LEAD_STATUS_TONE[e.status]}>{INS_LEAD_STATUS_LABEL[e.status]}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>

        <aside className="min-w-0 space-y-6 xl:sticky xl:top-24 xl:self-start">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Public preview</p>
            <CampaignPreview
              title={row.title}
              summary={row.summary}
              type={row.type}
              banner={row.banner}
              ctaLabel={row.ctaLabel}
              vendorName={vendorName(ctx.vendor)}
              endsAt={row.endsAt}
              products={products.filter((p) => p.status === "published").map((p) => p.name)}
            />
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              {display === "active" ? "This is how it appears on MarchGear's insurance pages right now." : "How it appears on MarchGear's insurance pages while it's live."} Placement and layout are decided by
              MarchGear.
            </p>
          </div>

          <Panel title="Approval history" padded={false}>
            {history.length === 0 ? (
              <p className="px-5 py-6 text-[13.5px] text-muted">Starts when you submit the campaign.</p>
            ) : (
              <ol className="max-h-[420px] overflow-y-auto px-5 py-4">
                {history.map(({ a, actor }, i) => (
                  <li key={a.id} className="relative flex gap-4 pb-5 last:pb-0">
                    {i < history.length - 1 && <span aria-hidden className="absolute bottom-0 left-[11px] top-7 w-px bg-line" />}
                    <span
                      className={cn(
                        "relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-[9.5px] font-semibold",
                        a.actorSide === "admin" ? "border-ink bg-ink text-white" : "border-line bg-white text-muted",
                      )}
                    >
                      {a.actorSide === "admin" ? "MG" : <ShieldCheck className="size-3" aria-hidden />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium leading-snug">{ACTION_TEXT[a.action] ?? a.action.replace(/_/g, " ")}</p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {formatDateTime(a.createdAt)}
                        {a.actorSide === "admin" ? " · MarchGear" : actor ? ` · ${actor}` : ""}
                      </p>
                      {a.remarks && <p className="mt-1.5 whitespace-pre-line break-words text-[13px] text-muted">{a.remarks}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
