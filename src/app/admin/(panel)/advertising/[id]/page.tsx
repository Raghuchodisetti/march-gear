import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { notFound } from "next/navigation";
import { ExternalLink, MessageSquareWarning, Package } from "lucide-react";
import { AD_FORMAT_LABEL, INS_VENDOR_STATUS_LABEL } from "@/insurance/labels";
import type { InsVendorStatus } from "@/db/enums";
import { requireStaff } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { auditTrail } from "@/server/ads/admin";
import { adInvoiceDueDate } from "@/server/ads/booking";
import { campaignHistory, getCampaign } from "@/server/ads/campaigns";
import { mediaSizes } from "@/server/ads/media";
import { dailySeries } from "@/server/ads/stats";
import { AdminHeader, Panel, StatCard, formatDateTime } from "@/components/admin/ui";
import { EmptyState, Facts } from "@/components/admin/partner-ui";
import { istDate, rupees } from "@/components/portal/billing/shared";
import { Callout } from "@/components/portal/offers/offer-ui";
import { BannerView } from "@/components/ads/banner";
import { AdHistory } from "@/components/ads/history";
import { AdStatusPill, CreativePill, InvoicePill } from "@/components/ads/status";
import { AdTrendChart } from "@/components/ads/trend-chart";
import { ADVERTISER_TYPE_LABEL, DESKTOP_ASPECT, MOBILE_ASPECT, adQuote, aspectOf, ctr, dayLabel, n, parseSize, productHref, rangeLabel, sizeLabel } from "@/components/ads/shared";
import { CampaignDecisions, CreativeDecisions } from "@/components/admin/advertising/decisions";
import { HouseCreativeButton } from "@/components/admin/advertising/house-form";

export const metadata: Metadata = { title: "Ad campaign" };

/** Within 3% of the recommended ratio. */
const ratioOk = (actual: { width: number | null; height: number | null } | undefined, recommended: string | null) => {
  const r = parseSize(recommended);
  if (!actual?.width || !actual.height || !r) return null;
  return Math.abs(actual.width / actual.height - r.w / r.h) / (r.w / r.h) <= 0.03;
};

export default async function AdCampaignReviewPage({ params }: PageProps<"/admin/advertising/[id]">) {
  await requireStaff();
  const { id } = await params;
  if (!/^\d{1,10}$/.test(id)) notFound();
  const data = await getCampaign(Number(id));
  if (!data) notFound();
  const { item: c, row, creatives } = data;
  const today = istDate();
  const started = c.startsOn <= today;
  const statsTo = c.endsOn < today ? c.endsOn : today;
  const [history, trail, series, sizes, terms] = await Promise.all([
    row.insVendorId ? campaignHistory(row.insVendorId, c.id, creatives, { includeInternal: true }) : Promise.resolve([]),
    row.insVendorId ? Promise.resolve([]) : auditTrail(c.id, creatives.map((cr) => cr.id)),
    started && c.status !== "rejected" ? dailySeries([c.id], c.startsOn, statsTo) : Promise.resolve([]),
    mediaSizes(creatives.flatMap((cr) => [cr.desktopImage, cr.mobileImage])),
    getCatalog().then((cat) => cat.content.insuranceSettings.paymentTermsDays),
  ]);
  const banner = c.placement.format === "banner";
  const dAspect = aspectOf(c.placement.desktopSize, DESKTOP_ASPECT);
  const mAspect = aspectOf(c.placement.mobileSize, MOBILE_ASPECT);
  const willInvoice = Boolean(row.insVendorId) && !c.house && !c.invoice && c.amount > 0;
  const target = c.productId ? (
    c.productRef ? (
      <a href={productHref(c.productRef)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:text-red">
        {c.productName} <ExternalLink aria-hidden className="size-3.5" />
      </a>
    ) : (
      "Product no longer available"
    )
  ) : c.targetUrl ? (
    <a href={c.targetUrl} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-1 break-all font-medium hover:text-red">
      {c.targetUrl} <ExternalLink aria-hidden className="size-3.5 shrink-0" />
    </a>
  ) : null;
  const advertiserHref = c.advertiser.type === "insurer" && c.advertiser.id ? `/admin/insurance/vendors/${c.advertiser.id}` : c.advertiser.type === "dealer" && c.advertiser.id ? `/admin/dealers/details?id=${c.advertiser.id}` : null;

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/advertising", label: "Ad campaigns" }}
        title={c.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12.5px] text-ink/70">{c.reference}</span>
            <AdStatusPill display={c.display} />
            <span>
              {c.advertiser.name} · {c.placement.name} · {rangeLabel(c.startsOn, c.endsOn)}
            </span>
          </span>
        }
      />

      <section className="mb-6 border border-line bg-white p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-[13px] text-muted">
            {c.status === "pending_approval" ? `Submitted ${c.submittedAt ? formatDateTime(c.submittedAt) : ""} — review the booking and its creatives.` : c.approvedAt ? `Approved ${formatDateTime(c.approvedAt)}.` : "Decisions on this campaign."}
          </p>
          <CampaignDecisions
            c={{
              id: c.id,
              name: c.name,
              status: c.status,
              startsOn: c.startsOn,
              endsOn: c.endsOn,
              days: c.days,
              today,
              house: c.house,
              vendor: Boolean(row.insVendorId),
              format: c.placement.format,
              pendingCreatives: c.creatives.pending,
              approvedCreatives: c.creatives.approved,
              invoice: willInvoice ? { total: c.total, dueOn: adInvoiceDueDate(c.startsOn, terms, today) } : null,
              invoiced: Boolean(c.invoice),
            }}
          />
        </div>
        {c.adminRemarks && (
          <Callout tone="neutral" icon={<MessageSquareWarning />} title="Latest remarks to the advertiser" className="mt-4">
            <p className="whitespace-pre-line">{c.adminRemarks}</p>
          </Callout>
        )}
        {!c.placement.isActive && (
          <Callout tone="amber" title="This placement is switched off" className="mt-4">
            Nothing serves on it until it&apos;s turned back on in{" "}
            <Link href="/admin/advertising/placements" className="font-semibold underline-offset-2 hover:underline">
              Placements & pricing
            </Link>
            .
          </Callout>
        )}
        {c.advertiser.type === "insurer" && c.advertiser.status !== "approved" && (
          <Callout tone="amber" title={`The vendor is ${INS_VENDOR_STATUS_LABEL[c.advertiser.status as InsVendorStatus]?.toLowerCase() ?? c.advertiser.status}`} className="mt-4">
            Its ads don&apos;t serve until the vendor account is approved again.
          </Callout>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Impressions" value={n(c.stats.impressions)} />
            <StatCard label="Clicks" value={n(c.stats.clicks)} />
            <StatCard label="CTR" value={ctr(c.stats.clicks, c.stats.impressions)} />
            <StatCard label="Enquiries" value={n(c.stats.enquiries)} />
          </div>
          <Panel title="Daily performance">
            {series.length ? (
              <AdTrendChart series={series} title={rangeLabel(c.startsOn, statsTo)} height={220} />
            ) : (
              <EmptyState title={started ? "No statistics" : `Starts ${dayLabel(c.startsOn)}`}>Impressions, clicks and enquiries appear here day by day while it runs.</EmptyState>
            )}
          </Panel>

          {banner ? (
            <Panel title={`Creatives (${creatives.length})`} action={c.house ? <HouseCreativeButton campaignId={c.id} creative={null} sizes={c.placement} label="Add creative" /> : undefined}>
              {creatives.length === 0 ? (
                <EmptyState title="No creatives">{c.house ? "Add a creative so the banner can serve." : "The advertiser hasn't added a creative."}</EmptyState>
              ) : (
                <ul className="space-y-5">
                  {creatives.map((cr) => {
                    const ds = cr.desktopImage ? sizes.get(cr.desktopImage) : undefined;
                    const ms = cr.mobileImage ? sizes.get(cr.mobileImage) : undefined;
                    const dOk = ratioOk(ds, c.placement.desktopSize);
                    const mOk = ratioOk(ms, c.placement.mobileSize);
                    return (
                      <li key={cr.id} id={`creative-${cr.id}`} className="scroll-mt-24 border border-line">
                        <div className="grid grid-cols-1 gap-4 bg-[#F6F6F6] p-4">
                          <figure>
                            <BannerView variant="desktop" desktopAspect={dAspect} mobileAspect={mAspect} ad={{ ...cr, advertiser: c.advertiser.name }} />
                            <figcaption className={`mt-1.5 text-[11.5px] ${dOk === false ? "font-medium text-[#9a5b00]" : "text-muted"}`}>
                              Desktop · {ds?.width && ds.height ? `${ds.width}×${ds.height}` : "size unknown"} (recommended {sizeLabel(c.placement.desktopSize)}){dOk === false ? " — different shape, will be cropped" : ""}
                            </figcaption>
                          </figure>
                          <figure className="w-full max-w-[320px]">
                            <BannerView variant="mobile" desktopAspect={dAspect} mobileAspect={mAspect} ad={{ ...cr, advertiser: c.advertiser.name }} />
                            <figcaption className={`mt-1.5 text-[11.5px] ${mOk === false ? "font-medium text-[#9a5b00]" : "text-muted"}`}>
                              Mobile · {ms?.width && ms.height ? `${ms.width}×${ms.height}` : "size unknown"}
                              {mOk === false ? " — will be cropped" : ""}
                            </figcaption>
                          </figure>
                        </div>
                        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[14px] font-semibold">{cr.name}</p>
                              <CreativePill status={cr.status} />
                              <span className="text-[11.5px] text-muted">updated {formatDateTime(cr.updatedAt)}</span>
                            </div>
                            <Facts
                              className="mt-2"
                              rows={[
                                ["Headline", cr.headline],
                                ["Text", cr.body],
                                ["Button", cr.ctaLabel],
                                ["Alt text", cr.alt],
                              ]}
                            />
                            {cr.remarks && <p className="mt-2 whitespace-pre-line rounded-[3px] bg-mist/70 px-3 py-2 text-[12.5px]">Remarks: {cr.remarks}</p>}
                          </div>
                          <div className="shrink-0">
                            {c.house ? (
                              <HouseCreativeButton campaignId={c.id} creative={{ id: cr.id, name: cr.name, desktopImage: cr.desktopImage, mobileImage: cr.mobileImage, headline: cr.headline ?? "", body: cr.body ?? "", ctaLabel: cr.ctaLabel ?? "", alt: cr.alt }} sizes={c.placement} label="Replace" />
                            ) : c.status === "rejected" || c.status === "cancelled" ? null : (
                              <CreativeDecisions id={cr.id} name={cr.name} status={cr.status} />
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          ) : (
            <Panel title="Sponsored product">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-mist">
                  <Package aria-hidden className="size-5" />
                </span>
                <div>
                  <p className="text-[14px] font-semibold">{c.productName ?? "Product unavailable"}</p>
                  <p className="mt-1 text-[13px] text-muted">Shown first, marked Sponsored, in quote results and on the compare page while live and while the product is published.</p>
                  {c.productRef && (
                    <a href={productHref(c.productRef)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-red hover:underline">
                      Open the product page <ExternalLink aria-hidden className="size-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </Panel>
          )}

          <Panel title="History">
            {row.insVendorId ? (
              <AdHistory entries={history} viewer="admin" />
            ) : trail.length ? (
              <ol className="divide-y divide-line">
                {trail.map((t) => (
                  <li key={t.id} className="py-2.5 text-[13.5px]">
                    {t.summary}
                    <span className="block text-[11.5px] text-muted">
                      {t.actor ?? "Staff"} · {formatDateTime(t.createdAt)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-6 text-center text-[13.5px] text-muted">No history yet.</p>
            )}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Advertiser">
            <Facts
              rows={[
                ["Name", advertiserHref ? <Link href={advertiserHref} className="font-medium hover:text-red">{c.advertiser.name}</Link> : c.advertiser.name],
                ["Type", ADVERTISER_TYPE_LABEL[c.advertiser.type]],
                ["Reference", c.advertiser.reference ? <span className="font-mono text-[12.5px]">{c.advertiser.reference}</span> : null],
              ]}
            />
          </Panel>
          <Panel title="Booking">
            <Facts
              rows={[
                ["Placement", <Link key="p" href={`/admin/advertising/placements#placement-${c.placement.id}`} className="hover:text-red">{c.placement.name}</Link>],
                ["Format", AD_FORMAT_LABEL[c.placement.format]],
                ["Dates", rangeLabel(c.startsOn, c.endsOn)],
                ["Days", n(c.days)],
                ["Links to", target],
                ["Booked", formatDateTime(c.createdAt)],
              ]}
            />
          </Panel>
          <Panel title="Price & invoice">
            {c.house ? (
              <p className="text-[13px] text-muted">House campaign — not charged, not invoiced.</p>
            ) : (
              <>
                <dl className="space-y-2 text-[13.5px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted num">
                      {rupees(c.pricePerDay)} × {c.days} days
                    </dt>
                    <dd className="num">{rupees(c.amount)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">GST (18%)</dt>
                    <dd className="num">{rupees(c.gst)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-line pt-2.5">
                    <dt className="font-semibold">Total</dt>
                    <dd className="font-display text-[19px] font-semibold tracking-[-0.02em] num">{rupees(c.total)}</dd>
                  </div>
                </dl>
                {adQuote(c.pricePerDay, c.days).total !== c.total && <p className="mt-2 text-[12px] text-[#9a5b00]">The stored total doesn&apos;t match the rate × days — check the invoice.</p>}
                <div className="mt-4 border-t border-line pt-4">
                  {c.invoice ? (
                    <Link href={`/admin/insurance/invoices/${c.invoice.id}`} className="group flex items-center justify-between gap-3">
                      <span>
                        <span className="block font-mono text-[13px] group-hover:text-red">{c.invoice.number}</span>
                        <span className="block text-[12px] text-muted">
                          {rupees(c.invoice.total)} · due {dayLabel(c.invoice.dueOn)}
                        </span>
                      </span>
                      <InvoicePill status={c.invoice.display} />
                    </Link>
                  ) : (
                    <p className="text-[13px] text-muted">{willInvoice ? `Approving raises the advertising invoice (due ${dayLabel(adInvoiceDueDate(c.startsOn, terms, today))}).` : "No invoice."}</p>
                  )}
                </div>
              </>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
