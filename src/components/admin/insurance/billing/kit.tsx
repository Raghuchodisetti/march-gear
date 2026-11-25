import Link from "@/components/admin/desk";
import type { ReactNode } from "react";
import type { InsInvoiceKind, InvoiceStatus } from "@/db/enums";
import type { insVendors } from "@/db/schema";
import { INS_INVOICE_KIND_LABEL } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { formatDay } from "@/components/admin/ui";
import { NO_PAYMENT_DETAILS, amountInWords, gstSplit, hasPaymentDetails, rupees, type BillingParty, type PaymentDetails } from "@/components/portal/billing/shared";
import { InvoicePill } from "../ops/kit";

/* Server-safe pieces of the insurance billing screens. */

type VendorRow = typeof insVendors.$inferSelect;

/** Who an insurance invoice is billed to: the vendor's legal name, registered address and GSTIN. */
export function vendorParty(v: VendorRow): BillingParty {
  const c = v.application.company;
  const name = v.legalName || c.legalName || v.brandName || c.brandName || "Insurance vendor";
  const brand = v.brandName || c.brandName;
  return {
    name,
    lines: [brand && brand !== name ? `Trading as ${brand}` : "", c.address, [c.city || v.city, c.state || v.state, c.pin].filter(Boolean).join(", "), `Vendor ID ${v.reference}`].filter(Boolean),
    gst: v.gst || v.application.registration.gstin || undefined,
    state: c.state || v.state || "",
  };
}

function Party({ title, party }: { title: string; party: BillingParty }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{title}</p>
      <p className="mt-2 text-[15px] font-semibold leading-snug">{party.name}</p>
      <div className="mt-1 space-y-0.5 text-[13px] leading-relaxed text-muted">
        {party.lines.map((l) => (
          <p key={l} className="break-words">
            {l}
          </p>
        ))}
        {party.gst && <p className="num">GSTIN {party.gst}</p>}
      </div>
    </div>
  );
}

export interface InsInvoiceView {
  number: string;
  kind: InsInvoiceKind;
  description: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  gst: number;
  total: number;
  display: InvoiceStatus;
  issuedOn: string;
  dueOn: string;
  paidOn: string | null;
}

/** The invoice as the vendor sees it (same content and GST split as the vendor portal). */
export function InsInvoiceDocument({ inv, from, to, payment, intraState }: { inv: InsInvoiceView; from: BillingParty; to: BillingParty; payment: PaymentDetails; intraState: boolean }) {
  const split = gstSplit(inv.gst, intraState);
  const open = inv.display !== "paid" && inv.display !== "void";
  const period = inv.periodStart === inv.periodEnd ? formatDay(inv.periodStart) : `${formatDay(inv.periodStart)} – ${formatDay(inv.periodEnd)}`;
  return (
    <article className="min-w-0 overflow-hidden border border-line bg-white">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-ink px-6 py-5 text-white sm:px-8">
        <p className="font-display text-[20px] tracking-[-0.02em]">
          <span className="font-semibold">March</span>Gear
          <span className="ml-2 rounded-[3px] border border-white/60 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.08em]">Insurance</span>
        </p>
        <div className="sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Tax invoice</p>
          <p className="text-[15px] font-semibold num">{inv.number}</p>
        </div>
      </header>
      <div className="h-[3px] bg-red" />
      <div className="space-y-8 p-6 sm:p-8">
        <div className="flex flex-col-reverse items-start justify-between gap-4 sm:flex-row">
          <div className="grid w-full flex-1 gap-6 sm:grid-cols-2">
            <Party title="From" party={from} />
            <Party title="Billed to" party={to} />
          </div>
          <InvoicePill status={inv.display} />
        </div>

        {/* The invoice number never wraps: full width on phones, its own auto-sized column from sm up. */}
        <dl className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line sm:grid-cols-[auto_repeat(3,minmax(0,1fr))]">
          {[
            ["Invoice no.", inv.number, true],
            ["Issued", formatDay(inv.issuedOn), false],
            ["Due", formatDay(inv.dueOn), false],
            ["Place of supply", to.state || "—", true],
          ].map(([k, v, wide]) => (
            <div key={String(k)} className={cn("min-w-0 bg-[#F6F6F6] px-4 py-3", wide && "col-span-2 sm:col-span-1")}>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{k}</dt>
              <dd className={cn("mt-1 text-[13.5px] font-semibold num", k === "Invoice no." ? "whitespace-nowrap" : "break-words")}>{v}</dd>
            </div>
          ))}
        </dl>

        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-y border-ink py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted sm:grid-cols-[minmax(0,1fr)_200px_120px]">
            <span>Description</span>
            <span className="hidden sm:block">Period</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-line py-4 sm:grid-cols-[minmax(0,1fr)_200px_120px]">
            <div className="min-w-0">
              <p className="break-words text-[14px] font-medium">{inv.description}</p>
              <p className="mt-0.5 text-[12.5px] text-muted">{INS_INVOICE_KIND_LABEL[inv.kind]} · MarchGear insurance marketplace</p>
              <p className="mt-0.5 text-[12.5px] text-muted sm:hidden">{period}</p>
            </div>
            <p className="hidden text-[13.5px] text-muted sm:block">{period}</p>
            <p className="text-right text-[14px] font-medium num">{rupees(inv.amount)}</p>
          </div>
          <dl className="ml-auto mt-4 max-w-xs space-y-2 text-[13.5px]">
            <div className="flex justify-between gap-6">
              <dt className="text-muted">Subtotal</dt>
              <dd className="num">{rupees(inv.amount)}</dd>
            </div>
            {split.intraState ? (
              <>
                <div className="flex justify-between gap-6">
                  <dt className="text-muted">CGST @ 9%</dt>
                  <dd className="num">{rupees(split.cgst)}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-muted">SGST @ 9%</dt>
                  <dd className="num">{rupees(split.sgst)}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-6">
                <dt className="text-muted">IGST @ 18%</dt>
                <dd className="num">{rupees(split.igst)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-6 border-t border-ink pt-2.5 text-[16px] font-semibold">
              <dt>Total</dt>
              <dd className="num">{rupees(inv.total)}</dd>
            </div>
            <p className="text-right text-[12px] text-muted">{amountInWords(inv.total)}</p>
            {inv.paidOn && <p className="text-right text-[12.5px] font-semibold text-[#1e7a3c]">Paid on {formatDay(inv.paidOn)}</p>}
          </dl>
        </div>

        {open && (
          <section className="border-l-[3px] border-red bg-[#F6F6F6] px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">How to pay</p>
            {hasPaymentDetails(payment) ? (
              <dl className="mt-2 grid gap-x-8 gap-y-1.5 text-[13.5px] sm:grid-cols-2">
                {(
                  [
                    ["Account name", payment.accountName],
                    ["Bank", payment.bankName],
                    ["Account number", payment.accountNumber],
                    ["IFSC", payment.ifsc],
                    ["UPI", payment.upi],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex flex-wrap gap-x-2">
                      <dt className="text-muted">{k}</dt>
                      <dd className="break-all font-medium num">{v}</dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p className="mt-2 text-[13.5px] font-medium">{NO_PAYMENT_DETAILS}</p>
            )}
            {payment.instructions && <p className="mt-2 text-[13px] text-muted">{payment.instructions}</p>}
            <p className="mt-2 text-[12.5px] text-muted">
              Quote <span className="font-medium text-ink num">{inv.number}</span> as the reference. There&apos;s no online payment gateway — pay by bank transfer, UPI or cheque, then record the UTR / transaction ID so MarchGear can verify it.
            </p>
          </section>
        )}
        <p className="text-[11.5px] text-muted">Computer-generated invoice from the MarchGear insurance vendor portal. Amounts in Indian rupees; GST at 18%.</p>
      </div>
    </article>
  );
}

/* ── Revenue breakdown tables ───────────────────────────────── */

export interface BucketRow {
  key: string;
  label: string;
  sub?: string;
  href?: string;
  invoiced: number;
  collected: number;
  outstanding: number;
}

/** Invoiced / collected / outstanding per group; a hairline bar under "collected" shows the share. */
export function BucketTable({ rows, first = "Name", empty, limit = 15, showOutstanding = true }: { rows: BucketRow[]; first?: string; empty: string; limit?: number; showOutstanding?: boolean }) {
  if (!rows.length) return <p className="px-5 py-8 text-center text-[13.5px] text-muted">{empty}</p>;
  const shown = rows.slice(0, limit);
  const max = Math.max(1, ...shown.map((r) => r.collected));
  const th = "border-b border-line bg-mist/60 px-4 py-2.5 font-semibold";
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[460px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="text-[12px] text-muted">
            <th className={th}>{first}</th>
            <th className={cn(th, "text-right")}>Invoiced</th>
            <th className={cn(th, "text-right")}>Collected</th>
            {showOutstanding && <th className={cn(th, "text-right")}>Outstanding</th>}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key}>
              <td className="max-w-[220px] border-b border-line px-4 py-2.5">
                {r.href ? (
                  <Link href={r.href} className="block truncate font-medium hover:text-red">
                    {r.label}
                  </Link>
                ) : (
                  <span className="block truncate font-medium">{r.label}</span>
                )}
                {r.sub && <span className="block truncate text-[12px] text-muted">{r.sub}</span>}
              </td>
              <td className="whitespace-nowrap border-b border-line px-4 py-2.5 text-right text-muted num">{rupees(r.invoiced)}</td>
              <td className="w-[150px] whitespace-nowrap border-b border-line px-4 py-2.5 text-right">
                <span className="font-semibold num">{signed(r.collected)}</span>
                <span aria-hidden className="mt-1.5 block h-[3px] w-full overflow-hidden rounded-full bg-[#F1F1F1]">
                  <span className="ml-auto block h-full rounded-full bg-red" style={{ width: `${r.collected > 0 ? Math.max(3, (r.collected / max) * 100) : 0}%` }} />
                </span>
              </td>
              {showOutstanding && <td className={cn("whitespace-nowrap border-b border-line px-4 py-2.5 text-right num", r.outstanding > 0 ? "text-[#9a5b00]" : "text-muted")}>{rupees(r.outstanding)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && <p className="px-4 py-2.5 text-[12px] text-muted">And {rows.length - limit} more — export the revenue summary for the full list.</p>}
    </div>
  );
}

/** ₹ with a proper minus sign for negatives (e.g. a period with more refunds than receipts). */
export const signed = (n: number) => (n < 0 ? `−${rupees(-n)}` : rupees(n));

/** A big money figure with a caption. */
export function Money({ label, value, note, tone, size = "md", href }: { label: string; value: number; note?: ReactNode; tone?: "green" | "amber" | "red"; size?: "lg" | "md"; href?: string }) {
  const body = (
    <>
      <p className="text-[12.5px] font-medium text-muted">{label}</p>
      <p
        className={cn(
          "mt-2 font-display font-semibold leading-none tracking-[-0.03em] num",
          size === "lg" ? "text-[34px]" : "text-[24px]",
          tone === "green" && "text-[#1e7a3c]",
          tone === "amber" && "text-[#9a5b00]",
          tone === "red" && "text-red",
        )}
      >
        {signed(value)}
      </p>
      {note && <p className="mt-2 text-[12.5px] text-muted">{note}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block min-w-0 bg-white p-5 transition-colors hover:bg-[#FAFAFA]">
      {body}
    </Link>
  ) : (
    <div className="min-w-0 bg-white p-5">{body}</div>
  );
}

