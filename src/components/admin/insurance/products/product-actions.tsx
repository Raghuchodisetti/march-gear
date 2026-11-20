"use client";

import type { ReactNode } from "react";
import { Ban, Check, ClipboardList, Eye, EyeOff, PauseCircle, PlayCircle, Rocket } from "lucide-react";
import type { InsProductStatus } from "@/db/enums";
import { INS_COVER_STATUS_LABEL } from "@/insurance/labels";
import type { InsCoverStatus } from "@/db/enums";
import { productDecisionAction } from "@/server/actions/admin-insurance-products";
import { cn } from "@/lib/utils";
import { DialogNotice, actionBtn, btnTone, useInsDialog, type DialogField } from "../vendors/decision-dialog";

/* Decisions on one insurance product: approve (with its pending covers), publish, unpublish, request changes, reject, suspend, reinstate. */

const CHANGE_SUGGESTIONS = [
  "Upload the policy wording document",
  "The own-damage rate is outside the allowed range",
  "Add the insurer's product UIN",
  "List the main exclusions in plain language",
  "Upload the insurer's authorisation / tie-up letter",
  "The eligibility doesn't match the add-ons offered",
];

type Op = "approve" | "approve_publish" | "publish" | "unpublish" | "request_changes" | "reject" | "suspend" | "reinstate";

export function ProductDecisionPanel({
  productId,
  name,
  status,
  vendorApproved,
  vendorStatusLabel,
  companyActive,
  companyName,
  pendingCovers,
  blockedCovers,
  missingCovers,
  plan,
}: {
  productId: number;
  name: string;
  status: InsProductStatus;
  vendorApproved: boolean;
  vendorStatusLabel: string;
  companyActive: boolean;
  companyName: string;
  pendingCovers: { id: number; name: string }[];
  blockedCovers: { id: number; name: string; status: InsCoverStatus }[];
  missingCovers: number;
  plan: { name: string; limit: number | null; published: number };
}) {
  const dialog = useInsDialog();
  const coverBlock = blockedCovers.length > 0 || missingCovers > 0;
  const atLimit = plan.limit !== null && plan.published >= plan.limit && status !== "published";
  const publishBlock = !vendorApproved ? `The vendor is ${vendorStatusLabel.toLowerCase()} — approve the product without publishing for now.` : !companyActive ? `${companyName} is inactive, so its products can't go live.` : atLimit ? `The ${plan.name} plan allows ${plan.limit} published product${plan.limit === 1 ? "" : "s"} and ${plan.published} ${plan.published === 1 ? "is" : "are"} live.` : null;

  const coverNotice =
    pendingCovers.length > 0 ? (
      <DialogNotice tone="amber">
        <p className="font-semibold">
          {pendingCovers.length} cover{pendingCovers.length === 1 ? "" : "s"} this product uses {pendingCovers.length === 1 ? "is" : "are"} still pending approval
        </p>
        <p className="mt-1">{pendingCovers.map((c) => c.name).join(", ")}</p>
        <p className="mt-1.5">A product can&apos;t be approved while a cover it uses isn&apos;t approved.</p>
      </DialogNotice>
    ) : (
      <DialogNotice tone="green">
        <span className="flex items-center gap-2">
          <Check aria-hidden className="size-4" /> Every cover this product uses is approved.
        </span>
      </DialogNotice>
    );
  const coverToggle: DialogField[] = pendingCovers.length ? [{ name: "approveCovers", kind: "toggle", label: "Approve its pending covers too", hint: "Each cover is approved and recorded in its own history. Only approved covers appear publicly." }] : [];
  const remarks = (label: string, optional = true): DialogField => ({ name: "remarks", kind: "textarea", label, optional, rows: 3 });

  const open = (op: Op) => {
    const specs: Record<Op, Parameters<typeof dialog.open>[0]> = {
      approve: {
        title: `Approve “${name}”`,
        description: "Approves the product without publishing it. The vendor (or you) can publish it later.",
        notice: coverNotice,
        fields: [...coverToggle, remarks("Message to the vendor")],
        initial: { approveCovers: pendingCovers.length > 0 },
        submitLabel: "Approve",
        tone: "dark",
        icon: <Check aria-hidden className="size-4" />,
        run: (v) => productDecisionAction(productId, { op, approveCovers: Boolean(v.approveCovers), remarks: v.remarks }),
        done: (res) => `Product approved${res.coversApproved ? ` with ${res.coversApproved} cover${res.coversApproved === 1 ? "" : "s"}` : ""}`,
      },
      approve_publish: {
        title: `Approve & publish “${name}”`,
        description: "The product goes live on the insurance pages straight away.",
        notice: coverNotice,
        fields: [...coverToggle, remarks("Message to the vendor")],
        initial: { approveCovers: pendingCovers.length > 0 },
        submitLabel: "Approve & publish",
        icon: <Rocket aria-hidden className="size-4" />,
        run: (v) => productDecisionAction(productId, { op, approveCovers: Boolean(v.approveCovers), remarks: v.remarks }),
        done: (res) => `Product approved and live${res.coversApproved ? ` · ${res.coversApproved} cover${res.coversApproved === 1 ? "" : "s"} approved` : ""}`,
      },
      publish: {
        title: `Publish “${name}”`,
        description: "Puts the product live on the insurance pages.",
        fields: [remarks("Message to the vendor")],
        submitLabel: "Publish",
        icon: <Eye aria-hidden className="size-4" />,
        run: (v) => productDecisionAction(productId, { op, remarks: v.remarks }),
        done: "Product published",
      },
      unpublish: {
        title: `Unpublish “${name}”`,
        description: "Takes the product off the website. It stays approved, so it can be published again.",
        fields: [remarks("Message to the vendor")],
        submitLabel: "Unpublish",
        tone: "dark",
        icon: <EyeOff aria-hidden className="size-4" />,
        run: (v) => productDecisionAction(productId, { op, remarks: v.remarks }),
        done: "Product unpublished",
      },
      request_changes: {
        title: `Request changes to “${name}”`,
        description: status === "published" ? "The product goes offline until the vendor fixes it and it's approved again." : "The vendor sees each item, edits the product and resubmits it.",
        fields: [
          { name: "corrections", kind: "list", label: "Required changes", suggestions: CHANGE_SUGGESTIONS, placeholder: "Describe what to change…", hint: "Press Enter to add each item." },
          remarks("Note to the vendor"),
        ],
        submitLabel: "Send to vendor",
        tone: "dark",
        icon: <ClipboardList aria-hidden className="size-4" />,
        run: (v) => productDecisionAction(productId, { op, corrections: v.corrections, remarks: v.remarks }),
        done: "Changes requested",
      },
      reject: {
        title: `Reject “${name}”`,
        description: "The product is closed and taken off the website if it was live.",
        fields: [remarks("Reason (shown to the vendor)", false)],
        submitLabel: "Reject product",
        tone: "danger",
        icon: <Ban aria-hidden className="size-4" />,
        run: (v) => productDecisionAction(productId, { op, remarks: v.remarks }),
        done: "Product rejected",
      },
      suspend: {
        title: `Suspend “${name}”`,
        description: "Hides the product from the website and locks it for editing until you reinstate it.",
        fields: [remarks("Reason (shown to the vendor)", false)],
        submitLabel: "Suspend product",
        tone: "danger",
        icon: <PauseCircle aria-hidden className="size-4" />,
        run: (v) => productDecisionAction(productId, { op, remarks: v.remarks }),
        done: "Product suspended",
      },
      reinstate: {
        title: `Reinstate “${name}”`,
        description: "It comes back as Approved — not live. Publish it when it's ready to go back on the website.",
        notice: coverNotice,
        fields: [...coverToggle, remarks("Message to the vendor")],
        initial: { approveCovers: pendingCovers.length > 0 },
        submitLabel: "Reinstate",
        icon: <PlayCircle aria-hidden className="size-4" />,
        run: (v) => productDecisionAction(productId, { op, approveCovers: Boolean(v.approveCovers), remarks: v.remarks }),
        done: "Product reinstated",
      },
    };
    dialog.open(specs[op]);
  };

  const btn = (op: Op, text: string, icon: ReactNode, tone: keyof typeof btnTone, disabled?: string | false | null) => (
    <button key={op} type="button" onClick={() => open(op)} disabled={Boolean(disabled)} title={disabled || undefined} className={cn(actionBtn, btnTone[tone])}>
      {icon} {text}
    </button>
  );
  const coverReason = coverBlock ? "A cover this product uses isn't approved" : null;
  const items: ReactNode[] = [];
  if (status === "submitted" || status === "pending_approval" || status === "changes_requested" || status === "rejected") {
    items.push(btn("approve_publish", "Approve & publish", <Rocket aria-hidden className="size-4" />, "primary", coverReason ?? publishBlock));
    items.push(btn("approve", "Approve", <Check aria-hidden className="size-4" />, "dark", coverReason));
    if (status !== "changes_requested" && status !== "rejected") items.push(btn("request_changes", "Request changes", <ClipboardList aria-hidden className="size-4" />, "outline"));
    if (status !== "rejected") items.push(btn("reject", "Reject", <Ban aria-hidden className="size-4" />, "danger"));
    if (status !== "rejected") items.push(btn("suspend", "Suspend", <PauseCircle aria-hidden className="size-4" />, "danger"));
  } else if (status === "approved") {
    items.push(btn("publish", "Publish", <Eye aria-hidden className="size-4" />, "primary", coverReason ?? publishBlock));
    items.push(btn("request_changes", "Request changes", <ClipboardList aria-hidden className="size-4" />, "outline"));
    items.push(btn("reject", "Reject", <Ban aria-hidden className="size-4" />, "danger"));
    items.push(btn("suspend", "Suspend", <PauseCircle aria-hidden className="size-4" />, "danger"));
  } else if (status === "published") {
    items.push(btn("unpublish", "Unpublish", <EyeOff aria-hidden className="size-4" />, "dark"));
    items.push(btn("request_changes", "Request changes", <ClipboardList aria-hidden className="size-4" />, "outline"));
    items.push(btn("reject", "Reject", <Ban aria-hidden className="size-4" />, "danger"));
    items.push(btn("suspend", "Suspend", <PauseCircle aria-hidden className="size-4" />, "danger"));
  } else if (status === "suspended") {
    items.push(btn("reinstate", "Reinstate", <PlayCircle aria-hidden className="size-4" />, "primary", coverReason));
  }

  return (
    <div>
      {status === "draft" ? (
        <p className="text-[13px] text-muted">This product is still a draft — the vendor hasn&apos;t submitted it, so there&apos;s nothing to decide.</p>
      ) : (
        <div className="flex flex-col gap-2 [&>*]:w-full">{items}</div>
      )}
      {coverBlock && status === "published" && (
        <p className="mt-3 text-[12px] text-[#9a5b00]">
          {blockedCovers.length > 0 ? `${blockedCovers.map((c) => `${c.name} (${INS_COVER_STATUS_LABEL[c.status].toLowerCase()})`).join(", ")} isn't approved, so it's left off the public page and estimates.` : ""}
          {missingCovers > 0 ? ` ${missingCovers} cover${missingCovers === 1 ? "" : "s"} it uses no longer exist${missingCovers === 1 ? "s" : ""}.` : ""}
        </p>
      )}
      {coverBlock && status !== "draft" && status !== "published" && (
        <p className="mt-3 text-[12px] text-red">
          {missingCovers > 0 ? `${missingCovers} cover${missingCovers === 1 ? "" : "s"} it uses no longer exist${missingCovers === 1 ? "s" : ""}. ` : ""}
          {blockedCovers.length > 0 && `${blockedCovers.map((c) => `${c.name} (${INS_COVER_STATUS_LABEL[c.status].toLowerCase()})`).join(", ")} must be approved first — or request changes. `}
        </p>
      )}
      {!coverBlock && publishBlock && (status === "approved" || status === "pending_approval" || status === "submitted" || status === "changes_requested" || status === "rejected") && <p className="mt-3 text-[12px] text-muted">{publishBlock}</p>}
      {dialog.element}
    </div>
  );
}
