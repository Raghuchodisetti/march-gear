import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3, Megaphone, MessageSquareWarning, MonitorPlay } from "lucide-react";
import type { InsCoverStatus, InsProductStatus } from "@/db/enums";
import { INS_COVER_STATUS_LABEL, INS_COVER_STATUS_TONE, INS_PRODUCT_STATUS_LABEL, INS_PRODUCT_STATUS_TONE } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { requireInsurer } from "@/server/insurance/context";
import { Badge, PortalHeader, formatDateTime, hrefWith, pageParam, strParam } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Card, Metric, Quiet } from "@/components/portal/dashboard/sections";
import { LinkTabs } from "@/components/admin/partner-ui";
import { TIMELINE_PAGE, approvalItems, approvalTimeline, otherWorkflowCounts, type ApprovalItem } from "@/components/insurance/vendor/approvals/queries";
import { historyLabel, historyTone, waitingFor } from "@/components/insurance/vendor/approvals/shared";
import { HistoryTimeline } from "@/components/insurance/vendor/approvals/timeline";

export const metadata: Metadata = { title: "Product approvals" };

const REVIEW = ["submitted", "pending_approval"];
const ATTENTION = ["changes_requested", "rejected"];

function StatusPill({ item }: { item: ApprovalItem }) {
  return item.kind === "product" ? (
    <Badge tone={INS_PRODUCT_STATUS_TONE[item.status as InsProductStatus]}>{INS_PRODUCT_STATUS_LABEL[item.status as InsProductStatus]}</Badge>
  ) : (
    <Badge tone={INS_COVER_STATUS_TONE[item.status as InsCoverStatus]}>{INS_COVER_STATUS_LABEL[item.status as InsCoverStatus]}</Badge>
  );
}

const kindLabel = (i: ApprovalItem) => (i.kind === "product" ? "Product" : i.coverType === "coverage" ? "Coverage item" : "Add-on cover");

export default async function ApprovalsPage(props: PageProps<"/insurance-vendor/approvals">) {
  const ctx = await requireInsurer({ perm: "products.view", next: "/insurance-vendor/approvals" });
  const sp = await props.searchParams;
  const kindRaw = strParam(sp.kind);
  const kind = kindRaw === "product" || kindRaw === "cover" ? kindRaw : undefined;
  const page = pageParam(sp.page);
  const now = new Date().getTime();

  const [items, timeline, other] = await Promise.all([approvalItems(ctx.vendor.id), approvalTimeline(ctx.vendor.id, page, kind), otherWorkflowCounts(ctx.vendor.id)]);
  const scoped = items.filter((i) => !kind || i.kind === kind);
  const waiting = scoped.filter((i) => REVIEW.includes(i.status)).sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  const attention = scoped.filter((i) => ATTENTION.includes(i.status));
  const approvedOffline = items.filter((i) => i.kind === "product" && i.status === "approved").length;
  const live = items.filter((i) => i.kind === "product" && i.status === "published").length;
  const decided = scoped.filter((i) => i.lastDecision).sort((a, b) => b.lastDecision!.at.localeCompare(a.lastDecision!.at));
  const canManage = ctx.can("products.manage");
  const pages = Math.max(1, Math.ceil(timeline.total / TIMELINE_PAGE));
  const params = { kind };
  const allPending = items.filter((i) => REVIEW.includes(i.status));
  const allAttention = items.filter((i) => ATTENTION.includes(i.status));

  return (
    <>
      <PortalHeader title="Product approvals" description="Everything waiting for, or decided by, MarchGear — products, coverage items and add-on covers — with the team's remarks." />

      <section aria-label="Summary" className="mb-6 flex flex-wrap gap-px overflow-hidden border border-line bg-line">
        <Metric label="Waiting for MarchGear" value={allPending.length} note={allPending.length ? `Oldest waiting ${waitingFor(allPending.map((i) => i.submittedAt).filter(Boolean).sort()[0] ?? null, now)}` : "Nothing in the queue"} />
        <Metric
          label="Needs your changes"
          value={allAttention.length}
          note={allAttention.length ? "Changes requested or rejected" : "Nothing to fix"}
          accent={allAttention.length ? <Badge tone="amber">Action needed</Badge> : undefined}
        />
        <Metric label="Approved, not live" value={approvedOffline} note={approvedOffline ? "Products you can publish" : "No products waiting to go live"} href={approvedOffline ? "/insurance-vendor/products?tab=approved" : undefined} />
        <Metric label="Live products" value={live} href="/insurance-vendor/products?tab=live" note="Published on the website" />
      </section>

      <section aria-label="Other approvals" className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-2">
        {[
          { href: "/insurance-vendor/campaigns", icon: <Megaphone className="size-4" />, title: "Promotional campaigns", c: other.campaigns, perm: ctx.can("campaigns.manage") },
          { href: "/insurance-vendor/advertising", icon: <MonitorPlay className="size-4" />, title: "Advertising", c: other.ads, perm: ctx.can("ads.manage") },
        ].map((w) => {
          const body = (
            <>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-mist text-ink/70">{w.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold">{w.title}</span>
                <span className="block text-[12.5px] text-muted">
                  {w.c.total ? (
                    <>
                      <span className="num">{w.c.review}</span> in review · <span className={cn("num", w.c.attention && "font-medium text-[#9a5b00]")}>{w.c.attention}</span> need changes · <span className="num">{w.c.approved}</span> approved
                    </>
                  ) : (
                    "Nothing submitted yet"
                  )}
                </span>
              </span>
              {w.perm && <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted transition-colors group-hover:text-red" />}
            </>
          );
          return w.perm ? (
            <Link key={w.title} href={w.href} className="group flex items-center gap-3 border border-line bg-white px-4 py-3.5 transition-colors hover:border-ink/30">
              {body}
            </Link>
          ) : (
            <div key={w.title} className="flex items-center gap-3 border border-line bg-white px-4 py-3.5">
              {body}
            </div>
          );
        })}
      </section>

      <LinkTabs
        active={kind ?? "all"}
        items={[
          { key: "all", label: "Everything", href: "/insurance-vendor/approvals", count: items.length },
          { key: "product", label: "Products", href: "/insurance-vendor/approvals?kind=product", count: items.filter((i) => i.kind === "product").length },
          { key: "cover", label: "Coverage & add-ons", href: "/insurance-vendor/approvals?kind=cover", count: items.filter((i) => i.kind === "cover").length },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          {attention.length > 0 && (
            <Card title="Needs your changes" subtitle="MarchGear sent these back. Fix them and resubmit." className="border-l-2 border-l-[#c98a1b]">
              <ul className="-my-1 divide-y divide-line">
                {attention.map((i) => (
                  <li key={`${i.kind}-${i.id}`} className="py-4 first:pt-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
                          <span>{kindLabel(i)}</span>
                          {i.reference && <span className="num">{i.reference}</span>}
                          <StatusPill item={i} />
                        </p>
                        <p className="mt-1 text-[14px] font-semibold">{i.name || "Untitled"}</p>
                        <p className="mt-2 flex gap-2 whitespace-pre-line text-[13px] text-ink/85">
                          <MessageSquareWarning aria-hidden className={cn("mt-0.5 size-4 shrink-0", i.status === "rejected" ? "text-red" : "text-[#9a5b00]")} />
                          <span>{i.adminRemarks || i.lastDecision?.remarks || "No remarks were left — open it for the history."}</span>
                        </p>
                        {i.requiredCorrections.length > 0 && (
                          <ol className="ml-6 mt-2 list-decimal space-y-0.5 text-[13px]">
                            {i.requiredCorrections.map((c, n) => (
                              <li key={n}>{c}</li>
                            ))}
                          </ol>
                        )}
                      </div>
                      <Button href={i.href} size="sm" variant={canManage ? "dark" : "outline"} className="shrink-0">
                        {canManage ? "Fix it" : "Open"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Waiting for MarchGear" subtitle={waiting.length ? "Oldest first. You'll be notified when each is decided." : undefined}>
            {waiting.length ? (
              <ul className="-my-1 divide-y divide-line">
                {waiting.map((i) => (
                  <li key={`${i.kind}-${i.id}`}>
                    <Link href={i.href} className="group flex items-center gap-3 py-3">
                      <Clock3 aria-hidden className="size-4 shrink-0 text-[#2456a6]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium group-hover:text-red">{i.name || "Untitled"}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {kindLabel(i)}
                          {i.reference ? ` · ${i.reference}` : ""} · submitted {i.submittedAt ? formatDateTime(i.submittedAt) : "—"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[12px] text-muted num">{waitingFor(i.submittedAt, now)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Quiet icon={<CheckCircle2 className="size-4" />} title="Nothing waiting">
                Products, coverage items and add-ons you submit appear here until MarchGear decides.
              </Quiet>
            )}
          </Card>

          <Card title="Decisions" subtitle="The latest MarchGear decision on each item" bodyClass="px-0 pb-2 md:px-0">
            {decided.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {decided.slice(0, 30).map((i) => (
                  <li key={`${i.kind}-${i.id}`}>
                    <Link href={i.href} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-mist/50 md:grid-cols-[minmax(0,1.4fr)_150px_140px] md:px-6">
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium">{i.name || "Untitled"}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {kindLabel(i)}
                          {i.reference ? ` · ${i.reference}` : ""}
                        </span>
                        {i.lastDecision?.remarks && <span className="mt-1 line-clamp-2 block text-[12.5px] text-ink/75">“{i.lastDecision.remarks}”</span>}
                      </span>
                      <span className="justify-self-end md:justify-self-start">
                        <StatusPill item={i} />
                      </span>
                      <span className="col-span-2 text-[12px] text-muted md:col-span-1 md:text-right">
                        <Badge tone={historyTone(i.lastDecision!.action)}>{historyLabel(i.lastDecision!.action)}</Badge>
                        <span className="ml-2 md:ml-0 md:mt-1 md:block">{formatDateTime(i.lastDecision!.at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Quiet title="No decisions yet">MarchGear&rsquo;s approvals, change requests and rejections show here with their remarks.</Quiet>
            )}
          </Card>
        </div>

        <aside className="min-w-0">
          <Card title="Timeline" subtitle={`${timeline.total} ${timeline.total === 1 ? "step" : "steps"} · newest first`}>
            <HistoryTimeline
              entries={timeline.entries}
              empty="Nothing submitted yet. Every submission and MarchGear decision appears here."
              subject={(e) => {
                const s = timeline.entries.find((x) => x.id === e.id)!.subject;
                return s.href ? (
                  <Link href={s.href} className="font-medium text-ink hover:text-red">
                    {s.kind}: {s.name}
                  </Link>
                ) : (
                  <span>
                    {s.kind}: {s.name}
                  </span>
                );
              }}
            />
            {pages > 1 && (
              <nav aria-label="Timeline pages" className="mt-6 flex items-center justify-between border-t border-line pt-4 text-[12.5px] text-muted">
                <span className="num">
                  Page {page} of {pages}
                </span>
                <span className="flex gap-2">
                  {page > 1 && (
                    <Link href={hrefWith("/insurance-vendor/approvals", params, { page: String(page - 1) })} className="font-medium text-ink hover:text-red">
                      Newer
                    </Link>
                  )}
                  {page < pages && (
                    <Link href={hrefWith("/insurance-vendor/approvals", params, { page: String(page + 1) })} className="font-medium text-ink hover:text-red">
                      Older
                    </Link>
                  )}
                </span>
              </nav>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
