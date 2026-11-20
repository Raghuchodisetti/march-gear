import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgePercent, CarFront, ClipboardCheck, FileText, GitPullRequest } from "lucide-react";
import { PARTNER_STATUS, type PartnerStatus } from "@/db/enums";
import { OFFER_CATEGORY_LABEL, PARTNER_STATUS_LABEL } from "@/partner/labels";
import { partnerNetworkStats } from "@/server/admin/partners";
import { requireStaff } from "@/server/auth";
import { AdminHeader, Panel, StatCard } from "@/components/admin/ui";
import { HistoryList } from "@/components/admin/partner-history";
import { PartnerPill, fieldLabel, overdue, rupees, waitingLabel } from "@/components/admin/partner-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dealer partner dashboard" };

const BAR: Record<PartnerStatus, string> = {
  draft: "bg-ink/15",
  submitted: "bg-[#2f6fd6]",
  pending_approval: "bg-[#5b8fe0]",
  under_review: "bg-[#8fb3ec]",
  documents_required: "bg-[#e09200]",
  changes_requested: "bg-[#f2b84b]",
  approved: "bg-[#22a04f]",
  rejected: "bg-red",
  suspended: "bg-[#a11f1f]",
  deactivated: "bg-ink/40",
};

function QueuePanel({ title, icon, href, count, empty, children, linkLabel = "Open queue" }: { title: string; icon: React.ReactNode; href: string; count: number; empty: string; children: React.ReactNode; linkLabel?: string }) {
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
        <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-red hover:underline">
          {linkLabel} <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      }
    >
      {count === 0 ? <p className="p-5 text-[13.5px] text-muted">{empty}</p> : <ul className="divide-y divide-line">{children}</ul>}
    </Panel>
  );
}

function Waiting({ since, now }: { since: Date | null; now: number }) {
  return <span className={cn("shrink-0 text-[12px] num", overdue(since, now) ? "font-semibold text-red" : "text-muted")}>{waitingLabel(since, now)}</span>;
}

export default async function PartnerDashboardPage() {
  await requireStaff();
  const s = await partnerNetworkStats();
  const now = s.now;
  const shown = PARTNER_STATUS.filter((st) => s.status[st] > 0);

  return (
    <>
      <AdminHeader title="Dealer partner dashboard" description="Applications, approvals and campaigns across the dealer network. Queues are oldest first; anything waiting over 48 hours is flagged." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total dealers" value={s.total} note={`${s.status.draft} still drafting`} href="/admin/dealers" />
        <StatCard label="Pending approval" value={s.pending} note={`${s.withDealer} waiting on the dealer`} href="/admin/dealers/verification" tone={s.pending ? "red" : undefined} />
        <StatCard label="Approved" value={s.status.approved} note="Live partners" href="/admin/dealers?status=approved" />
        <StatCard label="Rejected" value={s.status.rejected} href="/admin/dealers?status=rejected" />
        <StatCard label="Suspended" value={s.status.suspended} note={s.status.deactivated ? `${s.status.deactivated} deactivated` : undefined} href="/admin/dealers?status=suspended" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Vehicles to review" value={s.vehiclesPending} href="/admin/vehicle-approvals" tone={s.vehiclesPending ? "red" : undefined} />
        <StatCard label="Offers to review" value={s.offersPending} href="/admin/offer-approvals" tone={s.offersPending ? "red" : undefined} />
        <StatCard label="Active campaigns" value={s.activeCampaigns} note={`${s.scheduledCampaigns} scheduled`} href="/admin/campaign-management?show=active" />
        <StatCard label="Dealer enquiries" value={s.enquiries.toLocaleString("en-IN")} note={`${s.enquiries30.toLocaleString("en-IN")} in the last 30 days`} />
      </div>

      {s.total > 0 && (
        <Panel title="Dealers by status" className="mt-6">
          <div className="flex h-3 overflow-hidden rounded-full bg-mist" role="img" aria-label={shown.map((st) => `${PARTNER_STATUS_LABEL[st]}: ${s.status[st]}`).join(", ")}>
            {shown.map((st) => (
              <span key={st} className={BAR[st]} style={{ width: `${(s.status[st] / s.total) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px]">
            {shown.map((st) => (
              <li key={st}>
                <Link href={`/admin/dealers?status=${st}`} className="inline-flex items-center gap-1.5 hover:text-red">
                  <span aria-hidden className={cn("size-2.5 rounded-[2px]", BAR[st])} /> {PARTNER_STATUS_LABEL[st]} <span className="text-muted num">{s.status[st]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <QueuePanel title="Dealer applications" icon={<ClipboardCheck aria-hidden className="size-4 text-muted" />} href="/admin/dealers/verification" count={s.pending} empty="No applications waiting for review.">
          {s.dealerQueue.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/dealers/verification?id=${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-mist/50">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium">{d.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {d.reference}
                    {d.city ? ` · ${d.city}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <PartnerPill status={d.status} />
                  <Waiting since={d.submittedAt ?? d.createdAt} now={now} />
                </span>
              </Link>
            </li>
          ))}
        </QueuePanel>

        <QueuePanel title="Vehicle listings" icon={<CarFront aria-hidden className="size-4 text-muted" />} href="/admin/vehicle-approvals" count={s.vehiclesPending} empty="No vehicles waiting for review.">
          {s.vehicleQueue.map((v) => (
            <li key={v.id}>
              <Link href={`/admin/vehicle-approvals?review=${v.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-mist/50">
                <span className="block h-10 w-14 shrink-0 overflow-hidden rounded-[2px] bg-mist">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.image && <img src={v.image} alt="" className="size-full object-cover" loading="lazy" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">
                    {v.model} {v.variant}
                  </span>
                  <span className="block truncate text-[12px] text-muted">
                    {v.partnerName ?? "Dealer"} · {v.kind === "used" ? "Used" : "New"} · {rupees(v.price)}
                  </span>
                </span>
                <Waiting since={v.submittedAt ?? v.createdAt} now={now} />
              </Link>
            </li>
          ))}
        </QueuePanel>

        <QueuePanel title="Offers" icon={<BadgePercent aria-hidden className="size-4 text-muted" />} href="/admin/offer-approvals" count={s.offersPending} empty="No offers waiting for review.">
          {s.offerQueue.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/offer-approvals?review=${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-mist/50">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium">{o.title}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {o.partnerName ?? "Dealer"} · {OFFER_CATEGORY_LABEL[o.category as keyof typeof OFFER_CATEGORY_LABEL] ?? o.category}
                  </span>
                </span>
                <Waiting since={o.submittedAt ?? o.createdAt} now={now} />
              </Link>
            </li>
          ))}
        </QueuePanel>

        <QueuePanel title="Change requests" icon={<GitPullRequest aria-hidden className="size-4 text-muted" />} href="/admin/approval-history?target=profile_change" linkLabel="History" count={s.changesPending} empty="No change requests waiting.">
          {s.changeQueue.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/dealers/details?id=${c.partnerId}&tab=changes`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-mist/50">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium">{c.partnerName ?? c.reference}</span>
                  <span className="block truncate text-[12px] text-muted">Wants to change {c.fields.map(fieldLabel).join(", ")}</span>
                </span>
                <Waiting since={c.createdAt} now={now} />
              </Link>
            </li>
          ))}
        </QueuePanel>
      </div>
      {s.docsPending > 0 && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
          <FileText aria-hidden className="size-4" /> {s.docsPending} submitted document{s.docsPending === 1 ? "" : "s"} still awaiting a check — open a dealer&apos;s Documents tab to verify them.
        </p>
      )}

      <Panel
        title="Recent decisions"
        className="mt-6"
        action={
          <Link href="/admin/approval-history?side=admin" className="inline-flex items-center gap-1 text-[13px] font-medium text-red hover:underline">
            Full history <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        }
      >
        <HistoryList entries={s.recent} showPartner empty="No decisions yet. Approvals, rejections and requests from staff appear here." />
      </Panel>
    </>
  );
}
