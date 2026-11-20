"use client";

import type { ReactNode } from "react";
import { Ban, CalendarClock, Check, ClipboardList, FileText, MessageSquarePlus, PauseCircle, PlayCircle, X } from "lucide-react";
import type { AdCampaignStatus, AdCreativeStatus } from "@/db/enums";
import { adCampaignDecisionAction, adCampaignNoteAction, adCreativeDecisionAction } from "@/server/actions/ads-admin";
import { cn } from "@/lib/utils";
import { actionBtn, btnTone, useDecisionDialog, type DialogSpec } from "@/components/admin/partner-actions";
import { rupees } from "@/components/portal/billing/shared";
import { dayLabel, rangeLabel } from "@/components/ads/shared";

/* Staff decisions on an ad campaign and its creatives (one consistent dialog for every step). */

type Op = "approve" | "request_changes" | "reject" | "pause" | "resume" | "cancel" | "reschedule";

export function CampaignDecisions({
  c,
}: {
  c: {
    id: number;
    name: string;
    status: AdCampaignStatus;
    startsOn: string;
    endsOn: string;
    days: number;
    today: string;
    house: boolean;
    vendor: boolean;
    format: "banner" | "sponsored_listing";
    pendingCreatives: number;
    approvedCreatives: number;
    /** What approving would invoice (advertiser campaigns without an invoice yet). */
    invoice: { total: number; dueOn: string } | null;
    invoiced: boolean;
  };
}) {
  const dialog = useDecisionDialog();
  const ended = c.endsOn < c.today;
  const notice = (children: ReactNode, tone: "neutral" | "amber" = "neutral") => (
    <div className={cn("flex items-start gap-2.5 rounded-[3px] border px-4 py-3 text-[13px] leading-relaxed", tone === "amber" ? "border-[#f0d9ad] bg-[#fdf8ee] text-[#7a4a00]" : "border-line bg-mist/60")}>
      <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
      <span>{children}</span>
    </div>
  );
  const who = c.house ? "" : " (shown to the advertiser)";

  const open = (op: Op) => {
    const run = (v: Record<string, unknown>) => adCampaignDecisionAction(c.id, { op, ...v });
    const specs: Record<Op, DialogSpec> = {
      approve: {
        title: `Approve “${c.name}”`,
        description: c.startsOn > c.today ? `It will be scheduled and go live on ${dayLabel(c.startsOn)}.` : `It goes live straight away and runs until ${dayLabel(c.endsOn)}.`,
        notice: (
          <div className="space-y-2">
            {c.invoice
              ? notice(
                  <>
                    Approving raises an <strong>advertising invoice for {rupees(c.invoice.total)}</strong> (incl. GST), due {dayLabel(c.invoice.dueOn)}. The vendor pays it by bank transfer and records the reference.
                  </>,
                )
              : c.house
                ? notice("House campaign — MarchGear's own ad, so no invoice is raised.")
                : c.invoiced
                  ? notice("This booking already has an invoice — no new one is raised.")
                  : null}
            {c.format === "banner" &&
              c.approvedCreatives === 0 &&
              c.pendingCreatives === 0 &&
              notice("No creative is approved or waiting — the banner won't show until one is approved.", "amber")}
          </div>
        ),
        fields: [
          ...(c.format === "banner" && c.pendingCreatives > 0
            ? [{ name: "approveCreatives", kind: "toggle" as const, label: `Also approve the ${c.pendingCreatives} creative${c.pendingCreatives === 1 ? "" : "s"} awaiting review`, hint: "Otherwise review each creative below — the banner shows only approved creatives." }]
            : []),
          { name: "remarks", kind: "textarea", label: `Remarks${who}`, optional: true, rows: 3 },
        ],
        initial: c.pendingCreatives > 0 ? { approveCreatives: true } : undefined,
        submitLabel: "Approve campaign",
        icon: <Check aria-hidden className="size-4" />,
        run: (v) => run({ remarks: v.remarks, approveCreatives: Boolean(v.approveCreatives) }),
        done: (res) => `Approved — ${String(res.display ?? "").toLowerCase()}${res.invoice ? ` · invoice ${res.invoice}` : ""}`,
      },
      request_changes: {
        title: `Request changes to “${c.name}”`,
        description: "The advertiser sees your remarks, changes the dates or creatives and resubmits.",
        fields: [{ name: "remarks", kind: "textarea", label: "What should change?", rows: 4, placeholder: "e.g. The mobile banner's text is cut off — keep it inside the centre 80%." }],
        submitLabel: "Send to advertiser",
        tone: "dark",
        icon: <ClipboardList aria-hidden className="size-4" />,
        run: (v) => run({ remarks: v.remarks }),
        done: "Changes requested",
      },
      reject: {
        title: `Reject “${c.name}”`,
        description: "The booking is closed and its dates are released.",
        fields: [{ name: "remarks", kind: "textarea", label: `Reason${who}`, rows: 3 }],
        submitLabel: "Reject booking",
        tone: "danger",
        icon: <Ban aria-hidden className="size-4" />,
        run: (v) => run({ remarks: v.remarks }),
        done: "Booking rejected",
      },
      pause: {
        title: `Pause “${c.name}”`,
        description: "Stops serving the ad until it's resumed. The dates and invoice don't change.",
        fields: [{ name: "remarks", kind: "textarea", label: `Remarks${who}`, optional: true, rows: 3 }],
        submitLabel: "Pause campaign",
        tone: "dark",
        icon: <PauseCircle aria-hidden className="size-4" />,
        run: (v) => run({ remarks: v.remarks }),
        done: "Campaign paused",
      },
      resume: {
        title: `Resume “${c.name}”`,
        description: "Serves the ad again inside its dates.",
        fields: [{ name: "remarks", kind: "textarea", label: `Remarks${who}`, optional: true, rows: 3 }],
        submitLabel: "Resume campaign",
        icon: <PlayCircle aria-hidden className="size-4" />,
        run: (v) => run({ remarks: v.remarks }),
        done: (res) => `Resumed — ${String(res.display ?? "").toLowerCase()}`,
      },
      cancel: {
        title: `Cancel “${c.name}”`,
        description: c.invoiced ? "Ends the booking for good. An unpaid invoice is voided; a paid one stays — record any refund in Insurance › Refunds." : "Ends the booking for good and releases its dates.",
        fields: [{ name: "remarks", kind: "textarea", label: `Reason${who}`, rows: 3 }],
        submitLabel: "Cancel campaign",
        tone: "danger",
        icon: <X aria-hidden className="size-4" />,
        run: (v) => run({ remarks: v.remarks }),
        done: "Campaign cancelled",
      },
      reschedule: {
        title: `Reschedule “${c.name}”`,
        description: `Currently ${rangeLabel(c.startsOn, c.endsOn)} (${c.days} days).${c.invoiced ? " It's invoiced, so keep the same number of days." : c.house ? "" : " The price follows the booked daily rate."}`,
        fields: [
          { name: "startsOn", kind: "date", label: "First day", min: c.startsOn < c.today ? c.startsOn : c.today },
          { name: "endsOn", kind: "date", label: "Last day", min: c.today },
          { name: "remarks", kind: "textarea", label: `Remarks${who}`, optional: true, rows: 2 },
        ],
        initial: { startsOn: c.startsOn, endsOn: c.endsOn },
        submitLabel: "Save dates",
        tone: "dark",
        icon: <CalendarClock aria-hidden className="size-4" />,
        run: (v) => run({ startsOn: v.startsOn, endsOn: v.endsOn, remarks: v.remarks }),
        done: "Campaign rescheduled",
      },
    };
    dialog.open(specs[op]);
  };

  const b = (op: Op, text: string, Icon: typeof Check, tone: keyof typeof btnTone, disabled?: string) => (
    <button key={op} type="button" onClick={() => open(op)} disabled={Boolean(disabled)} title={disabled} className={cn(actionBtn, btnTone[tone])}>
      <Icon aria-hidden className="size-4" /> {text}
    </button>
  );
  const items: ReactNode[] = [];
  if (c.status === "pending_approval" || c.status === "changes_requested") {
    items.push(b("approve", "Approve", Check, "primary", ended ? "The dates have passed — reschedule first" : undefined));
    if (c.status === "pending_approval") items.push(b("request_changes", "Request changes", ClipboardList, "outline"));
    items.push(b("reschedule", "Reschedule", CalendarClock, "outline"));
    items.push(b("reject", "Reject", Ban, "danger"));
  } else if (c.status === "approved" && !ended) {
    items.push(b("pause", "Pause", PauseCircle, "dark"));
    items.push(b("reschedule", "Reschedule", CalendarClock, "outline"));
    items.push(b("cancel", "Cancel", X, "danger"));
  } else if (c.status === "paused" && !ended) {
    items.push(b("resume", "Resume", PlayCircle, "primary"));
    items.push(b("reschedule", "Reschedule", CalendarClock, "outline"));
    items.push(b("cancel", "Cancel", X, "danger"));
  }
  if (c.vendor)
    items.push(
      <button
        key="note"
        type="button"
        className={cn(actionBtn, btnTone.outline)}
        onClick={() =>
          dialog.open({
            title: "Internal note",
            description: "Only MarchGear staff see this. It's added to the booking's history.",
            fields: [{ name: "remarks", kind: "textarea", label: "Note", rows: 4 }],
            submitLabel: "Add note",
            tone: "dark",
            icon: <MessageSquarePlus aria-hidden className="size-4" />,
            run: (v) => adCampaignNoteAction(c.id, { remarks: v.remarks }),
            done: "Note added",
          })
        }
      >
        <MessageSquarePlus aria-hidden className="size-4" /> Note
      </button>,
    );
  return (
    <div>
      {items.length ? <div className="flex flex-wrap gap-2">{items}</div> : null}
      {dialog.element}
    </div>
  );
}

export function CreativeDecisions({ id, name, status }: { id: number; name: string; status: AdCreativeStatus }) {
  const dialog = useDecisionDialog();
  const open = (op: "approve" | "request_changes" | "reject") => {
    const specs: Record<typeof op, DialogSpec> = {
      approve: {
        title: `Approve creative “${name}”`,
        description: "Approved creatives are shown whenever the campaign is live.",
        fields: [{ name: "remarks", kind: "textarea", label: "Remarks", optional: true, rows: 2 }],
        submitLabel: "Approve creative",
        icon: <Check aria-hidden className="size-4" />,
        run: (v) => adCreativeDecisionAction(id, { op, remarks: v.remarks }),
        done: "Creative approved",
      },
      request_changes: {
        title: `Request changes to “${name}”`,
        fields: [{ name: "remarks", kind: "textarea", label: "What should change?", rows: 3, placeholder: "e.g. Use the recommended 1600×400 size — the logo is cropped." }],
        submitLabel: "Send to advertiser",
        tone: "dark",
        icon: <ClipboardList aria-hidden className="size-4" />,
        run: (v) => adCreativeDecisionAction(id, { op, remarks: v.remarks }),
        done: "Changes requested",
      },
      reject: {
        title: `Reject creative “${name}”`,
        fields: [{ name: "remarks", kind: "textarea", label: "Reason", rows: 3 }],
        submitLabel: "Reject creative",
        tone: "danger",
        icon: <Ban aria-hidden className="size-4" />,
        run: (v) => adCreativeDecisionAction(id, { op, remarks: v.remarks }),
        done: "Creative rejected",
      },
    };
    dialog.open(specs[op]);
  };
  const btn = (op: "approve" | "request_changes" | "reject", text: string, Icon: typeof Check, tone: keyof typeof btnTone) => (
    <button key={op} type="button" onClick={() => open(op)} className={cn(actionBtn, btnTone[tone], "h-8 px-2.5 text-[12.5px]")}>
      <Icon aria-hidden className="size-3.5" /> {text}
    </button>
  );
  const items: ReactNode[] = [];
  if (status !== "approved") items.push(btn("approve", "Approve", Check, "primary"));
  if (status === "pending" || status === "approved") items.push(btn("request_changes", "Request changes", ClipboardList, "outline"));
  if (status !== "rejected") items.push(btn("reject", "Reject", Ban, "danger"));
  return (
    <div className="flex flex-wrap gap-2">
      {items}
      {dialog.element}
    </div>
  );
}
