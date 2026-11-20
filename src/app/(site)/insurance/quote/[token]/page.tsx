import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { AlertTriangle, BadgeCheck, CalendarClock, Car, Clock, Globe, Info, Mail, Phone, ShieldAlert } from "lucide-react";
import { getDb } from "@/db";
import { insQuotes } from "@/db/schema";
import { getSessionUser, isStaff } from "@/server/auth";
import { todayISO } from "@/server/validation";
import { getQuoteByToken, isVendorMember, recordInsEvent } from "@/server/insurance/market";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { formatDateTime, formatDay } from "@/components/admin/ui";
import { CompanyLogo, Tag } from "@/components/insurance/public/market/ui";
import { inr } from "@/components/insurance/public/market/money";
import { PrintButton, QuoteResponse } from "@/components/insurance/public/market/quote-response";
import {
  INDICATIVE_NOTE,
  INS_PRODUCT_CATEGORY_LABEL,
  INS_QUOTE_AUTH_LABEL,
  INS_QUOTE_STATUS_LABEL,
  INS_VENDOR_CATEGORY_LABEL,
  quoteDisplayStatus,
} from "@/insurance/labels";
import type { InsProductCategory } from "@/db/enums";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your car insurance quote",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/** The status as the customer reads it (the vendor-facing labels talk about "the customer"). */
const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  submitted: "Awaiting your response",
  viewed: "Awaiting your response",
  accepted: "You're interested",
  declined: "You declined",
  expired: "Expired",
};

const STATUS_TONE: Record<string, string> = {
  submitted: "bg-[#eef3fb] text-[#1d4ed8]",
  viewed: "bg-[#eef3fb] text-[#1d4ed8]",
  accepted: "bg-[#edf7ef] text-[#15803d]",
  declined: "bg-mist text-muted",
  expired: "bg-mist text-muted",
};

export default async function CustomerQuotePage(props: PageProps<"/insurance/quote/[token]">) {
  const { token } = await props.params;
  const q = await getQuoteByToken(token);
  if (!q) notFound();
  const today = todayISO();
  const status = quoteDisplayStatus(q, today);
  const open = status === "submitted" || status === "viewed";
  const b = q.breakdown;

  // The first view by the customer (not the vendor's own team or MarchGear staff) marks the quote viewed.
  const viewer = await getSessionUser();
  const insider = viewer ? isStaff(viewer.role) || (await isVendorMember(viewer.id, q.vendorId)) : false;
  if (!insider) {
    after(async () => {
      if (!q.viewedAt) await getDb().update(insQuotes).set({ viewedAt: new Date() }).where(and(eq(insQuotes.id, q.id), isNull(insQuotes.viewedAt)));
      await recordInsEvent("quote_view", q.vendorId, q.id);
    });
  }

  const authorised = q.authorization === "insurer_authorised";
  const insurerName = q.company?.name ?? "the insurer";
  const lines: [string, number, string?][] = [];
  if (b.odYears > 0) lines.push([`Own damage (${b.odYears} yr)`, b.od]);
  if (b.adjustment) lines.push([b.adjustment < 0 ? "Discount on own damage" : "Loading on own damage", b.adjustment]);
  if (b.ncbDiscount) lines.push([`No-claim bonus (${b.ncbPct}%)`, -b.ncbDiscount]);
  if (b.tpYears > 0) lines.push([`Third-party liability (${b.tpYears} yr)`, b.tp]);
  if (b.pa) lines.push(["Owner-driver personal accident", b.pa]);
  for (const a of b.addOns ?? []) lines.push([`${a.name}${a.included ? " (included)" : ""}`, a.premium]);
  const vendorContacts = [
    q.vendor.profile?.supportPhone && { icon: Phone, label: "Phone", value: q.vendor.profile.supportPhone, href: `tel:${q.vendor.profile.supportPhone.replace(/\s/g, "")}` },
    q.vendor.profile?.supportEmail && { icon: Mail, label: "Email", value: q.vendor.profile.supportEmail, href: `mailto:${q.vendor.profile.supportEmail}` },
    q.vendor.profile?.supportHours && { icon: Clock, label: "Hours", value: q.vendor.profile.supportHours },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string }[];
  const companyContacts = q.company
    ? ([
        q.company.supportPhone && { icon: Phone, label: "Customer support", value: q.company.supportPhone, href: `tel:${q.company.supportPhone.replace(/\s/g, "")}` },
        q.company.claimsPhone && { icon: ShieldAlert, label: "Claims", value: q.company.claimsPhone, href: `tel:${q.company.claimsPhone.replace(/\s/g, "")}` },
        q.company.claimsEmail && { icon: Mail, label: "Claims email", value: q.company.claimsEmail, href: `mailto:${q.company.claimsEmail}` },
        q.company.website && { icon: Globe, label: "Website", value: q.company.website.replace(/^https?:\/\//, ""), href: q.company.website },
      ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string }[])
    : [];

  return (
    <>
      <style>{`@media print {
        @page { margin: 14mm; }
        body * { visibility: hidden; }
        #quote-sheet, #quote-sheet * { visibility: visible; }
        #quote-sheet { position: absolute; left: 0; top: 0; width: 100%; }
        header, footer, nav, .print-hidden { display: none !important; }
      }`}</style>
      <article id="quote-sheet" className="container-x max-w-[1120px] pb-16 pt-8 md:pb-24 md:pt-10 print:max-w-none print:px-0 print:pt-0">
        <div className="print-hidden flex flex-wrap items-center justify-between gap-4">
          <Breadcrumbs items={[{ label: "Insurance", href: "/insurance" }, { label: "Quotes", href: "/insurance/quotes" }, { label: q.reference }]} />
          <PrintButton />
        </div>

        {/* Authorisation banner */}
        <div
          role="note"
          className={cn("mt-8 flex gap-4 rounded-[3px] px-5 py-5 md:px-6", authorised ? "bg-ink text-white print:border print:border-ink print:bg-white print:text-ink" : "border border-[#ecd9a8] bg-[#fdf8ec] text-ink print:border-ink print:bg-white")}
        >
          {authorised ? <BadgeCheck className="mt-0.5 size-6 shrink-0 text-red" aria-hidden /> : <AlertTriangle className="mt-0.5 size-6 shrink-0 text-[#a16207]" aria-hidden />}
          <div className="min-w-0">
            <p className="text-[16px] font-semibold md:text-[17px]">{INS_QUOTE_AUTH_LABEL[q.authorization]}</p>
            {authorised ? (
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/75 print:text-ink/80">
                Issued with the insurer&apos;s own quotation reference <span className="font-mono font-semibold text-white print:text-ink">{q.insurerQuoteRef}</span>. {insurerName} confirms the policy after its checks when you go ahead.
              </p>
            ) : (
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/75">
                Prepared by {q.vendor.name} as an estimate. It is <strong>not</strong> a quotation from {insurerName}: the insurer sets the final premium, IDV and terms when it issues the policy, and they may differ.
              </p>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="min-w-0">
            <p className="type-eyebrow inline-flex items-center gap-3 text-ink">
              <span aria-hidden className="h-px w-6 bg-red" />
              Quote <span className="font-mono tracking-wider">{q.reference}</span>
            </p>
            <h1 className="type-h2 mt-4 text-balance">
              {q.product?.name ?? "Car insurance"} <span className="type-editorial font-normal">for {q.enquiry.name.split(" ")[0]}</span>
            </h1>
            <p className="mt-3 text-[13.5px] text-muted">
              From {q.vendor.name}
              {q.submittedAt ? ` · sent ${formatDateTime(q.submittedAt)}` : ""} · request {q.enquiry.reference}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <span className={cn("inline-flex h-7 items-center rounded-[2px] px-2.5 text-[12px] font-semibold", STATUS_TONE[status] ?? "bg-mist text-ink")}>{CUSTOMER_STATUS_LABEL[status] ?? INS_QUOTE_STATUS_LABEL[status]}</span>
            <span className={cn("inline-flex items-center gap-1.5 text-[13px]", status === "expired" ? "text-red" : "text-ink")}>
              <CalendarClock className="size-4" aria-hidden />
              {status === "expired" ? `Expired on ${formatDay(q.validUntil)}` : `Valid until ${formatDay(q.validUntil)}`}
            </span>
          </div>
        </div>

        {status === "expired" && (
          <p className="mt-6 border-l-2 border-red bg-red-50 px-4 py-3 text-[13.5px] text-ink">This quote has expired. Premiums change with time — ask {q.vendor.name} for a fresh quote.</p>
        )}
        {status === "accepted" && q.respondedAt && (
          <p className="mt-6 border-l-2 border-[#15803d] bg-[#edf7ef] px-4 py-3 text-[13.5px] text-ink">
            You told {q.vendor.name} you&apos;re interested on {formatDateTime(q.respondedAt)}. They&apos;ll contact you to complete the policy with the insurer.
          </p>
        )}
        {status === "declined" && q.respondedAt && <p className="mt-6 border-l-2 border-line bg-mist px-4 py-3 text-[13.5px] text-ink">You declined this quote on {formatDateTime(q.respondedAt)}.</p>}

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12 print:block">
          <div className="min-w-0 space-y-10 lg:col-span-8">
            {/* Plan + car */}
            <section className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2">
              <div className="flex gap-4 bg-white p-5">
                {q.company && <CompanyLogo company={{ name: q.company.name, shortName: null, logo: q.company.logo }} />}
                <div className="min-w-0">
                  <p className="text-[11.5px] text-muted">Plan</p>
                  <p className="mt-0.5 text-[15px] font-semibold text-ink">
                    {q.product?.public ? (
                      <Link href={`/insurance/products/${q.product.reference}`} className="hover:text-red">
                        {q.product.name}
                      </Link>
                    ) : (
                      (q.product?.name ?? "Car insurance")
                    )}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {insurerName}
                    {q.product ? ` · ${INS_PRODUCT_CATEGORY_LABEL[q.product.category as InsProductCategory] ?? ""}` : ""}
                  </p>
                  <p className="mt-2 text-[12.5px] text-ink num">
                    {[b.odYears > 0 && `${b.odYears} yr own damage`, b.tpYears > 0 && `${b.tpYears} yr third party`].filter(Boolean).join(" + ")}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 bg-white p-5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-[3px] bg-mist">
                  <Car className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[11.5px] text-muted">Car</p>
                  <p className="mt-0.5 text-[15px] font-semibold text-ink">{q.enquiry.vehicle || "As discussed"}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted num">
                    {[q.enquiry.regNumber, q.enquiry.fuel, q.enquiry.vehicleIsNew ? "New car" : q.enquiry.year, q.enquiry.city, !q.enquiry.vehicleIsNew && `${b.ncbPct || q.enquiry.ncbPct}% NCB`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
            </section>

            {/* Cover */}
            <section aria-labelledby="q-cover">
              <h2 id="q-cover" className="type-h4">
                Cover
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3">
                <div className="bg-white px-5 py-4">
                  <dt className="text-[11.5px] text-muted">IDV</dt>
                  <dd className="mt-1 text-[16px] font-semibold num">{q.idv ? inr(q.idv) : "Not applicable"}</dd>
                </div>
                <div className="bg-white px-5 py-4">
                  <dt className="text-[11.5px] text-muted">Deductible</dt>
                  <dd className="mt-1 text-[16px] font-semibold num">{b.deductible ? `${inr(b.deductible)} / claim` : "None"}</dd>
                </div>
                <div className="col-span-2 bg-white px-5 py-4 sm:col-span-1">
                  <dt className="text-[11.5px] text-muted">Valid until</dt>
                  <dd className="mt-1 text-[16px] font-semibold">{formatDay(q.validUntil)}</dd>
                </div>
              </dl>
              {q.coverage.length > 0 && (
                <ul className="mt-5 divide-y divide-line border-y border-line">
                  {q.coverage.map((c, i) => (
                    <li key={`${c.name}-${i}`} className="grid grid-cols-1 gap-1 py-3.5 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                      <p className="text-[14px] font-medium text-ink">{c.name}</p>
                      <p className="text-[13.5px] text-muted">{c.detail || "Included"}</p>
                    </li>
                  ))}
                </ul>
              )}
              {(b.addOns ?? []).length > 0 && (
                <>
                  <h3 className="mt-8 text-[13px] font-semibold text-ink">Add-ons in this quote</h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {b.addOns.map((a) => (
                      <li key={`${a.key}-${a.name}`}>
                        <Tag tone="outline">{a.name}</Tag>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {/* Premium */}
            <section aria-labelledby="q-premium">
              <h2 id="q-premium" className="type-h4">
                Premium breakdown
              </h2>
              <table className="mt-4 w-full text-[14px]">
                <caption className="sr-only">Premium breakdown</caption>
                <tbody className="divide-y divide-line border-y border-line">
                  {lines.map(([label, v], i) => (
                    <tr key={`${label}-${i}`}>
                      <th scope="row" className="py-3 pr-4 text-left font-normal text-muted">
                        {label}
                      </th>
                      <td className="py-3 text-right num">{v < 0 ? `− ${inr(-v)}` : inr(v)}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="py-3 pr-4 text-left font-medium text-ink">
                      Net premium
                    </th>
                    <td className="py-3 text-right font-medium num">{inr(b.net)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-3 pr-4 text-left font-normal text-muted">
                      GST ({b.gstPct}%)
                    </th>
                    <td className="py-3 text-right num">{inr(b.gst)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="pt-4 pr-4 text-left text-[15px] font-semibold text-ink">
                      Total premium {authorised ? "" : "(indicative)"}
                    </th>
                    <td className="pt-4 text-right font-display text-[24px] font-semibold num">{inr(q.total)}</td>
                  </tr>
                </tfoot>
              </table>
              {(b.notes ?? []).length > 0 && (
                <ul className="mt-4 space-y-1 text-[12px] text-muted">
                  {b.notes.map((n) => (
                    <li key={n}>· {n}</li>
                  ))}
                </ul>
              )}
            </section>

            {(q.notes || q.terms) && (
              <section aria-labelledby="q-notes" className="space-y-6">
                <h2 id="q-notes" className="type-h4">
                  Notes and terms
                </h2>
                {q.notes && (
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">From {q.vendor.name}</p>
                    <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink/85">{q.notes}</p>
                  </div>
                )}
                {q.terms && (
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Terms</p>
                    <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink/80">{q.terms}</p>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="order-first space-y-6 lg:order-none lg:col-span-4 print:mt-10">
            <div className="border border-line p-5 md:p-6">
              <p className="text-[12px] text-muted">{authorised ? "Quoted premium" : "Indicative premium"} · incl. GST</p>
              <p className="mt-1 font-display text-[36px] font-semibold leading-none tracking-[-0.03em] num">{inr(q.total)}</p>
              <p className="mt-2 text-[12px] text-muted">{authorised ? `Insurer's reference ${q.insurerQuoteRef}` : "Estimate — not an insurer quotation"}</p>
              <div className="print-hidden mt-6 border-t border-line pt-5">
                {open ? (
                  <QuoteResponse token={q.token} vendorName={q.vendor.name} />
                ) : (
                  <p className="text-[13px] text-muted">
                    {status === "expired" ? "This quote can't be accepted any more." : status === "accepted" ? "You've said you're interested." : "You've responded to this quote."} Questions? Contact {q.vendor.name} below.
                  </p>
                )}
              </div>
            </div>

            <div className="border border-line p-5 md:p-6">
              <p className="text-[11.5px] text-muted">{q.vendor.isInsurer ? "Your insurer" : "Sent by"}</p>
              <p className="mt-0.5 text-[15px] font-semibold text-ink">{q.vendor.name}</p>
              {q.vendor.category && !q.vendor.isInsurer && <p className="text-[12px] text-muted">{INS_VENDOR_CATEGORY_LABEL[q.vendor.category]}</p>}
              <Contacts items={vendorContacts} empty="They'll contact you on the number you gave." />
              {q.company && !q.vendor.isInsurer && (
                <>
                  <p className="mt-6 border-t border-line pt-5 text-[11.5px] text-muted">Insurer</p>
                  <p className="mt-0.5 text-[15px] font-semibold text-ink">
                    {q.company.isActive ? (
                      <Link href={`/insurance/providers/${q.company.slug}`} className="hover:text-red">
                        {q.company.name}
                      </Link>
                    ) : (
                      q.company.name
                    )}
                  </p>
                </>
              )}
              {companyContacts.length > 0 && <Contacts items={companyContacts} />}
            </div>

            <p className="flex gap-2 text-[11.5px] leading-relaxed text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {authorised ? "" : `${INDICATIVE_NOTE} `}MarchGear lists insurance products and passes on quotes; it doesn&apos;t issue policies, take payments or settle claims.
              </span>
            </p>
          </aside>
        </div>
      </article>
    </>
  );
}

function Contacts({ items, empty }: { items: { icon: typeof Phone; label: string; value: string; href?: string }[]; empty?: string }) {
  if (!items.length) return empty ? <p className="mt-3 text-[12.5px] text-muted">{empty}</p> : null;
  return (
    <dl className="mt-4 space-y-3">
      {items.map((x) => (
        <div key={x.label} className="flex min-w-0 gap-3">
          <x.icon className="mt-0.5 size-4 shrink-0 text-ink/60" aria-hidden />
          <div className="min-w-0">
            <dt className="text-[11.5px] text-muted">{x.label}</dt>
            <dd className="break-words text-[13.5px] text-ink">
              {x.href ? (
                <a href={x.href} className="hover:text-red" {...(x.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
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
  );
}
