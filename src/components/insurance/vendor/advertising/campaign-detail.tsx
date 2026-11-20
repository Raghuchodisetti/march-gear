"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarRange, CheckCircle2, ImagePlus, Loader2, MessageSquareWarning, Monitor, RefreshCw, Send, Smartphone, Trash2, X } from "lucide-react";
import type { AdCreativeStatus } from "@/db/enums";
import { addAdCreativeAction, cancelAdCampaignAction, checkAdAvailabilityAction, removeAdCreativeAction, replaceAdCreativeAction, resubmitAdCampaignAction, updateAdDatesAction } from "@/server/actions/ads-vendor";
import { cn } from "@/lib/utils";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Segmented } from "@/components/ui/field";
import { useDecisionDialog } from "@/components/admin/partner-actions";
import { Callout } from "@/components/portal/offers/offer-ui";
import { rupees } from "@/components/portal/billing/shared";
import { BannerView } from "@/components/ads/banner";
import { CreativePill } from "@/components/ads/status";
import { CreativeFields, EMPTY_CREATIVE, creativePayload, type CreativeDraft } from "@/components/ads/creative-fields";
import { DESKTOP_ASPECT, MOBILE_ASPECT, adQuote, aspectOf, dayLabel, occupancyByDay, rangeDays, rangeLabel, soldOutDays, type BookedRange } from "@/components/ads/shared";
import { BannerUpload } from "./banner-upload";
import { RangeCalendar } from "./range-calendar";

/* Client pieces of a vendor's ad booking page: booking actions and the creatives manager. */

const OFFLINE: { ok: false; error: string; fieldErrors?: Record<string, string> } = { ok: false, error: "Couldn't reach the server. Check your connection and try again." };

export function BookingActions({
  campaign,
  calendar,
}: {
  campaign: { id: number; name: string; status: string; startsOn: string; endsOn: string; pricePerDay: number; canCancel: boolean; canEditDates: boolean; canResubmit: boolean; invoiced: boolean };
  calendar: { placementId: number; firstDay: string; lastDay: string; minDays: number; maxDays: number; slots: number; booked: BookedRange[] } | null;
}) {
  const dialog = useDecisionDialog();
  const [dates, setDates] = useState(false);
  if (!campaign.canCancel && !campaign.canEditDates && !campaign.canResubmit) return null;
  return (
    <>
      {campaign.canResubmit && (
        <Button
          size="sm"
          icon={<Send className="size-4" aria-hidden />}
          onClick={() =>
            dialog.open({
              title: `Resubmit “${campaign.name}”`,
              description: "Sends the booking back to MarchGear for review with your changes.",
              fields: [],
              submitLabel: "Resubmit for review",
              icon: <Send aria-hidden className="size-4" />,
              run: () => resubmitAdCampaignAction({ id: campaign.id }),
              done: "Resubmitted for review",
            })
          }
        >
          Resubmit for review
        </Button>
      )}
      {campaign.canEditDates && calendar && (
        <Button size="sm" variant="outline" icon={<CalendarRange className="size-4" aria-hidden />} onClick={() => setDates(true)}>
          Change dates
        </Button>
      )}
      {campaign.canCancel && (
        <Button
          size="sm"
          variant="ghost"
          className="text-red hover:bg-red-50"
          icon={<X className="size-4" aria-hidden />}
          onClick={() =>
            dialog.open({
              title: `Cancel “${campaign.name}”?`,
              description: campaign.invoiced
                ? "The booking is cancelled and its unpaid invoice is voided. If you've already paid, MarchGear will contact you about a refund."
                : "The booking is cancelled and its dates are released. This can't be undone — you can book again later.",
              fields: [{ name: "reason", kind: "textarea", label: "Reason", optional: true, rows: 3 }],
              submitLabel: "Cancel booking",
              tone: "danger",
              icon: <X aria-hidden className="size-4" />,
              run: (v) => cancelAdCampaignAction({ id: campaign.id, reason: v.reason }),
              done: (res) => (res.voided ? "Booking cancelled — the invoice was voided" : "Booking cancelled"),
            })
          }
        >
          Cancel booking
        </Button>
      )}
      {dialog.element}
      {calendar && <DatesModal open={dates} onClose={() => setDates(false)} campaign={campaign} calendar={calendar} />}
    </>
  );
}

function DatesModal({
  open,
  onClose,
  campaign,
  calendar,
}: {
  open: boolean;
  onClose: () => void;
  campaign: { id: number; startsOn: string; endsOn: string; pricePerDay: number };
  calendar: { placementId: number; firstDay: string; lastDay: string; minDays: number; maxDays: number; slots: number; booked: BookedRange[] };
}) {
  const router = useRouter();
  const { toast } = useUI();
  const [start, setStart] = useState(campaign.startsOn >= calendar.firstDay ? campaign.startsOn : "");
  const [end, setEnd] = useState(campaign.startsOn >= calendar.firstDay ? campaign.endsOn : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState<{ checking: boolean; soldOut: string[] }>({ checking: false, soldOut: [] });
  const occupancy = useMemo(() => occupancyByDay(calendar.booked, calendar.firstDay, calendar.lastDay, campaign.id), [calendar, campaign.id]);
  const days = start && end ? rangeDays(start, end) : 0;
  const clashes = start && end ? soldOutDays(calendar.booked, calendar.slots, start, end, campaign.id) : [];
  const price = days ? adQuote(campaign.pricePerDay, days) : null;

  useEffect(() => {
    if (!open || !start || !end) return;
    let live = true;
    const t = setTimeout(async () => {
      setServer({ checking: true, soldOut: [] });
      const res = await checkAdAvailabilityAction({ placementId: calendar.placementId, startsOn: start, endsOn: end, campaignId: campaign.id }).catch(() => null);
      if (live) setServer({ checking: false, soldOut: res && res.ok ? res.soldOut : [] });
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, start, end, campaign.id, calendar.placementId]);

  const lengthIssue = days && days < calendar.minDays ? `Book at least ${calendar.minDays} days` : days > calendar.maxDays ? `Book at most ${calendar.maxDays} days` : null;
  const full = clashes.length ? clashes : server.soldOut;

  const save = async () => {
    if (!start || !end) return setError("Choose the first and last day");
    if (lengthIssue) return setError(lengthIssue);
    setBusy(true);
    const res = await updateAdDatesAction({ id: campaign.id, startsOn: start, endsOn: end }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setError(Object.values(res.fieldErrors ?? {})[0] ?? res.error ?? "Couldn't change the dates.");
      return;
    }
    toast("Dates updated", { tone: "success" });
    onClose();
    router.refresh();
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" title="Change dates" description={`Currently ${rangeLabel(campaign.startsOn, campaign.endsOn)}. The price follows your booked rate of ${rupees(campaign.pricePerDay)}/day.`}>
      <div className="space-y-4 px-6 py-5 sm:px-8">
        <RangeCalendar
          start={start}
          end={end}
          min={calendar.firstDay}
          max={calendar.lastDay}
          occupancy={occupancy}
          slots={calendar.slots}
          invalid={Boolean(error)}
          onChange={(s, e) => {
            setStart(s);
            setEnd(e);
            setError(null);
          }}
        />
        {full.length > 0 ? (
          <Callout tone="red" icon={<AlertTriangle />}>
            Sold out on {full.slice(0, 4).map((d) => dayLabel(d, false)).join(", ")}
            {full.length > 4 ? ` and ${full.length - 4} more` : ""} — choose other days.
          </Callout>
        ) : start && end ? (
          <p className="flex items-center gap-2 text-[13px]" role="status">
            {server.checking ? <Loader2 aria-hidden className="size-4 animate-spin text-muted" /> : <CheckCircle2 aria-hidden className="size-4 text-[#1e7a3c]" />}
            {rangeLabel(start, end)} · {days} days{price ? ` · ${rupees(price.total)} incl. GST` : ""}
            {lengthIssue && <span className="text-red">· {lengthIssue}</span>}
          </p>
        ) : null}
        {error && <p className="text-[12.5px] text-red">{error}</p>}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Keep current dates
        </Button>
        <Button onClick={save} disabled={busy || !start || !end || full.length > 0} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarRange className="size-4" aria-hidden />}>
          Save dates
        </Button>
      </div>
    </Modal>
  );
}

/* ── Creatives ────────────────────────────────────────────────── */

export interface VendorCreative {
  id: number;
  name: string;
  desktopImage: string | null;
  mobileImage: string | null;
  headline: string | null;
  body: string | null;
  ctaLabel: string | null;
  alt: string;
  status: AdCreativeStatus;
  remarks: string | null;
  updatedAt: string;
}

const draftOf = (c: VendorCreative): CreativeDraft => ({ name: c.name, desktopImage: c.desktopImage, mobileImage: c.mobileImage, headline: c.headline ?? "", body: c.body ?? "", ctaLabel: c.ctaLabel ?? "", alt: c.alt });

export function CreativeManager({
  campaignId,
  creatives,
  sizes,
  advertiser,
  editable,
  live,
  lockedReason,
}: {
  campaignId: number;
  creatives: VendorCreative[];
  sizes: { desktopSize: string | null; mobileSize: string | null };
  advertiser: string;
  editable: boolean;
  live: boolean;
  lockedReason: string | null;
}) {
  const router = useRouter();
  const { toast } = useUI();
  const dialog = useDecisionDialog();
  const [editing, setEditing] = useState<{ mode: "add" } | { mode: "replace"; creative: VendorCreative } | null>(null);
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const approved = creatives.filter((c) => c.status === "approved").length;
  const dAspect = aspectOf(sizes.desktopSize, DESKTOP_ASPECT);
  const mAspect = aspectOf(sizes.mobileSize, MOBILE_ASPECT);

  const remove = (c: VendorCreative) =>
    dialog.open({
      title: `Remove “${c.name}”?`,
      description: c.status === "approved" && approved === 1 && live ? "This is your only approved creative — your banner stops showing until another one is approved." : "The creative is removed from this booking.",
      fields: [],
      submitLabel: "Remove creative",
      tone: "danger",
      icon: <Trash2 aria-hidden className="size-4" />,
      run: () => removeAdCreativeAction({ creativeId: c.id }),
      done: "Creative removed",
    });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          ariaLabel="Preview size"
          value={view}
          onChange={setView}
          options={[
            { value: "desktop", label: <span className="inline-flex items-center gap-1.5"><Monitor aria-hidden className="size-3.5" /> Desktop</span> },
            { value: "mobile", label: <span className="inline-flex items-center gap-1.5"><Smartphone aria-hidden className="size-3.5" /> Mobile</span> },
          ]}
        />
        {editable && creatives.length < 6 && (
          <Button size="sm" variant="outline" icon={<ImagePlus className="size-4" aria-hidden />} onClick={() => setEditing({ mode: "add" })}>
            Add creative
          </Button>
        )}
      </div>
      {!editable && lockedReason && <p className="mb-4 text-[12.5px] text-muted">{lockedReason}</p>}
      <ul className="space-y-4">
        {creatives.map((c) => (
          <li key={c.id} className="border border-line">
            <div className={cn("bg-[#F6F6F6] p-3 sm:p-4", view === "mobile" && "flex justify-center")}>
              <div className={cn("w-full", view === "mobile" && "max-w-[340px]")}>
                <BannerView variant={view} desktopAspect={dAspect} mobileAspect={mAspect} ad={{ desktopImage: c.desktopImage, mobileImage: c.mobileImage, alt: c.alt, headline: c.headline, body: c.body, ctaLabel: c.ctaLabel, advertiser }} />
              </div>
            </div>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-semibold">{c.name}</p>
                  <CreativePill status={c.status} />
                </div>
                <p className="mt-1 text-[12.5px] text-muted">{c.alt}</p>
                {c.status === "pending" && <p className="mt-1 text-[12px] text-muted">MarchGear reviews new and replaced creatives before they&apos;re shown.</p>}
              </div>
              {editable && (
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" icon={<RefreshCw className="size-4" aria-hidden />} onClick={() => setEditing({ mode: "replace", creative: c })}>
                    Replace
                  </Button>
                  {creatives.length > 1 && (
                    <button type="button" onClick={() => remove(c)} aria-label={`Remove ${c.name}`} className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red">
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            {c.remarks && (c.status === "changes_requested" || c.status === "rejected") && (
              <Callout tone={c.status === "rejected" ? "red" : "amber"} icon={<MessageSquareWarning />} title={c.status === "rejected" ? "Rejected by MarchGear" : "MarchGear asked for changes"} className="mx-4 mb-4">
                <p className="whitespace-pre-line">{c.remarks}</p>
              </Callout>
            )}
          </li>
        ))}
      </ul>
      {dialog.element}
      {editing && (
        <CreativeModal
          key={editing.mode === "add" ? "add" : editing.creative.id}
          onClose={() => setEditing(null)}
          title={editing.mode === "add" ? "Add a creative" : `Replace “${editing.creative.name}”`}
          initial={editing.mode === "add" ? { ...EMPTY_CREATIVE, name: `Creative ${creatives.length + 1}` } : draftOf(editing.creative)}
          warning={editing.mode === "replace" && editing.creative.status === "approved" ? (live && approved === 1 ? "This is your only approved creative: your banner pauses until MarchGear approves the replacement. To avoid a gap, add a new creative instead and remove this one once it's approved." : "The replacement is reviewed again before it's shown.") : null}
          sizes={sizes}
          advertiser={advertiser}
          save={async (draft) => {
            const payload = creativePayload(draft);
            const res = await (editing.mode === "add" ? addAdCreativeAction({ campaignId, creative: payload }) : replaceAdCreativeAction({ creativeId: editing.creative.id, creative: payload })).catch(() => OFFLINE);
            if (res.ok) {
              toast(editing.mode === "add" ? "Creative sent for review" : "Replacement sent for review", { tone: "success" });
              setEditing(null);
              router.refresh();
            }
            return res;
          }}
        />
      )}
    </div>
  );
}

function CreativeModal({
  onClose,
  title,
  initial,
  warning,
  sizes,
  advertiser,
  save,
}: {
  onClose: () => void;
  title: string;
  initial: CreativeDraft;
  warning: string | null;
  sizes: { desktopSize: string | null; mobileSize: string | null };
  advertiser: string;
  save: (d: CreativeDraft) => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>;
}) {
  const { toast } = useUI();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const local: Record<string, string> = {};
    if (!draft.desktopImage) local["creative.desktopImage"] = "Upload the desktop banner";
    if (!draft.mobileImage) local["creative.mobileImage"] = "Upload the mobile banner";
    if (draft.alt.trim().length < 5) local["creative.alt"] = "Describe the banner for people using screen readers";
    if (Object.keys(local).length) return setErrors(local);
    setBusy(true);
    const res = await save(draft);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast(res.error ?? "Couldn't save the creative.", { tone: "error" });
    }
  };
  return (
    <Modal open onClose={onClose} size="xl" title={title} description="New and replaced creatives are reviewed by MarchGear before they're shown.">
      <div className="space-y-4 px-6 py-5 sm:px-8">
        {warning && (
          <Callout tone="amber" icon={<AlertTriangle />}>
            {warning}
          </Callout>
        )}
        <CreativeFields
          value={draft}
          onChange={(d) => {
            setDraft(d);
            setErrors({});
          }}
          errors={errors}
          sizes={sizes}
          advertiser={advertiser}
          showName
          renderImage={(p) => <BannerUpload {...p} />}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}>
          Send for review
        </Button>
      </div>
    </Modal>
  );
}
