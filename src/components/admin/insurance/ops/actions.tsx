"use client";

import { Ban, CheckCircle2, MessageSquareWarning, Pause, Play, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import type { InsCampaignStatus } from "@/db/enums";
import { cn } from "@/lib/utils";
import { campaignDecisionAction, unverifyConversionAction, verifyConversionAction, withdrawQuoteAction, type CampaignDecision } from "@/server/actions/admin-insurance-ops";
import { actionBtn, btnTone, useDecisionDialog } from "@/components/admin/partner-actions";
import { rupees } from "@/components/portal/billing/shared";
import { Notice } from "./kit";

/* Client pieces for enquiry conversions, quote withdrawals and campaign decisions. */

const icon = "size-4";

export function ConversionActions({
  enquiryId,
  reference,
  verified,
  canVerify,
  blockedReason,
  policyNumber,
  leadFee,
}: {
  enquiryId: number;
  reference: string;
  verified: boolean;
  canVerify: boolean;
  blockedReason?: string;
  policyNumber: string | null;
  leadFee: { enabled: boolean; amount: number; existing: string | null };
}) {
  const dialog = useDecisionDialog();
  const verify = () =>
    dialog.open({
      title: `Verify the policy on ${reference}?`,
      description: "Only verify after checking the vendor's evidence (policy schedule or insurer confirmation).",
      notice: (
        <div className="space-y-3">
          <Notice tone="info" title={`Policy number ${policyNumber ?? "—"}`}>
            The vendor reported this policy. Verifying marks the conversion as confirmed by MarchGear in every dashboard and tells the vendor.
          </Notice>
          {leadFee.enabled && leadFee.amount > 0 ? (
            leadFee.existing ? (
              <Notice tone="warn">A lead-fee invoice ({leadFee.existing}) already exists for this enquiry, so no new one is raised.</Notice>
            ) : (
              <Notice tone="warn" title="A lead-fee invoice will be raised">
                {rupees(leadFee.amount)} + 18% GST, billed to the vendor as soon as you verify.
              </Notice>
            )
          ) : (
            <p className="text-[12.5px] text-muted">Lead fees are switched off in insurance settings — no invoice is raised.</p>
          )}
        </div>
      ),
      fields: [{ name: "remarks", kind: "textarea", label: "Remarks for the vendor", optional: true, rows: 3, placeholder: "e.g. Checked against the insurer's policy schedule dated 12 Nov." }],
      submitLabel: "Verify conversion",
      icon: <ShieldCheck className={icon} aria-hidden />,
      run: (v) => verifyConversionAction(enquiryId, { remarks: v.remarks }),
      done: (res) => {
        const inv = res.invoice as { number: string } | null;
        return inv ? `Conversion verified — lead-fee invoice ${inv.number} raised` : "Conversion verified — the vendor has been told";
      },
      toastAction: (res) => {
        const inv = res.invoice as { id: number } | null;
        return inv ? { label: "Open invoice", href: `/admin/insurance/invoices/${inv.id}` } : undefined;
      },
    });
  const unverify = () =>
    dialog.open({
      title: "Withdraw this verification?",
      description: "The conversion goes back to “reported by the vendor”. Use this if the policy was cancelled or the evidence was wrong.",
      fields: [{ name: "reason", kind: "textarea", label: "Reason (shown to the vendor)", rows: 3, placeholder: "e.g. The insurer confirmed the policy was cancelled within the free-look period." }],
      submitLabel: "Withdraw verification",
      tone: "dark",
      icon: <RotateCcw className={icon} aria-hidden />,
      run: (v) => unverifyConversionAction(enquiryId, { reason: v.reason }),
      done: (res) => {
        const fee = res.openLeadFee as { number: string } | null;
        return fee ? `Verification withdrawn. Lead-fee invoice ${fee.number} is still open — void it if it shouldn't be charged.` : "Verification withdrawn — the vendor has been told";
      },
      toastAction: (res) => {
        const fee = res.openLeadFee as { id: number } | null;
        return fee ? { label: "Open invoice", href: `/admin/insurance/invoices/${fee.id}` } : undefined;
      },
    });

  return (
    <div className="flex flex-wrap gap-2">
      {verified ? (
        <button type="button" onClick={unverify} className={cn(actionBtn, btnTone.outline)}>
          <RotateCcw className={icon} aria-hidden /> Withdraw verification
        </button>
      ) : (
        <button type="button" onClick={verify} disabled={!canVerify} title={blockedReason} className={cn(actionBtn, btnTone.primary)}>
          <ShieldCheck className={icon} aria-hidden /> Verify conversion
        </button>
      )}
      {!verified && !canVerify && blockedReason && <p className="basis-full text-[12.5px] text-muted">{blockedReason}</p>}
      {dialog.element}
    </div>
  );
}

export function WithdrawQuoteButton({ quoteId, reference, disabled }: { quoteId: number; reference: string; disabled?: string }) {
  const dialog = useDecisionDialog();
  const open = () =>
    dialog.open({
      title: `Withdraw quote ${reference}?`,
      description: "For quotes that break MarchGear's rules (e.g. a misleading premium or a missing insurer reference). The customer's link stops offering it.",
      notice: <Notice tone="warn">The vendor sees your remarks and is notified. This can&apos;t be undone — the vendor can send a corrected quote.</Notice>,
      fields: [{ name: "remarks", kind: "textarea", label: "Remarks for the vendor", rows: 4, placeholder: "e.g. Marked insurer-authorised without the insurer's quotation reference. Send a corrected quote." }],
      submitLabel: "Withdraw quote",
      tone: "dark",
      icon: <Ban className={icon} aria-hidden />,
      run: (v) => withdrawQuoteAction(quoteId, { remarks: v.remarks }),
      done: `Quote ${reference} withdrawn — the vendor has been told why`,
    });
  return (
    <>
      <button type="button" onClick={open} disabled={Boolean(disabled)} title={disabled} className={cn(actionBtn, btnTone.danger)}>
        <Ban className={icon} aria-hidden /> Compliance withdraw
      </button>
      {dialog.element}
    </>
  );
}

const DECISION_UI: Record<CampaignDecision, { label: string; tone: keyof typeof btnTone; icon: React.ReactNode; title: string; description: string; field?: { label: string; placeholder: string; optional?: boolean }; submit: string; done: string }> = {
  approve: {
    label: "Approve",
    tone: "primary",
    icon: <CheckCircle2 className={icon} aria-hidden />,
    title: "Approve this campaign?",
    description: "It shows on the insurance pages from its start date until its end date.",
    field: { label: "Remarks for the vendor", placeholder: "Optional — e.g. Approved. Banner text checked.", optional: true },
    submit: "Approve campaign",
    done: "Campaign approved — the vendor has been told",
  },
  changes: {
    label: "Request changes",
    tone: "outline",
    icon: <MessageSquareWarning className={icon} aria-hidden />,
    title: "Request changes?",
    description: "The vendor can edit the campaign and submit it again.",
    field: { label: "What needs to change", placeholder: "e.g. Remove “lowest premium guaranteed” — premiums shown on MarchGear are indicative." },
    submit: "Request changes",
    done: "Changes requested — the vendor has been told",
  },
  reject: {
    label: "Reject",
    tone: "danger",
    icon: <XCircle className={icon} aria-hidden />,
    title: "Reject this campaign?",
    description: "The campaign won't be shown. The vendor sees your reason.",
    field: { label: "Reason (shown to the vendor)", placeholder: "e.g. The campaign promotes products that aren't published on MarchGear." },
    submit: "Reject campaign",
    done: "Campaign rejected",
  },
  pause: {
    label: "Pause",
    tone: "outline",
    icon: <Pause className={icon} aria-hidden />,
    title: "Pause this campaign?",
    description: "It disappears from the insurance pages until you resume it. Its dates don't change.",
    field: { label: "Remarks for the vendor", placeholder: "Optional — why it's paused", optional: true },
    submit: "Pause campaign",
    done: "Campaign paused",
  },
  resume: {
    label: "Resume",
    tone: "primary",
    icon: <Play className={icon} aria-hidden />,
    title: "Resume this campaign?",
    description: "It shows again on the insurance pages while today is within its dates.",
    field: { label: "Remarks for the vendor", placeholder: "Optional", optional: true },
    submit: "Resume campaign",
    done: "Campaign resumed",
  },
  cancel: {
    label: "Cancel campaign",
    tone: "danger",
    icon: <Ban className={icon} aria-hidden />,
    title: "Cancel this campaign?",
    description: "It stops for good. The vendor would need to create a new campaign.",
    field: { label: "Reason (shown to the vendor)", placeholder: "e.g. Withdrawn at the vendor's request on 18 Nov." },
    submit: "Cancel campaign",
    done: "Campaign cancelled",
  },
};

/** Which decisions a stored status allows (mirrors the server's rules). */
const ALLOWED: Record<InsCampaignStatus, CampaignDecision[]> = {
  draft: [],
  pending_approval: ["approve", "changes", "reject", "cancel"],
  changes_requested: ["reject", "cancel"],
  approved: ["pause", "cancel"],
  paused: ["resume", "cancel"],
  rejected: [],
  cancelled: [],
};

export function CampaignActions({ campaignId, status, ended, vendorApproved, warnings = [] }: { campaignId: number; status: InsCampaignStatus; ended: boolean; vendorApproved: boolean; warnings?: string[] }) {
  const dialog = useDecisionDialog();
  const allowed = ALLOWED[status];
  if (!allowed.length) return <p className="text-[13px] text-muted">No decisions are open for a campaign in this state.</p>;
  const blocked = (d: CampaignDecision) =>
    (d === "approve" || d === "resume") && ended ? "The end date has passed" : d === "approve" && !vendorApproved ? "The vendor's account isn't approved" : undefined;
  const open = (d: CampaignDecision) => {
    const ui = DECISION_UI[d];
    dialog.open({
      title: ui.title,
      description: ui.description,
      notice:
        d === "approve" && warnings.length ? (
          <Notice tone="warn" title="Check before approving">
            <ul className="list-disc space-y-0.5 pl-4">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Notice>
        ) : undefined,
      fields: ui.field ? [{ name: "remarks", kind: "textarea", label: ui.field.label, placeholder: ui.field.placeholder, optional: ui.field.optional, rows: 3 }] : [],
      submitLabel: ui.submit,
      tone: ui.tone === "danger" || ui.tone === "outline" ? "dark" : "primary",
      icon: ui.icon,
      run: (v) => campaignDecisionAction(campaignId, { decision: d, remarks: v.remarks }),
      done: ui.done,
    });
  };
  return (
    <div className="flex flex-wrap gap-2">
      {allowed.map((d) => {
        const ui = DECISION_UI[d];
        const why = blocked(d);
        return (
          <button key={d} type="button" onClick={() => open(d)} disabled={Boolean(why)} title={why} className={cn(actionBtn, btnTone[ui.tone])}>
            {ui.icon} {ui.label}
          </button>
        );
      })}
      {dialog.element}
    </div>
  );
}
