"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, Check, CheckCheck, ClipboardList, Info } from "lucide-react";
import type { InsCoverStatus, InsCoverType, InsProductStatus, InsVendorStatus } from "@/db/enums";
import { STANDARD_COVER_BY_KEY } from "@/insurance/covers";
import { INS_VENDOR_STATUS_LABEL } from "@/insurance/labels";
import type { CoverPricing } from "@/insurance/types";
import { bulkApproveCoversAction, coverDecisionAction } from "@/server/actions/admin-insurance-products";
import { Drawer } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import { CoverPill, Facts, ProductPill, SlaAge } from "../ui";
import { coverPricingLabel } from "./labels";
import { DialogNotice, actionBtn, btnTone, useInsDialog } from "../vendors/decision-dialog";

/* The coverage / add-on review board: a selectable table, bulk approve and a detail drawer with the decisions. */

export interface CoverBoardRow {
  id: number;
  vendorId: number;
  type: InsCoverType;
  key: string;
  name: string;
  description: string;
  eligibility: string | null;
  maxVehicleAgeYears: number | null;
  fuels: string[];
  exclusions: string[];
  limits: string | null;
  pricing: CoverPricing;
  status: InsCoverStatus;
  adminRemarks: string | null;
  submittedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  vendorName: string;
  vendorRef: string;
  vendorStatus: InsVendorStatus;
  products: { id: number; reference: string; name: string; status: InsProductStatus; included: boolean }[];
}

const dateTime = (d: Date | string) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const standardName = (key: string) => (key === "custom" ? "Custom cover" : (STANDARD_COVER_BY_KEY[key]?.name ?? key));

function CoverActions({ cover }: { cover: CoverBoardRow }) {
  const dialog = useInsDialog();
  const noun = cover.type === "addon" ? "add-on" : "coverage item";
  const live = cover.products.filter((p) => p.status === "published").length;
  const open = (op: "approve" | "request_changes" | "reject") => {
    const specs = {
      approve: {
        title: `Approve “${cover.name}”`,
        description: `Approved ${noun}s can appear on the vendor's published products and in indicative estimates.`,
        fields: [{ name: "remarks", kind: "textarea" as const, label: "Message to the vendor", optional: true, rows: 3 }],
        submitLabel: "Approve",
        tone: "primary" as const,
        icon: <Check aria-hidden className="size-4" />,
        done: `${cover.name} approved`,
      },
      request_changes: {
        title: `Request changes to “${cover.name}”`,
        description: "The vendor edits the cover and resubmits it.",
        fields: [{ name: "remarks", kind: "textarea" as const, label: "What should the vendor change?", rows: 3, placeholder: "e.g. State the claim limit per policy year." }],
        submitLabel: "Send to vendor",
        tone: "dark" as const,
        icon: <ClipboardList aria-hidden className="size-4" />,
        done: "Changes requested",
      },
      reject: {
        title: `Reject “${cover.name}”`,
        description: "The vendor sees your reason.",
        fields: [{ name: "remarks", kind: "textarea" as const, label: "Reason (shown to the vendor)", rows: 3 }],
        submitLabel: "Reject",
        tone: "danger" as const,
        icon: <Ban aria-hidden className="size-4" />,
        done: `${cover.name} rejected`,
      },
    }[op];
    dialog.open({
      ...specs,
      notice:
        op !== "approve" && live > 0 ? (
          <DialogNotice tone="amber">
            {live} published product{live === 1 ? " uses" : "s use"} this {noun}. They stay live, but this {noun} disappears from their public pages and estimates until it&apos;s approved again.
          </DialogNotice>
        ) : undefined,
      run: (v) => coverDecisionAction(cover.id, { op, remarks: v.remarks }),
      done: specs.done,
    });
  };
  const s = cover.status;
  return (
    <div className="flex flex-wrap gap-2">
      {(s === "pending_approval" || s === "changes_requested" || s === "rejected") && (
        <button type="button" onClick={() => open("approve")} className={cn(actionBtn, btnTone.primary)}>
          <Check aria-hidden className="size-4" /> Approve
        </button>
      )}
      {(s === "pending_approval" || s === "approved") && (
        <button type="button" onClick={() => open("request_changes")} className={cn(actionBtn, btnTone.outline)}>
          <ClipboardList aria-hidden className="size-4" /> Request changes
        </button>
      )}
      {(s === "pending_approval" || s === "changes_requested" || s === "approved") && (
        <button type="button" onClick={() => open("reject")} className={cn(actionBtn, btnTone.danger)}>
          <Ban aria-hidden className="size-4" /> Reject
        </button>
      )}
      {s === "draft" && <p className="text-[13px] text-muted">Still a draft — the vendor hasn&apos;t submitted it.</p>}
      {dialog.element}
    </div>
  );
}

function CoverDetail({ cover }: { cover: CoverBoardRow }) {
  const std = STANDARD_COVER_BY_KEY[cover.key];
  return (
    <div className="space-y-6 p-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <CoverPill status={cover.status} />
          <span className="text-[12.5px] text-muted">{standardName(cover.key)}</span>
        </div>
        <p className="mt-3 whitespace-pre-line break-words text-[14px] leading-relaxed">{cover.description}</p>
      </div>
      {cover.adminRemarks && (
        <p className="rounded-[3px] border border-[#e09200]/30 bg-[#fdf3e1]/60 px-3.5 py-2.5 text-[13px]">
          <span className="font-medium text-[#7a4800]">Last message to the vendor:</span> {cover.adminRemarks}
        </p>
      )}
      <Facts
        rows={[
          [
            "Vendor",
            <Link key="v" href={`/admin/insurance/vendors/${cover.vendorId}`} className="font-medium hover:text-red">
              {cover.vendorName}
              <span className="block text-[12px] font-normal text-muted">
                {cover.vendorRef} · {INS_VENDOR_STATUS_LABEL[cover.vendorStatus]}
              </span>
            </Link>,
          ],
          ["Eligibility", cover.eligibility],
          ["Max car age", cover.maxVehicleAgeYears !== null ? `${cover.maxVehicleAgeYears} years${std?.typicalMaxAge ? ` (typical: ${std.typicalMaxAge})` : ""}` : "No limit"],
          ["Fuels", cover.fuels.length ? cover.fuels.join(", ") : "All fuels"],
          ["Limits", cover.limits],
          ["Pricing", <span key="p">{coverPricingLabel(cover.pricing)}{std && std.defaultPricing.basis !== "included" && <span className="block text-[12px] text-muted">Typical: {coverPricingLabel(std.defaultPricing)}</span>}</span>],
          ["Submitted", cover.submittedAt ? dateTime(cover.submittedAt) : null],
          ["Updated", dateTime(cover.updatedAt)],
        ]}
      />
      <div>
        <p className="mb-2 text-[12.5px] font-medium text-muted">Exclusions</p>
        {cover.exclusions.length ? (
          <ul className="space-y-1.5">
            {cover.exclusions.map((x, i) => (
              <li key={`${x}-${i}`} className="flex gap-2.5 text-[13.5px]">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink/40" />
                <span className="min-w-0 break-words">{x}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-muted">None listed.</p>
        )}
      </div>
      <div>
        <p className="mb-2 text-[12.5px] font-medium text-muted">Products using it</p>
        {cover.products.length ? (
          <ul className="divide-y divide-line border border-line">
            {cover.products.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/insurance/products/${p.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-mist/50">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium">{p.name}</span>
                    <span className="block text-[12px] text-muted">
                      {p.reference} · {p.included ? "Included" : "Optional"}
                    </span>
                  </span>
                  <ProductPill status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-muted">Not used by any product yet.</p>
        )}
      </div>
    </div>
  );
}

export function CoverBoard({ rows, type, now, initialReview, extra }: { rows: CoverBoardRow[]; type: InsCoverType; now: number; initialReview: number | null; extra: CoverBoardRow | null }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [reviewId, setReviewId] = useState<number | null>(initialReview);
  const dialog = useInsDialog();
  const all = extra && !rows.some((r) => r.id === extra.id) ? [...rows, extra] : rows;
  const review = all.find((r) => r.id === reviewId) ?? null;
  const selectable = rows.filter((r) => r.status === "pending_approval");
  const chosen = selected.filter((id) => selectable.some((r) => r.id === id));
  const noun = type === "addon" ? "add-on" : "coverage item";

  const show = (id: number | null) => {
    setReviewId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("review", String(id));
    else url.searchParams.delete("review");
    window.history.replaceState(null, "", url);
  };
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const bulk = () =>
    dialog.open({
      title: `Approve ${chosen.length} ${noun}${chosen.length === 1 ? "" : "s"}`,
      description: "Only covers still pending approval are approved; anything decided in the meantime is skipped. Each vendor gets one notification.",
      fields: [{ name: "remarks", kind: "textarea", label: "Message to the vendors", optional: true, rows: 2 }],
      submitLabel: "Approve selected",
      icon: <CheckCheck aria-hidden className="size-4" />,
      run: (v) => bulkApproveCoversAction({ ids: chosen, remarks: v.remarks }),
      done: (res) => `${res.approved} approved${res.skipped ? ` · ${res.skipped} skipped` : ""}`,
    });

  return (
    <div>
      <div className="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">{selectable.length ? `${chosen.length} of ${selectable.length} pending selected` : "Nothing on this page is pending approval"}</p>
        {selectable.length > 0 && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setSelected(chosen.length === selectable.length ? [] : selectable.map((r) => r.id))} className={cn(actionBtn, btnTone.outline)}>
              {chosen.length === selectable.length ? "Clear selection" : "Select all pending"}
            </button>
            <button type="button" onClick={bulk} disabled={!chosen.length} className={cn(actionBtn, btnTone.primary)}>
              <CheckCheck aria-hidden className="size-4" /> Approve selected{chosen.length ? ` (${chosen.length})` : ""}
            </button>
          </div>
        )}
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((c) => (
          <li key={c.id} className="flex gap-3 border border-line bg-white p-4">
            {c.status === "pending_approval" && <input type="checkbox" checked={chosen.includes(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} className="mt-1 size-4 shrink-0 accent-[var(--color-red)]" />}
            <button type="button" onClick={() => show(c.id)} className="min-w-0 flex-1 text-left">
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{c.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {c.vendorName} · {standardName(c.key)}
                  </span>
                </span>
                <CoverPill status={c.status} />
              </span>
              <span className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                <span className="text-muted">{coverPricingLabel(c.pricing)}</span>
                {c.status === "pending_approval" && <SlaAge since={c.submittedAt ?? c.createdAt} now={now} prefix="Waiting" />}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="relative hidden overflow-x-auto border border-line bg-white md:block">
        <table className="w-full min-w-[960px] border-collapse text-left text-[13.5px]">
          <thead>
            <tr className="text-[12px] text-muted">
              <th className="w-10 border-b border-line bg-mist/60 px-4 py-3">
                <span className="sr-only">Select</span>
              </th>
              {[type === "addon" ? "Add-on" : "Coverage item", "Vendor", "Pricing", "Used by", "Status", "Waiting", ""].map((h, i) => (
                <th key={i} className="border-b border-line bg-mist/60 px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={cn("align-top transition-colors hover:bg-mist/40", reviewId === c.id && "bg-mist/60")}>
                <td className="border-b border-line px-4 py-3">
                  {c.status === "pending_approval" && <input type="checkbox" checked={chosen.includes(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} className="mt-0.5 size-4 accent-[var(--color-red)]" />}
                </td>
                <td className="min-w-[220px] border-b border-line px-4 py-3">
                  <button type="button" onClick={() => show(c.id)} className="text-left font-semibold hover:text-red">
                    {c.name}
                  </button>
                  <span className="mt-0.5 block text-[12px] text-muted">{standardName(c.key)}</span>
                </td>
                <td className="max-w-[200px] border-b border-line px-4 py-3">
                  <Link href={`/admin/insurance/vendors/${c.vendorId}`} className="block truncate hover:text-red">
                    {c.vendorName}
                  </Link>
                </td>
                <td className="border-b border-line px-4 py-3 text-[12.5px]">{coverPricingLabel(c.pricing)}</td>
                <td className="whitespace-nowrap border-b border-line px-4 py-3 text-[12.5px]">
                  {c.products.length ? `${c.products.length} product${c.products.length === 1 ? "" : "s"}` : <span className="text-muted">None</span>}
                  {c.products.some((p) => p.status === "published") && <span className="block text-muted">{c.products.filter((p) => p.status === "published").length} live</span>}
                </td>
                <td className="border-b border-line px-4 py-3">
                  <CoverPill status={c.status} />
                </td>
                <td className="whitespace-nowrap border-b border-line px-4 py-3">{c.status === "pending_approval" ? <SlaAge since={c.submittedAt ?? c.createdAt} now={now} className="text-[12.5px]" /> : <span className="text-[12.5px] text-muted">—</span>}</td>
                <td className="border-b border-line px-4 py-3">
                  <div className="flex justify-end">
                    <button type="button" onClick={() => show(c.id)} className={cn("inline-flex h-8 items-center rounded-[3px] px-2.5 text-[12.5px] font-medium", c.status === "pending_approval" ? "bg-red text-white hover:bg-red-600" : "border border-line hover:border-ink")}>
                      {c.status === "pending_approval" ? "Review" : "Open"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer
        open={Boolean(review)}
        onClose={() => {
          // Escape on a decision dialog stacked over the drawer closes only that dialog.
          if (document.querySelectorAll('[role="dialog"]').length > 1) return;
          show(null);
        }}
        title={review?.name ?? ""}
        className="max-w-[640px]"
        footer={review ? <CoverActions key={review.id} cover={review} /> : undefined}
      >
        {review && <CoverDetail cover={review} />}
        {review && (
          <p className="flex items-center gap-1.5 px-5 pb-5 text-[12px] text-muted">
            <Info aria-hidden className="size-3.5 shrink-0" /> Only approved {noun}s appear on public product pages and in estimates.
          </p>
        )}
      </Drawer>
      {dialog.element}
    </div>
  );
}
