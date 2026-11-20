import Link from "next/link";
import type { ReactNode } from "react";
import { AlarmClock, ArrowUpRight, BadgeCheck, Check, ChevronRight, ClipboardCheck, RefreshCcw } from "lucide-react";
import type { AdDisplayStatus, InsCampaignDisplay } from "@/insurance/labels";
import { AD_STATUS_LABEL, AD_STATUS_TONE, INS_CAMPAIGN_STATUS_LABEL, INS_CAMPAIGN_STATUS_TONE, INS_PRODUCT_STATUS_LABEL, INS_PRODUCT_STATUS_TONE } from "@/insurance/labels";
import type { InsProductStatus } from "@/db/enums";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/portal/ui";
import { InlineBar } from "@/components/portal/analytics/charts";
import type { CampaignPerf, FollowUp } from "@/server/insurance/dashboard";

/* Server-safe pieces of the insurance vendor dashboard. */

export function InsSetupSteps({ steps }: { steps: { key: string; label: string; done: boolean; href: string }[] }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <section className="border border-line bg-white">
      <div className="grid grid-cols-1 gap-6 p-5 md:p-7 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red">Get started</p>
          <h2 className="mt-2 font-display text-[22px] font-semibold leading-tight tracking-[-0.02em]">Set up your insurance storefront</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">A complete profile, clear covers and approved products are what bring quote requests in.</p>
          <div className="mt-5 flex items-center gap-3">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-mist">
              <span className="block h-full rounded-full bg-red transition-[width] duration-1000" style={{ width: `${(done / Math.max(1, steps.length)) * 100}%` }} />
            </span>
            <span className="text-[12px] font-medium text-muted num">
              {done} of {steps.length}
            </span>
          </div>
        </div>
        <ol className="flex flex-wrap gap-px self-start border border-line bg-line">
          {steps.map((s, i) => (
            <li key={s.key} className="min-w-0 flex-[1_1_220px] bg-white">
              <Link href={s.href} className={cn("group flex h-full items-center gap-3 px-4 py-3.5 transition-colors duration-300 hover:bg-mist/60", s.done && "text-muted")}>
                <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[11.5px] font-semibold num", s.done ? "border-ink bg-ink text-white" : "border-line text-ink")}>
                  {s.done ? <Check aria-label="Done" className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("min-w-0 flex-1 text-[13px] font-medium", s.done && "line-through decoration-ink/20")}>{s.label}</span>
                {!s.done && <ChevronRight aria-hidden className="size-4 text-muted transition-transform duration-300 group-hover:translate-x-0.5" />}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function QuickActions({ items }: { items: { href: string; label: string; icon: ReactNode }[] }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Quick actions" className="flex flex-wrap gap-px overflow-hidden border border-line bg-line">
      {items.map((a) => (
        <Link key={a.href} href={a.href} className="group flex min-w-0 flex-[1_1_150px] items-center gap-2.5 bg-white px-4 py-3.5 text-[13px] font-medium transition-colors duration-300 hover:bg-[#fcfcfc]">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-mist text-ink/70 transition-colors group-hover:bg-red group-hover:text-white">{a.icon}</span>
          <span className="min-w-0 truncate">{a.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Policy conversions — reported by the vendor and verified by MarchGear, never added together. */
export function Conversions({ reported, verified, enquiries }: { reported: number; verified: number; enquiries: number }) {
  const rate = (n: number) => (enquiries ? `${Math.round((n / enquiries) * 1000) / 10}% of enquiries` : "");
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden border border-line bg-line sm:grid-cols-2">
      <div className="bg-white p-5">
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
          <ClipboardCheck aria-hidden className="size-4" /> Policies issued — reported
        </p>
        <p className="mt-3 font-display text-[30px] font-semibold leading-none tracking-[-0.03em] num">{reported.toLocaleString("en-IN")}</p>
        <p className="mt-2 text-[12.5px] text-muted">{[rate(reported), "as marked by your team"].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="bg-white p-5">
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
          <BadgeCheck aria-hidden className="size-4 text-[#1e7a3c]" /> Verified by MarchGear
        </p>
        <p className="mt-3 font-display text-[30px] font-semibold leading-none tracking-[-0.03em] num">{verified.toLocaleString("en-IN")}</p>
        <p className="mt-2 text-[12.5px] text-muted">{reported > verified ? `${reported - verified} awaiting verification` : rate(verified) || "Checked against your evidence"}</p>
      </div>
    </div>
  );
}

export function ProductPerformance({ rows }: { rows: { id: number; reference: string; name: string; status: InsProductStatus; views: number; enquiries: number }[] }) {
  const maxV = Math.max(1, ...rows.map((r) => r.views));
  const maxE = Math.max(1, ...rows.map((r) => r.enquiries));
  return (
    <div className="relative -mx-5 overflow-x-auto md:-mx-6">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="text-[12px] text-muted">
            <th className="border-b border-line px-5 pb-2.5 font-medium md:px-6">Product</th>
            <th className="w-[30%] border-b border-line px-3 pb-2.5 font-medium">Views</th>
            <th className="w-[26%] border-b border-line px-3 pb-2.5 pr-5 font-medium md:pr-6">Enquiries</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="group">
              <td className="border-b border-line px-5 py-3 md:px-6">
                <Link href={`/insurance-vendor/products/${r.id}`} className="block min-w-0">
                  <span className="block truncate font-medium group-hover:text-red">{r.name}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted">
                    <span className="num">{r.reference}</span>
                    <Badge tone={INS_PRODUCT_STATUS_TONE[r.status]}>{INS_PRODUCT_STATUS_LABEL[r.status]}</Badge>
                  </span>
                </Link>
              </td>
              <td className="border-b border-line px-3 py-3">
                <InlineBar value={r.views} max={maxV}>
                  {r.views.toLocaleString("en-IN")}
                </InlineBar>
              </td>
              <td className="border-b border-line px-3 py-3 pr-5 md:pr-6">
                <InlineBar value={r.enquiries} max={maxE} tone="red">
                  {r.enquiries.toLocaleString("en-IN")}
                </InlineBar>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CampaignTable({ rows }: { rows: CampaignPerf[] }) {
  const maxClicks = Math.max(1, ...rows.map((r) => r.clicks));
  return (
    <div className="relative -mx-5 overflow-x-auto md:-mx-6">
      <table className="w-full min-w-[620px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="text-[12px] text-muted">
            <th className="border-b border-line px-5 pb-2.5 font-medium md:px-6">Campaign</th>
            <th className="border-b border-line px-3 pb-2.5 text-right font-medium">Views</th>
            <th className="w-[28%] border-b border-line px-3 pb-2.5 font-medium">Clicks</th>
            <th className="border-b border-line px-3 pb-2.5 text-right font-medium">CTR</th>
            <th className="border-b border-line px-3 pb-2.5 pr-5 text-right font-medium md:pr-6">Enquiries</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="border-b border-line px-5 py-3 md:px-6">
                <Link href={r.href} className="group block min-w-0">
                  <span className="block max-w-[260px] truncate font-medium group-hover:text-red">{r.name}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted">
                    <span>{r.kind === "ad" ? "Advertising" : "Promotion"}</span>
                    {r.statusKind === "ad" ? (
                      <Badge tone={AD_STATUS_TONE[r.status as AdDisplayStatus]}>{AD_STATUS_LABEL[r.status as AdDisplayStatus]}</Badge>
                    ) : (
                      <Badge tone={INS_CAMPAIGN_STATUS_TONE[r.status as InsCampaignDisplay]}>{INS_CAMPAIGN_STATUS_LABEL[r.status as InsCampaignDisplay]}</Badge>
                    )}
                  </span>
                </Link>
              </td>
              <td className="border-b border-line px-3 py-3 text-right num" title={r.kind === "ad" ? "Ad impressions" : "Campaign views"}>
                {r.views.toLocaleString("en-IN")}
              </td>
              <td className="border-b border-line px-3 py-3">
                <InlineBar value={r.clicks} max={maxClicks}>
                  {r.clicks.toLocaleString("en-IN")}
                </InlineBar>
              </td>
              <td className="border-b border-line px-3 py-3 text-right text-muted num">{r.views ? `${((r.clicks / r.views) * 100).toFixed(1)}%` : "—"}</td>
              <td className="border-b border-line px-3 py-3 pr-5 text-right font-semibold num md:pr-6">{r.enquiries.toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FollowUpList({ items, now }: { items: FollowUp[]; now: Date }) {
  const time = (d: Date) => d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
  const day = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
  const todayKey = day(now);
  return (
    <ul className="-mx-2">
      {items.map((f) => (
        <li key={`${f.kind}-${f.id}`}>
          <Link href={f.href} className="group flex items-start gap-3 rounded-[3px] px-2 py-2.5 transition-colors duration-300 hover:bg-mist/70">
            <span className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full", f.overdue ? "bg-red-50 text-red" : "bg-mist text-ink/70")}>
              {f.kind === "renewal" ? <RefreshCcw aria-hidden className="size-3.5" /> : <AlarmClock aria-hidden className="size-3.5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-ink group-hover:text-red">{f.name}</span>
              <span className="block truncate text-[12px] text-muted">
                <span className="num">{f.reference}</span> · {f.detail}
              </span>
            </span>
            <span className={cn("shrink-0 text-right text-[12px] num", f.overdue ? "font-medium text-red" : "text-muted")}>
              {day(f.at) === todayKey ? time(f.at) : day(f.at)}
              {f.overdue && <span className="block text-[10.5px] font-semibold uppercase tracking-[0.06em]">Overdue</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CardLinkOut({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
      {children} <ArrowUpRight aria-hidden className="size-3.5" />
    </Link>
  );
}
