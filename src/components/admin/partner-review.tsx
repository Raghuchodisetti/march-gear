"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "@/components/admin/desk";
import { useDeskRouter as useRouter } from "@/components/admin/desk";
import { Ban, CalendarClock, CalendarPlus, Check, ClipboardList, Eye, EyeOff, ImageOff, PauseCircle, PlayCircle, Rocket, X } from "lucide-react";
import type { OfferStatus, PartnerStatus, PartnerVehicleStatus } from "@/db/enums";
import { OFFER_STATUS_LABEL, PARTNER_STATUS_LABEL, offerDisplayStatus } from "@/partner/labels";
import { offerDecisionAction, vehicleDecisionAction } from "@/server/actions/partner-admin";
import { Drawer } from "@/components/ui/overlay";
import { Segmented } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { actionBtn, btnTone, useDecisionDialog } from "./partner-actions";

/* Review drawers and decision bars for vehicle listings, offers and campaigns. */

/** A wide side drawer that is open while `?review=` is in the URL; closing it drops the param. */
export function ReviewDrawer({ title, closeHref, footer, children }: { title: string; closeHref: string; footer?: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const close = () => {
    // Escape on a decision dialog stacked over the drawer should close only that dialog.
    if (document.querySelectorAll('[role="dialog"]').length > 1) return;
    setOpen(false);
    router.replace(closeHref, { scroll: false });
  };
  return (
    <Drawer open={open} onClose={close} title={title} footer={footer} className="max-w-[920px]">
      {children}
    </Drawer>
  );
}

const unsplash = (src: string, w: number) => (src.includes("images.unsplash.com") ? `${src.split("?")[0]}?w=${w}&q=70&auto=format` : src);

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  if (!images.length)
    return (
      <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 bg-mist text-[13px] text-muted">
        <ImageOff aria-hidden className="size-6" /> No photos uploaded
      </div>
    );
  const current = images[Math.min(i, images.length - 1)];
  return (
    <div>
      <div className="relative aspect-[16/9] max-h-[440px] w-full overflow-hidden bg-mist">
        {/* Dealer-uploaded media — plain <img> on purpose. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={unsplash(current, 1200)} alt={`${alt} — photo ${i + 1} of ${images.length}`} className="size-full object-cover" />
        <span className="absolute bottom-3 right-3 rounded-full bg-ink/75 px-2.5 py-1 text-[11.5px] font-medium text-white num">
          {i + 1} / {images.length}
        </span>
      </div>
      {images.length > 1 && (
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, n) => (
            <button key={`${src}-${n}`} type="button" onClick={() => setI(n)} aria-label={`Show photo ${n + 1}`} aria-pressed={n === i} className={cn("h-14 w-20 shrink-0 overflow-hidden rounded-[2px] ring-2 ring-offset-1 transition", n === i ? "ring-red" : "ring-transparent opacity-70 hover:opacity-100")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img decoding="async" src={unsplash(src, 200)} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Vehicles ───────────────────────────────────────────────── */

/**
 * Staff decisions on a dealer listing. Used cars go through review (approve, publish, corrections, reject).
 * New cars don't — the dealer publishes them — so staff can only pause a live one (remarks required) or put it back.
 */
export function VehicleActions({ id, status, partnerApproved, label, kind = "used" }: { id: number; status: PartnerVehicleStatus; partnerApproved: boolean; label: string; kind?: "new" | "used" }) {
  const dialog = useDecisionDialog();
  const isNew = kind === "new";
  const open = (op: "approve" | "approve_publish" | "publish" | "unpublish" | "reject" | "request_changes") => {
    const specs = {
      approve_publish: { title: "Approve & publish", description: "The listing goes live on MarchGear straight away (used cars appear on /used-cars).", submitLabel: "Approve & publish", icon: <Rocket aria-hidden className="size-4" />, done: "Approved and published", optional: true },
      approve: { title: "Approve listing", description: "Approves the listing without publishing it. You or the dealer can publish it later.", submitLabel: "Approve", icon: <Check aria-hidden className="size-4" />, done: "Listing approved", optional: true },
      publish: isNew
        ? { title: "Publish again", description: "Puts the new-car listing back on the dealer's page and the model page.", submitLabel: "Publish", icon: <Eye aria-hidden className="size-4" />, done: "Listing published", optional: true }
        : { title: "Publish listing", description: "Puts the listing live on the website.", submitLabel: "Publish", icon: <Eye aria-hidden className="size-4" />, done: "Listing published", optional: true },
      unpublish: isNew
        ? {
            title: "Pause listing",
            description: "Takes the listing off the website straight away. The dealer is notified with your remarks and can fix it and publish again.",
            submitLabel: "Pause listing",
            icon: <EyeOff aria-hidden className="size-4" />,
            done: "Listing paused — the dealer has been notified",
            optional: false,
          }
        : { title: "Unpublish listing", description: "Takes the listing off the website. The dealer keeps it in their inventory.", submitLabel: "Unpublish", icon: <EyeOff aria-hidden className="size-4" />, done: "Listing unpublished", optional: true },
      request_changes: { title: "Request corrections", description: "The dealer sees your remarks, edits the listing and resubmits it.", submitLabel: "Send corrections", icon: <ClipboardList aria-hidden className="size-4" />, done: "Corrections requested", optional: false },
      reject: { title: "Reject listing", description: "The listing is closed and taken off the website if it was live.", submitLabel: "Reject listing", icon: <Ban aria-hidden className="size-4" />, done: "Listing rejected", optional: false },
    }[op];
    dialog.open({
      title: `${specs.title}: ${label}`,
      description: specs.description,
      fields: [
        {
          name: "remarks",
          kind: "textarea",
          label: specs.optional ? "Remarks to the dealer" : op === "reject" ? "Reason (shown to the dealer)" : op === "unpublish" ? "Why is it paused? (shown to the dealer)" : "What should the dealer change?",
          optional: specs.optional,
          rows: 3,
          placeholder: op === "request_changes" ? "e.g. Add photos of the odometer and the service book." : op === "unpublish" && isNew ? "e.g. The price looks wrong for this variant — please check it and publish again." : undefined,
        },
      ],
      submitLabel: specs.submitLabel,
      tone: op === "reject" ? "danger" : op === "approve_publish" || op === "publish" ? "primary" : "dark",
      icon: specs.icon,
      run: (v) => vehicleDecisionAction(id, { op, remarks: v.remarks }),
      done: specs.done,
    });
  };
  const btn = (op: Parameters<typeof open>[0], text: string, icon: ReactNode, tone: keyof typeof btnTone, disabled?: boolean) => (
    <button key={op} type="button" onClick={() => open(op)} disabled={disabled} className={cn(actionBtn, btnTone[tone])}>
      {icon} {text}
    </button>
  );
  const items: ReactNode[] = [];
  if (isNew) {
    if (status === "published") items.push(btn("unpublish", "Pause listing", <EyeOff aria-hidden className="size-4" />, "dark"));
    else if (status !== "draft" && status !== "archived") items.push(btn("publish", "Publish again", <Eye aria-hidden className="size-4" />, "primary", !partnerApproved));
    return (
      <div>
        {items.length ? <div className="flex flex-wrap gap-2">{items}</div> : <p className="text-[13px] text-muted">This listing is {status === "draft" ? "a draft the dealer hasn't published" : "archived"} — there&apos;s nothing to do.</p>}
        <p className="mt-2 text-[12px] text-muted">New-car listings go live when the dealer publishes them — no approval step. Pausing notifies the dealer with your remarks.</p>
        {dialog.element}
      </div>
    );
  }
  if (status === "pending_approval" || status === "changes_requested" || status === "rejected") {
    items.push(btn("approve_publish", "Approve & publish", <Rocket aria-hidden className="size-4" />, "primary", !partnerApproved));
    items.push(btn("approve", "Approve", <Check aria-hidden className="size-4" />, "dark"));
    if (status !== "changes_requested") items.push(btn("request_changes", "Request corrections", <ClipboardList aria-hidden className="size-4" />, "outline"));
    if (status !== "rejected") items.push(btn("reject", "Reject", <Ban aria-hidden className="size-4" />, "danger"));
  } else if (status === "approved" || status === "unpublished") {
    items.push(btn("publish", "Publish", <Eye aria-hidden className="size-4" />, "primary", !partnerApproved));
    items.push(btn("request_changes", "Request corrections", <ClipboardList aria-hidden className="size-4" />, "outline"));
    items.push(btn("reject", "Reject", <Ban aria-hidden className="size-4" />, "danger"));
  } else if (status === "published") {
    items.push(btn("unpublish", "Unpublish", <EyeOff aria-hidden className="size-4" />, "dark"));
    items.push(btn("request_changes", "Request corrections", <ClipboardList aria-hidden className="size-4" />, "outline"));
    items.push(btn("reject", "Reject", <Ban aria-hidden className="size-4" />, "danger"));
  }
  return (
    <div>
      {items.length ? <div className="flex flex-wrap gap-2">{items}</div> : <p className="text-[13px] text-muted">This listing is {status === "draft" ? "still a draft" : "archived"} — there&apos;s nothing to decide.</p>}
      {!partnerApproved && items.length > 0 && <p className="mt-2 text-[12px] text-muted">The dealership isn&apos;t approved, so this listing can be approved but not published yet.</p>}
      {dialog.element}
    </div>
  );
}

/* ── Offers & campaigns ─────────────────────────────────────── */

const IST_MS = 330 * 60_000;
/** ISO → "2026-12-01T09:00" in IST, for datetime-local inputs. */
export const toLocalInput = (iso: string | Date) => new Date(new Date(iso).getTime() + IST_MS).toISOString().slice(0, 16);
const fmt = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

type OfferOp = "approve" | "schedule" | "reject" | "request_changes" | "pause" | "resume" | "cancel" | "extend";

export function OfferActions({ id, status, startsAt, endsAt, title, compact, now }: { id: number; status: OfferStatus; startsAt: string; endsAt: string; title: string; compact?: boolean; /** When the page was rendered (ms). */ now: number }) {
  const dialog = useDecisionDialog();
  const display = offerDisplayStatus({ status, startsAt, endsAt }, new Date(now));
  const ended = new Date(endsAt).getTime() < now;
  const willBe = offerDisplayStatus({ status: "approved", startsAt, endsAt }, new Date(now));

  const open = (op: OfferOp) => {
    const nowInput = toLocalInput(new Date(now));
    const base = { fields: [{ name: "remarks", kind: "textarea" as const, label: "Remarks to the dealer", optional: true, rows: 3 }] };
    const specs: Record<OfferOp, Parameters<typeof dialog.open>[0]> = {
      approve: {
        ...base,
        title: `Approve “${title}”`,
        description: "Approved offers go live and expire on their own dates.",
        notice: (
          <div className="flex items-start gap-2.5 rounded-[3px] border border-line bg-mist/60 px-4 py-3 text-[13px]">
            <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
            <span>
              {willBe === "scheduled" ? (
                <>
                  It will show as <strong>Scheduled</strong> and go live on {fmt(new Date(startsAt))}, running until {fmt(new Date(endsAt))}.
                </>
              ) : (
                <>
                  It goes <strong>Active</strong> straight away and runs until {fmt(new Date(endsAt))}.
                </>
              )}
            </span>
          </div>
        ),
        submitLabel: "Approve offer",
        icon: <Check aria-hidden className="size-4" />,
        run: (v) => offerDecisionAction(id, { op, remarks: v.remarks }),
        done: (res) => `Offer approved — ${String(res.display ?? "").toLowerCase()}`,
      },
      schedule: {
        title: `Schedule “${title}”`,
        description: "Approve with your own start and end (IST). The change is recorded in the approval history.",
        fields: [
          { name: "startsAt", kind: "datetime", label: "Starts (IST)" },
          { name: "endsAt", kind: "datetime", label: "Ends (IST)", min: nowInput },
          { name: "remarks", kind: "textarea", label: "Remarks to the dealer", optional: true, rows: 2 },
        ],
        initial: { startsAt: toLocalInput(startsAt), endsAt: toLocalInput(endsAt) },
        submitLabel: "Approve & schedule",
        icon: <CalendarClock aria-hidden className="size-4" />,
        run: (v) => offerDecisionAction(id, { op, startsAt: v.startsAt, endsAt: v.endsAt, remarks: v.remarks }),
        done: (res) => `Offer scheduled — ${String(res.display ?? "").toLowerCase()}`,
      },
      extend: {
        title: `Extend “${title}”`,
        description: `Currently ends ${fmt(new Date(endsAt))}.`,
        fields: [
          { name: "endsAt", kind: "datetime", label: "New end (IST)", min: toLocalInput(endsAt) },
          { name: "remarks", kind: "textarea", label: "Remarks to the dealer", optional: true, rows: 2 },
        ],
        initial: { endsAt: toLocalInput(new Date(Math.max(now, new Date(endsAt).getTime()) + 7 * 86_400_000)) },
        submitLabel: "Extend campaign",
        tone: "dark",
        icon: <CalendarPlus aria-hidden className="size-4" />,
        run: (v) => offerDecisionAction(id, { op, endsAt: v.endsAt, remarks: v.remarks }),
        done: "Campaign extended",
      },
      request_changes: {
        title: `Request changes to “${title}”`,
        fields: [{ name: "remarks", kind: "textarea", label: "What should the dealer change?", rows: 3, placeholder: "e.g. The terms must state the exchange bonus applies to cars older than 3 years only." }],
        submitLabel: "Send to dealer",
        tone: "dark",
        icon: <ClipboardList aria-hidden className="size-4" />,
        run: (v) => offerDecisionAction(id, { op, remarks: v.remarks }),
        done: "Changes requested",
      },
      reject: {
        title: `Reject “${title}”`,
        fields: [{ name: "remarks", kind: "textarea", label: "Reason (shown to the dealer)", rows: 3 }],
        submitLabel: "Reject offer",
        tone: "danger",
        icon: <Ban aria-hidden className="size-4" />,
        run: (v) => offerDecisionAction(id, { op, remarks: v.remarks }),
        done: "Offer rejected",
      },
      pause: { ...base, title: `Pause “${title}”`, description: "Hides the offer from the website until it's resumed. Its dates don't change.", submitLabel: "Pause campaign", tone: "dark", icon: <PauseCircle aria-hidden className="size-4" />, run: (v) => offerDecisionAction(id, { op, remarks: v.remarks }), done: "Campaign paused" },
      resume: { ...base, title: `Resume “${title}”`, description: "Shows the offer again inside its date window.", submitLabel: "Resume campaign", icon: <PlayCircle aria-hidden className="size-4" />, run: (v) => offerDecisionAction(id, { op, remarks: v.remarks }), done: (res) => `Campaign resumed — ${String(res.display ?? "").toLowerCase()}` },
      cancel: {
        title: `Cancel “${title}”`,
        description: "Ends the campaign for good. The dealer can create a new offer later.",
        fields: [{ name: "remarks", kind: "textarea", label: "Reason (shown to the dealer)", rows: 3 }],
        submitLabel: "Cancel campaign",
        tone: "danger",
        icon: <X aria-hidden className="size-4" />,
        run: (v) => offerDecisionAction(id, { op, remarks: v.remarks }),
        done: "Campaign cancelled",
      },
    };
    dialog.open(specs[op]);
  };

  const size = compact ? "h-8 px-2.5 text-[12.5px]" : "";
  const icon = compact ? "size-3.5" : "size-4";
  const b = (op: OfferOp, text: string, Icon: typeof Check, tone: keyof typeof btnTone, disabled?: boolean) => (
    <button key={op} type="button" onClick={() => open(op)} disabled={disabled} className={cn(actionBtn, btnTone[tone], size)} title={disabled ? "This offer's dates have passed — schedule it with new dates" : undefined}>
      <Icon aria-hidden className={icon} /> {text}
    </button>
  );
  const items: ReactNode[] = [];
  if (status === "submitted" || status === "pending_approval" || status === "changes_requested" || status === "rejected") {
    items.push(b("approve", "Approve", Check, "primary", ended));
    items.push(b("schedule", "Schedule", CalendarClock, "dark"));
    if (status !== "changes_requested") items.push(b("request_changes", "Request changes", ClipboardList, "outline"));
    if (status !== "rejected") items.push(b("reject", "Reject", Ban, "danger"));
    if (status !== "rejected") items.push(b("cancel", "Cancel", X, "outline"));
  } else if (status === "approved") {
    if (!ended) items.push(b("pause", "Pause", PauseCircle, "dark"));
    items.push(b("extend", "Extend", CalendarPlus, "outline"));
    if (!compact) items.push(b("schedule", "Reschedule", CalendarClock, "outline"));
    if (!compact) items.push(b("request_changes", "Request changes", ClipboardList, "outline"));
    items.push(b("cancel", "Cancel", X, "danger"));
  } else if (status === "paused") {
    items.push(b("resume", "Resume", PlayCircle, "primary"));
    items.push(b("extend", "Extend", CalendarPlus, "outline"));
    if (!compact) items.push(b("schedule", "Reschedule", CalendarClock, "outline"));
    items.push(b("cancel", "Cancel", X, "danger"));
  }
  return (
    <div>
      {items.length ? (
        <div className="flex flex-wrap gap-2">{items}</div>
      ) : (
        <p className="text-[13px] text-muted">This offer is {OFFER_STATUS_LABEL[display].toLowerCase()} — there&apos;s nothing to decide.</p>
      )}
      {!compact && ended && (status === "submitted" || status === "pending_approval") && <p className="mt-2 text-[12px] text-muted">Its end date has passed — use Schedule to approve it with new dates.</p>}
      {dialog.element}
    </div>
  );
}

export function BannerPreview({ media, title }: { media: { desktopBanner: string; mobileBanner: string; thumbnail: string }; title: string }) {
  const [view, setView] = useState<"desktop" | "mobile" | "thumbnail">("desktop");
  const src = media[view === "desktop" ? "desktopBanner" : view === "mobile" ? "mobileBanner" : "thumbnail"];
  const frame = view === "desktop" ? "aspect-[3/1] w-full" : view === "mobile" ? "aspect-[4/5] w-full max-w-[260px]" : "aspect-square w-full max-w-[200px]";
  return (
    <div>
      <Segmented
        ariaLabel="Banner size"
        value={view}
        onChange={setView}
        options={[
          { value: "desktop", label: "Desktop" },
          { value: "mobile", label: "Mobile" },
          { value: "thumbnail", label: "Thumbnail" },
        ]}
        className="mb-3 w-full sm:w-auto"
      />
      <div className="flex justify-center bg-mist/70 p-3">
        <div className={cn("overflow-hidden bg-white shadow-soft", frame)}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" decoding="async" src={unsplash(src, view === "desktop" ? 1400 : 600)} alt={`${title} — ${view} banner`} className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1.5 text-center text-[12.5px] text-muted">
              <ImageOff aria-hidden className="size-5" /> No {view} banner uploaded
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Campaign board ─────────────────────────────────────────── */

export interface CampaignRow {
  id: number;
  reference: string;
  title: string;
  campaignName: string;
  categoryLabel: string;
  status: OfferStatus;
  startsAt: string;
  endsAt: string;
  partnerId: number;
  partnerName: string;
  partnerStatus: PartnerStatus;
  thumbnail: string | null;
  views: number;
  enquiries: number;
  conversions: number;
}

const DISPLAY_BAR: Record<string, string> = {
  active: "bg-[#22a04f]",
  scheduled: "bg-[#2f6fd6]",
  paused: "bg-[#e09200]",
  expired: "bg-ink/25",
};
const DISPLAY_PILL: Record<string, string> = {
  active: "bg-[#e8f5ec] text-[#1e7a3c]",
  scheduled: "bg-[#e9f0fb] text-[#2456a6]",
  paused: "bg-[#fdf3e1] text-[#9a5b00]",
  expired: "bg-mist text-ink/70",
};
const dayFmt = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");

export function CampaignBoard({ rows, emptyText, now }: { rows: CampaignRow[]; emptyText: string; now: number }) {
  const [view, setView] = useState<"table" | "timeline">("table");
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted num">
          {rows.length} campaign{rows.length === 1 ? "" : "s"}
        </p>
        <Segmented
          ariaLabel="Layout"
          value={view}
          onChange={setView}
          options={[
            { value: "table", label: "Table" },
            { value: "timeline", label: "Timeline" },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <div className="border border-line bg-white px-6 py-14 text-center text-[14px] text-muted">{emptyText}</div>
      ) : view === "table" ? (
        <CampaignTable rows={rows} now={now} />
      ) : (
        <Timeline rows={rows} now={now} />
      )}
    </div>
  );
}

function CampaignTable({ rows, now }: { rows: CampaignRow[]; now: number }) {
  return (
    <div className="overflow-x-auto border border-line bg-white">
      <table className="w-full min-w-[980px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="text-[12px] text-muted">
            {["Campaign", "Dealer", "Status", "Window (IST)", "Views", "Enquiries", "Conversions", ""].map((h, i) => (
              <th key={i} className={cn("border-b border-line bg-mist/60 px-4 py-3 font-semibold", i >= 4 && i <= 6 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = offerDisplayStatus(r, new Date(now));
            return (
              <tr key={r.id} className="align-top transition-colors hover:bg-mist/40">
                <td className="border-b border-line px-4 py-3">
                  <Link href={`/admin/offer-approvals?view=all&review=${r.id}`} className="font-medium hover:text-red">
                    {r.title}
                  </Link>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    {r.reference} · {r.categoryLabel}
                  </span>
                </td>
                <td className="border-b border-line px-4 py-3">
                  <Link href={`/admin/dealers/details?id=${r.partnerId}`} className="hover:text-red">
                    {r.partnerName}
                  </Link>
                </td>
                <td className="border-b border-line px-4 py-3">
                  <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold", DISPLAY_PILL[d] ?? "bg-mist")}>
                    <span aria-hidden className={cn("size-1.5 rounded-full", DISPLAY_BAR[d] ?? "bg-ink/30")} />
                    {OFFER_STATUS_LABEL[d]}
                  </span>
                  {r.partnerStatus !== "approved" && (d === "active" || d === "scheduled") && (
                    <span className="mt-1 block text-[11.5px] text-muted">Hidden — dealer {PARTNER_STATUS_LABEL[r.partnerStatus].toLowerCase()}</span>
                  )}
                </td>
                <td className="whitespace-nowrap border-b border-line px-4 py-3 text-[13px]">
                  {dayFmt(new Date(r.startsAt))} – {dayFmt(new Date(r.endsAt))}
                </td>
                <td className="border-b border-line px-4 py-3 text-right num">{r.views.toLocaleString("en-IN")}</td>
                <td className="border-b border-line px-4 py-3 text-right num">
                  {r.enquiries.toLocaleString("en-IN")}
                  <span className="block text-[11.5px] text-muted">{pct(r.enquiries, r.views)} of views</span>
                </td>
                <td className="border-b border-line px-4 py-3 text-right num">
                  {r.conversions.toLocaleString("en-IN")}
                  <span className="block text-[11.5px] text-muted">{pct(r.conversions, r.enquiries)} of enquiries</span>
                </td>
                <td className="border-b border-line px-4 py-3">
                  <OfferActions id={r.id} status={r.status} startsAt={r.startsAt} endsAt={r.endsAt} title={r.title} compact now={now} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Timeline({ rows, now }: { rows: CampaignRow[]; now: number }) {
  const { start, end, months, today } = useMemo(() => {
    const DAY = 86_400_000;
    const minStart = Math.min(...rows.map((r) => new Date(r.startsAt).getTime()));
    const maxEnd = Math.max(...rows.map((r) => new Date(r.endsAt).getTime()));
    const s = Math.max(Math.min(minStart, now - 7 * DAY), now - 120 * DAY);
    const e = Math.min(Math.max(maxEnd, now + 30 * DAY), now + 240 * DAY);
    const ticks: { label: string; at: number }[] = [];
    const cursor = new Date(s);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= e) {
      if (cursor.getTime() >= s) ticks.push({ label: cursor.toLocaleDateString("en-IN", ticks.length === 0 || cursor.getMonth() === 0 ? { month: "short", year: "numeric" } : { month: "short" }), at: cursor.getTime() });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { start: s, end: e, months: ticks, today: now };
  }, [rows, now]);
  const pos = (t: number) => `${(Math.min(Math.max(t, start), end) - start) / (end - start) * 100}%`;
  return (
    <div className="border border-line bg-white">
      <div className="hidden border-b border-line md:grid md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="px-4 py-2.5 text-[12px] font-semibold text-muted">Campaign</div>
        <div className="relative mr-4 h-9">
          {months.map((m) => (
            <span key={m.at} className="absolute top-0 h-full border-l border-line pl-1.5 pt-2.5 text-[11px] text-muted" style={{ left: pos(m.at) }}>
              {m.label}
            </span>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const d = offerDisplayStatus(r, new Date(now));
          const s = new Date(r.startsAt).getTime();
          const e = new Date(r.endsAt).getTime();
          return (
            <li key={r.id} className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[260px_minmax(0,1fr)] md:gap-0 md:px-0 md:py-0">
              <div className="min-w-0 md:px-4 md:py-3">
                <Link href={`/admin/offer-approvals?view=all&review=${r.id}`} className="block truncate text-[13.5px] font-medium hover:text-red">
                  {r.title}
                </Link>
                <span className="block truncate text-[12px] text-muted">
                  {r.partnerName} · {OFFER_STATUS_LABEL[d]}
                  {r.partnerStatus !== "approved" && (d === "active" || d === "scheduled") ? ` (hidden — dealer ${PARTNER_STATUS_LABEL[r.partnerStatus].toLowerCase()})` : ""}
                </span>
              </div>
              <div className="relative h-8 rounded-[2px] bg-mist/60 md:my-3 md:mr-4 md:h-auto md:min-h-8">
                <span aria-hidden className="absolute inset-y-0 w-px bg-red" style={{ left: pos(today) }} />
                <span
                  className={cn("absolute inset-y-1.5 rounded-[2px]", DISPLAY_BAR[d] ?? "bg-ink/30", d === "paused" && "bg-[repeating-linear-gradient(45deg,#e09200_0_6px,#f2b84b_6px_12px)]")}
                  style={{ left: pos(s), width: `max(4px, calc(${pos(e)} - ${pos(s)}))` }}
                  title={`${dayFmt(new Date(s))} – ${dayFmt(new Date(e))}`}
                />
                <span className="sr-only">
                  Runs {dayFmt(new Date(s))} to {dayFmt(new Date(e))}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-2.5 text-[11.5px] text-muted">
        {(["active", "scheduled", "paused", "expired"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2.5 rounded-[2px]", DISPLAY_BAR[k])} /> {OFFER_STATUS_LABEL[k]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-px bg-red" /> Today
        </span>
      </div>
    </div>
  );
}

/* ── Dealer details tabs ────────────────────────────────────── */

/** Client-side tabs over server-rendered panels; the open tab is kept in `?tab=` for deep links. */
export function PartnerTabs({ tabs, initial }: { tabs: { key: string; label: string; count?: number; content: ReactNode }[]; initial: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.key === initial) ? initial : tabs[0].key);
  const change = (key: string) => {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
  };
  return (
    <div>
      <Tabs items={tabs.map((t) => ({ value: t.key, label: t.label, count: t.count }))} value={active} onChange={change} size="sm" ariaLabel="Dealer sections" className="mb-6 gap-6" />
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" aria-label={t.label} hidden={t.key !== active}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
