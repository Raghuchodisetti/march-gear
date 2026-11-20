"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Loader2, Repeat } from "lucide-react";
import { formatDate } from "@/lib/format";
import { requestPlanChangeAction } from "@/server/actions/partner-billing";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { USAGE_LABEL, gstOn, rupees, type ChangeQuote, type Plan } from "./shared";

const OFFLINE = { ok: false as const, error: "Couldn't reach the server. Please try again." };

export function PlanChangeButton({
  plan,
  current,
  quote,
  usage,
}: {
  plan: Plan;
  current: Plan | null;
  quote: ChangeQuote;
  usage: Record<keyof Plan["limits"], number>;
}) {
  const router = useRouter();
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const up = !current || plan.monthly > current.monthly;
  const verb = quote.kind === "trial_switch" ? "Switch to" : up ? "Upgrade to" : "Move to";
  const over = (Object.keys(plan.limits) as (keyof Plan["limits"])[]).filter((k) => plan.limits[k] !== null && usage[k] > (plan.limits[k] as number));

  const confirm = async () => {
    setBusy(true);
    const res = await requestPlanChangeAction({ plan: plan.id }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) return toast(res.error ?? "Couldn't change the plan", { tone: "error" });
    setOpen(false);
    toast(res.message, { tone: "success" });
    if (res.invoices.length) router.push("/dealer/invoices");
    router.refresh();
  };

  if (quote.blocked && !quote.kind)
    return (
      <p className="flex min-h-11 items-center text-[12.5px] leading-snug text-muted" title={quote.blocked}>
        {quote.blocked}
      </p>
    );

  const Icon = quote.kind === "trial_switch" ? Repeat : up ? ArrowUpRight : ArrowDownRight;
  return (
    <>
      <Button variant={up ? "dark" : "outline"} className="w-full" onClick={() => setOpen(true)} icon={<Icon className="size-4" aria-hidden />}>
        {verb} {plan.name}
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={`${verb} ${plan.name}`} description={`${rupees(plan.monthly)} per month + 18% GST`} size="md">
        <div className="space-y-5 px-6 py-6 sm:px-8">
          <p className="text-[14px] leading-relaxed">{quote.summary}</p>
          {quote.invoices.length > 0 && (
            <div className="border border-line">
              {quote.invoices.map((inv, i) => (
                <div key={i} className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium">{i === 0 && quote.kind === "prorated_upgrade" ? "Prorated upgrade" : "Monthly subscription"}</p>
                    <p className="text-[12px] text-muted">
                      {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)} · due {formatDate(inv.dueOn)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-semibold num">{rupees(inv.amount + gstOn(inv.amount))}</p>
                    <p className="text-[11.5px] text-muted num">
                      {rupees(inv.amount)} + {rupees(gstOn(inv.amount))} GST
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {over.length > 0 && (
            <div className="flex gap-3 border-l-[3px] border-[#9a5b00] bg-[#fdf3e1] px-4 py-3 text-[13px] text-[#6b4000]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                You&apos;re currently above {plan.name}&apos;s limits for{" "}
                {over.map((k) => `${USAGE_LABEL[k].toLowerCase()} (${usage[k]} of ${plan.limits[k]})`).join(", ")}. Bring these within the limits before the change takes effect.
              </p>
            </div>
          )}
          {quote.kind !== "trial_switch" && (
            <p className="text-[12.5px] text-muted">
              No online payment gateway is set up: you&apos;ll pay the invoice by bank transfer, UPI or cheque and record the reference on the Invoices page. MarchGear verifies it and the change completes.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={busy} data-autofocus icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              {quote.kind === "trial_switch" ? `Switch to ${plan.name}` : quote.invoices.length > 1 ? "Request change & issue invoices" : "Request change & issue invoice"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
