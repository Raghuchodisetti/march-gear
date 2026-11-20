import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Check, CircleDot, Clock3, FileText, X } from "lucide-react";
import { INS_LEAD_STATUS_LABEL } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { requireInsurer } from "@/server/insurance/context";
import { getQuoteView } from "@/server/insurance/quote-builder";
import { PortalHeader } from "@/components/portal/ui";
import { formatIstDateTime } from "@/components/portal/crm/pipeline";
import { istDate } from "@/components/portal/billing/shared";
import { AuthBadge, QuoteStatusBadge, formatDayShort } from "@/components/insurance/vendor/crm/badges";
import { daysFrom, formatMobile } from "@/components/insurance/vendor/crm/shared";
import { QuotePreview } from "@/components/insurance/vendor/quotes/quote-preview";
import { QuoteActions } from "@/components/insurance/vendor/quotes/quote-actions";

export const metadata: Metadata = { title: "Quote" };

export default async function Page({ params }: PageProps<"/insurance-vendor/quotes/[id]">) {
  const ctx = await requireInsurer({ perm: "quotes.manage" });
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isFinite(id) || id <= 0) notFound();
  const q = await getQuoteView(ctx, id);
  if (!q) notFound();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const today = istDate();
  const daysLeft = daysFrom(today, q.validUntil);

  const responded = q.status === "accepted" || q.status === "declined";
  const steps = [
    { label: "Drafted", at: q.createdAt, done: true, tone: "done" as const },
    { label: "Sent to customer", at: q.submittedAt, done: Boolean(q.submittedAt), tone: "done" as const },
    { label: "Viewed by customer", at: q.viewedAt, done: Boolean(q.viewedAt), tone: "done" as const },
    q.status === "withdrawn"
      ? { label: "Withdrawn", at: null, done: true, tone: "stop" as const }
      : q.display === "expired"
        ? { label: `Expired ${formatDayShort(q.validUntil)}`, at: null, done: true, tone: "stop" as const }
        : responded
          ? { label: q.status === "accepted" ? "Customer interested" : "Customer declined", at: q.respondedAt, done: true, tone: q.status === "accepted" ? ("good" as const) : ("stop" as const) }
          : { label: "Customer response", at: null, done: false, tone: "done" as const },
  ];

  return (
    <>
      <PortalHeader
        title={`Quote ${q.reference}`}
        description={
          <>
            {q.enquiry.name} · {q.product?.name ?? "Product removed"} ·{" "}
            <Link href={`/insurance-vendor/enquiries/${q.enquiry.id}`} className="font-mono underline-offset-4 hover:underline">
              {q.enquiry.reference}
            </Link>
          </>
        }
        back={{ href: "/insurance-vendor/quotes", label: "All quotes" }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AuthBadge auth={q.authorization} />
            <QuoteStatusBadge status={q.display} />
          </div>
        }
      />

      {/* Status tracking */}
      <section aria-label="Status" className="mb-6 border border-line bg-white px-5 py-5 sm:px-6">
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:gap-0">
          {steps.map((s, i) => (
            <li key={s.label} className="relative flex gap-3 sm:block sm:pr-4">
              {i < steps.length - 1 && <span aria-hidden className={cn("absolute left-[13px] top-7 h-[calc(100%-4px)] w-px sm:left-7 sm:right-0 sm:top-[13px] sm:h-px sm:w-auto", steps[i + 1].done ? "bg-ink" : "bg-line")} />}
              <span
                className={cn(
                  "relative z-10 inline-flex size-[27px] shrink-0 items-center justify-center rounded-full border",
                  !s.done && "border-line bg-white text-muted",
                  s.done && s.tone === "done" && "border-ink bg-ink text-white",
                  s.done && s.tone === "good" && "border-[#1e7a3c] bg-[#1e7a3c] text-white",
                  s.done && s.tone === "stop" && "border-muted bg-muted text-white",
                )}
              >
                {s.done ? s.tone === "stop" ? <X aria-hidden className="size-3.5" /> : <Check aria-hidden className="size-3.5" /> : <CircleDot aria-hidden className="size-3.5" />}
              </span>
              <div className="min-w-0 sm:mt-3">
                <p className={cn("text-[13px] font-medium", !s.done && "text-muted")}>{s.label}</p>
                <p className="mt-0.5 text-[12px] text-muted num">{s.at ? formatIstDateTime(s.at) : s.done ? "" : "Waiting"}</p>
              </div>
            </li>
          ))}
        </ol>
        {(q.display === "submitted" || q.display === "viewed") && (
          <p className={cn("mt-4 flex items-center gap-2 border-t border-line pt-4 text-[12.5px]", daysLeft <= 2 ? "text-[#9a5b00]" : "text-muted")}>
            <Clock3 aria-hidden className="size-4" /> Valid until {formatDayShort(q.validUntil)} · {daysLeft === 0 ? "expires today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <QuotePreview
            data={{
              reference: q.reference,
              vendorName: q.vendor.name,
              authorization: q.authorization,
              insurerQuoteRef: q.insurerQuoteRef,
              customer: { name: q.enquiry.name, mobile: formatMobile(q.enquiry.mobile), email: q.enquiry.email, city: q.enquiry.city },
              vehicle: { line: q.enquiry.vehicle, reg: q.enquiry.regNumber },
              product: q.productDetail ? { name: q.productDetail.name, companyName: q.productDetail.companyName, category: q.productDetail.category, code: q.productDetail.code, uin: q.productDetail.uin } : null,
              coverage: q.coverage,
              breakdown: q.breakdown,
              validUntil: q.validUntil,
              issuedOn: istDate(q.submittedAt ?? q.createdAt),
              notes: q.notes ?? "",
              terms: q.terms ?? "",
            }}
          />
        </div>
        <div className="min-w-0 space-y-5">
          <QuoteActions quote={q} origin={origin} canManage={ctx.can("quotes.manage")} />

          <section className="border border-line bg-white p-5">
            <h2 className="text-[13px] font-semibold">Details</h2>
            <dl className="mt-3 divide-y divide-line text-[13px]">
              {(
                [
                  ["Enquiry", <Link key="e" href={`/insurance-vendor/enquiries/${q.enquiry.id}`} className="font-mono underline-offset-4 hover:underline">{q.enquiry.reference}</Link>],
                  ["Enquiry status", INS_LEAD_STATUS_LABEL[q.enquiry.status]],
                  ["Customer", `${q.enquiry.name} · +91 ${formatMobile(q.enquiry.mobile)}`],
                  ["Prepared by", q.createdBy ?? "—"],
                  ["Created", formatIstDateTime(q.createdAt)],
                  ["Last updated", formatIstDateTime(q.updatedAt)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="shrink-0 text-muted">{k}</dt>
                  <dd className="min-w-0 truncate text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="border border-line bg-white p-5">
            <h2 className="text-[13px] font-semibold">Timeline</h2>
            {q.events.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted">No activity yet.</p>
            ) : (
              <ol className="relative mt-4 space-y-4 before:absolute before:inset-y-1 before:left-[13px] before:w-px before:bg-line">
                {q.events.map((e) => {
                  const [head, ...rest] = e.body.split("\n");
                  return (
                    <li key={e.id} className="relative flex gap-3">
                      <span className="relative z-10 inline-flex size-[27px] shrink-0 items-center justify-center rounded-full border border-line bg-white text-muted">
                        <FileText aria-hidden className="size-3.5" />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className="break-words text-[13px] font-medium leading-snug">{head}</p>
                        {rest.length > 0 && <p className="mt-0.5 whitespace-pre-line break-words text-[12.5px] text-ink/70">{rest.join("\n")}</p>}
                        <p className="mt-0.5 text-[11.5px] text-muted num">
                          {e.author ?? "MarchGear"} · {formatIstDateTime(e.createdAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
