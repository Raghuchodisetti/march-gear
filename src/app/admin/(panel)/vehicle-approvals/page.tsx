import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { AlertTriangle, CarFront, ExternalLink, FileText, Library } from "lucide-react";
import { PARTNER_VEHICLE_STATUS } from "@/db/enums";
import { PARTNER_STATUS_LABEL, VEHICLE_STATUS_LABEL } from "@/partner/labels";
import { getVehicleReview, listPartnerVehicles, VEHICLES_PAGE_SIZE, type VehicleReview } from "@/server/admin/partners";
import { requireStaff } from "@/server/auth";
import { AdminHeader, FilterForm, FilterSelect, Pagination, Panel, SearchInput, formatDateTime, formatDay, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { Gallery, ReviewDrawer, VehicleActions } from "@/components/admin/partner-review";
import { HistoryList } from "@/components/admin/partner-history";
import { EmptyState, Facts, LinkTabs, PartnerPill, VehiclePill, deviation, overdue, rupees, waitingLabel } from "@/components/admin/partner-ui";
import { PRICE_BAND, conditionLabel, waitingLabel as orderWait } from "@/components/portal/inventory/shared";
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
      const outside = v.sellingPrice < ref * PRICE_BAND.min || v.sellingPrice > ref * PRICE_BAND.max;
      return {
        dev,
        ref,
        tone: outside || abs >= 0.1 ? ("red" as const) : abs >= 0.05 ? ("amber" as const) : ("green" as const),
        note: outside ? `Outside the ${PRICE_BAND.min * 100}–${PRICE_BAND.max * 100}% price rule` : abs >= 0.1 ? "Big deviation from the catalogue ex-showroom price" : abs >= 0.05 ? "Noticeably different from the catalogue" : "In line with the catalogue",
      };
    }
    return { dev: null, ref: null, tone: "red" as const, note: "Model or variant not in the catalogue — hidden from the website" };
  }
  const newRef = ref ?? v.exShowroom;
  if (!newRef) return { dev: null, ref: null, tone: "neutral" as const, note: c ? "Variant not matched — no new-car price to compare with" : "Model not in the catalogue" };
  const dev = deviation(v.sellingPrice, newRef)!;
  return { dev, ref: newRef, tone: dev >= 0 ? ("red" as const) : ("green" as const), note: dev >= 0 ? "Asking price is at or above the new-car price" : `${Math.round(-dev * 100)}% below the new-car price` };
}

const pctLabel = (d: number | null) => (d === null ? null : `${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}%`);
const TONE_TEXT = { red: "text-red", amber: "text-[#9a5b00]", green: "text-[#1e7a3c]", neutral: "text-muted" };
const availability = (v: { kind: "new" | "used"; stock: number; availability: "in_stock" | "on_order"; waitingWeeks: number | null }) =>
  v.kind === "used" ? (v.stock > 0 ? "Available" : "Sold") : v.availability === "on_order" ? `On order · ${orderWait(v.waitingWeeks)}` : `${v.stock} in stock`;

const VIEWS = ["queue", "new", "all"] as const;

export default async function VehicleApprovalsPage({ searchParams }: PageProps<"/admin/vehicle-approvals">) {
  await requireStaff();
  const sp = await searchParams;
  const view = VIEWS.find((x) => x === sp.view) ?? "queue";
  const partnerParam = strParam(sp.partner);
  const params = {
    view: view === "queue" ? undefined : view,
    q: strParam(sp.q),
    kind: view === "all" ? strParam(sp.kind) : undefined,
    status: view === "queue" ? undefined : strParam(sp.status),
    partner: partnerParam && /^\d+$/.test(partnerParam) ? partnerParam : undefined,
  };
  const reviewId = strParam(sp.review);
  const [{ rows, total, page, queue, liveNew, byStatus, now }, review] = await Promise.all([
    listPartnerVehicles({ view, q: params.q, kind: params.kind, status: params.status, partner: params.partner ? Number(params.partner) : undefined, page: pageParam(sp.page) }),
    reviewId && /^\d+$/.test(reviewId) ? getVehicleReview(Number(reviewId)) : Promise.resolve(null),
  ]);
  const all = Object.values(byStatus).reduce((a, b) => a + (b ?? 0), 0);
  const base = "/admin/vehicle-approvals";
  const listParams = { ...params, page: sp.page ? String(pageParam(sp.page)) : undefined };
  const hasFilters = Boolean(params.q || params.kind || params.status || params.partner);
  const keep = { q: params.q, partner: params.partner };

  return (
    <>
      <AdminHeader
        title="Vehicle approvals"
        description="Used-car listings waiting for review, oldest first — approve, publish, send back for corrections or reject; published ones go live on /used-cars. New-car listings don't need approval: dealers publish them from the catalogue, and you can pause any of them with remarks."
      />
      <LinkTabs
        active={view}
        items={[
          { key: "queue", label: "Used cars to review", count: queue, href: hrefWith(base, keep, {}) },
          { key: "new", label: "New-car stock", count: liveNew, href: hrefWith(base, keep, { view: "new" }) },
          { key: "all", label: "All listings", count: all, href: hrefWith(base, keep, { view: "all" }) },
        ]}
      />
      <FilterForm resetHref={hrefWith(base, { view: params.view }, {})} hasFilters={hasFilters}>
        {params.view && <input type="hidden" name="view" value={params.view} />}
        {params.partner && <input type="hidden" name="partner" value={params.partner} />}
        <SearchInput value={params.q} placeholder="Reference, model, VIN, dealer…" />
        {view === "all" && <FilterSelect name="kind" label="New & used" value={params.kind} options={[{ value: "new", label: "New cars" }, { value: "used", label: "Used cars" }]} />}
        {view === "new" && (
          <FilterSelect
            name="status"
            label="Live and paused"
            value={params.status}
            options={(["published", "unpublished", "draft", "changes_requested", "archived"] as const).map((s) => ({ value: s, label: s === "unpublished" ? "Paused" : VEHICLE_STATUS_LABEL[s] }))}
          />
        )}
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
          <EmptyState icon={<CarFront aria-hidden className="size-5" />} title={hasFilters ? "No listings match" : view === "queue" ? "No used cars waiting" : view === "new" ? "No new-car stock yet" : "No listings yet"}>
            {hasFilters
              ? "Try another search or filter."
              : view === "queue"
                ? "Used cars dealers submit for approval appear here, oldest first."
                : view === "new"
                  ? "New-car listings appear here as soon as a dealer publishes them from the catalogue."
                  : "Dealer listings appear here."}
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
                      {v.image && <img decoding="async" src={v.image} alt="" className="size-full object-cover" loading="lazy" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">
                        {v.year} {v.model} {v.variant}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        {v.partnerName ?? v.partnerRef} · {v.kind === "used" ? "Used" : `New · ${availability(v)}`}
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
                  const pending = v.kind === "used" && v.status === "pending_approval";
                  return (
                    <tr key={v.id} className={cn("align-top transition-colors hover:bg-mist/40", review?.vehicle.id === v.id && "bg-mist/60")}>
                      <td className="border-b border-line px-4 py-3">
                        <Link href={href} scroll={false} className="flex items-center gap-3">
                          <span className="block h-11 w-16 shrink-0 overflow-hidden rounded-[2px] bg-mist">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {v.image && <img decoding="async" src={v.image} alt="" className="size-full object-cover" loading="lazy" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold hover:text-red">
                              {v.year} {v.model} {v.variant}
                            </span>
                            <span className="block text-[12px] text-muted">
                              {v.reference} · {v.kind === "used" ? `Used · ${v.fuel} · ${v.imageCount} photo${v.imageCount === 1 ? "" : "s"}` : `New · ${v.colour || "colour not set"} · ${availability(v)}`}
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
                        {v.kind === "new" && v.status === "unpublished" && <span className="mt-1 block text-[11.5px] text-muted">{v.adminRemarks ? "Paused by MarchGear" : "Paused by the dealer"}</span>}
                      </td>
                      <td className="border-b border-line px-4 py-3 text-right">
                        <Link href={href} scroll={false} className={cn("inline-flex h-8 items-center rounded-[3px] px-3 text-[12.5px] font-medium", pending ? "bg-red text-white hover:bg-red-600" : "border border-line hover:border-ink")}>
                          {pending ? "Review" : "Open"}
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
        <ReviewDrawer
          key={review.vehicle.id}
          title={`${review.vehicle.year} ${review.brandName} ${review.vehicle.model}`}
          closeHref={hrefWith(base, listParams, {})}
          footer={<VehicleActions id={review.vehicle.id} kind={review.vehicle.kind} status={review.vehicle.status} partnerApproved={review.partner.status === "approved"} label={`${review.vehicle.model} ${review.vehicle.variant}`} />}
        >
          <VehicleReviewBody r={review} />
        </ReviewDrawer>
      )}
    </>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((f) => (
        <li key={f} className="rounded-full bg-mist px-2.5 py-1 text-[12px]">
          {f}
        </li>
      ))}
    </ul>
  );
}

function VehicleReviewBody({ r }: { r: VehicleReview }) {
  const v = r.vehicle;
  const check = priceCheck(v, r.catalogue);
  const used = r.used;
  const isNew = v.kind === "new";
  const nd = r.newDetails;
  const cat = r.fromCatalogue;
  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <VehiclePill status={v.status} />
        <span className="text-[13px] text-muted">
          {v.reference} · {v.variant} · {isNew ? "New car" : "Used car"}
        </span>
        <Link href={`/admin/dealers/details?id=${r.partner.id}`} className="text-[13px] font-medium hover:text-red">
          {r.partner.name}
        </Link>
        {r.partner.status !== "approved" && <PartnerPill status={r.partner.status} />}
        {v.status === "published" && r.partner.status === "approved" && !isNew && v.publicUsedCarId && (
          <Link href={`/used-cars/${v.publicUsedCarId}`} target="_blank" className="inline-flex items-center gap-1 text-[13px] font-medium text-red hover:underline">
            Live on /used-cars <ExternalLink aria-hidden className="size-3.5" />
          </Link>
        )}
        {v.status === "published" && r.partner.status === "approved" && isNew && r.partner.publicDealerId && cat?.ok && (
          <Link href={`/dealers/${r.partner.publicDealerId}#stock`} target="_blank" className="inline-flex items-center gap-1 text-[13px] font-medium text-red hover:underline">
            Live on the dealer page <ExternalLink aria-hidden className="size-3.5" />
          </Link>
        )}
      </div>

      {!cat?.ok && (
        <p className="flex gap-2 border-l-2 border-red bg-red-50/60 px-4 py-2.5 text-[13px]">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
          <span>
            <span className="font-semibold">Not in the catalogue.</span> This listing&apos;s model or variant isn&apos;t in the published catalogue, so it&apos;s hidden from the website. The dealer has been asked to pick the model again — or add it under New cars if it&apos;s missing.
          </span>
        </p>
      )}

      {isNew && (
        <p className="flex gap-2 border-l-2 border-ink/20 bg-mist/50 px-4 py-2.5 text-[13px]">
          <Library aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
          <span>New-car listings go live when the dealer publishes them. The car — photos, specs and features — comes from the catalogue; the dealer sets only colour, price, availability and showroom.</span>
        </p>
      )}

      {v.status === "published" && r.partner.status !== "approved" && (
        <p className="border-l-2 border-[#e09200] bg-[#fdf3e1]/60 px-4 py-2.5 text-[13px]">
          Published, but hidden from the website while the dealership is {PARTNER_STATUS_LABEL[r.partner.status].toLowerCase()}.
        </p>
      )}

      {v.adminRemarks && (
        <p className="border-l-2 border-[#e09200] bg-[#fdf3e1]/60 px-4 py-2.5 text-[13px]">
          <span className="font-semibold">{isNew && v.status === "unpublished" ? "Paused with remarks:" : "Last remarks to the dealer:"}</span> {v.adminRemarks}
        </p>
      )}

      <div>
        <Gallery images={isNew ? (cat?.images ?? []) : v.images} alt={`${v.model} ${v.variant}`} />
        <p className="mt-1.5 text-[12px] text-muted">{isNew ? "Catalogue photos — what buyers see on this listing." : `${v.images.length} photo${v.images.length === 1 ? "" : "s"} of this car, uploaded by the dealer.`}</p>
      </div>

      <section className={cn("border p-4", check.tone === "red" ? "border-red/30 bg-red-50/40" : check.tone === "amber" ? "border-[#e09200]/30 bg-[#fdf3e1]/50" : "border-line")}>
        <h3 className="flex items-center gap-2 text-[13.5px] font-semibold">
          {check.tone === "red" && <AlertTriangle aria-hidden className="size-4 text-red" />} Pricing
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[12px] text-muted">{isNew ? "Dealer's selling price" : "Asking price"}</p>
            <p className="mt-0.5 font-display text-[20px] font-semibold num">{rupees(v.sellingPrice)}</p>
          </div>
          <div>
            <p className="text-[12px] text-muted">{isNew ? "Catalogue ex-showroom" : "New price today (catalogue)"}</p>
            <p className="mt-0.5 text-[15px] font-medium num">{r.catalogue?.price ? rupees(r.catalogue.price) : r.catalogue ? `${rupees(r.catalogue.priceMin)} – ${rupees(r.catalogue.priceMax)}` : "—"}</p>
            {r.catalogue && <p className="text-[11.5px] text-muted">{r.catalogue.variantName ? `${r.catalogue.carName} ${r.catalogue.variantName}` : `${r.catalogue.carName} (variant not matched)`}</p>}
          </div>
          <div>
            <p className="text-[12px] text-muted">Deviation</p>
            <p className={cn("mt-0.5 text-[15px] font-semibold num", TONE_TEXT[check.tone])}>{pctLabel(check.dev) ?? "—"}</p>
          </div>
        </div>
        <p className={cn("mt-3 text-[12.5px]", TONE_TEXT[check.tone])}>{check.note}</p>
        {isNew && <p className="mt-1 text-[12px] text-muted">Dealers can only publish prices between {PRICE_BAND.min * 100}% and {PRICE_BAND.max * 100}% of the catalogue ex-showroom price.</p>}
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel title={isNew ? "The dealer's listing" : "Vehicle"}>
          <Facts
            className="-my-2.5"
            rows={[
              ["Brand / model", `${r.brandName} ${v.model}`],
              ["Variant", v.variant],
              [isNew ? "Model year" : "Manufactured", v.year || null],
              ["Fuel / gearbox", `${v.fuel} · ${v.transmission}`],
              [
                "Colour",
                v.colour ? (
                  <span className="inline-flex items-center gap-1.5">
                    {cat?.colourHex && <span aria-hidden className="size-3 rounded-full border border-black/10" style={{ backgroundColor: cat.colourHex }} />}
                    {v.colour}
                  </span>
                ) : null,
              ],
              ["Availability", isNew && nd ? (nd.availability === "on_order" ? `On order · ${orderWait(nd.waitingWeeks)}` : `${v.stock} in stock`) : v.stock > 0 ? "Available" : "Sold"],
              ["Stock no. / VIN", v.vin && <span className="font-mono text-[12.5px]">{v.vin}</span>],
              ["Showroom", r.showroom ? `${r.showroom.name}, ${r.showroom.city}` : null],
              [isNew ? "Published" : "Submitted", isNew ? (v.publishedAt ? formatDateTime(v.publishedAt) : null) : v.submittedAt ? formatDateTime(v.submittedAt) : null],
            ]}
          />
        </Panel>
        {used ? (
          <Panel title="Used-car disclosures">
            <Facts
              className="-my-2.5"
              rows={[
                ["Condition", conditionLabel(used.condition) || null],
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
          <Panel title="Features (from the catalogue)">{cat?.features.length ? <Chips items={cat.features} /> : <p className="text-[13px] text-muted">The catalogue lists no features for this variant.</p>}</Panel>
        )}
      </div>

      {!isNew && (
        <Panel title="Condition notes">
          {v.description ? <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{v.description}</p> : <p className="text-[13px] text-muted">No condition notes.</p>}
        </Panel>
      )}

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
                  <img loading="lazy" decoding="async" src={`/dealer/files/${r.inspection.id}`} alt="Inspection report" className="max-h-full max-w-full object-contain" />
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

      {cat && cat.specs.length > 0 && (
        <Panel title="Specifications (from the catalogue)">
          <Facts className="-my-2.5" rows={cat.specs.map((s) => [s.label, s.value])} />
        </Panel>
      )}

      {!isNew && cat && cat.features.length > 0 && (
        <Panel title="Features (from the catalogue)">
          <Chips items={cat.features} />
        </Panel>
      )}

      <Panel title="History">
        <HistoryList entries={r.history} showTarget={false} empty="No decisions on this listing yet." />
      </Panel>
      <p className="text-[12px] text-muted">
        {v.views.toLocaleString("en-IN")} views · {v.enquiries.toLocaleString("en-IN")} enquiries
        {v.publishedAt ? ` · published ${formatDateTime(v.publishedAt)}` : ""}
      </p>
    </div>
  );
}
