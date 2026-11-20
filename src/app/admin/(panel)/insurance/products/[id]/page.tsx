import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ExternalLink, FileText, Store } from "lucide-react";
import { INS_PRODUCT_CATEGORY_BLURB, INS_PRODUCT_CATEGORY_LABEL, INS_VENDOR_CATEGORY_LABEL, INS_VENDOR_STATUS_LABEL } from "@/insurance/labels";
import { STANDARD_COVER_BY_KEY } from "@/insurance/covers";
import { estimateCars, getInsProductReview, type InsFileRow } from "@/server/admin/insurance";
import { requireStaff } from "@/server/auth";
import { todayISO } from "@/server/validation";
import { Button } from "@/components/ui/button";
import { AdminHeader, Panel, formatDateTime } from "@/components/admin/ui";
import { CoverPill, Facts, InsFilePill, InsHistoryList, ProductPill, StatusPill, VendorMessage, fileSize, rupees } from "@/components/admin/insurance/ui";
import { coverPricingLabel } from "@/components/admin/insurance/covers/labels";
import { ProductDecisionPanel } from "@/components/admin/insurance/products/product-actions";
import { SampleEstimate } from "@/components/admin/insurance/products/sample-estimate";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/admin/insurance/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: /^\d+$/.test(id) ? `Product review ${id}` : "Product review" };
}

const any = (list: string[], label = "Any") => (list.length ? list.join(", ") : <span className="text-muted">{label}</span>);

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-[13.5px] text-muted">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((x, i) => (
        <li key={`${x}-${i}`} className="flex gap-2.5 text-[13.5px]">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink/40" />
          <span className="min-w-0 break-words">{x}</span>
        </li>
      ))}
    </ul>
  );
}

function DocLink({ label, file, refName, privateNote }: { label: string; file: InsFileRow | null; refName: string | null; privateNote?: string }) {
  return (
    <li className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{label}</span>
        {file ? (
          <a href={`/insurance-vendor/files/${file.id}`} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1.5 text-[12.5px] text-muted hover:text-red">
            <FileText aria-hidden className="size-3.5 shrink-0" /> <span className="truncate">{file.filename}</span> · {fileSize(file.size)} ↗
          </a>
        ) : (
          <span className="mt-0.5 block text-[12.5px] text-muted">{refName ? "File no longer available" : "Not uploaded"}</span>
        )}
        {privateNote && <span className="mt-0.5 block text-[11.5px] text-muted">{privateNote}</span>}
      </span>
      {file && <InsFilePill status={file.status} />}
    </li>
  );
}

export default async function ProductReviewPage({ params }: PageProps<"/admin/insurance/products/[id]">) {
  await requireStaff();
  const { id } = await params;
  const r = /^\d+$/.test(id) ? await getInsProductReview(Number(id)) : null;
  if (!r) notFound();
  const cars = await estimateCars();
  const today = todayISO();
  const p = r.product;
  const allCovers = [...r.coverage, ...r.addOns.map((a) => a.cover!)];
  const pendingCovers = [...new Map(allCovers.filter((c) => c.status === "pending_approval").map((c) => [c.id, { id: c.id, name: c.name }])).values()];
  const blockedCovers = [...new Map(allCovers.filter((c) => c.status !== "approved" && c.status !== "pending_approval").map((c) => [c.id, { id: c.id, name: c.name, status: c.status }])).values()];
  const odRange = r.pricingConfig.odRate;
  const odOut = p.pricing.odRatePct < odRange.min || p.pricing.odRatePct > odRange.max;
  const live = p.status === "published" && r.vendor.status === "approved" && r.company.isActive;
  const doc = (ref: { id: number } | null | undefined) => (ref ? (r.docs.find((d) => d.id === ref.id) ?? null) : null);
  const isIntermediary = r.vendor.category !== "insurer";

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/insurance/products", label: "All products" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-words">{p.name}</span>
            <span className="tracking-normal">
              <ProductPill status={p.status} />
            </span>
          </span>
        }
        description={`${p.reference} · ${INS_PRODUCT_CATEGORY_LABEL[p.category]} · by ${r.vendor.name} · underwritten by ${r.company.name}`}
        actions={
          <>
            <Button href={`/admin/insurance/vendors/${r.vendor.id}`} variant="outline" size="sm" icon={<Store className="size-4" aria-hidden />}>
              Vendor
            </Button>
            {live && (
              <Button href={`/insurance/products/${p.reference}`} target="_blank" variant="outline" size="sm" icon={<ExternalLink className="size-4" aria-hidden />}>
                View on site
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <VendorMessage remarks={p.adminRemarks} corrections={p.requiredCorrections} title="Latest message to the vendor" />

          <Panel title="Basics">
            <Facts
              className="-my-2.5"
              rows={[
                ["Name", p.name],
                ["Tagline", p.tagline],
                ["Category", <span key="c">{INS_PRODUCT_CATEGORY_LABEL[p.category]}<span className="block text-[12.5px] text-muted">{INS_PRODUCT_CATEGORY_BLURB[p.category]}</span></span>],
                ["Reference", <span key="r" className="font-mono text-[13px]">{p.reference}</span>],
                ["Vendor's code", <span key="v" className="font-mono text-[13px]">{p.code}</span>],
                ["Insurer's UIN", p.uin && <span className="font-mono text-[13px]">{p.uin}</span>],
                ["Description", <span key="d" className="whitespace-pre-line">{p.description}</span>],
                ["Cashless garages", p.garageCount ? p.garageCount.toLocaleString("en-IN") : "Uses the insurer's figure"],
                ["Created", `${formatDateTime(p.createdAt)}${r.createdByName ? ` by ${r.createdByName}` : ""}`],
                ["Submitted", p.submittedAt ? formatDateTime(p.submittedAt) : null],
                ["Approved", p.approvedAt ? formatDateTime(p.approvedAt) : null],
                ["Published", p.publishedAt ? formatDateTime(p.publishedAt) : null],
              ]}
            />
          </Panel>

          <Panel title="Underwriter">
            <Facts
              className="-my-2.5"
              rows={[
                [
                  "Insurance company",
                  <span key="c" className="inline-flex flex-wrap items-center gap-2">
                    <Link href={`/admin/insurance/companies/${r.company.id}`} className="font-medium hover:text-red">
                      {r.company.name}
                    </Link>
                    {r.company.isActive ? <StatusPill tone="green">Active</StatusPill> : <StatusPill tone="neutral">Inactive — products hidden</StatusPill>}
                  </span>,
                ],
                ["Sold by", <span key="s">{r.vendor.name}<span className="block text-[12.5px] text-muted">{r.vendor.category ? INS_VENDOR_CATEGORY_LABEL[r.vendor.category] : "Category not set"} · {INS_VENDOR_STATUS_LABEL[r.vendor.status]}</span></span>],
                [
                  "Relationship",
                  r.company.vendorId === r.vendor.id
                    ? "The vendor is this insurer"
                    : isIntermediary
                      ? "Intermediary distributing the insurer's product — check the tie-up letter"
                      : <span key="w" className="inline-flex items-center gap-1.5 text-[#9a5b00]"><AlertTriangle aria-hidden className="size-3.5" /> An insurer vendor selling another insurer&apos;s product</span>,
                ],
              ]}
            />
            {isIntermediary && (
              <ul className="-mx-5 -mb-5 mt-4 divide-y divide-line border-t border-line">
                <DocLink label="Insurer authorisation / tie-up letter" file={doc(p.documents?.tieUp)} refName={p.documents?.tieUp?.filename ?? null} privateNote="Never shown publicly." />
              </ul>
            )}
          </Panel>

          <Panel title="Eligibility">
            <Facts
              className="-my-2.5"
              rows={[
                ["Body types", any(p.eligibility.bodyTypes)],
                ["Luxury cars", p.eligibility.luxury === "any" ? "Allowed" : p.eligibility.luxury === "exclude" ? "Excluded" : "Only luxury cars"],
                ["Brands", any(p.eligibility.brands.map((b) => r.brandNames[b] ?? b))],
                ["Models", any(p.eligibility.models.map((m) => r.modelNames[m] ?? m))],
                ["Fuels", any(p.eligibility.fuels)],
                ["Car age", `${p.eligibility.minAgeYears}–${p.eligibility.maxAgeYears} years at policy start`],
                ["States", any(p.eligibility.states, "All of India")],
                ["Cities", any(p.eligibility.cities, "All cities")],
              ]}
            />
          </Panel>

          <Panel title="Coverage">
            <Facts
              className="-my-2.5"
              rows={[
                ["Own damage", p.coverage.ownDamage ? "Covered" : "Not covered"],
                ["Third party", p.coverage.thirdParty ? "Covered" : "Not covered"],
                ["Owner-driver PA", p.coverage.paOwnerDriver === "included" ? "Included" : p.coverage.paOwnerDriver === "optional" ? "Optional" : "Not offered"],
                ["TP property limit", p.coverage.tpPropertyLimit],
              ]}
            />
            <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <p className="mb-2 text-[12.5px] font-medium text-muted">Highlights</p>
                <Chips items={p.coverage.highlights} empty="No highlights added." />
              </div>
              <div>
                <p className="mb-2 text-[12.5px] font-medium text-muted">Coverage items</p>
                {r.coverage.length === 0 ? (
                  <p className="text-[13.5px] text-muted">No coverage items attached.</p>
                ) : (
                  <ul className="divide-y divide-line border border-line">
                    {r.coverage.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <Link href={`/admin/insurance/coverage?status=all&review=${c.id}`} className="min-w-0 truncate text-[13.5px] font-medium hover:text-red">
                          {c.name}
                        </Link>
                        <CoverPill status={c.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Add-on covers" padded={false}>
            {r.addOns.length === 0 ? (
              <p className="p-5 text-[13.5px] text-muted">No add-ons offered with this product.</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[13.5px]">
                  <thead>
                    <tr className="text-[12px] text-muted">
                      {["Add-on", "Offered as", "Pricing for estimates", "Status"].map((h) => (
                        <th key={h} className="border-b border-line bg-mist/60 px-5 py-3 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.addOns.map(({ cover: c, included }) => (
                      <tr key={c!.id} className="border-b border-line last:border-0">
                        <td className="px-5 py-3">
                          <Link href={`/admin/insurance/add-ons?status=all&review=${c!.id}`} className="font-medium hover:text-red">
                            {c!.name}
                          </Link>
                          <span className="block text-[12px] text-muted">{STANDARD_COVER_BY_KEY[c!.key]?.name ?? (c!.key === "custom" ? "Custom cover" : c!.key)}</span>
                        </td>
                        <td className="px-5 py-3">{included ? "Included in the price" : "Optional"}</td>
                        <td className="px-5 py-3">{coverPricingLabel(c!.pricing)}</td>
                        <td className="px-5 py-3">
                          <CoverPill status={c!.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {r.missingCovers.length > 0 && <p className="border-t border-line px-5 py-3 text-[12.5px] text-red">{r.missingCovers.length} referenced cover{r.missingCovers.length === 1 ? " no longer exists" : "s no longer exist"} — request changes so the vendor can fix the product.</p>}
          </Panel>

          <Panel title="Pricing">
            <Facts
              className="-my-2.5"
              rows={[
                [
                  "Own-damage rate",
                  <span key="od" className="inline-flex flex-wrap items-center gap-2">
                    <span className="num">{p.pricing.odRatePct}% of IDV a year</span>
                    {odOut ? <StatusPill tone="red">Outside the allowed {odRange.min}–{odRange.max}%</StatusPill> : <StatusPill tone="green">Within {odRange.min}–{odRange.max}%</StatusPill>}
                  </span>,
                ],
                ["Minimum OD premium", rupees(p.pricing.minOdPremium)],
                ["OD adjustment", p.pricing.odAdjustmentPct ? `${p.pricing.odAdjustmentPct > 0 ? "+" : ""}${p.pricing.odAdjustmentPct}%` : "None"],
                ["IDV band", `${p.pricing.idvMinPct}% to +${p.pricing.idvMaxPct}% of the computed IDV`],
                ["Policy term", `${p.pricing.odYears ? `${p.pricing.odYears}-year own damage` : "No own damage"} · ${p.pricing.tpYears ? `${p.pricing.tpYears}-year third party` : "no third party"}`],
              ]}
            />
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-[13.5px] font-semibold">Sample indicative estimate</h3>
              <p className="mb-4 mt-0.5 text-[12.5px] text-muted">Pick a catalogue car to see what this product&apos;s pricing gives, with the current pricing configuration.</p>
              <SampleEstimate
                cars={cars}
                today={today}
                config={r.pricingConfig}
                pricing={p.pricing}
                paOwnerDriver={p.coverage.paOwnerDriver}
                addOns={r.addOns.map((a) => ({ coverId: a.coverId, key: a.cover!.key, name: a.cover!.name, pricing: a.cover!.pricing, included: a.included, status: a.cover!.status }))}
                eligibility={p.eligibility}
              />
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Deductibles">
              <Facts
                className="-my-2.5"
                rows={[
                  ["Compulsory", rupees(p.deductibles.compulsory)],
                  ["Voluntary options", p.deductibles.voluntary.length ? p.deductibles.voluntary.map((x) => rupees(x)).join(", ") : "None"],
                ]}
              />
            </Panel>
            <Panel title="Exclusions">
              <Chips items={p.exclusions} empty="No exclusions listed." />
            </Panel>
          </div>

          <Panel title="Documents" padded={false}>
            <ul className="divide-y divide-line">
              <DocLink label="Product brochure" file={doc(p.documents?.brochure)} refName={p.documents?.brochure?.filename ?? null} privateNote="Downloadable publicly while the product is published." />
              <DocLink label="Policy wording" file={doc(p.documents?.wording)} refName={p.documents?.wording?.filename ?? null} privateNote="Downloadable publicly while the product is published." />
              {!isIntermediary && p.documents?.tieUp && <DocLink label="Insurer authorisation / tie-up letter" file={doc(p.documents.tieUp)} refName={p.documents.tieUp.filename} privateNote="Never shown publicly." />}
            </ul>
          </Panel>

          <Panel title="Terms">{p.terms ? <p className="whitespace-pre-line break-words text-[13.5px] leading-relaxed">{p.terms}</p> : <p className="text-[13.5px] text-muted">No additional terms.</p>}</Panel>

          <Panel title="History">
            <InsHistoryList entries={r.history} showTarget={false} empty="Nothing has happened on this product yet." />
          </Panel>
        </div>

        <div className="order-first space-y-6 xl:sticky xl:top-6 xl:order-none xl:self-start">
          <Panel title="Decision">
            <ProductDecisionPanel
              productId={p.id}
              name={p.name}
              status={p.status}
              vendorApproved={r.vendor.status === "approved"}
              vendorStatusLabel={INS_VENDOR_STATUS_LABEL[r.vendor.status]}
              companyActive={r.company.isActive}
              companyName={r.company.name}
              pendingCovers={pendingCovers}
              blockedCovers={blockedCovers}
              missingCovers={r.missingCovers.length}
              plan={{ name: r.plan?.name ?? r.vendor.plan, limit: r.plan?.products ?? null, published: r.publishedCount }}
            />
          </Panel>
          <Panel title="Public visibility">
            <ul className="space-y-2 text-[13px]">
              {[
                { ok: p.status === "published", text: p.status === "published" ? "Product is published" : "Product isn't published" },
                { ok: r.vendor.status === "approved", text: `Vendor is ${INS_VENDOR_STATUS_LABEL[r.vendor.status].toLowerCase()}` },
                { ok: r.company.isActive, text: `${r.company.name} is ${r.company.isActive ? "active" : "inactive"}` },
              ].map((x) => (
                <li key={x.text} className="flex items-center gap-2">
                  <span aria-hidden className={cn("size-2 shrink-0 rounded-full", x.ok ? "bg-[#22a04f]" : "bg-ink/25")} />
                  <span className={x.ok ? "" : "text-muted"}>{x.text}</span>
                </li>
              ))}
            </ul>
            <p className={cn("mt-3 text-[12.5px] font-medium", live ? "text-[#1e7a3c]" : "text-muted")}>{live ? "Live on MarchGear." : "Not shown on the website."}</p>
            {r.plan && (
              <p className="mt-1 text-[12px] text-muted">
                {r.plan.name} plan · {r.publishedCount} of {r.plan.products ?? "unlimited"} published products used
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

