import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { AlertCircle, ArrowRight, Check, CircleDollarSign, Clock3, FileText, Landmark } from "lucide-react";
import { getDb } from "@/db";
import { partners } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE, PLAN_STATUS_LABEL } from "@/partner/labels";
import { requirePartner } from "@/server/partner/context";
import { ensureBillingState, getInvoices, getPlanHistory, getPlans, getUsage, quoteFor, toInvoiceView } from "@/server/partner/billing";
import { Badge, Panel, PortalHeader, formatDateTime } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { PlanChangeButton } from "@/components/portal/billing/plan-change";
import { PLAN_CHANGE_RULES, PLAN_STATUS_TONE, TRIAL_DAYS, USAGE_LABEL, addDays, istDate, rupees, trialFor, type Plan } from "@/components/portal/billing/shared";

export const metadata: Metadata = { title: "Subscription" };

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const over = limit !== null && used > limit;
  const near = limit !== null && !over && used / limit >= 0.8;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-[13px] text-muted num">
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
      {over && <p className="mt-1.5 text-[12px] text-red">Over your plan&apos;s limit by {used - (limit ?? 0)}.</p>}
      {near && <p className="mt-1.5 text-[12px] text-[#9a5b00]">{used === limit ? "At your plan's limit." : "Close to your limit."}</p>}
    </div>
  );
}

const limitText = (v: number | null, unit: string) => (v === null ? `Unlimited ${unit}` : `${v} ${unit}`);

export default async function Page() {
  const ctx = await requirePartner({ perm: "billing.manage" });
  await ensureBillingState(ctx.partner.id);
  const [[p], plans, usage, invoices] = await Promise.all([
    getDb().select().from(partners).where(eq(partners.id, ctx.partner.id)),
    getPlans(),
    getUsage(ctx.partner.id),
    getInvoices(ctx.partner.id),
  ]);
  const history = await getPlanHistory(p);
  const today = istDate();
  const current = plans.find((x) => x.id === p.plan) ?? null;
  const views = invoices.map((i) => toInvoiceView(i, plans, today));
  const trial = trialFor(p.approvedAt, p.createdAt, today);
  const open = views.filter((v) => v.display === "due" || v.display === "overdue" || v.display === "verifying");
  const pending = open.filter((v) => v.plan !== p.plan);
  const unpaidCurrent = open.find((v) => v.plan === p.plan || p.planStatus === "past_due");
  const used = TRIAL_DAYS - trial.daysLeft;

  return (
    <>
      <PortalHeader
        title="Subscription"
        description="Your MarchGear partner plan, what you're using and how plan changes are billed."
        actions={
          <Button href="/dealer/invoices" variant="outline" size="sm" icon={<FileText className="size-4" aria-hidden />}>
            Invoices & payments
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden border border-line bg-white">
          <div aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-red" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Current plan</p>
              <Badge tone={PLAN_STATUS_TONE[p.planStatus]}>{p.planStatus === "trial" ? (trial.ended ? "Trial ended" : "Free trial") : PLAN_STATUS_LABEL[p.planStatus]}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 className="font-display text-[40px] font-semibold leading-none tracking-[-0.03em]">{current?.name ?? p.plan}</h2>
                <p className="mt-2 max-w-md text-[14px] text-muted">{current?.summary}</p>
              </div>
              {current && (
                <p className="text-right">
                  <span className="font-display text-[28px] font-semibold tracking-[-0.02em] num">{rupees(current.monthly)}</span>
                  <span className="text-[13px] text-muted"> / month</span>
                  <span className="block text-[12px] text-muted">+ 18% GST ({rupees(Math.round(current.monthly * 1.18))} total)</span>
                </p>
              )}
            </div>

            <div className="mt-7 border-t border-line pt-6">
              {p.planStatus === "trial" ? (
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="flex items-center gap-2 text-[14px] font-medium">
                      <Clock3 className="size-4 text-red" aria-hidden />
                      {trial.daysLeft} day{trial.daysLeft === 1 ? "" : "s"} left in your {TRIAL_DAYS}-day free trial
                    </p>
                    <p className="text-[12.5px] text-muted">
                      Started {formatDate(trial.start)} · free until {formatDate(trial.lastDay)}
                    </p>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EFEFEF]">
                    <div className="h-full rounded-full bg-red transition-[width] duration-[1200ms]" style={{ width: `${Math.min(100, (used / TRIAL_DAYS) * 100)}%` }} />
                  </div>
                  <p className="mt-3 text-[13px] text-muted">
                    Your first invoice — {current ? `${rupees(current.monthly)} + GST for ${current.name}` : "for your plan"} — is issued on {formatDate(trial.firstBillable)} for the month from that day. Nothing is charged
                    automatically: you pay by bank transfer or UPI and MarchGear verifies it.
                  </p>
                </div>
              ) : p.planStatus === "active" && p.planRenewsAt ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[12px] text-muted">Paid until</p>
                    <p className="mt-1 text-[16px] font-semibold">{formatDate(addDays(p.planRenewsAt, -1))}</p>
                  </div>
                  <div>
                    <p className="text-[12px] text-muted">Next renewal</p>
                    <p className="mt-1 text-[16px] font-semibold">{formatDate(p.planRenewsAt)}</p>
                    <p className="text-[12px] text-muted">Renewal invoice is issued 7 days before.</p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 border-l-[3px] border-red bg-red-50 px-4 py-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-red" aria-hidden />
                  <div className="text-[13.5px]">
                    <p className="font-semibold">Payment due</p>
                    <p className="mt-0.5 text-muted">
                      {p.planStatus === "past_due" && p.planRenewsAt ? `Your paid period ended on ${formatDate(addDays(p.planRenewsAt, -1))}. ` : "Your free trial has ended. "}
                      {unpaidCurrent ? (
                        <>
                          Pay invoice{" "}
                          <Link href={`/dealer/invoices/${unpaidCurrent.id}`} className="font-medium text-ink underline underline-offset-4 num">
                            {unpaidCurrent.number}
                          </Link>{" "}
                          ({rupees(unpaidCurrent.total)}) and record the payment to keep your plan active.
                        </>
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
                {pending.map((v) => (
                  <Link key={v.id} href={`/dealer/invoices/${v.id}`} className="flex flex-wrap items-center justify-between gap-3 border border-line px-4 py-3 transition-colors hover:border-ink/30">
                    <span className="text-[13.5px]">
                      <span className="font-medium">Change to {v.planName}</span>
                      <span className="text-muted">
                        {" "}
                        · {v.periodStart > today ? `from ${formatDate(v.periodStart)}` : "on payment"} · invoice <span className="num">{v.number}</span>
                      </span>
                    </span>
                    <Badge tone={INVOICE_STATUS_TONE[v.display]}>{INVOICE_STATUS_LABEL[v.display]}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <Panel title="Usage against your plan">
          <div className="space-y-6">
            {(Object.keys(USAGE_LABEL) as (keyof Plan["limits"])[]).map((k) => (
              <Meter key={k} label={USAGE_LABEL[k]} used={usage[k]} limit={current?.limits[k] ?? null} />
            ))}
          </div>
          <p className="mt-6 text-[12px] text-muted">Live listings are published vehicles; active offers are approved offers running today; staff and showrooms count active ones.</p>
        </Panel>
      </div>

      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em]">Compare plans</h2>
            <p className="mt-1 text-[13.5px] text-muted">Prices per month, before 18% GST.</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === p.plan;
            const quote = quoteFor(p, invoices, plans, plan.id, today);
            return (
              <div key={plan.id} className={cn("relative flex flex-col border bg-white p-6 transition-colors duration-500", isCurrent ? "border-ink" : "border-line hover:border-ink/30")}>
                {isCurrent && <span className="absolute -top-px right-6 bg-ink px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white">Your plan</span>}
                <p className="text-[15px] font-semibold">{plan.name}</p>
                <p className="mt-1 min-h-10 text-[13px] text-muted">{plan.summary}</p>
                <p className="mt-5">
                  <span className="font-display text-[32px] font-semibold tracking-[-0.03em] num">{rupees(plan.monthly)}</span>
                  <span className="text-[13px] text-muted"> / month</span>
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-line py-4 text-[12.5px]">
                  <div>
                    <dt className="text-muted">Listings</dt>
                    <dd className="font-medium">{limitText(plan.limits.listings, "")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Active offers</dt>
                    <dd className="font-medium">{limitText(plan.limits.activeOffers, "")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Staff</dt>
                    <dd className="font-medium">{limitText(plan.limits.staff, "")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Showrooms</dt>
                    <dd className="font-medium">{limitText(plan.limits.showrooms, "")}</dd>
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
                  {isCurrent ? (
                    <p className="flex h-11 items-center justify-center border border-dashed border-line text-[13px] text-muted">Current plan</p>
                  ) : (
                    <PlanChangeButton plan={plan} current={current} quote={quote} usage={usage} />
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
            {PLAN_CHANGE_RULES.map((r, i) => (
              <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#F6F6F6] text-[11px] font-semibold num">{i + 1}</span>
                {r}
              </li>
            ))}
          </ol>
          <div className="mt-5 flex gap-3 border-t border-line pt-5 text-[13px] text-muted">
            <Landmark className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
            <p>
              No payment gateway is connected, so nothing is charged automatically. Invoices are paid by bank transfer, UPI or cheque; you record the UTR on the{" "}
              <Link href="/dealer/invoices" className="font-medium text-ink underline underline-offset-4">
                Invoices
              </Link>{" "}
              page and MarchGear&apos;s accounts team verifies it.
            </p>
          </div>
        </Panel>

        <Panel title="Plan history" padded={false}>
          <ol className="max-h-[420px] overflow-y-auto px-5 py-4">
            {history.map((h, i) => (
              <li key={h.id} className="relative flex gap-4 pb-5 last:pb-0">
                {i < history.length - 1 && <span aria-hidden className="absolute left-[11px] top-7 bottom-0 w-px bg-line" />}
                <span className={cn("relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border bg-white", i === 0 ? "border-red text-red" : "border-line text-muted")}>
                  {h.action.startsWith("payment") ? <CircleDollarSign className="size-3.5" aria-hidden /> : h.action === "invoice" ? <FileText className="size-3.5" aria-hidden /> : <ArrowRight className="size-3.5" aria-hidden />}
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] leading-snug">{h.summary}</p>
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
    </>
  );
}
