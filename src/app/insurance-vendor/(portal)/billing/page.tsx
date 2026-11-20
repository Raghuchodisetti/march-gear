import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { AlertCircle, ArrowRight, ArrowUpRight, CalendarClock, Check, CircleDollarSign, Clock3, FileText, Landmark, Megaphone, ReceiptText } from "lucide-react";
import { getDb } from "@/db";
import { insVendors } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE } from "@/insurance/labels";
import { requireInsurer } from "@/server/insurance/context";
import {
  ensureInsBillingState,
  getAdRefs,
  getInsBillingSettings,
  getInsInvoiceRows,
  getInsPlanHistory,
  getInsPlans,
  getInsUsage,
  insQuoteFor,
  scheduledFreePlan,
  toInsInvoiceView,
} from "@/server/insurance/subscription";
import { Badge, Panel, PortalHeader, formatDateTime } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { InsPlanChangeButton } from "@/components/insurance/vendor/billing/plan-change";
import {
  INS_PLAN_STATUS_LABEL,
  INS_PLAN_STATUS_TONE,
  INS_USAGE_LABEL,
  INS_USAGE_NOTE,
  addDays,
  insPhase,
  insPlanChangeRules,
  insPlanName,
  insTrialFor,
  isPayable,
  istDate,
  rupees,
  type InsLimits,
} from "@/components/insurance/vendor/billing/shared";

export const metadata: Metadata = { title: "Billing" };

function Meter({ label, note, used, limit }: { label: string; note: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const over = limit !== null && used > limit;
  const near = limit !== null && !over && used / limit >= 0.8;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="shrink-0 text-[13px] text-muted num">
          <span className={cn("font-semibold text-ink", over && "text-red")}>{used}</span> {limit === null ? "· Unlimited" : `of ${limit}`}
        </p>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#EFEFEF]" role="meter" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit ?? undefined}>
        {limit === null ? (
          <div className="h-full w-full bg-[repeating-linear-gradient(90deg,#d9d9d9_0_6px,transparent_6px_10px)]" />
        ) : (
          <div className={cn("h-full rounded-full transition-[width] duration-[1200ms] ease-[var(--ease-premium)]", over ? "bg-red" : near ? "bg-[#c77700]" : "bg-ink")} style={{ width: `${Math.max(pct, used ? 2 : 0)}%` }} />
        )}
      </div>
      <p className={cn("mt-1.5 text-[12px]", over ? "text-red" : near ? "text-[#9a5b00]" : "text-muted")}>
        {over ? `Over your plan's limit by ${used - (limit ?? 0)}.` : near ? (used === limit ? "At your plan's limit." : "Close to your limit.") : note}
      </p>
    </div>
  );
}

const limitText = (v: number | null) => (v === null ? "Unlimited" : String(v));

export default async function Page() {
  const ctx = await requireInsurer({ perm: "billing.manage" });
  await ensureInsBillingState(ctx.vendor.id);
  const [[v], plans, settings, usage, rows] = await Promise.all([
    getDb().select().from(insVendors).where(eq(insVendors.id, ctx.vendor.id)),
    getInsPlans(),
    getInsBillingSettings(),
    getInsUsage(ctx.vendor.id),
    getInsInvoiceRows(ctx.vendor.id),
  ]);
  const [scheduled, history, ads] = await Promise.all([scheduledFreePlan(v.id, plans), getInsPlanHistory(v, settings.trialDays), getAdRefs(v.id, rows.map((r) => r.adCampaignId))]);
  const today = istDate();
  const current = plans.find((x) => x.id === v.plan) ?? null;
  const views = rows.map((r) => toInsInvoiceView(r, plans, ads, today));
  const trial = insTrialFor(v.approvedAt, v.createdAt, settings.trialDays, today);
  const phase = insPhase({ ...v, trial }, plans, today);
  const ending = v.planStatus === "cancelled";
  const subs = views.filter((i) => i.kind === "subscription");
  const open = subs.filter((i) => isPayable(i.display) || i.display === "verifying");
  const pending = open.filter((i) => i.plan !== v.plan);
  const unpaidCurrent = open.find((i) => i.plan === v.plan) ?? open[0];
  const used = trial.days - trial.daysLeft;

  const adInvoices = views.filter((i) => i.kind === "advertising" && i.display !== "void");
  const adPaid = adInvoices.filter((i) => i.display === "paid").reduce((s, i) => s + i.total, 0);
  const adOutstanding = adInvoices.filter((i) => isPayable(i.display) || i.display === "verifying").reduce((s, i) => s + i.total, 0);
  const canAds = ctx.can("ads.manage");

  const statusLabel = phase === "trial" ? "Free trial" : phase === "free" ? "Free plan" : INS_PLAN_STATUS_LABEL[v.planStatus];
  const statusTone = phase === "trial" ? "blue" : phase === "free" ? "green" : INS_PLAN_STATUS_TONE[v.planStatus];

  return (
    <>
      <PortalHeader
        title="Billing"
        description="Your MarchGear insurance plan, what you're using against it, and how plan changes are billed."
        actions={
          <>
            <Button href="/insurance-vendor/transactions" variant="ghost" size="sm" icon={<CircleDollarSign className="size-4" aria-hidden />}>
              Transactions
            </Button>
            <Button href="/insurance-vendor/invoices" variant="outline" size="sm" icon={<FileText className="size-4" aria-hidden />}>
              Invoices
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="relative min-w-0 overflow-hidden border border-line bg-white">
          <div aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-red" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Current plan</p>
              <Badge tone={statusTone}>{statusLabel}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
              <div className="min-w-0">
                <h2 className="font-display text-[36px] font-semibold leading-none tracking-[-0.03em] sm:text-[40px]">{current?.name ?? v.plan}</h2>
                <p className="mt-2 max-w-md text-[14px] text-muted">{current?.summary}</p>
              </div>
              {current && (
                <p className="sm:text-right">
                  <span className="font-display text-[28px] font-semibold tracking-[-0.02em] num">{current.monthly ? rupees(current.monthly) : "Free"}</span>
                  {current.monthly > 0 && <span className="text-[13px] text-muted"> / month</span>}
                  <span className="block text-[12px] text-muted">{current.monthly ? `+ 18% GST (${rupees(Math.round(current.monthly * 1.18))} total)` : "No invoices on this plan"}</span>
                </p>
              )}
            </div>

            <div className="mt-7 border-t border-line pt-6">
              {phase === "trial" ? (
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="flex items-center gap-2 text-[14px] font-medium">
                      <Clock3 className="size-4 text-red" aria-hidden />
                      {trial.daysLeft} day{trial.daysLeft === 1 ? "" : "s"} left in your {trial.days}-day free trial
                    </p>
                    <p className="text-[12.5px] text-muted">
                      Started {formatDate(trial.start)} · free until {formatDate(trial.lastDay)}
                    </p>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EFEFEF]">
                    <div className="h-full rounded-full bg-red transition-[width] duration-[1200ms]" style={{ width: `${trial.days ? Math.min(100, (used / trial.days) * 100) : 100}%` }} />
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted">
                    {current && current.monthly > 0 ? (
                      <>
                        Your first invoice — {rupees(current.monthly)} + GST for {current.name} — is issued on {formatDate(trial.firstBillable)} for the month from that day, due within{" "}
                        {settings.paymentTermsDays} days. Nothing is charged automatically: you pay by bank transfer, UPI or cheque and MarchGear verifies it.
                      </>
                    ) : (
                      <>{current?.name ?? "This plan"} is free, so no invoice is raised when the trial ends. Upgrade any time for more products, campaigns and team members.</>
                    )}
                  </p>
                </div>
              ) : phase === "free" ? (
                <div className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-[#1e7a3c]" aria-hidden />
                  <p className="text-[13.5px] leading-relaxed text-muted">
                    You&apos;re on a free plan — MarchGear doesn&apos;t raise invoices for it. Upgrading starts a monthly paid period from the day you upgrade, once MarchGear verifies your first payment.
                  </p>
                </div>
              ) : phase === "paid" && v.planRenewsAt ? (
                ending ? (
                  <div className="flex gap-3 border-l-[3px] border-[#9a5b00] bg-[#fdf3e1] px-4 py-3">
                    <CalendarClock className="mt-0.5 size-4 shrink-0 text-[#9a5b00]" aria-hidden />
                    <div className="text-[13.5px]">
                      <p className="font-semibold text-[#6b4000]">
                        {current?.name} ends on {formatDate(addDays(v.planRenewsAt, -1))}
                      </p>
                      <p className="mt-0.5 text-[#6b4000]/80">
                        You move to {insPlanName(plans, scheduled)} (free) on {formatDate(v.planRenewsAt)} and no renewal invoice is raised. Changed your mind? Use <em className="not-italic font-medium">Keep {current?.name}</em> below.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[12px] text-muted">Paid until</p>
                      <p className="mt-1 text-[16px] font-semibold">{formatDate(addDays(v.planRenewsAt, -1))}</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-muted">Next renewal</p>
                      <p className="mt-1 text-[16px] font-semibold">{formatDate(v.planRenewsAt)}</p>
                      <p className="text-[12px] text-muted">The renewal invoice is issued 7 days before and is due on the renewal date.</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex gap-3 border-l-[3px] border-red bg-red-50 px-4 py-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-red" aria-hidden />
                  <div className="text-[13.5px]">
                    <p className="font-semibold">Payment due</p>
                    <p className="mt-0.5 text-muted">
                      {v.planRenewsAt ? `Your paid period ended on ${formatDate(addDays(v.planRenewsAt, -1))}. ` : `Your free trial ended on ${formatDate(trial.lastDay)}. `}
                      {unpaidCurrent ? (
                        unpaidCurrent.display === "verifying" ? (
                          <>
                            MarchGear is verifying your payment for{" "}
                            <Link href={`/insurance-vendor/invoices/${unpaidCurrent.id}`} className="font-medium text-ink underline underline-offset-4 num">
                              {unpaidCurrent.number}
                            </Link>
                            .
                          </>
                        ) : (
                          <>
                            Pay invoice{" "}
                            <Link href={`/insurance-vendor/invoices/${unpaidCurrent.id}`} className="font-medium text-ink underline underline-offset-4 num">
                              {unpaidCurrent.number}
                            </Link>{" "}
                            ({rupees(unpaidCurrent.total)}) and record the payment to keep your plan active — or move to a free plan below.
                          </>
                        )
                      ) : (
                        "Your invoice will appear on the Invoices page."
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {pending.length > 0 && (
              <div className="mt-5 space-y-2">
                {pending.map((i) => (
                  <Link key={i.id} href={`/insurance-vendor/invoices/${i.id}`} className="flex flex-wrap items-center justify-between gap-3 border border-line px-4 py-3 transition-colors hover:border-ink/30">
                    <span className="min-w-0 text-[13.5px]">
                      <span className="font-medium">Change to {insPlanName(plans, i.plan)}</span>
                      <span className="text-muted">
                        {" "}
                        · {i.periodStart > today ? `from ${formatDate(i.periodStart)}` : "on payment"} · invoice <span className="num">{i.number}</span>
                      </span>
                    </span>
                    <Badge tone={INVOICE_STATUS_TONE[i.display]}>{INVOICE_STATUS_LABEL[i.display]}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <Panel title="Usage against your plan">
          <div className="space-y-6">
            {(Object.keys(INS_USAGE_LABEL) as (keyof InsLimits)[]).map((k) => (
              <Meter key={k} label={INS_USAGE_LABEL[k]} note={INS_USAGE_NOTE[k]} used={usage[k]} limit={current?.limits[k] ?? null} />
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-[12.5px]">
            <Link href="/insurance-vendor/products" className="inline-flex items-center gap-1 font-medium hover:text-red">
              Products <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <Link href="/insurance-vendor/campaigns" className="inline-flex items-center gap-1 font-medium hover:text-red">
              Campaigns <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <Link href="/insurance-vendor/settings" className="inline-flex items-center gap-1 font-medium hover:text-red">
              Team <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </Panel>
      </div>

      <section className="mt-10">
        <div className="mb-5">
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em]">Compare plans</h2>
          <p className="mt-1 text-[13.5px] text-muted">Prices per month, before 18% GST. Advertising is billed separately per booking.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === v.plan;
            const quote = insQuoteFor(v, rows, plans, plan.id, settings, scheduled, today);
            return (
              <div key={plan.id} className={cn("relative flex min-w-0 flex-col border bg-white p-6 transition-colors duration-500", isCurrent ? "border-ink" : "border-line hover:border-ink/30")}>
                {isCurrent && <span className="absolute -top-px right-6 bg-ink px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white">Your plan</span>}
                {ending && plan.id === scheduled && <span className="absolute -top-px right-6 bg-[#9a5b00] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white">From {formatDate(v.planRenewsAt!)}</span>}
                <p className="text-[15px] font-semibold">{plan.name}</p>
                <p className="mt-1 min-h-10 text-[13px] text-muted">{plan.summary}</p>
                <p className="mt-5">
                  <span className="font-display text-[32px] font-semibold tracking-[-0.03em] num">{plan.monthly ? rupees(plan.monthly) : "Free"}</span>
                  {plan.monthly > 0 && <span className="text-[13px] text-muted"> / month</span>}
                </p>
                <dl className="mt-5 grid grid-cols-3 gap-x-3 gap-y-2 border-y border-line py-4 text-[12.5px]">
                  <div className="min-w-0">
                    <dt className="text-muted">Products</dt>
                    <dd className="font-medium">{limitText(plan.limits.products)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted">Campaigns</dt>
                    <dd className="font-medium">{limitText(plan.limits.activeCampaigns)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted">Team</dt>
                    <dd className="font-medium">{limitText(plan.limits.members)}</dd>
                  </div>
                </dl>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2 text-[13px]">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-red" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent && !ending ? (
                    <p className="flex h-11 items-center justify-center border border-dashed border-line text-[13px] text-muted">Current plan</p>
                  ) : (
                    <InsPlanChangeButton plan={plan} current={current} quote={quote} usage={usage} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-10 grid gap-6 xl:grid-cols-2">
        <Panel title="How plan changes are billed">
          <ol className="space-y-3">
            {insPlanChangeRules(settings.paymentTermsDays).map((r, i) => (
              <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#F6F6F6] text-[11px] font-semibold num">{i + 1}</span>
                {r}
              </li>
            ))}
          </ol>
          <div className="mt-5 flex gap-3 border-t border-line pt-5 text-[13px] text-muted">
            <Landmark className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
            <p>
              No payment gateway is connected, so nothing is charged automatically. Invoices are payable within {settings.paymentTermsDays} days by bank transfer, UPI or cheque; you record the
              UTR on the{" "}
              <Link href="/insurance-vendor/invoices" className="font-medium text-ink underline underline-offset-4">
                Invoices
              </Link>{" "}
              page and MarchGear&apos;s accounts team verifies it.
            </p>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel
            title="Advertising spend"
            action={
              canAds ? (
                <Link href="/insurance-vendor/advertising" className="inline-flex items-center gap-1 text-[12.5px] font-medium hover:text-red">
                  Advertising <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              ) : undefined
            }
          >
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  ["Invoiced", adInvoices.reduce((s, i) => s + i.total, 0)],
                  ["Paid", adPaid],
                  ["Outstanding", adOutstanding],
                ] as const
              ).map(([k, n]) => (
                <div key={k} className="min-w-0">
                  <p className="text-[12px] text-muted">{k}</p>
                  <p className={cn("mt-1 font-display text-[20px] font-semibold tracking-[-0.02em] num sm:text-[22px]", k === "Outstanding" && n > 0 && "text-red")}>{rupees(n)}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 flex gap-2.5 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
              <Megaphone className="mt-0.5 size-3.5 shrink-0 text-ink" aria-hidden />
              <span>
                Paid placements (homepage and insurance banners, sponsored listings) are booked separately and invoiced when MarchGear approves the booking — {adInvoices.length} advertising invoice
                {adInvoices.length === 1 ? "" : "s"} so far, incl. GST.{" "}
                {canAds ? (
                  <Link href="/insurance-vendor/advertising" className="font-medium text-ink underline underline-offset-4">
                    Book or manage ads
                  </Link>
                ) : (
                  "Ask someone with advertising access to book placements."
                )}
              </span>
            </p>
          </Panel>

          <Panel title="Plan history" padded={false}>
            <ol className="max-h-[360px] overflow-y-auto px-5 py-4">
              {history.map((h, i) => (
                <li key={h.id} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < history.length - 1 && <span aria-hidden className="absolute bottom-0 left-[11px] top-7 w-px bg-line" />}
                  <span className={cn("relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border bg-white", i === 0 ? "border-red text-red" : "border-line text-muted")}>
                    {h.action.startsWith("payment") ? <ReceiptText className="size-3.5" aria-hidden /> : h.action === "invoice" ? <FileText className="size-3.5" aria-hidden /> : <ArrowRight className="size-3.5" aria-hidden />}
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-[13.5px] leading-snug">{h.summary}</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {formatDateTime(h.at)}
                      {h.by ? ` · ${h.by}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
