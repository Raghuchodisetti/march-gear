import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CarFront, ExternalLink, FileText, PlayCircle } from "lucide-react";
import { PARTNER_VEHICLE_STATUS } from "@/db/enums";
import { PARTNER_STATUS_LABEL, VEHICLE_STATUS_LABEL } from "@/partner/labels";
import { getVehicleReview, listPartnerVehicles, VEHICLES_PAGE_SIZE, type VehicleReview } from "@/server/admin/partners";
import { requireStaff } from "@/server/auth";
import { AdminHeader, FilterForm, FilterSelect, Pagination, Panel, SearchInput, formatDateTime, formatDay, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { Gallery, ReviewDrawer, VehicleActions } from "@/components/admin/partner-review";
import { HistoryList } from "@/components/admin/partner-history";
import { EmptyState, Facts, LinkTabs, PartnerPill, VehiclePill, deviation, overdue, rupees, waitingLabel } from "@/components/admin/partner-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Vehicle approvals" };

type Catalogue = { carName: string; variantName: string | null; price: number | null; priceMin: number; priceMax: number; slug: string } | null;

/** How the asking price compares with the catalogue — big gaps are flagged for the reviewer. */
function priceCheck(v: { kind: "new" | "used"; sellingPrice: number; exShowroom: number | null }, c: Catalogue) {
  const ref = c?.price ?? null;
  if (v.kind === "new") {
    if (ref) {
      const dev = deviation(v.sellingPrice, ref)!;
      const abs = Math.abs(dev);
      return { dev, ref, tone: abs >= 0.1 ? ("red" as const) : abs >= 0.05 ? ("amber" as const) : ("green" as const), note: abs >= 0.1 ? "Big deviation from the catalogue ex-showroom price" : abs >= 0.05 ? "Noticeably different from the catalogue" : "In line with the catalogue" };
    }
    if (c) {
      const out = v.sellingPrice < c.priceMin * 0.9 || v.sellingPrice > c.priceMax * 1.1;
      return { dev: null, ref: null, tone: out ? ("red" as const) : ("green" as const), note: out ? `Outside the ${c.carName} price range` : `Within the ${c.carName} price range`, range: [c.priceMin, c.priceMax] as const };
    }
    return { dev: null, ref: null, tone: "neutral" as const, note: "Model not in the catalogue — no reference price" };
  }
  const newRef = ref ?? v.exShowroom;
  if (!newRef) return { dev: null, ref: null, tone: "neutral" as const, note: "No new-car price to compare with" };
  const dev = deviation(v.sellingPrice, newRef)!;
  return { dev, ref: newRef, tone: dev >= 0 ? ("red" as const) : ("green" as const), note: dev >= 0 ? "Asking price is at or above the new-car price" : `${Math.round(-dev * 100)}% below the new-car price` };
}

const pctLabel = (d: number | null) => (d === null ? null : `${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}%`);
const TONE_TEXT = { red: "text-red", amber: "text-[#9a5b00]", green: "text-[#1e7a3c]", neutral: "text-muted" };

export default async function VehicleApprovalsPage({ searchParams }: PageProps<"/admin/vehicle-approvals">) {
  await requireStaff();
  const sp = await searchParams;
  const view = sp.view === "all" ? "all" : "queue";
  const partnerParam = strParam(sp.partner);
  const params = { view: view === "all" ? "all" : undefined, q: strParam(sp.q), kind: strParam(sp.kind), status: view === "all" ? strParam(sp.status) : undefined, partner: partnerParam && /^\d+$/.test(partnerParam) ? partnerParam : undefined };
  const reviewId = strParam(sp.review);
  const [{ rows, total, page, queue, byStatus, now }, review] = await Promise.all([
    listPartnerVehicles({ view, q: params.q, kind: params.kind, status: params.status, partner: params.partner ? Number(params.partner) : undefined, page: pageParam(sp.page) }),
    reviewId && /^\d+$/.test(reviewId) ? getVehicleReview(Number(reviewId)) : Promise.resolve(null),
  ]);
  const all = Object.values(byStatus).reduce((a, b) => a + (b ?? 0), 0);
  const base = "/admin/vehicle-approvals";
  const listParams = { ...params, page: sp.page ? String(pageParam(sp.page)) : undefined };
  const hasFilters = Boolean(params.q || params.kind || params.status || params.partner);

  return (
    <>
      <AdminHeader title="Vehicle approvals" description="Dealer listings waiting for review — oldest first. Approve, publish, send back for corrections or reject. Used cars go live on /used-cars when published." />
      <LinkTabs
        active={view}
        items={[
          { key: "queue", label: "Waiting for review", count: queue, href: hrefWith(base, { q: params.q, kind: params.kind, partner: params.partner }, {}) },
          { key: "all", label: "All listings", count: all, href: hrefWith(base, { q: params.q, kind: params.kind, partner: params.partner }, { view: "all" }) },
        ]}
      />
      <FilterForm resetHref={hrefWith(base, { view: params.view }, {})} hasFilters={hasFilters}>
        {params.view && <input type="hidden" name="view" value="all" />}
        {params.partner && <input type="hidden" name="partner" value={params.partner} />}
        <SearchInput value={params.q} placeholder="Reference, model, VIN, dealer…" />
        <FilterSelect name="kind" label="New & used" value={params.kind} options={[{ value: "new", label: "New cars" }, { value: "used", label: "Used cars" }]} />
        {view === "all" && <FilterSelect name="status" label="Any status" value={params.status} options={PARTNER_VEHICLE_STATUS.map((s) => ({ value: s, label: `${VEHICLE_STATUS_LABEL[s]} (${byStatus[s] ?? 0})` }))} />}
      </FilterForm>
      {params.partner && (
        <p className="-mt-1 mb-3 text-[13px] text-muted">
          Showing one dealer&apos;s listings ·{" "}
          <Link href={hrefWith(base, { ...params, partner: undefined }, {})} className="font-medium text-red hover:underline">
            Show every dealer
          </Link>
        </p>
      )}

      {rows.length === 0 ? (
        <div className="border border-line bg-white">
          <EmptyState icon={<CarFront aria-hidden className="size-5" />} title={view === "queue" && !hasFilters ? "No listings waiting" : "No listings match"}>
            {view === "queue" && !hasFilters ? "Vehicles dealers submit for approval appear here, oldest first." : "Try another search or filter."}
          </EmptyState>
        </div>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {rows.map((v) => {
              const check = priceCheck(v, v.catalogue);
              return (
                <li key={v.id}>
                  <Link href={hrefWith(base, listParams, { review: String(v.id) })} scroll={false} className="flex gap-3 border border-line bg-white p-3">
                    <span className="block h-16 w-20 shrink-0 overflow-hidden rounded-[2px] bg-mist">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {v.image && <img src={v.image} alt="" className="size-full object-cover" loading="lazy" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">
                        {v.year} {v.model} {v.variant}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        {v.partnerName ?? v.partnerRef} · {v.kind === "used" ? "Used" : "New"}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <VehiclePill status={v.status} />
                        <span className={cn("text-[12.5px] font-medium num", TONE_TEXT[check.tone])}>
                          {rupees(v.sellingPrice)} {pctLabel(check.dev) && `(${pctLabel(check.dev)})`}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto border border-line bg-white md:block">
            <table className="w-full min-w-[960px] border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="text-[12px] text-muted">
                  {["Vehicle", "Dealer", "Price vs catalogue", view === "queue" ? "Waiting" : "Updated", "Status", ""].map((h, i) => (
                    <th key={i} className="border-b border-line bg-mist/60 px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const check = priceCheck(v, v.catalogue);
                  const href = hrefWith(base, listParams, { review: String(v.id) });
                  return (
                    <tr key={v.id} className={cn("align-top transition-colors hover:bg-mist/40", review?.vehicle.id === v.id && "bg-mist/60")}>
                      <td className="border-b border-line px-4 py-3">
                        <Link href={href} scroll={false} className="flex items-center gap-3">
                          <span className="block h-11 w-16 shrink-0 overflow-hidden rounded-[2px] bg-mist">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {v.image && <img src={v.image} alt="" className="size-full object-cover" loading="lazy" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold hover:text-red">
                              {v.year} {v.model} {v.variant}
                            </span>
                            <span className="block text-[12px] text-muted">
                              {v.reference} · {v.kind === "used" ? "Used" : "New"} · {v.fuel} · {v.imageCount} photo{v.imageCount === 1 ? "" : "s"}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        <Link href={`/admin/dealers/details?id=${v.partnerId}`} className="hover:text-red">
                          {v.partnerName ?? v.partnerRef}
                        </Link>
                        {v.partnerStatus !== "approved" && (
                          <span className="mt-1 block">
                            <PartnerPill status={v.partnerStatus} />
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-b border-line px-4 py-3">
                        <span className="font-medium num">{rupees(v.sellingPrice)}</span>
                        <span className={cn("mt-0.5 flex items-center gap-1 text-[12px]", TONE_TEXT[check.tone])}>
                          {check.tone === "red" && <AlertTriangle aria-hidden className="size-3.5" />}
                          {check.ref ? `${pctLabel(check.dev)} vs ${rupees(check.ref)}` : check.note}
                        </span>
                      </td>
                      <td className="whitespace-nowrap border-b border-line px-4 py-3 text-[12.5px]">
                        {view === "queue" ? <span className={cn(overdue(v.submittedAt, now) ? "font-semibold text-red" : "")}>{waitingLabel(v.submittedAt ?? v.createdAt, now)}</span> : formatDateTime(v.updatedAt)}
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        <VehiclePill status={v.status} />
                      </td>
                      <td className="border-b border-line px-4 py-3 text-right">
                        <Link href={href} scroll={false} className={cn("inline-flex h-8 items-center rounded-[3px] px-3 text-[12.5px] font-medium", v.status === "pending_approval" ? "bg-red text-white hover:bg-red-600" : "border border-line hover:border-ink")}>
                          {v.status === "pending_approval" ? "Review" : "Open"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Pagination base={base} params={params} page={page} pageSize={VEHICLES_PAGE_SIZE} total={total} />

      {review && (
        <ReviewDrawer key={review.vehicle.id} title={`${review.vehicle.year} ${review.brandName} ${review.vehicle.model}`} closeHref={hrefWith(base, listParams, {})} footer={<VehicleActions id={review.vehicle.id} status={review.vehicle.status} partnerApproved={review.partner.status === "approved"} label={`${review.vehicle.model} ${review.vehicle.variant}`} />}>
          <VehicleReviewBody r={review} />
        </ReviewDrawer>
      )}
    </>
  );
}

function VehicleReviewBody({ r }: { r: VehicleReview }) {
  const v = r.vehicle;
  const check = priceCheck(v, r.catalogue);
  const used = v.used;
  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <VehiclePill status={v.status} />
        <span className="text-[13px] text-muted">
          {v.reference} · {v.variant} · {v.kind === "used" ? "Used car" : "New car"}
        </span>
        <Link href={`/admin/dealers/details?id=${r.partner.id}`} className="text-[13px] font-medium hover:text-red">
          {r.partner.name}
        </Link>
        {r.partner.status !== "approved" && <PartnerPill status={r.partner.status} />}
        {v.status === "published" && r.partner.status === "approved" && v.kind === "used" && v.publicUsedCarId && (
          <Link href={`/used-cars/${v.publicUsedCarId}`} target="_blank" className="inline-flex items-center gap-1 text-[13px] font-medium text-red hover:underline">
            Live on /used-cars <ExternalLink aria-hidden className="size-3.5" />
          </Link>
        )}
        {v.status === "published" && r.partner.status === "approved" && v.kind === "new" && r.partner.publicDealerId && (
          <Link href={`/dealers/${r.partner.publicDealerId}`} target="_blank" className="inline-flex items-center gap-1 text-[13px] font-medium text-red hover:underline">
            Live on the dealer page <ExternalLink aria-hidden className="size-3.5" />
          </Link>
        )}
      </div>

      {v.status === "published" && r.partner.status !== "approved" && (
        <p className="border-l-2 border-[#e09200] bg-[#fdf3e1]/60 px-4 py-2.5 text-[13px]">
          Published, but hidden from the website while the dealership is {PARTNER_STATUS_LABEL[r.partner.status].toLowerCase()}.
        </p>
      )}

      {v.adminRemarks && (
        <p className="border-l-2 border-[#e09200] bg-[#fdf3e1]/60 px-4 py-2.5 text-[13px]">
          <span className="font-semibold">Last remarks to the dealer:</span> {v.adminRemarks}
        </p>
      )}

      <Gallery images={v.images} alt={`${v.model} ${v.variant}`} />

      <section className={cn("border p-4", check.tone === "red" ? "border-red/30 bg-red-50/40" : check.tone === "amber" ? "border-[#e09200]/30 bg-[#fdf3e1]/50" : "border-line")}>
        <h3 className="flex items-center gap-2 text-[13.5px] font-semibold">
          {check.tone === "red" && <AlertTriangle aria-hidden className="size-4 text-red" />} Pricing
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-[12px] text-muted">Selling price</p>
            <p className="mt-0.5 font-display text-[20px] font-semibold num">{rupees(v.sellingPrice)}</p>
          </div>
          <div>
            <p className="text-[12px] text-muted">Dealer&apos;s ex-showroom</p>
            <p className="mt-0.5 text-[15px] font-medium num">{rupees(v.exShowroom)}</p>
          </div>
          <div>
            <p className="text-[12px] text-muted">Catalogue ex-showroom</p>
            <p className="mt-0.5 text-[15px] font-medium num">{r.catalogue?.price ? rupees(r.catalogue.price) : r.catalogue ? `${rupees(r.catalogue.priceMin)} – ${rupees(r.catalogue.priceMax)}` : "—"}</p>
            {r.catalogue && <p className="text-[11.5px] text-muted">{r.catalogue.variantName ? `${r.catalogue.carName} ${r.catalogue.variantName}` : `${r.catalogue.carName} (variant not matched)`}</p>}
          </div>
          <div>
            <p className="text-[12px] text-muted">Deviation</p>
            <p className={cn("mt-0.5 text-[15px] font-semibold num", TONE_TEXT[check.tone])}>{pctLabel(check.dev) ?? "—"}</p>
          </div>
        </div>
        <p className={cn("mt-3 text-[12.5px]", TONE_TEXT[check.tone])}>{check.note}</p>
        {v.exShowroom && r.catalogue?.price && Math.abs((v.exShowroom - r.catalogue.price) / r.catalogue.price) > 0.05 && (
          <p className="mt-1 text-[12.5px] text-[#9a5b00]">The dealer&apos;s stated ex-showroom price differs from the catalogue by {pctLabel(deviation(v.exShowroom, r.catalogue.price))}.</p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel title="Vehicle">
          <Facts
            className="-my-2.5"
            rows={[
              ["Brand / model", `${r.brandName} ${v.model}`],
              ["Variant", v.variant],
              ["Year", v.year],
              ["Fuel / gearbox", `${v.fuel} · ${v.transmission}`],
              ["Body / colour", `${v.bodyType} · ${v.colour}`],
              ["Stock", v.stock],
              ["VIN", v.vin && <span className="font-mono text-[12.5px]">{v.vin}</span>],
              ["Showroom", r.showroom ? `${r.showroom.name}, ${r.showroom.city}` : null],
              ["Submitted", v.submittedAt ? formatDateTime(v.submittedAt) : null],
            ]}
          />
        </Panel>
        {used ? (
          <Panel title="Used-car disclosures">
            <Facts
              className="-my-2.5"
              rows={[
                ["Registered", [used.registrationYear, used.registrationState].filter(Boolean).join(" · ")],
                ["Registration no.", used.registrationNumber && <span className="font-mono text-[12.5px]">{used.registrationNumber}</span>],
                ["Odometer", used.km !== null ? `${used.km.toLocaleString("en-IN")} km` : null],
                ["Owners", used.owners],
                ["Accident history", used.accident?.hadAccident ? <span className="text-red">Yes{used.accident.details ? ` — ${used.accident.details}` : ""}</span> : "None declared"],
                ["Insurance", used.insurance?.status ? `${used.insurance.status.replace("_", " ")}${used.insurance.validUntil ? ` · till ${formatDay(used.insurance.validUntil)}` : ""}` : null],
              ]}
            />
          </Panel>
        ) : (
          <Panel title="Features">
            {v.features.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {v.features.map((f) => (
                  <li key={f} className="rounded-full bg-mist px-2.5 py-1 text-[12px]">
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">No features listed.</p>
            )}
          </Panel>
        )}
      </div>

      {used && (
        <Panel title="Inspection report" padded={false}>
          {r.inspection ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-2.5 text-[13px]">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <FileText aria-hidden className="size-4 shrink-0 text-muted" /> <span className="truncate">{r.inspection.filename}</span>
                </span>
                <a href={`/dealer/files/${r.inspection.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-red hover:underline">
                  Open <ExternalLink aria-hidden className="size-3.5" />
                </a>
              </div>
              <div className="flex h-[380px] items-center justify-center bg-mist/60">
                {r.inspection.mime.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/dealer/files/${r.inspection.id}`} alt="Inspection report" className="max-h-full max-w-full object-contain" />
                ) : (
                  <object data={`/dealer/files/${r.inspection.id}`} type="application/pdf" className="size-full" aria-label="Inspection report (PDF)">
                    <p className="p-6 text-center text-[13px] text-muted">
                      <a className="text-red underline" href={`/dealer/files/${r.inspection.id}`} target="_blank" rel="noreferrer">
                        Open the inspection report
                      </a>
                    </p>
                  </object>
                )}
              </div>
            </div>
          ) : (
            <p className="p-5 text-[13px] text-muted">No inspection report uploaded.</p>
          )}
        </Panel>
      )}

      {used && v.features.length > 0 && (
        <Panel title="Features">
          <ul className="flex flex-wrap gap-1.5">
            {v.features.map((f) => (
              <li key={f} className="rounded-full bg-mist px-2.5 py-1 text-[12px]">
                {f}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {v.specs.length > 0 && (
        <Panel title="Specifications">
          <Facts className="-my-2.5" rows={v.specs.map((s) => [s.label, s.value])} />
        </Panel>
      )}

      {(v.description || v.videos.length > 0) && (
        <Panel title="Description">
          {v.description && <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{v.description}</p>}
          {v.videos.length > 0 && (
            <ul className="mt-3 space-y-1">
              {v.videos.map((u) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1.5 break-all text-[13px] text-red hover:underline">
                    <PlayCircle aria-hidden className="size-4 shrink-0" /> {u}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Panel title="Approval history">
        <HistoryList entries={r.history} showTarget={false} empty="No decisions on this listing yet." />
      </Panel>
      <p className="text-[12px] text-muted">
        {v.views.toLocaleString("en-IN")} views · {v.enquiries.toLocaleString("en-IN")} enquiries
        {v.publishedAt ? ` · published ${formatDateTime(v.publishedAt)}` : ""}
      </p>
    </div>
  );
}
