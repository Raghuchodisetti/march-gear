"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Loader2, Repeat, Undo2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { requestInsPlanChangeAction } from "@/server/actions/ins-billing";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { gstOn } from "@/components/portal/billing/shared";
import { INS_USAGE_LABEL, rupees, type InsChangeQuote, type InsPlan, type InsUsage } from "./shared";

const OFFLINE = { ok: false as const, error: "Couldn't reach the server. Please try again." };

/** "Upgrade to …" / "Move to …" on a plan card, with a confirmation that spells out exactly what will be invoiced. */
export function InsPlanChangeButton({ plan, current, quote, usage }: { plan: InsPlan; current: InsPlan | null; quote: InsChangeQuote; usage: InsUsage }) {
  const router = useRouter();
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const up = !current || plan.monthly > current.monthly;
  const keep = quote.kind === "keep_plan";
  const verb = keep ? "Keep" : quote.kind === "trial_switch" ? "Switch to" : up ? "Upgrade to" : "Move to";
  const over = (Object.keys(plan.limits) as (keyof InsUsage)[]).filter((k) => plan.limits[k] !== null && usage[k] > (plan.limits[k] as number));

  const confirm = async () => {
    setBusy(true);
    const res = await requestInsPlanChangeAction({ plan: plan.id }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) return toast(res.error ?? "Couldn't change the plan", { tone: "error" });
    setOpen(false);
    toast(res.message, { tone: "success", ...(res.invoices[0] ? { action: { label: "View invoice", href: `/insurance-vendor/invoices/${res.invoices[0].id}` } } : {}) });
    router.refresh();
  };

  if (quote.blocked && !quote.kind)
    return (
      <p className="flex min-h-11 items-center text-[12.5px] leading-snug text-muted" title={quote.blocked}>
        {quote.blocked}
      </p>
    );

  const Icon = keep ? Undo2 : quote.kind === "trial_switch" ? Repeat : up ? ArrowUpRight : ArrowDownRight;
  const cta =
    quote.kind === "trial_switch"
      ? `Switch to ${plan.name}`
      : keep
        ? `Keep ${plan.name}`
        : quote.invoices.length > 1
          ? "Request change & issue invoices"
          : quote.invoices.length === 1
            ? "Request change & issue invoice"
            : `Move to ${plan.name}`;

  return (
    <>
      <Button variant={up || keep ? "dark" : "outline"} className="w-full" onClick={() => setOpen(true)} icon={<Icon className="size-4" aria-hidden />}>
        {verb} {plan.name}
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={`${verb} ${plan.name}`} description={plan.monthly ? `${rupees(plan.monthly)} per month + 18% GST` : "Free plan — no invoices"} size="md">
        <div className="space-y-5 px-6 py-6 sm:px-8">
          <p className="text-[14px] leading-relaxed">{quote.summary}</p>
          {quote.invoices.length > 0 && (
            <div className="border border-line">
              {quote.invoices.map((inv, i) => (
                <div key={i} className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium">{inv.prorated ? "Prorated upgrade" : "Monthly subscription"}</p>
                    <p className="text-[12px] text-muted">
                      {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)} · due {formatDate(inv.dueOn)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[14px] font-semibold num">{rupees(inv.amount + gstOn(inv.amount))}</p>
                    <p className="text-[11.5px] text-muted num">
                      {rupees(inv.amount)} + {rupees(gstOn(inv.amount))} GST
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {over.length > 0 && !keep && (
            <div className="flex gap-3 border-l-[3px] border-[#9a5b00] bg-[#fdf3e1] px-4 py-3 text-[13px] text-[#6b4000]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                You&apos;re currently above {plan.name}&apos;s limits for{" "}
                {over.map((k) => `${INS_USAGE_LABEL[k].toLowerCase()} (${usage[k]} of ${plan.limits[k]})`).join(", ")}. Nothing is removed automatically, but you won&apos;t be able to publish or submit more
                until you&apos;re within them.
              </p>
            </div>
          )}
          {quote.invoices.length > 0 && (
            <p className="text-[12.5px] text-muted">
              No online payment gateway is set up: you&apos;ll pay the invoice by bank transfer, UPI or cheque and record the reference on the Invoices page. MarchGear verifies it and the change completes.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={busy} data-autofocus icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              {cta}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
