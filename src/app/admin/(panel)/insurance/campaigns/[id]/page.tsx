import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { notFound } from "next/navigation";
import { ExternalLink, ImageOff, Presentation } from "lucide-react";
import { INS_CAMPAIGN_STATUS_LABEL, INS_CAMPAIGN_TYPE_LABEL, INS_PRODUCT_CATEGORY_LABEL, INS_PRODUCT_STATUS_LABEL, INS_VENDOR_STATUS_LABEL, INS_VENDOR_STATUS_TONE, campaignDisplayStatus } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { getInsCampaign } from "@/server/admin/insurance-ops";
import { vendorName } from "@/server/insurance/context";
import { AdminHeader, Panel, formatDateTime } from "@/components/admin/ui";
import { Facts, StatusPill } from "@/components/admin/partner-ui";
import { addDays, istDate } from "@/components/portal/billing/shared";
import { CampaignPill, FactGrid, InsHistoryList, Notice, TitlePills } from "@/components/admin/insurance/ops/kit";
import { CampaignActions } from "@/components/admin/insurance/ops/actions";

export const metadata: Metadata = { title: "Campaign review" };

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const data = /^\d{1,9}$/.test(id) ? await getInsCampaign(Number(id)) : null;
  if (!data) notFound();
  const { c, v, products, missingProducts, history, performance: perf } = data;
  const now = new Date();
  const shown = campaignDisplayStatus(c, now);
  const ended = c.endsAt < now;
  const vendor = vendorName(v);
  const days = Math.max(1, Math.round((c.endsAt.getTime() - c.startsAt.getTime()) / 86_400_000));

  const notPublic = products.filter((p) => p.status !== "published" || p.vendorId !== c.vendorId);
  const warnings = [
    ...(missingProducts.length ? [`${missingProducts.length} linked product${missingProducts.length > 1 ? "s were" : " was"} deleted`] : []),
    ...notPublic.map((p) => (p.vendorId !== c.vendorId ? `“${p.name}” belongs to another vendor` : `“${p.name}” isn't published (${INS_PRODUCT_STATUS_LABEL[p.status]}) — the campaign can't link to it`)),
    ...(!products.length && !missingProducts.length ? ["No products are linked — the campaign has nothing to send customers to"] : []),
    ...(!c.banner ? ["There's no banner image"] : []),
    ...(data.planLimit !== null && data.slotsUsed >= data.planLimit
      ? [`The vendor's ${data.planName} plan allows ${data.planLimit} campaign${data.planLimit === 1 ? "" : "s"} at a time and ${data.slotsUsed} other${data.slotsUsed === 1 ? " is" : "s are"} already live, scheduled, paused or awaiting approval`]
      : []),
  ];

  // Last 30 IST days of views and clicks.
  const series = Array.from({ length: 30 }, (_, i) => {
    const day = addDays(istDate(), i - 29);
    return { day, views: perf.daily.find((d) => d.day === day && d.kind === "campaign_view")?.n ?? 0, clicks: perf.daily.find((d) => d.day === day && d.kind === "campaign_click")?.n ?? 0 };
  });
  const peak = Math.max(1, ...series.map((s) => s.views));

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/insurance/campaigns", label: "Promotional campaigns" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {c.title}
            <TitlePills>
              <CampaignPill status={shown} />
            </TitlePills>
          </span>
        }
        description={`${c.reference} · ${INS_CAMPAIGN_TYPE_LABEL[c.type]} · ${vendor}${c.submittedAt ? ` · submitted ${formatDateTime(c.submittedAt)}` : ""}`}
        actions={
          <Link href="/admin/advertising" className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-ink/15 px-3.5 text-[13px] font-medium hover:border-ink">
            <Presentation aria-hidden className="size-4" /> Paid ads
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Creative" padded={false}>
            <div className="relative aspect-[3/1] w-full overflow-hidden bg-mist">
              {c.banner ? (
                // Vendor-uploaded media — plain <img> on purpose.
                // eslint-disable-next-line @next/next/no-img-element
                <img decoding="async" src={c.banner} alt={`Banner for ${c.title}`} className="size-full object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-2 text-[13px] text-muted">
                  <ImageOff aria-hidden className="size-6" /> No banner uploaded
                </div>
              )}
            </div>
            <div className="space-y-3 p-5">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">{INS_CAMPAIGN_TYPE_LABEL[c.type]}</p>
              <h2 className="font-display text-[22px] font-semibold leading-snug tracking-[-0.01em]">{c.title}</h2>
              <p className="text-[14.5px] leading-relaxed">{c.summary}</p>
              {c.description && <p className="whitespace-pre-line break-words border-t border-line pt-3 text-[13.5px] leading-relaxed text-ink/80">{c.description}</p>}
              {c.ctaLabel && (
                <span className="inline-flex h-9 items-center rounded-[3px] bg-red px-3.5 text-[13px] font-medium text-white" aria-label={`Button text: ${c.ctaLabel}`}>
                  {c.ctaLabel}
                </span>
              )}
            </div>
          </Panel>

          <Panel title={`Products (${products.length + missingProducts.length})`} padded={false}>
            {products.length === 0 && missingProducts.length === 0 ? (
              <p className="px-5 py-6 text-[13.5px] text-muted">No products linked.</p>
            ) : (
              <ul className="divide-y divide-line">
                {products.map((p) => {
                  const isPublic = p.status === "published" && p.vendorId === c.vendorId && v.status === "approved";
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                      <span className="min-w-0">
                        <span className="block font-medium">{p.name}</span>
                        <span className="block text-[12px] text-muted">
                          <span className="num">{p.reference}</span> · {INS_PRODUCT_CATEGORY_LABEL[p.category]}
                          {p.companyName ? ` · ${p.companyName}` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <StatusPill tone={isPublic ? "green" : p.status === "published" ? "amber" : "neutral"}>{isPublic ? "Public" : INS_PRODUCT_STATUS_LABEL[p.status]}</StatusPill>
                        {isPublic && (
                          <Link href={`/insurance/products/${p.reference}`} target="_blank" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-red hover:underline">
                            View <ExternalLink aria-hidden className="size-3" />
                          </Link>
                        )}
                      </span>
                    </li>
                  );
                })}
                {missingProducts.map((pid) => (
                  <li key={pid} className="px-5 py-3.5 text-[13px] text-muted">
                    Product #{pid} — deleted
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Performance">
            <FactGrid
              cols={4}
              items={[
                ["Views", perf.views.toLocaleString("en-IN")],
                ["Clicks", `${perf.clicks.toLocaleString("en-IN")} · ${pct(perf.clicks, perf.views)}`],
                ["Enquiries", `${perf.enquiries} · ${pct(perf.enquiries, perf.clicks)}`],
                ["Policies", `${perf.reported} reported · ${perf.verified} verified`],
              ]}
            />
            <p className="mt-2 text-[12px] text-muted">
              {perf.quoted} of {perf.enquiries} enquiries quoted · {perf.renewals} renewal enquiries. Views and clicks come from the public pages&apos; analytics beacons; enquiries are attributed by the campaign link.
            </p>
            <div className="mt-5">
              <p className="mb-2 text-[12px] font-medium text-muted">Views per day, last 30 days (IST)</p>
              <div className="flex h-20 items-end gap-[2px]" role="img" aria-label={`Views per day over the last 30 days, peak ${peak === 1 && !series.some((s) => s.views) ? 0 : peak}`}>
                {series.map((s) => (
                  <span key={s.day} title={`${s.day}: ${s.views} views, ${s.clicks} clicks`} className="min-w-0 flex-1 rounded-t-[2px] bg-ink/80" style={{ height: `${s.views ? Math.max(4, (s.views / peak) * 100) : 2}%`, opacity: s.views ? 1 : 0.15 }} />
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Approval history">
            <InsHistoryList entries={history} empty="No decisions yet." />
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6">
          <Panel title="Decision">
            <div className="space-y-4">
              {c.adminRemarks && (
                <div className="rounded-[3px] bg-mist/60 px-3.5 py-3 text-[13px]">
                  <p className="text-[11.5px] font-medium text-muted">Last remarks to the vendor</p>
                  <p className="mt-0.5 whitespace-pre-line break-words">{c.adminRemarks}</p>
                </div>
              )}
              {warnings.length > 0 && c.status === "pending_approval" && (
                <Notice tone="warn" title="Check before approving">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              <CampaignActions campaignId={c.id} status={c.status} ended={ended} vendorApproved={v.status === "approved"} warnings={warnings} />
            </div>
          </Panel>

          <Panel title="Dates">
            <Facts
              rows={[
                ["Starts", formatDateTime(c.startsAt)],
                ["Ends", formatDateTime(c.endsAt)],
                ["Length", `${days} day${days === 1 ? "" : "s"}`],
                ["Right now", c.status === "pending_approval" ? `Would be ${INS_CAMPAIGN_STATUS_LABEL[campaignDisplayStatus({ ...c, status: "approved" }, now)].toLowerCase()} if approved` : INS_CAMPAIGN_STATUS_LABEL[shown]],
                ["Approved", c.approvedAt ? formatDateTime(c.approvedAt) : null],
              ]}
            />
          </Panel>

          <Panel title="Vendor">
            <Facts
              rows={[
                [
                  "Vendor",
                  <Link key="v" href={`/admin/insurance/vendors/${v.id}`} className="font-medium hover:text-red">
                    {vendor} <span className="font-normal text-muted num">{v.reference}</span>
                  </Link>,
                ],
                ["Account", <StatusPill key="s" tone={INS_VENDOR_STATUS_TONE[v.status]}>{INS_VENDOR_STATUS_LABEL[v.status]}</StatusPill>],
                ["Plan", `${data.planName}${data.planLimit === null ? " · unlimited campaigns" : ` · ${data.planLimit} live at a time`}`],
                ["Other live campaigns", data.liveOthers.length ? data.liveOthers.map((o) => o.title).join(", ") : "None"],
                ["Created by", data.author],
              ]}
            />
          </Panel>
        </aside>
      </div>
    </>
  );
}
