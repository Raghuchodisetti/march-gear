import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BadgeCheck, Building2, Clock, Download, Globe, Mail, Phone, ShieldAlert, Wrench } from "lucide-react";
import { getPublicCompany } from "@/server/insurance/public";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { InsuranceSearchForm } from "@/components/insurance/search/insurance-search-form";
import { TrackInsuranceView } from "@/components/insurance/public/market/track";
import { CompanyLogo, Tag } from "@/components/insurance/public/market/ui";
import { fileSize } from "@/components/insurance/public/market/money";
import { termLabel } from "@/components/insurance/public/market/engine";
import { INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { STANDARD_COVER_BY_KEY } from "@/insurance/covers";
import { formatDate, formatNumber } from "@/lib/format";
import { INSURANCE_OG_IMAGE, fitDescription, fitTitle, pageMetadata } from "@/components/seo/metadata";

export async function generateMetadata(props: PageProps<"/insurance/providers/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const c = await getPublicCompany(slug);
  if (!c) return { title: "Provider not found" };
  return pageMetadata({
    title: fitTitle([`${c.name} Car Insurance Plans`, `${c.shortName ?? c.name} Car Insurance`, c.name]),
    description: fitDescription(
      `Car insurance plans from ${c.name} on MarchGear: cover, add-ons, cashless garages and how claims work.`,
      c.about,
    ),
    path: `/insurance/providers/${c.slug}`,
    images: [INSURANCE_OG_IMAGE],
  });
}

export default async function ProviderPage(props: PageProps<"/insurance/providers/[slug]">) {
  const { slug } = await props.params;
  const c = await getPublicCompany(slug);
  if (!c) notFound();
  const products = c.products;
  const claim = c.claimInfo;
  const verified = Boolean(claim?.verified && claim.settlementRatio !== null);

  // What the insurer offers across its public plans.
  const addOns = new Map<string, { name: string; summary: string; included: number; optional: number }>();
  const coverage = new Map<string, { name: string; summary: string }>();
  for (const p of products) {
    for (const a of p.addOns) {
      const k = a.key === "custom" ? `c-${a.name}` : a.key;
      const cur = addOns.get(k) ?? { name: a.name, summary: STANDARD_COVER_BY_KEY[a.key]?.summary ?? a.description, included: 0, optional: 0 };
      if (a.included) cur.included += 1;
      else cur.optional += 1;
      addOns.set(k, cur);
    }
    for (const i of p.coverageItems) coverage.set(i.key === "custom" ? `c-${i.name}` : i.key, { name: i.name, summary: STANDARD_COVER_BY_KEY[i.key]?.summary ?? i.description });
  }
  const bodyTypes = products.some((p) => p.eligibility.bodyTypes.length === 0) ? ["All body types"] : [...new Set(products.flatMap((p) => p.eligibility.bodyTypes))];
  const fuels = products.some((p) => p.eligibility.fuels.length === 0) ? ["All fuels"] : [...new Set(products.flatMap((p) => p.eligibility.fuels))];
  const luxury = products.some((p) => p.eligibility.luxury !== "exclude") ? (products.every((p) => p.eligibility.luxury === "only") ? "Luxury cars only" : "Including luxury cars") : "Not for luxury cars";
  const maxAge = products.length ? Math.max(...products.map((p) => p.eligibility.maxAgeYears)) : null;
  const newCars = products.some((p) => p.eligibility.minAgeYears === 0 && (p.category === "bundled" || p.category === "new_car" || p.pricing.tpYears >= 3));
  const docs = products.flatMap((p) => (["brochure", "wording"] as const).flatMap((k) => (p.documents[k] ? [{ p, k, d: p.documents[k]! }] : [])));
  const vendors = [...new Set(products.map((p) => p.vendorId))];
  const contacts = [
    c.supportPhone && { icon: Phone, label: "Customer support", value: c.supportPhone, href: `tel:${c.supportPhone.replace(/\s/g, "")}` },
    c.claimsPhone && { icon: ShieldAlert, label: "Claims helpline", value: c.claimsPhone, href: `tel:${c.claimsPhone.replace(/\s/g, "")}` },
    c.claimsEmail && { icon: Mail, label: "Claims email", value: c.claimsEmail, href: `mailto:${c.claimsEmail}` },
    c.vendorContacts?.supportEmail && { icon: Mail, label: "Support email", value: c.vendorContacts.supportEmail, href: `mailto:${c.vendorContacts.supportEmail}` },
    c.vendorContacts?.supportHours && { icon: Clock, label: "Support hours", value: c.vendorContacts.supportHours },
    c.website && { icon: Globe, label: "Website", value: c.website.replace(/^https?:\/\//, ""), href: c.website, external: true },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string; external?: boolean }[];

  return (
    <>
      {vendors.map((v) => (
        <TrackInsuranceView key={v} kind="provider_view" vendorId={v} refId={c.id} />
      ))}

      {/* Hero */}
      <section className="border-b border-line">
        <div className="container-x pb-12 pt-8 md:pb-16 md:pt-10">
          <Breadcrumbs items={[{ label: "Insurance", href: "/insurance" }, { label: "Providers", href: "/insurance/providers" }, { label: c.shortName ?? c.name }]} />
          <div className="mt-10 grid grid-cols-1 gap-10 md:mt-14 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <CompanyLogo company={c} size="lg" />
              <h1 className="type-h1 mt-7 text-balance">{c.name}</h1>
              {c.about && <p className="type-lead mt-5 max-w-2xl text-muted">{c.about}</p>}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:col-span-4 lg:justify-end">
              <Button href="#request-quote" size="lg" arrow>
                Request a quote
              </Button>
              {products.length > 0 && (
                <Button href={`/insurance/compare?products=${products.slice(0, 4).map((p) => p.reference).join(",")}`} variant="outline" size="lg">
                  Compare plans
                </Button>
              )}
            </div>
          </div>
          <dl className="mt-12 grid grid-cols-2 gap-6 border-t border-ink pt-6 md:grid-cols-4">
            <Fact label="Plans on MarchGear" value={String(products.length)} />
            <Fact label="Cashless garages" value={c.garageCount ? formatNumber(c.garageCount) : "Not stated"} hint={c.garageNote ? `${c.garageNote} · as stated by the insurer` : "As stated by the insurer"} />
            <Fact label="Headquarters" value={c.headquarters ?? "—"} hint={c.establishedYear ? `Since ${c.establishedYear}` : undefined} />
            <Fact
              label="Claims settled"
              value={verified ? `${claim!.settlementRatio}%` : "Not verified"}
              hint={verified ? `${claim!.year} · verified by MarchGear` : "Claim figures not yet verified by MarchGear"}
            />
          </dl>
        </div>
      </section>

      {/* Plans */}
      <section aria-labelledby="plans-title" className="container-x py-14 md:py-20">
        <SectionTitle id="plans-title" eyebrow="Plans" title={`Plans from ${c.shortName ?? c.name}`} />
        {products.length === 0 ? (
          <p className="mt-8 border border-dashed border-line px-6 py-10 text-center text-[14px] text-muted">No plans from this insurer are live right now.</p>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={`/insurance/products/${p.reference}`} className="group flex h-full flex-col border border-line bg-white p-6 transition-colors hover:border-ink">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag>{INS_PRODUCT_CATEGORY_LABEL[p.category]}</Tag>
                    <span className="text-[12px] text-muted num">{termLabel(p.pricing)}</span>
                  </div>
                  <h3 className="type-h4 mt-4 group-hover:text-red">{p.name}</h3>
                  {p.tagline && <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{p.tagline}</p>}
                  {p.addOns.some((a) => a.included) && (
                    <p className="mt-4 text-[12.5px] text-ink">
                      <span className="text-muted">Includes </span>
                      {p.addOns
                        .filter((a) => a.included)
                        .map((a) => a.name)
                        .join(", ")}
                    </p>
                  )}
                  <span className="mt-auto inline-flex items-center gap-1 pt-6 text-[13px] font-medium text-ink">
                    View plan
                    <ArrowUpRight className="size-3.5 text-red transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                  </span>
                  {p.soldBy && <span className="mt-2 text-[11.5px] text-muted">Sold by {p.soldBy}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Coverage and add-ons */}
      {(coverage.size > 0 || addOns.size > 0) && (
        <section aria-labelledby="cover-title" className="border-t border-line bg-mist/50 py-14 md:py-20">
          <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <SectionTitle id="cover-title" eyebrow="Cover" title="What the plans cover" />
              <p className="mt-4 text-[14px] leading-relaxed text-muted">Across this insurer&apos;s live plans. Each plan&apos;s page shows exactly what it includes.</p>
              {coverage.size > 0 && (
                <ul className="mt-8 space-y-4">
                  {[...coverage.values()].map((i) => (
                    <li key={i.name}>
                      <p className="text-[14px] font-medium text-ink">{i.name}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{i.summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="lg:col-span-8">
              <h3 className="type-eyebrow text-ink">Add-on covers offered</h3>
              <div className="relative mt-4 overflow-x-auto border border-line bg-white" tabIndex={0} role="region" aria-label="Add-on covers offered">
                <table className="w-full min-w-[520px] text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[12px] text-muted">
                      <th scope="col" className="px-5 py-3 font-medium">
                        Add-on
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Included in
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Optional on
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[...addOns.values()].map((a) => (
                      <tr key={a.name}>
                        <th scope="row" className="px-5 py-3.5 text-left align-top font-normal">
                          <span className="font-medium text-ink">{a.name}</span>
                          <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{a.summary}</span>
                        </th>
                        <td className="px-5 py-3.5 align-top num">{a.included ? `${a.included} plan${a.included === 1 ? "" : "s"}` : "—"}</td>
                        <td className="px-5 py-3.5 align-top num">{a.optional ? `${a.optional} plan${a.optional === 1 ? "" : "s"}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Vehicles, garages, claims */}
      <section className="container-x grid grid-cols-1 gap-12 py-14 md:py-20 lg:grid-cols-3 lg:gap-10">
        <div>
          <SectionTitle eyebrow="Vehicles" title="Cars it insures" />
          <dl className="mt-6 divide-y divide-line border-y border-line text-[13.5px]">
            <Row label="Body types" value={bodyTypes.join(", ")} />
            <Row label="Fuels" value={fuels.join(", ")} />
            <Row label="Luxury cars" value={luxury} />
            {maxAge !== null && <Row label="Car age" value={`Up to ${maxAge} years`} />}
            <Row label="New cars" value={newCars ? "Yes — with multi-year third-party cover" : "No new-car plan listed"} />
          </dl>
        </div>
        <div>
          <SectionTitle eyebrow="Garages" title="Cashless network" />
          <div className="mt-6 flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-mist">
              <Wrench className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-display text-[34px] font-semibold leading-none tracking-[-0.03em] num">{c.garageCount ? formatNumber(c.garageCount) : "—"}</p>
              <p className="mt-2 text-[13px] text-muted">{c.garageNote ? `${c.garageNote}. ` : ""}As stated by the insurer — check the network near you before you buy.</p>
            </div>
          </div>
        </div>
        <div>
          <SectionTitle eyebrow="Claims" title="How claims work" />
          <div className="mt-6 border border-line p-5">
            {verified ? (
              <>
                <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink">
                  <BadgeCheck className="size-4 text-red" aria-hidden /> Verified by MarchGear
                </p>
                <p className="mt-3 font-display text-[30px] font-semibold leading-none num">{claim!.settlementRatio}%</p>
                <p className="mt-2 text-[12.5px] text-muted">
                  Claims settled · {claim!.year}
                  {claim!.source ? ` · Source: ${claim!.source}` : ""}
                  {claim!.verifiedAt ? ` · Checked ${formatDate(claim!.verifiedAt.slice(0, 10))}` : ""}
                </p>
              </>
            ) : (
              <p className="text-[13.5px] text-muted">Claim figures not yet verified by MarchGear.</p>
            )}
          </div>
          {claim && claim.process.length > 0 && (
            <ol className="mt-6 space-y-3">
              {claim.process.map((s, i) => (
                <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-ink">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-[11px] font-semibold num">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* Documents, terms and contacts */}
      <section className="border-t border-line">
        <div className="container-x grid grid-cols-1 gap-12 py-14 md:py-20 lg:grid-cols-2">
          <div>
            <SectionTitle eyebrow="Documents" title="Brochures and policy wordings" />
            {docs.length ? (
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {docs.map(({ p, k, d }) => (
                  <li key={`${p.id}-${k}`}>
                    <a href={`/insurance/products/${p.reference}/documents/${k}`} target="_blank" rel="noopener" className="group flex items-center gap-4 py-4">
                      <Download className="size-4 shrink-0 text-ink/70" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-ink group-hover:text-red">
                          {p.name} — {k === "brochure" ? "brochure" : "policy wording"}
                        </span>
                        <span className="block text-[12px] text-muted">
                          {d.mime === "application/pdf" ? "PDF" : "Image"} · {fileSize(d.size)}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-[13.5px] text-muted">This insurer hasn&apos;t published documents for its plans yet.</p>
            )}
            <p className="mt-6 text-[12.5px] leading-relaxed text-muted">
              Terms: cover, premiums and claims are governed by each plan&apos;s policy wording and the insurer&apos;s underwriting. Premiums shown on MarchGear are indicative — the insurer sets the final premium when the policy is issued.
              {c.regulatorRegNo ? ` Registration no. ${c.regulatorRegNo} (as supplied by the insurer).` : ""}
            </p>
          </div>
          <div>
            <SectionTitle eyebrow="Contact" title="Reach the insurer" />
            {contacts.length ? (
              <dl className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {contacts.map((x) => (
                  <div key={x.label} className="flex min-w-0 gap-3">
                    <x.icon className="mt-0.5 size-[18px] shrink-0 text-ink/60" aria-hidden />
                    <div className="min-w-0">
                      <dt className="text-[12px] text-muted">{x.label}</dt>
                      <dd className="mt-0.5 break-words text-[14px] text-ink">
                        {x.href ? (
                          <a href={x.href} {...(x.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="hover:text-red">
                            {x.value}
                          </a>
                        ) : (
                          x.value
                        )}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-6 text-[13.5px] text-muted">Contact details will appear here once the insurer adds them.</p>
            )}
            <p className="mt-6 flex items-start gap-2 text-[12px] text-muted">
              <Building2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              MarchGear lists this insurer&apos;s plans; it doesn&apos;t issue policies or settle claims.
            </p>
          </div>
        </div>
      </section>

      {/* Request a quote */}
      <section id="request-quote" aria-labelledby="rq-title" className="scroll-mt-32 border-t border-line bg-mist/50 py-14 md:py-20">
        <div className="container-x grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionTitle id="rq-title" eyebrow="Get started" title={`Quotes from ${c.shortName ?? c.name}`} />
            <p className="mt-4 text-[14px] leading-relaxed text-muted">Tell us about your car to see indicative premiums for this insurer&apos;s plans, then ask for a quote.</p>
          </div>
          <div className="lg:col-span-8">
            <InsuranceSearchForm variant="panel" source="provider" extraParams={{ provider: c.slug }} />
          </div>
        </div>
      </section>
    </>
  );
}

function SectionTitle({ eyebrow, title, id }: { eyebrow: string; title: string; id?: string }) {
  return (
    <div>
      <p className="type-eyebrow inline-flex items-center gap-3 text-ink">
        <span aria-hidden className="h-px w-6 bg-red" />
        {eyebrow}
      </p>
      <h2 id={id} className="type-h3 mt-4 text-balance">
        {title}
      </h2>
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-1.5 truncate font-display text-[22px] font-semibold tracking-[-0.02em] num md:text-[26px]">{value}</dd>
      {hint && <dd className="mt-1 text-[11.5px] leading-snug text-muted">{hint}</dd>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}
