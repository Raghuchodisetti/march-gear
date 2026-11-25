"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useDeskRouter as useRouter } from "@/components/admin/desk";
import { ImageIcon, ImagePlus, Loader2, Megaphone, RefreshCw, Trash2 } from "lucide-react";
import { createHouseCampaignAction, saveHouseCreativeAction } from "@/server/actions/ads-admin";
import { AD_FORMAT_LABEL } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { MediaPickerButton } from "@/components/admin/media-picker";
import { Panel } from "@/components/admin/ui";
import { CreativeFields, EMPTY_CREATIVE, creativePayload, type CreativeDraft, type ImageSlotProps } from "@/components/ads/creative-fields";
import { occupancyByDay, rangeDays, rangeLabel, soldOutDays, type BookedRange, type PlacementView } from "@/components/ads/shared";
import { addDays } from "@/components/portal/billing/shared";

/* MarchGear's own (house) campaigns: no booking fee, approved on creation, never invoiced. */

const OFFLINE: { ok: false; error: string; fieldErrors?: Record<string, string> } = { ok: false, error: "Couldn't reach the server. Please try again." };

/** An image field backed by the admin media library. */
function LibraryImage({ slot, value, onChange, error, aspectClass }: ImageSlotProps) {
  return (
    <div>
      <div className={cn("relative overflow-hidden rounded-[4px] border bg-mist", aspectClass, error ? "border-red" : "border-line")}>
        {value ? (
          // Media-library preview.
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy" decoding="async" src={value} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[12px] text-muted">
            <ImageIcon aria-hidden className="size-5" /> No {slot} banner yet
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <MediaPickerButton onPick={(urls) => onChange(urls[0] ?? null)} />
        {value && (
          <button type="button" onClick={() => onChange(null)} aria-label={`Remove the ${slot} banner`} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-red">
            <Trash2 aria-hidden className="size-4" />
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-red">{error}</p>}
    </div>
  );
}

export function HouseCampaignForm({ placements, booked, today, products }: { placements: PlacementView[]; booked: Record<number, BookedRange[]>; today: string; products: { id: number; label: string }[] }) {
  const router = useRouter();
  const { toast } = useUI();
  const [placementId, setPlacementId] = useState<string>(placements.find((p) => p.format === "banner")?.id.toString() ?? "");
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(addDays(today, 13));
  const [targetUrl, setTargetUrl] = useState("");
  const [productId, setProductId] = useState("");
  const [creative, setCreative] = useState<CreativeDraft>(EMPTY_CREATIVE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const placement = placements.find((p) => String(p.id) === placementId) ?? null;
  const days = startsOn && endsOn && endsOn >= startsOn ? rangeDays(startsOn, endsOn) : 0;
  const ranges = useMemo(() => (placement ? (booked[placement.id] ?? []) : []), [placement, booked]);
  const full = placement && days ? soldOutDays(ranges, placement.slots, startsOn, endsOn) : [];
  const peak = placement && days ? Math.max(0, ...Object.values(occupancyByDay(ranges, startsOn, endsOn))) : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await createHouseCampaignAction({
      placementId: Number(placementId) || undefined,
      name,
      startsOn,
      endsOn,
      targetUrl: placement?.format === "banner" ? targetUrl : null,
      productId: placement?.format === "sponsored_listing" ? Number(productId) || null : null,
      creative: placement?.format === "banner" ? creativePayload(creative) : null,
    }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast(Object.values(res.fieldErrors ?? {})[0] ?? res.error ?? "Couldn't create the campaign.", { tone: "error" });
      return;
    }
    toast(`House campaign ${res.reference} is approved`, { tone: "success" });
    router.push(`/admin/advertising/${res.id}`);
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <Panel title="Campaign">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="Placement"
              value={placementId}
              onChange={(e) => {
                setPlacementId(e.target.value);
                setErrors({});
              }}
              placeholder="Choose a placement"
              options={placements.map((p) => ({ value: String(p.id), label: `${p.name} · ${AD_FORMAT_LABEL[p.format]}${p.isActive ? "" : " (off)"}` }))}
              error={errors.placementId}
            />
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Festive offers on MarchGear" maxLength={160} error={errors.name} />
            <TextField label="First day" type="date" value={startsOn} min={today} onChange={(e) => setStartsOn(e.target.value)} error={errors.startsOn} />
            <TextField label="Last day" type="date" value={endsOn} min={startsOn || today} onChange={(e) => setEndsOn(e.target.value)} error={errors.endsOn} hint={days ? `${days} days` : undefined} />
            {placement?.format === "sponsored_listing" ? (
              <SelectField
                label="Product to promote"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder={products.length ? "Choose a published product" : "No published products yet"}
                options={products.map((p) => ({ value: String(p.id), label: p.label }))}
                error={errors.productId}
                className="md:col-span-2"
              />
            ) : (
              <TextField
                label="Links to"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="/insurance or https://…"
                hint="A /path on MarchGear (gets ?ad= for attribution) or a full https:// address."
                error={errors.targetUrl}
                maxLength={300}
                className="md:col-span-2"
              />
            )}
          </div>
          {placement && days > 0 && (
            <p className={cn("mt-4 text-[12.5px]", full.length ? "text-red" : "text-muted")}>
              {full.length
                ? `Full on ${full.length} day${full.length === 1 ? "" : "s"} of ${rangeLabel(startsOn, endsOn)} — every one of the ${placement.slots} slots is booked. Choose other dates or add a slot in Placements & pricing.`
                : `${rangeLabel(startsOn, endsOn)} · busiest day has ${peak} of ${placement.slots} slot${placement.slots === 1 ? "" : "s"} taken.`}
            </p>
          )}
        </Panel>
        {placement?.format === "banner" && (
          <Panel title="Creative">
            <CreativeFields value={creative} onChange={setCreative} errors={errors} sizes={placement} advertiser="MarchGear" renderImage={(p) => <LibraryImage {...p} />} />
          </Panel>
        )}
      </div>
      <aside>
        <div className="sticky top-24 space-y-4 border border-line bg-white p-5">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-red-50 text-red">
            <Megaphone aria-hidden className="size-5" />
          </span>
          <div>
            <p className="text-[15px] font-semibold">House campaign</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">MarchGear&apos;s own ad. It&apos;s approved straight away, takes a slot like any booking and is never invoiced. Its creative is approved with it.</p>
          </div>
          <Button type="submit" className="w-full" disabled={busy || full.length > 0} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
            Create & approve
          </Button>
        </div>
      </aside>
    </form>
  );
}

/** Add or replace a house campaign's creative (approved straight away). */
export function HouseCreativeButton({ campaignId, creative, sizes, label }: { campaignId: number; creative: (CreativeDraft & { id: number }) | null; sizes: { desktopSize: string | null; mobileSize: string | null }; label: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CreativeDraft>(creative ?? EMPTY_CREATIVE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const res = await saveHouseCreativeAction({ campaignId, creativeId: creative?.id ?? null, creative: creativePayload(draft) }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast(res.error ?? "Couldn't save the creative.", { tone: "error" });
      return;
    }
    toast("Creative saved", { tone: "success" });
    setOpen(false);
    router.refresh();
  };
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        icon={creative ? <RefreshCw className="size-4" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        onClick={() => {
          setDraft(creative ?? EMPTY_CREATIVE);
          setErrors({});
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} size="xl" title={label} description="House creatives are approved as soon as they're saved.">
        <div className="px-6 py-5 sm:px-8">
          <CreativeFields value={draft} onChange={setDraft} errors={errors} sizes={sizes} advertiser="MarchGear" renderImage={(p) => <LibraryImage {...p} />} />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
            Save creative
          </Button>
        </div>
      </Modal>
    </>
  );
}
