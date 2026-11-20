import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check, Download, FileText, X } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { todayISO } from "@/server/validation";
import { getActiveCampaigns, getPublicProduct } from "@/server/insurance/public";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { INDICATIVE_NOTE, INS_PRODUCT_CATEGORY_BLURB, INS_PRODUCT_CATEGORY_LABEL, INS_VENDOR_CATEGORY_LABEL } from "@/insurance/labels";
import { STANDARD_COVER_BY_KEY } from "@/insurance/covers";
import { parseSearch } from "@/insurance/search";
import { formatNumber } from "@/lib/format";
import { TrackInsuranceView } from "@/components/insurance/public/market/track";
import { CompanyLogo, Tag } from "@/components/insurance/public/market/ui";
import { ProductEstimator } from "@/components/insurance/public/market/product-estimator";
import { CampaignCard } from "@/components/insurance/public/market/campaign-card";
import { eligibilitySummary, pricingBasisLabel } from "@/components/insurance/public/market/display";
import { fileSize, inr } from "@/components/insurance/public/market/money";
import { idParam, listParam, pricingConfig, termLabel } from "@/components/insurance/public/market/engine";

export async function generateMetadata(props: PageProps<"/insurance/products/[ref]">): Promise<Metadata> {
  const { ref } = await props.params;
  const p = await getPublicProduct(ref);
  if (!p) return { title: "Plan not found" };
  return {
    title: `${p.name} — ${p.company.name}`,
    description: p.tagline ?? p.description.slice(0, 160),
  };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ProductPage(props: PageProps<"/insurance/products/[ref]">) {
  const [{ ref }, sp] = await Promise.all([props.params, props.searchParams]);
  const p = await getPublicProduct(ref);
  if (!p) notFound();
  const catalog = await getCatalog();
  const config = pricingConfig(catalog.content.insurancePricing);
  const campaigns = (await getActiveCampaigns(50)).filter((c) => c.vendorId === p.vendorId && c.productIds.includes(p.id));
  const campaignId = idParam(sp.campaign);
  const attribution = {
    source: /^[a-z0-9_-]{2,40}$/.test(first(sp.src)) ? first(sp.src) : campaignId ? "campaign" : idParam(sp.ad) ? "ad" : "product",
    campaignId,
    adId: idParam(sp.ad),
  };
  const addOns = p.addOns;
  const docs = (["brochure", "wording"] as const).flatMap((k) => (p.documents[k] ? [{ k, d: p.documents[k]! }] : []));

  return (
    <>
      <TrackInsuranceView kind="product_view" vendorId={p.vendorId} refId={p.id} />

      {/* Hero */}
      <section className="border-b border-line">
        <div className="container-x pb-10 pt-8 md:pb-14 md:pt-10">
          <Breadcrumbs
            items={[
              { label: "Insurance", href: "/insurance" },
              { label: p.company.shortName ?? p.company.name, href: `/insurance/providers/${p.company.slug}` },
              { label: p.name },
            ]}
          />
          <div className="mt-10 max-w-4xl md:mt-14">
            <div className="flex items-center gap-4">
              <CompanyLogo company={p.company} />
              <Link href={`/insurance/providers/${p.company.slug}`} className="text-[14px] font-medium text-ink hover:text-red">
                {p.company.name}
              </Link>
            </div>
            <h1 className="type-h1 mt-7 text-balance">{p.name}</h1>
            {p.tagline && <p className="type-lead mt-5 max-w-2xl text-muted">{p.tagline}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Tag tone="ink">{INS_PRODUCT_CATEGORY_LABEL[p.category]}</Tag>
              <span className="text-[13px] text-muted num">{termLabel(p.pricing)}</span>
              {p.uin && <span className="text-[13px] text-muted">UIN {p.uin}</span>}
              <span className="font-mono text-[12px] text-muted">{p.reference}</span>
            </div>
            {p.soldBy && (
              <p className="mt-5 text-[13px] text-muted">
                Underwritten by <span className="text-ink">{p.company.name}</span> · sold by <span className="text-ink">{p.soldBy}</span>
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="container-x grid grid-cols-1 gap-12 py-10 md:py-14 lg:grid-cols-12 lg:gap-14">
        {/* Estimator (first on mobile) */}
        <aside className="lg:order-2 lg:col-span-4">
          <div className="lg:sticky lg:top-[140px]">
            <ProductEstimator product={p} config={config} initialSearch={parseSearch(sp)} initialAddOns={listParam(sp.addons)} today={todayISO()} attribution={attribution} />
            <p className="mt-4 text-[11.5px] leading-relaxed text-muted">{INDICATIVE_NOTE}</p>
          </div>
        </aside>

        <div className="min-w-0 space-y-14 lg:order-1 lg:col-span-8">
          {/* Overview */}
          <section aria-labelledby="overview">
            <H2 id="overview" eyebrow="Overview">
              About this plan
            </H2>
            <p className="mt-5 max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-ink/85">{p.description}</p>
            <p className="mt-3 max-w-3xl text-[13.5px] text-muted">{INS_PRODUCT_CATEGORY_BLURB[p.category]}</p>
            {p.coverage.highlights.length > 0 && (
              <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {p.coverage.highlights.map((h) => (
                  <li key={h} className="flex gap-3 border-l-2 border-red bg-mist/60 px-4 py-3 text-[14px] text-ink">
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Cover */}
          <section aria-labelledby="cover">
            <H2 id="cover" eyebrow="Cover">
              What&apos;s covered
            </H2>
            <dl className="mt-6 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-3">
              <Cell label="Own damage" ok={p.coverage.ownDamage && p.pricing.odYears > 0} text={p.pricing.odYears ? `${p.pricing.odYears} year${p.pricing.odYears === 1 ? "" : "s"}` : "Not covered"} />
              <Cell
                label="Third-party liability"
                ok={p.coverage.thirdParty && p.pricing.tpYears > 0}
                text={p.pricing.tpYears ? `${p.pricing.tpYears} year${p.pricing.tpYears === 1 ? "" : "s"}${p.coverage.tpPropertyLimit ? ` · property up to ${p.coverage.tpPropertyLimit}` : ""}` : "Not covered"}
              />
              <Cell
                label="Owner-driver PA cover"
                ok={p.coverage.paOwnerDriver !== "none"}
                text={p.coverage.paOwnerDriver === "included" ? "Included" : p.coverage.paOwnerDriver === "optional" ? `Optional · about ${inr(config.paOwnerDriver)} a year` : "Not offered"}
              />
            </dl>
            {p.coverageItems.length > 0 && (
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {p.coverageItems.map((c) => (
                  <li key={c.id} className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                    <p className="text-[14px] font-medium text-ink">{c.name}</p>
                    <div className="text-[13.5px] leading-relaxed text-muted">
                      {c.description}
                      {c.limits && <span className="mt-1 block text-ink/80">Limit: {c.limits}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Add-ons */}
          <section aria-labelledby="addons">
            <H2 id="addons" eyebrow="Add-ons">
              Add-on covers
            </H2>
            {addOns.length === 0 ? (
              <p className="mt-5 text-[14px] text-muted">{p.pricing.odYears === 0 ? "Add-ons attach to own-damage cover, which this plan doesn't include." : "No add-on covers are offered with this plan."}</p>
            ) : (
              <div className="relative mt-6 overflow-x-auto border border-line">
                <table className="w-full min-w-[560px] text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line bg-mist/60 text-left text-[12px] text-muted">
                      <th scope="col" className="px-5 py-3 font-medium">
                        Add-on
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        With this plan
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Indicative price
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {addOns.map((a) => (
                      <tr key={a.id}>
                        <th scope="row" className="px-5 py-4 text-left align-top font-normal">
                          <span className="font-medium text-ink">{a.name}</span>
                          <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">{a.description || STANDARD_COVER_BY_KEY[a.key]?.summary}</span>
                          {(a.eligibility || a.maxVehicleAgeYears !== null || a.limits || a.fuels.length > 0) && (
                            <span className="mt-1.5 block text-[12px] text-ink/70">
                              {[
                                a.eligibility,
                                !a.eligibility && a.maxVehicleAgeYears !== null ? `Cars up to ${a.maxVehicleAgeYears} years old` : null,
                                a.fuels.length ? `${a.fuels.join(", ")} cars` : null,
                                a.limits,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                          {a.exclusions.length > 0 && <span className="mt-1 block text-[12px] text-muted">Excludes: {a.exclusions.join("; ")}</span>}
                        </th>
                        <td className="px-5 py-4 align-top">{a.included ? <span className="font-medium text-ink">Included</span> : "Optional"}</td>
                        <td className="px-5 py-4 align-top text-muted">{a.included ? "In the premium" : pricingBasisLabel(a.pricing)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[12px] text-muted">Choose a car in the estimator to see each add-on&apos;s indicative price for it.</p>
          </section>

          {/* Eligibility, deductibles, garages */}
          <section aria-labelledby="eligibility" className="grid grid-cols-1 gap-10 md:grid-cols-2">
            <div>
              <H2 id="eligibility" eyebrow="Eligibility">
                Who it&apos;s for
              </H2>
              <dl className="mt-5 divide-y divide-line border-y border-line text-[13.5px]">
                {eligibilitySummary(p.eligibility).map((e) => (
                  <div key={e.label} className="flex justify-between gap-6 py-3">
                    <dt className="text-muted">{e.label}</dt>
                    <dd className="text-right text-ink">{e.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <H2 eyebrow="Costs at claim time">Deductibles and garages</H2>
              <dl className="mt-5 divide-y divide-line border-y border-line text-[13.5px]">
                <div className="flex justify-between gap-6 py-3">
                  <dt className="text-muted">Compulsory deductible</dt>
                  <dd className="text-right text-ink num">{p.deductibles.compulsory ? `${inr(p.deductibles.compulsory)} per claim` : "None"}</dd>
                </div>
                <div className="flex justify-between gap-6 py-3">
                  <dt className="text-muted">Voluntary deductible</dt>
                  <dd className="text-right text-ink num">{p.deductibles.voluntary.length ? p.deductibles.voluntary.map((v) => inr(v)).join(", ") : "Not offered"}</dd>
                </div>
                <div className="flex justify-between gap-6 py-3">
                  <dt className="text-muted">Cashless garages</dt>
                  <dd className="text-right text-ink num">{p.garageCount ? `${formatNumber(p.garageCount)} (as stated by the insurer)` : "Not stated"}</dd>
                </div>
                <div className="flex justify-between gap-6 py-3">
                  <dt className="text-muted">IDV you can choose</dt>
                  <dd className="text-right text-ink num">{p.pricing.odYears ? `${p.pricing.idvMinPct}% to +${p.pricing.idvMaxPct}% of the suggested value` : "Not applicable"}</dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Exclusions */}
          <section aria-labelledby="exclusions">
            <H2 id="exclusions" eyebrow="Exclusions">
              What isn&apos;t covered
            </H2>
            {p.exclusions.length ? (
              <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {p.exclusions.map((e) => (
                  <li key={e} className="flex gap-3 text-[14px] leading-relaxed text-ink">
                    <X className="mt-1 size-3.5 shrink-0 text-red" aria-hidden />
                    {e}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-[14px] text-muted">See the policy wording for the full list of exclusions.</p>
            )}
          </section>

          {/* Documents + terms */}
          <section aria-labelledby="documents">
            <H2 id="documents" eyebrow="Documents">
              Brochure, wording and terms
            </H2>
            {docs.length > 0 ? (
              <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {docs.map(({ k, d }) => (
                  <li key={k}>
                    <a
                      href={`/insurance/products/${p.reference}/documents/${k}`}
                      target="_blank"
                      rel="noopener"
                      className="group flex items-center gap-4 border border-line px-4 py-3.5 transition-colors hover:border-ink"
                    >
                      <FileText className="size-5 shrink-0 text-ink/70" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-ink">{k === "brochure" ? "Product brochure" : "Policy wording"}</span>
                        <span className="block text-[12px] text-muted">
                          {d.mime === "application/pdf" ? "PDF" : "Image"} · {fileSize(d.size)}
                        </span>
                      </span>
                      <Download className="size-4 text-red" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-[14px] text-muted">The insurer hasn&apos;t published a brochure or policy wording for this plan yet — ask for it with your quote.</p>
            )}
            {p.terms && (
              <div className="mt-6 border-l-2 border-line pl-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Terms and conditions</p>
                <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink/80">{p.terms}</p>
              </div>
            )}
          </section>

          {/* Insurer + seller */}
          <section aria-labelledby="who" className="border-t border-line pt-10">
            <H2 id="who" eyebrow="Who you buy from">
              {p.soldBy ? "Insurer and seller" : "The insurer"}
            </H2>
            <div className={p.soldBy ? "mt-6 grid grid-cols-1 gap-5 md:grid-cols-2" : "mt-6"}>
              <Link href={`/insurance/providers/${p.company.slug}`} className="group flex items-center gap-4 border border-line p-5 transition-colors hover:border-ink">
                <CompanyLogo company={p.company} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] text-muted">Underwritten by</span>
                  <span className="block text-[15px] font-semibold text-ink">{p.company.name}</span>
                </span>
                <ArrowUpRight className="size-4 text-red" aria-hidden />
              </Link>
              {p.soldBy && (
                <div className="flex items-center gap-4 border border-line p-5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-[3px] bg-mist">
                    <Check className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11.5px] text-muted">Sold by</span>
                    <span className="block text-[15px] font-semibold text-ink">{p.vendorName}</span>
                    {p.vendorCategory && <span className="block text-[12px] text-muted">{INS_VENDOR_CATEGORY_LABEL[p.vendorCategory]}, approved by MarchGear</span>}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Campaigns */}
          {campaigns.length > 0 && (
            <section aria-labelledby="promotions">
              <H2 id="promotions" eyebrow="Promotions">
                Running now on this plan
              </H2>
              <ul className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                {campaigns.map((c) => (
                  <li key={c.id}>
                    <CampaignCard campaign={c} href={`/insurance/quotes?campaign=${c.id}&provider=${p.company.slug}`} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-muted">Promotions are run by the provider named on each card and approved by MarchGear. Terms are the provider&apos;s.</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function H2({ id, eyebrow, children }: { id?: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="type-eyebrow inline-flex items-center gap-3 text-ink">
        <span aria-hidden className="h-px w-6 bg-red" />
        {eyebrow}
      </p>
      <h2 id={id} className="type-h3 mt-4">
        {children}
      </h2>
    </div>
  );
}

function Cell({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-1.5 flex items-start gap-2 text-[14px] text-ink">
        <span className={ok ? "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-ink text-white" : "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-line text-muted"}>
          {ok ? <Check className="size-2.5" strokeWidth={3} aria-hidden /> : <X className="size-2.5" aria-hidden />}
        </span>
        {text}
      </dd>
    </div>
  );
}
