import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { notFound } from "next/navigation";
import { ExternalLink, Mail, Phone } from "lucide-react";
import { STAFF_ROLES } from "@/server/auth";
import {
  INDICATIVE_NOTE,
  INS_INTENT_LABEL,
  INS_POLICY_STATUS_LABEL,
  INS_PRODUCT_CATEGORY_LABEL,
  INS_PRODUCT_STATUS_LABEL,
  INVOICE_STATUS_LABEL,
  quoteDisplayStatus,
} from "@/insurance/labels";
import { insInvoiceDisplayStatus } from "@/server/insurance/billing";
import { requireStaff } from "@/server/auth";
import { getInsEnquiry, insuranceSettings } from "@/server/admin/insurance-ops";
import { AdminHeader, Badge, Panel, Table, Td, Th, formatDateTime, formatDay } from "@/components/admin/ui";
import { Facts, StatusPill } from "@/components/admin/partner-ui";
import { istDate, rupees } from "@/components/portal/billing/shared";
import { INVOICE_STATUS_TONE } from "@/insurance/labels";
import { AuthPill, ConversionPill, InsHistoryList, LeadPill, Notice, QuotePill, RenewalPill, TitlePills, conversionState } from "@/components/admin/insurance/ops/kit";
import { LEAD_EVENT_LABEL, humanize, sourceLabel } from "@/components/admin/insurance/ops/labels";
import { ConversionActions } from "@/components/admin/insurance/ops/actions";
import { vendorName } from "@/server/insurance/context";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Insurance enquiry" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const data = /^\d{1,9}$/.test(id) ? await getInsEnquiry(Number(id)) : null;
  if (!data) notFound();
  const { e, v, product, companyName, events, quotes, renewals, approvals, leadFees } = data;
  const settings = await insuranceSettings();
  const today = istDate();
  const conv = conversionState(e);
  const vendor = vendorName(v);
  const est = e.estimate;
  const openFee = leadFees.find((f) => f.status !== "void");

  const blocked =
    conv === "none"
      ? "The vendor hasn't reported a policy for this enquiry yet."
      : conv === "reported" && !e.policyNumber?.trim()
        ? "The vendor reported the policy without a policy number — ask them to add it first."
        : undefined;

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/insurance/enquiries", label: "All enquiries" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {e.name}
            <TitlePills>
              <LeadPill status={e.status} />
            </TitlePills>
          </span>
        }
        description={`${e.reference} · ${INS_INTENT_LABEL[e.intent]} · ${vendor} · received ${formatDateTime(e.createdAt)}`}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Customer">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a href={`tel:+91${e.mobile}`} className="inline-flex h-11 items-center gap-2 rounded-[3px] border border-line px-4 text-[14px] font-medium hover:border-ink">
                <Phone aria-hidden className="size-4 text-red" /> <span className="num">+91 {e.mobile}</span>
              </a>
              {e.email && (
                <a href={`mailto:${e.email}?subject=${encodeURIComponent(`Your MarchGear insurance enquiry ${e.reference}`)}`} className="inline-flex h-11 min-w-0 items-center gap-2 rounded-[3px] border border-line px-4 text-[14px] font-medium hover:border-ink">
                  <Mail aria-hidden className="size-4 shrink-0 text-red" /> <span className="truncate">{e.email}</span>
                </a>
              )}
            </div>
            <p className="mt-3 text-[12.5px] text-muted">
              {data.account ? (
                <>
                  Signed-in customer: <span className="text-ink">{data.account.name}</span> ({data.account.email})
                </>
              ) : (
                "Sent without signing in."
              )}{" "}
              Consent recorded {formatDateTime(e.consentAt)}.
            </p>
          </Panel>

          <Panel title="Vehicle & current policy">
            <Facts
              rows={[
                ["Registration", e.regNumber ? <span className="num">{e.regNumber}</span> : e.vehicleIsNew ? "New car — not registered yet" : null],
                ["Vehicle", [e.brandName, e.modelName, e.variantName].filter(Boolean).join(" ")],
                ["Year · fuel", [e.year, e.fuel].filter(Boolean).join(" · ")],
                ["City", [e.city, e.state].filter(Boolean).join(", ")],
                ["Policy situation", e.policyStatus ? INS_POLICY_STATUS_LABEL[e.policyStatus] : null],
                ["Policy expiry", e.policyExpiry ? formatDay(e.policyExpiry) : null],
                ["Previous insurer", e.previousInsurer],
                ["No-claim bonus", `${e.ncbPct}%${e.claimedLastYear ? " · claimed last year" : ""}`],
                ["Add-ons asked for", e.addOns.length ? e.addOns.map(humanize).join(", ") : null],
                ["Message", e.message ? <span className="whitespace-pre-line">{e.message}</span> : null],
              ]}
            />
          </Panel>

          <Panel title="Indicative estimate the customer saw">
            {est ? (
              <>
                <div className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line sm:grid-cols-4">
                  {[
                    ["IDV", rupees(est.idv)],
                    ["Own damage", rupees(est.od - est.ncbDiscount)],
                    ["Third party + PA", rupees(est.tp + est.pa)],
                    ["Total incl. GST", rupees(est.total)],
                  ].map(([k, val]) => (
                    <div key={k} className="bg-white px-4 py-3">
                      <p className="text-[11.5px] text-muted">{k}</p>
                      <p className="mt-0.5 text-[14px] font-semibold num">{val}</p>
                    </div>
                  ))}
                </div>
                {est.addOns.length > 0 && (
                  <p className="mt-3 text-[12.5px] text-muted">
                    Add-ons: {est.addOns.map((a) => `${a.name}${a.included ? " (included)" : ` ${rupees(a.premium)}`}`).join(" · ")}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[13.5px] text-muted">{e.indicativePremium ? `Indicative premium ${rupees(e.indicativePremium)}.` : "No estimate was shown (the customer asked without one)."}</p>
            )}
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              {INDICATIVE_NOTE}
            </p>
          </Panel>

          <Panel title={`Quotes (${quotes.length})`} padded={false}>
            {quotes.length === 0 ? (
              <p className="px-5 py-6 text-[13.5px] text-muted">The vendor hasn&apos;t built a quote for this enquiry.</p>
            ) : (
              <div className="[&>div]:border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Quote</Th>
                      <Th>Status</Th>
                      <Th>Type</Th>
                      <Th className="text-right">Total</Th>
                      <Th>Valid until</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((q) => (
                      <tr key={q.id}>
                        <Td>
                          <Link href={`/admin/insurance/quotes/${q.id}`} className="font-medium num hover:text-red">
                            {q.reference}
                          </Link>
                          <p className="text-[12px] text-muted">{q.submittedAt ? `Sent ${formatDateTime(q.submittedAt)}` : "Not sent"}</p>
                        </Td>
                        <Td>
                          <QuotePill status={quoteDisplayStatus(q, today)} />
                        </Td>
                        <Td>
                          <AuthPill a={q.authorization} />
                        </Td>
                        <Td className="text-right font-semibold num">{rupees(q.total)}</Td>
                        <Td className="whitespace-nowrap">{formatDay(q.validUntil)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Panel>

          <Panel title={`Timeline (${events.length})`}>
            {events.length === 0 ? (
              <p className="text-[13.5px] text-muted">No activity recorded.</p>
            ) : (
              <ol className="relative">
                {events.map((ev, i) => {
                  const staff = ev.userRole ? STAFF_ROLES.includes(ev.userRole) : false;
                  const meta = Object.entries(ev.meta ?? {}).filter(([, val]) => val !== null && val !== "");
                  return (
                    <li key={ev.id} className="relative flex gap-4 pb-5 last:pb-0">
                      {i < events.length - 1 && <span aria-hidden className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-line" />}
                      <span aria-hidden className={cn("relative mt-1.5 size-[15px] shrink-0 rounded-full border-[3px] border-white ring-1", staff ? "bg-ink ring-ink/20" : ev.userName ? "bg-red ring-red/20" : "bg-muted ring-line")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold">{LEAD_EVENT_LABEL[ev.kind]}</p>
                        {ev.body && <p className="mt-0.5 whitespace-pre-line break-words text-[13.5px] leading-relaxed text-ink/85">{ev.body}</p>}
                        {meta.length > 0 && (
                          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-muted">
                            {meta.map(([k, val]) => (
                              <span key={k}>
                                {humanize(k)}: <span className="text-ink/70">{String(val)}</span>
                              </span>
                            ))}
                          </p>
                        )}
                        <p className="mt-1 text-[11.5px] text-muted">
                          {ev.userName ? `${ev.userName} · ${staff ? "MarchGear" : vendor}` : "Customer / system"} · {formatDateTime(ev.createdAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6">
          <Panel title="Policy conversion">
            <div className="space-y-4">
              <ConversionPill state={conv} />
              <Facts
                rows={[
                  ["Policy number", e.policyNumber ? <span className="num">{e.policyNumber}</span> : null],
                  ["Premium (reported)", e.policyPremium ? rupees(e.policyPremium) : null],
                  ["Issued (reported)", e.policyIssuedAt ? formatDateTime(e.policyIssuedAt) : null],
                  ["Verified", e.conversionVerifiedAt ? `${formatDateTime(e.conversionVerifiedAt)}${data.verifierName ? ` · ${data.verifierName}` : ""}` : null],
                ]}
              />
              <ConversionActions
                enquiryId={e.id}
                reference={e.reference}
                verified={conv === "verified"}
                canVerify={conv === "reported" && Boolean(e.policyNumber?.trim())}
                blockedReason={blocked}
                policyNumber={e.policyNumber}
                leadFee={{ enabled: settings.leadFeeEnabled, amount: settings.leadFeeAmount, existing: openFee?.number ?? null }}
              />
              {leadFees.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-muted">Lead-fee invoices</p>
                  <ul className="space-y-1.5">
                    {leadFees.map((f) => {
                      const d = insInvoiceDisplayStatus(f, today);
                      return (
                        <li key={f.id} className="flex items-center justify-between gap-2 text-[13px]">
                          <Link href={`/admin/insurance/invoices/${f.id}`} className="font-medium num hover:text-red">
                            {f.number}
                          </Link>
                          <span className="flex items-center gap-2">
                            <span className="num">{rupees(f.total)}</span>
                            <Badge tone={INVOICE_STATUS_TONE[d]}>{INVOICE_STATUS_LABEL[d]}</Badge>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {conv === "reported" && <Notice tone="warn">Reported by the vendor — not yet confirmed. Dashboards count it separately from verified conversions.</Notice>}
            </div>
            {approvals.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-3 text-[12px] font-medium text-muted">Verification history</p>
                <InsHistoryList entries={approvals} />
              </div>
            )}
          </Panel>

          <Panel title="Vendor & product">
            <Facts
              rows={[
                [
                  "Vendor",
                  <Link key="v" href={`/admin/insurance/vendors/${v.id}`} className="font-medium hover:text-red">
                    {vendor} <span className="font-normal text-muted num">{v.reference}</span>
                  </Link>,
                ],
                [
                  "Product",
                  product?.id ? (
                    <span key="p">
                      <Link href={`/admin/insurance/products/${product.id}`} className="hover:text-red">
                        {product.name}
                      </Link>
                      <span className="block text-[12px] text-muted">
                        <span className="num">{product.reference}</span> · {product.category ? INS_PRODUCT_CATEGORY_LABEL[product.category] : ""}
                      </span>
                    </span>
                  ) : (
                    "Product removed"
                  ),
                ],
                ["Product status", product?.status ? <StatusPill key="s" tone={product.status === "published" ? "green" : "neutral"}>{INS_PRODUCT_STATUS_LABEL[product.status]}</StatusPill> : null],
                ["Insurer", companyName],
                ["Assigned to", data.assignedName ?? "Unassigned"],
                ["Follow-up", e.followUpAt ? formatDateTime(e.followUpAt) : null],
                ["Lost reason", e.lostReason],
              ]}
            />
            {product?.status === "published" && product.reference && (
              <Link href={`/insurance/products/${product.reference}`} target="_blank" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-red hover:underline">
                Public product page <ExternalLink aria-hidden className="size-3.5" />
              </Link>
            )}
          </Panel>

          <Panel title="Attribution">
            <Facts
              rows={[
                ["Source", sourceLabel(e.source)],
                [
                  "Promotion",
                  data.campaign ? (
                    <Link key="c" href={`/admin/insurance/campaigns/${data.campaign.id}`} className="hover:text-red">
                      {data.campaign.title} <span className="text-muted num">{data.campaign.reference}</span>
                    </Link>
                  ) : null,
                ],
                [
                  "Ad campaign",
                  data.adCampaign ? (
                    <Link key="a" href="/admin/advertising" className="hover:text-red">
                      {data.adCampaign.name} <span className="text-muted num">{data.adCampaign.reference}</span>
                    </Link>
                  ) : null,
                ],
              ]}
            />
          </Panel>

          {renewals.length > 0 && (
            <Panel title="Renewals" padded={false}>
              <ul className="divide-y divide-line">
                {renewals.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
                    <span>
                      <span className="font-medium num">{r.reference}</span>
                      <span className="block text-[12px] text-muted">Expires {formatDay(r.expiryDate)}</span>
                    </span>
                    <RenewalPill status={r.status} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
