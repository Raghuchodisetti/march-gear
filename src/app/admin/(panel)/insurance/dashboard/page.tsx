import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import type { ReactNode } from "react";
import { ArrowRight, ClipboardCheck, Layers, Megaphone, Presentation, ShieldCheck, Store, Wallet } from "lucide-react";
import { INS_VENDOR_STATUS, type InsVendorStatus } from "@/db/enums";
import { INS_PRODUCT_CATEGORY_LABEL, INS_VENDOR_CATEGORY_SHORT, INS_VENDOR_STATUS_LABEL } from "@/insurance/labels";
import { PAYMENT_METHOD_SHORT } from "@/components/portal/billing/shared";
import { insuranceDashboard } from "@/server/admin/insurance";
import { requireStaff } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { AdminHeader, Panel, StatCard } from "@/components/admin/ui";
import { ChartStyles, Funnel } from "@/components/portal/analytics/charts";
import { InsHistoryList, SlaAge, VendorPill, rupees } from "@/components/admin/insurance/ui";
import { WeeklyTrend } from "@/components/admin/insurance/dashboard/weekly-trend";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Insurance dashboard" };

const BAR: Record<InsVendorStatus, string> = {
  draft: "bg-ink/15",
  submitted: "bg-[#2f6fd6]",
  pending_approval: "bg-[#5b8fe0]",
  under_review: "bg-[#8fb3ec]",
  documents_required: "bg-[#e09200]",
  changes_requested: "bg-[#f2b84b]",
  approved: "bg-[#22a04f]",
  rejected: "bg-red",
  suspended: "bg-ink",
};

function Group({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h2 className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</h2>
      {children}
    </section>
  );
}

function QueuePanel({ title, icon, href, count, empty, children, linkLabel = "Open queue" }: { title: string; icon: ReactNode; href: string; count: number; empty: string; children: ReactNode; linkLabel?: string }) {
  return (
    <Panel
      padded={false}
      title={
        <span className="flex items-center gap-2">
          {icon} {title}
          {count > 0 && <span className="rounded-full bg-red px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-white num">{count}</span>}
        </span>
      }
      action={
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-red hover:underline">
          {linkLabel} <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      }
    >
      {count === 0 ? <p className="p-5 text-[13.5px] text-muted">{empty}</p> : <ul className="divide-y divide-line">{children}</ul>}
    </Panel>
  );
}

function QueueRow({ href, title, meta, since, now, right }: { href: string; title: string; meta: string; since: Date | string | null; now: number; right?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-mist/50">
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium">{title}</span>
          <span className="block truncate text-[12px] text-muted">{meta}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {right}
          <SlaAge since={since} now={now} />
        </span>
      </Link>
    </li>
  );
}

export default async function InsuranceDashboardPage() {
  await requireStaff();
  const s = await insuranceDashboard();
  const now = s.now;
  const q = s.queues;
  const shown = INS_VENDOR_STATUS.filter((st) => s.vendors.status[st] > 0);
  const adCollected = s.money.advertising.paid - s.money.advertising.refunds;
  const allCollected = s.money.all.paid - s.money.all.refunds;

  return (
    <>
      <ChartStyles />
      <AdminHeader
        title="Insurance dashboard"
        description="Vendors, products and approvals across the insurance marketplace. Queues are oldest first; anything waiting over 48 hours is flagged."
        actions={
          <>
            <Button href="/admin/insurance/product-approvals" variant="outline" size="sm" icon={<ShieldCheck className="size-4" aria-hidden />}>
              Product approvals
            </Button>
            <Button href="/admin/insurance/vendor-approvals" size="sm" icon={<ClipboardCheck className="size-4" aria-hidden />}>
              Vendor verification
            </Button>
          </>
        }
      />

      <Group title="Vendors">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Total vendors" value={s.vendors.total} note={`${s.vendors.status.draft} still registering`} href="/admin/insurance/vendors" />
          <StatCard label="Pending approval" value={s.vendors.pending} note={`${s.vendors.withVendor} waiting on the vendor`} href="/admin/insurance/vendor-approvals" tone={s.vendors.pending ? "red" : undefined} />
          <StatCard label="Approved vendors" value={s.vendors.status.approved} note={`${s.vendors.status.rejected} rejected`} href="/admin/insurance/vendors?status=approved" />
          <StatCard label="Suspended vendors" value={s.vendors.status.suspended} note="Their products are hidden" href="/admin/insurance/vendors?status=suspended" />
        </div>
      </Group>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Group title="Products">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Total products" value={s.products.total} note={`${s.products.status.draft} drafts`} href="/admin/insurance/products" />
            <StatCard label="Pending approval" value={s.products.pending} href="/admin/insurance/product-approvals" tone={s.products.pending ? "red" : undefined} note={`${s.products.status.changes_requested} with vendors`} />
            <StatCard label="Active (published)" value={s.products.status.published} note={`${s.products.live} live on the site`} href="/admin/insurance/products?status=published" />
          </div>
        </Group>
        <Group title="Customers">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Enquiries" value={s.enquiries.total.toLocaleString("en-IN")} note={`${s.enquiries.last30.toLocaleString("en-IN")} in 30 days`} />
            <StatCard label="Quotes submitted" value={s.quotesSubmitted.toLocaleString("en-IN")} note="Sent to customers" />
            <StatCard label="Verified conversions" value={s.conversions.verified} note={`${s.conversions.reported} reported, not yet verified`} />
          </div>
        </Group>
      </div>

      <Group title="Revenue" className="mt-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Advertising revenue collected" value={rupees(adCollected)} note={`${rupees(s.money.advertising.outstanding)} outstanding${s.money.advertising.refunds ? ` · ${rupees(s.money.advertising.refunds)} refunded` : ""}`} />
          <StatCard label="Total revenue collected" value={rupees(allCollected)} note={s.money.all.refunds ? `After ${rupees(s.money.all.refunds)} in refunds` : "Subscriptions, advertising and lead fees"} />
          <StatCard label="Outstanding (unpaid)" value={rupees(s.money.all.outstanding)} note={s.money.all.overdue ? <span className="font-medium text-red">{rupees(s.money.all.overdue)} overdue</span> : "Nothing overdue"} />
        </div>
        <p className="mt-2 text-[12px] text-muted">Collected = paid invoices minus refunds on them, incl. GST. Outstanding = invoices not yet paid (due, overdue or payment being verified) — never counted as revenue.</p>
      </Group>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Trend">
          <WeeklyTrend
            weeks={s.trend.weeks}
            series={[
              { key: "enquiries", label: "Quote requests", unit: "Quote requests", values: s.trend.enquiries },
              { key: "quotes", label: "Quotes sent", unit: "Quotes sent", values: s.trend.quotes },
              { key: "policies", label: "Policies reported", unit: "Policies reported", values: s.trend.policies },
            ]}
          />
        </Panel>
        <Panel title="Conversion (all time)">
          <Funnel stages={s.funnel} />
          <p className="mt-4 text-[12px] text-muted">Policies are “reported” by the vendor until MarchGear verifies the evidence. Percentages compare each step with the one before.</p>
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <QueuePanel title="Vendor applications" icon={<Store aria-hidden className="size-4 text-muted" />} href="/admin/insurance/vendor-approvals" count={q.vendors.count} empty="No applications waiting for review.">
          {q.vendors.rows.map((v) => (
            <QueueRow key={v.id} href={`/admin/insurance/vendor-approvals?id=${v.id}`} title={v.name} meta={[v.reference, v.category ? INS_VENDOR_CATEGORY_SHORT[v.category] : null, v.city].filter(Boolean).join(" · ")} since={v.submittedAt ?? v.createdAt} now={now} right={<span className="hidden sm:inline"><VendorPill status={v.status} /></span>} />
          ))}
        </QueuePanel>
        <QueuePanel title="Products" icon={<ShieldCheck aria-hidden className="size-4 text-muted" />} href="/admin/insurance/product-approvals" count={q.products.count} empty="No products waiting for review.">
          {q.products.rows.map((p) => (
            <QueueRow key={p.id} href={`/admin/insurance/products/${p.id}`} title={p.name} meta={`${p.vendorName} · ${INS_PRODUCT_CATEGORY_LABEL[p.category]}`} since={p.submittedAt ?? p.createdAt} now={now} />
          ))}
        </QueuePanel>
        <QueuePanel title="Coverage & add-ons" icon={<Layers aria-hidden className="size-4 text-muted" />} href={q.covers.rows[0]?.type === "addon" ? "/admin/insurance/add-ons" : "/admin/insurance/coverage"} count={q.covers.count} empty="No covers waiting for review.">
          {q.covers.rows.map((c) => (
            <QueueRow key={c.id} href={`/admin/insurance/${c.type === "addon" ? "add-ons" : "coverage"}?review=${c.id}`} title={c.name} meta={`${c.vendorName} · ${c.type === "addon" ? "Add-on" : "Coverage item"}`} since={c.submittedAt ?? c.createdAt} now={now} />
          ))}
        </QueuePanel>
        <QueuePanel title="Promotional campaigns" icon={<Megaphone aria-hidden className="size-4 text-muted" />} href="/admin/insurance/campaigns" count={q.campaigns.count} empty="No campaigns waiting for review.">
          {q.campaigns.rows.map((c) => (
            <QueueRow key={c.id} href="/admin/insurance/campaigns" title={c.title} meta={`${c.vendorName} · ${c.reference}`} since={c.submittedAt ?? c.createdAt} now={now} />
          ))}
        </QueuePanel>
        <QueuePanel title="Advertising" icon={<Presentation aria-hidden className="size-4 text-muted" />} href="/admin/advertising" count={q.ads.count} empty="No ad campaigns or creatives waiting for review.">
          {q.ads.rows.map((a) => (
            <QueueRow key={`c${a.id}`} href="/admin/advertising" title={a.name} meta={`${a.house ? "MarchGear (house)" : (a.advertiser ?? "Advertiser")} · ${a.reference}`} since={a.submittedAt ?? a.createdAt} now={now} />
          ))}
          {q.ads.creativeRows.slice(0, Math.max(0, 6 - q.ads.rows.length)).map((c) => (
            <QueueRow key={`r${c.id}`} href="/admin/advertising" title={c.name} meta={`Creative for ${c.campaignName}`} since={c.createdAt} now={now} />
          ))}
        </QueuePanel>
        <QueuePanel title="Payments to verify" icon={<Wallet aria-hidden className="size-4 text-muted" />} href="/admin/insurance/payments" count={q.payments.count} empty="No payments waiting for verification.">
          {q.payments.rows.map((p) => (
            <QueueRow key={p.id} href="/admin/insurance/payments" title={`${rupees(p.amount)} · ${p.vendorName}`} meta={`${p.invoiceNumber} · ${PAYMENT_METHOD_SHORT[p.method]} · ${p.utr}`} since={p.createdAt} now={now} />
          ))}
        </QueuePanel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel title="Vendors by status" className="xl:self-start">
          {s.vendors.total === 0 ? (
            <p className="text-[13.5px] text-muted">No vendors have registered yet.</p>
          ) : (
            <>
              <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-mist" role="img" aria-label={shown.map((st) => `${INS_VENDOR_STATUS_LABEL[st]}: ${s.vendors.status[st]}`).join(", ")}>
                {shown.map((st) => (
                  <span key={st} className={BAR[st]} style={{ width: `${(s.vendors.status[st] / s.vendors.total) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-4 space-y-2">
                {shown.map((st) => (
                  <li key={st}>
                    <Link href={`/admin/insurance/vendors?status=${st}`} className="flex items-center justify-between gap-3 text-[13px] hover:text-red">
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden className={cn("size-2.5 rounded-[2px]", BAR[st])} /> {INS_VENDOR_STATUS_LABEL[st]}
                      </span>
                      <span className="font-medium num">{s.vendors.status[st]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
        <Panel title="Recent approvals activity" action={<Link href="/admin/insurance/vendors" className="inline-flex items-center gap-1 text-[13px] font-medium text-red hover:underline">Vendors <ArrowRight aria-hidden className="size-3.5" /></Link>}>
          <InsHistoryList entries={s.recent.slice(0, 8)} showVendor empty="No activity yet. Submissions and decisions on vendors, products and covers appear here." />
        </Panel>
      </div>
    </>
  );
}
