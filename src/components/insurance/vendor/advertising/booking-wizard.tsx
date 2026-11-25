"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ExternalLink, FileText, Globe, Landmark, Loader2, Package, Plus, Send } from "lucide-react";
import { AD_FORMAT_LABEL } from "@/insurance/labels";
import { INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import type { InsProductCategory } from "@/db/enums";
import { bookAdCampaignAction, checkAdAvailabilityAction } from "@/server/actions/ads-vendor";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Callout } from "@/components/portal/offers/offer-ui";
import { rupees } from "@/components/portal/billing/shared";
import { PlacementArt } from "@/components/ads/placement-art";
import { CreativeFields, EMPTY_CREATIVE, creativePayload, type CreativeDraft } from "@/components/ads/creative-fields";
import {
  AUDIENCE_LABEL,
  TARGET_KIND_LABEL,
  adQuote,
  dayLabel,
  occupancyByDay,
  rangeDays,
  rangeLabel,
  safeHttpsUrl,
  safeInternalPath,
  soldOutDays,
  type BookedRange,
  type PlacementView,
  type TargetKind,
} from "@/components/ads/shared";
import { addDays } from "@/components/portal/billing/shared";
import { BannerUpload } from "./banner-upload";
import { RangeCalendar } from "./range-calendar";

/* ──────────────────────────────────────────────────────────────
   "Book a placement": placement → dates → target → creatives
   (banners only) → review & submit. Everything is checked again
   on the server; the price is the placement's rate × days + GST.
   ────────────────────────────────────────────────────────────── */

type StepKey = "placement" | "dates" | "target" | "creative" | "review";
const STEP_INFO: Record<StepKey, { title: string; hint: string }> = {
  placement: { title: "Placement", hint: "Where your ad appears" },
  dates: { title: "Dates", hint: "When it runs" },
  target: { title: "Link", hint: "Where clicks go" },
  creative: { title: "Creatives", hint: "Desktop & mobile banners" },
  review: { title: "Review & submit", hint: "Price and terms" },
};

const stepOf = (field: string): StepKey =>
  field === "placementId" ? "placement" : field === "startsOn" || field === "endsOn" ? "dates" : field.startsWith("target") ? "target" : field.startsWith("creative") ? "creative" : "review";

interface Product {
  id: number;
  name: string;
  reference: string;
  category: string;
}

type Availability = { state: "idle" } | { state: "checking" } | { state: "ok"; total: number } | { state: "full"; days: string[] } | { state: "error"; message: string };

export function BookingWizard({
  firstDay,
  lastStart,
  placements,
  booked,
  products,
  provider,
  advertiser,
  initialPlacementId,
}: {
  firstDay: string;
  lastStart: string;
  placements: PlacementView[];
  booked: Record<number, BookedRange[]>;
  products: Product[];
  provider: { slug: string; name: string; href: string } | null;
  advertiser: string;
  initialPlacementId: number | null;
}) {
  const { toast } = useUI();
  const [placementId, setPlacementId] = useState<number | null>(initialPlacementId);
  const [step, setStep] = useState<StepKey>(initialPlacementId ? "dates" : "placement");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [target, setTarget] = useState<{ kind: TargetKind; productId: string; path: string; url: string }>({ kind: products.length ? "product" : provider ? "provider" : "path", productId: products[0] ? String(products[0].id) : "", path: "", url: "" });
  const [creative, setCreative] = useState<CreativeDraft>(EMPTY_CREATIVE);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<Availability>({ state: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: number; reference: string; total: number } | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const placement = placements.find((p) => p.id === placementId) ?? null;
  const steps: StepKey[] = placement?.format === "sponsored_listing" ? ["placement", "dates", "target", "review"] : ["placement", "dates", "target", "creative", "review"];
  const index = Math.max(0, steps.indexOf(step));
  const days = startsOn && endsOn ? rangeDays(startsOn, endsOn) : 0;
  const price = placement && days ? adQuote(placement.pricePerDay, days) : null;
  const calendarEnd = placement ? addDays(lastStart, placement.maxDays - 1) : lastStart;
  const occupancy = useMemo(() => (placementId ? occupancyByDay(booked[placementId] ?? [], firstDay, calendarEnd) : {}), [placementId, booked, firstDay, calendarEnd]);
  const clashes = placement && startsOn && endsOn ? soldOutDays(booked[placement.id] ?? [], placement.slots, startsOn, endsOn) : [];
  const product = products.find((p) => String(p.id) === target.productId) ?? null;
  /** The chosen start if `len` days from it are free, otherwise the earliest start where they are (or null). */
  const firstFit = (len: number) => {
    if (!placement) return null;
    const free = (from: string) => Array.from({ length: len }, (_, i) => addDays(from, i)).every((d) => (occupancy[d] ?? 0) < placement.slots);
    if (startsOn && free(startsOn)) return startsOn;
    for (let d = firstDay; d <= lastStart; d = addDays(d, 1)) if (free(d)) return d;
    return null;
  };
  const defaultName = placement && startsOn ? `${placement.name} — ${dayLabel(startsOn, false)}` : "";

  // Ask the server whether the chosen dates are still free (others may have booked since the page loaded).
  useEffect(() => {
    if (!placement || !startsOn || !endsOn) return;
    let live = true;
    const t = setTimeout(async () => {
      setAvailability({ state: "checking" });
      const res = await checkAdAvailabilityAction({ placementId: placement.id, startsOn, endsOn }).catch(() => null);
      if (!live) return;
      if (!res) setAvailability({ state: "error", message: "Couldn't check availability. Check your connection." });
      else if (!res.ok) setAvailability({ state: "error", message: Object.values(res.fieldErrors ?? {})[0] ?? res.error ?? "Couldn't check those dates." });
      else if (res.soldOut.length) setAvailability({ state: "full", days: res.soldOut });
      else setAvailability({ state: "ok", total: res.total });
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [placement, startsOn, endsOn]);

  const clearErrors = (prefix: string) => setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(prefix))));

  /** Client-side checks per step (the server repeats all of them). */
  function problems(s: StepKey): Record<string, string> {
    const out: Record<string, string> = {};
    if (s === "placement" && !placement) out.placementId = "Choose a placement";
    if (s === "dates" && placement) {
      if (!startsOn) out.startsOn = "Choose the first day";
      else if (!endsOn) out.endsOn = "Choose the last day";
      else if (days < placement.minDays) out.endsOn = `Book at least ${placement.minDays} days (this is ${days})`;
      else if (days > placement.maxDays) out.endsOn = `Book at most ${placement.maxDays} days (this is ${days})`;
      else if (clashes.length || availability.state === "full") out.endsOn = "Some of these days are sold out — choose other dates";
    }
    if (s === "target") {
      if (target.kind === "product" && !target.productId) out["target.productId"] = "Choose a product";
      if (target.kind === "path" && !safeInternalPath(target.path)) out["target.path"] = "Enter a MarchGear page starting with /, e.g. /insurance/renewal";
      if (target.kind === "url" && !safeHttpsUrl(target.url)) out["target.url"] = "Enter a full https:// address";
      if (placement?.format === "sponsored_listing" && target.kind !== "product") out["target.kind"] = "A sponsored listing promotes one of your products";
    }
    if (s === "creative") {
      if (!creative.desktopImage) out["creative.desktopImage"] = "Upload the desktop banner";
      if (!creative.mobileImage) out["creative.mobileImage"] = "Upload the mobile banner";
      if (creative.alt.trim().length < 5) out["creative.alt"] = "Describe the banner for people using screen readers";
    }
    if (s === "review") {
      if ((name.trim() || defaultName).length < 3) out.name = "Name the campaign";
      if (!confirm) out.confirm = "Please confirm the booking terms";
    }
    return out;
  }

  const scrollTop = () => top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const goTo = (s: StepKey) => {
    // Forward jumps only past steps that are complete.
    const target = steps.indexOf(s);
    for (let i = 0; i < target; i++) {
      const p = problems(steps[i]);
      if (Object.keys(p).length) {
        setErrors(p);
        setStep(steps[i]);
        scrollTop();
        return;
      }
    }
    setStep(s);
    scrollTop();
  };
  const next = () => {
    const p = problems(step);
    if (Object.keys(p).length) {
      setErrors(p);
      toast(Object.values(p)[0], { tone: "error" });
      return;
    }
    setErrors({});
    goTo(steps[index + 1]);
  };

  const choosePlacement = (p: PlacementView) => {
    if (p.id !== placementId) {
      setPlacementId(p.id);
      setStartsOn("");
      setEndsOn("");
      setAvailability({ state: "idle" });
      if (p.format === "sponsored_listing") setTarget((t) => ({ ...t, kind: "product" }));
    }
    clearErrors("placementId");
  };

  const submit = async () => {
    const all = steps.reduce<Record<string, string>>((acc, s) => ({ ...acc, ...problems(s) }), {});
    if (Object.keys(all).length) {
      setErrors(all);
      setStep(stepOf(Object.keys(all)[0]));
      toast(Object.values(all)[0], { tone: "error" });
      scrollTop();
      return;
    }
    setSubmitting(true);
    const res = await bookAdCampaignAction({
      placementId,
      startsOn,
      endsOn,
      name: name.trim() || defaultName,
      target: { kind: target.kind, productId: target.kind === "product" ? Number(target.productId) : null, path: target.path, url: target.url },
      creative: placement?.format === "banner" ? creativePayload(creative) : null,
      confirm,
    }).catch(() => null);
    setSubmitting(false);
    if (!res) return toast("Couldn't reach the server. Check your connection and try again.", { tone: "error" });
    if (!res.ok) {
      const fe = res.fieldErrors ?? {};
      setErrors(fe);
      const first = Object.keys(fe)[0];
      if (first) setStep(stepOf(first));
      toast(Object.values(fe)[0] ?? res.error ?? "Couldn't book that. Please try again.", { tone: "error" });
      scrollTop();
      return;
    }
    setDone({ id: res.id, reference: res.reference, total: res.total });
    scrollTop();
  };

  if (done) return <Submitted done={done} />;

  if (!placements.length)
    return (
      <div className="border border-line bg-white px-6 py-14 text-center">
        <p className="text-[15px] font-semibold">No placements are open for booking right now</p>
        <p className="mx-auto mt-1 max-w-md text-[13.5px] text-muted">MarchGear opens placements for insurance vendors from time to time. Contact support if you&apos;d like to advertise.</p>
      </div>
    );

  return (
    <div ref={top} className="scroll-mt-24">
      {/* Stepper */}
      <ol className="no-scrollbar -mx-4 mb-7 flex gap-2 overflow-x-auto px-4 md:mx-0 md:gap-0 md:px-0">
        {steps.map((s, i) => {
          const active = s === step;
          const doneStep = i < index;
          return (
            <li key={s} className="flex shrink-0 items-center md:flex-1">
              <button
                type="button"
                onClick={() => goTo(s)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-left transition-colors md:rounded-none md:border-0 md:px-0 md:py-0",
                  active ? "border-ink bg-ink text-white md:bg-transparent md:text-ink" : "border-line bg-white md:bg-transparent",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold transition-colors md:size-8",
                    active ? "bg-red text-white" : doneStep ? "bg-ink text-white" : "border border-line bg-white text-ink/60 group-hover:border-ink/40",
                  )}
                >
                  {doneStep ? <Check aria-hidden className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-[13px] leading-tight", active ? "font-semibold" : "font-medium text-ink/80", active && "text-white md:text-ink")}>{STEP_INFO[s].title}</span>
                  <span className="hidden text-[11.5px] text-muted lg:block">{STEP_INFO[s].hint}</span>
                </span>
              </button>
              {i < steps.length - 1 && <span aria-hidden className="mx-4 hidden h-px flex-1 bg-line md:block" />}
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE }}>
              {step === "placement" && (
                <Section title="Choose a placement" note="Banners appear at the spot shown in red. Sponsored listings put one of your published products first in quote results and comparisons.">
                  {errors.placementId && <p className="mb-3 text-[12.5px] text-red">{errors.placementId}</p>}
                  <div role="radiogroup" aria-label="Placement" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {placements.map((p) => {
                      const on = p.id === placementId;
                      const blocked = p.format === "sponsored_listing" && !products.length;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={blocked}
                          onClick={() => choosePlacement(p)}
                          className={cn(
                            "group relative flex flex-col border bg-white p-4 text-left transition-[border-color,box-shadow] duration-300",
                            on ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]" : "border-line hover:border-ink/40",
                            blocked && "cursor-not-allowed opacity-60 hover:border-line",
                          )}
                        >
                          <span className="block overflow-hidden rounded-[3px] border border-line bg-[#F6F6F6] p-2.5">
                            <PlacementArt placementKey={p.key} format={p.format} />
                          </span>
                          <span className="mt-3.5 flex items-start justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{AD_FORMAT_LABEL[p.format]}</span>
                              <span className="mt-0.5 block text-[15.5px] font-semibold leading-snug">{p.name}</span>
                            </span>
                            <span className={cn("mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors", on ? "border-red bg-red text-white" : "border-line")}>{on && <Check aria-hidden className="size-3" />}</span>
                          </span>
                          <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">{p.description}</span>
                          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3 text-[12px]">
                            <div>
                              <dt className="text-muted">Where</dt>
                              <dd className="font-medium">{p.location}</dd>
                            </div>
                            <div>
                              <dt className="text-muted">Sizes</dt>
                              <dd className="font-medium num">{p.format === "banner" ? `${p.desktopSize ?? "—"} · ${p.mobileSize ?? "—"}` : "Your product card"}</dd>
                            </div>
                            <div>
                              <dt className="text-muted">Length</dt>
                              <dd className="font-medium num">
                                {p.minDays}–{p.maxDays} days
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted">Rotation</dt>
                              <dd className="font-medium num">
                                {p.slots} advertiser{p.slots === 1 ? "" : "s"} at once
                              </dd>
                            </div>
                          </dl>
                          <span className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                            <span className="font-display text-[20px] font-semibold tracking-[-0.02em] num">
                              {rupees(p.pricePerDay)}
                              <span className="text-[12px] font-normal text-muted"> /day + GST</span>
                            </span>
                            {p.audience !== "all" && <span className="text-[11px] text-muted">{AUDIENCE_LABEL[p.audience]}</span>}
                          </span>
                          {blocked && <span className="mt-2 text-[12px] font-medium text-[#9a5b00]">Needs a published product first</span>}
                        </button>
                      );
                    })}
                  </div>
                </Section>
              )}

              {step === "dates" && placement && (
                <Section title="Choose your dates" note={`${placement.name} runs for ${placement.minDays}–${placement.maxDays} days. Up to ${placement.slots} advertiser${placement.slots === 1 ? "" : "s"} rotate in this spot each day; a day is sold out when every slot is booked or awaiting review. Bookings start from ${dayLabel(firstDay)}.`}>
                  <RangeCalendar
                    start={startsOn}
                    end={endsOn}
                    min={firstDay}
                    max={calendarEnd}
                    occupancy={occupancy}
                    slots={placement.slots}
                    invalid={Boolean(errors.startsOn || errors.endsOn)}
                    onChange={(s, e) => {
                      setStartsOn(s);
                      setEndsOn(e);
                      setAvailability({ state: "idle" });
                      clearErrors("startsOn");
                      clearErrors("endsOn");
                    }}
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-[12.5px] text-muted">Quick length:</span>
                    {[...new Set([placement.minDays, 14, 30, placement.maxDays])]
                      .filter((d) => d >= placement.minDays && d <= placement.maxDays)
                      .sort((a, b) => a - b)
                      .map((len) => {
                        const from = firstFit(len);
                        const on = startsOn && endsOn && days === len;
                        return (
                          <button
                            key={len}
                            type="button"
                            disabled={!from}
                            title={from ? undefined : `No ${len}-day run is free in the booking window`}
                            onClick={() => {
                              if (!from) return;
                              setStartsOn(from);
                              setEndsOn(addDays(from, len - 1));
                              setAvailability({ state: "idle" });
                              clearErrors("endsOn");
                              clearErrors("startsOn");
                            }}
                            className={cn("inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-medium transition-colors num disabled:cursor-not-allowed disabled:opacity-40", on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}
                          >
                            {len} days
                          </button>
                        );
                      })}
                  </div>
                  <DatesStatus startsOn={startsOn} endsOn={endsOn} days={days} clashes={clashes} availability={availability} error={errors.startsOn ?? errors.endsOn} price={price} />
                </Section>
              )}

              {step === "target" && placement && (
                <Section title="Where should clicks go?" note="Every click goes through MarchGear first so it can be counted. Links to MarchGear pages carry a tag, so quote requests from your ad show up as ad enquiries.">
                  <div role="radiogroup" aria-label="Link to" className="space-y-2.5">
                    {(placement.format === "sponsored_listing" ? (["product"] as TargetKind[]) : (["product", "provider", "path", "url"] as TargetKind[])).map((k) => {
                      const on = target.kind === k;
                      const unavailable = (k === "product" && !products.length) || (k === "provider" && !provider);
                      const Icon = { product: Package, provider: Landmark, path: FileText, url: Globe }[k];
                      return (
                        <div key={k} className={cn("border bg-white transition-colors", on ? "border-ink" : "border-line", unavailable && "opacity-60")}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={on}
                            disabled={unavailable}
                            onClick={() => {
                              setTarget((t) => ({ ...t, kind: k }));
                              clearErrors("target");
                            }}
                            className="flex w-full items-start gap-3 p-4 text-left disabled:cursor-not-allowed"
                          >
                            <span className={cn("mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border", on ? "border-red bg-red text-white" : "border-line")}>{on && <Check aria-hidden className="size-3" />}</span>
                            <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                            <span className="min-w-0">
                              <span className="block text-[14px] font-medium">{TARGET_KIND_LABEL[k]}</span>
                              <span className="mt-0.5 block text-[12.5px] text-muted">
                                {k === "product" && (products.length ? "Opens the product page, where customers can ask you for a quote." : "You don't have any published products yet.")}
                                {k === "provider" && (provider ? `Opens ${provider.name} on MarchGear.` : "Your company doesn't have a provider page on MarchGear yet.")}
                                {k === "path" && "Any public page on MarchGear, e.g. a guide or the renewal page."}
                                {k === "url" && "Your own site. Must be https://. Enquiries there aren't counted by MarchGear."}
                              </span>
                            </span>
                          </button>
                          {on && k === "product" && products.length > 0 && (
                            <div className="border-t border-line px-4 pb-4 pt-3 sm:pl-[3.25rem]">
                              <SelectField
                                label="Product"
                                value={target.productId}
                                onChange={(e) => {
                                  setTarget((t) => ({ ...t, productId: e.target.value }));
                                  clearErrors("target");
                                }}
                                placeholder="Choose a product"
                                options={products.map((p) => ({ value: String(p.id), label: `${p.name} · ${INS_PRODUCT_CATEGORY_LABEL[p.category as InsProductCategory] ?? p.category}` }))}
                                error={errors["target.productId"]}
                              />
                              {product && (
                                <a href={`/insurance/products/${product.reference}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-red hover:underline">
                                  Open the product page <ExternalLink aria-hidden className="size-3.5" />
                                </a>
                              )}
                            </div>
                          )}
                          {on && k === "path" && (
                            <div className="border-t border-line px-4 pb-4 pt-3 sm:pl-[3.25rem]">
                              <TextField
                                label="Page on MarchGear"
                                value={target.path}
                                onChange={(e) => {
                                  setTarget((t) => ({ ...t, path: e.target.value }));
                                  clearErrors("target");
                                }}
                                placeholder="/insurance/renewal"
                                hint="Starts with /. Admin and portal pages aren't allowed."
                                error={errors["target.path"]}
                                maxLength={300}
                              />
                            </div>
                          )}
                          {on && k === "url" && (
                            <div className="border-t border-line px-4 pb-4 pt-3 sm:pl-[3.25rem]">
                              <TextField
                                label="Web address"
                                type="url"
                                inputMode="url"
                                value={target.url}
                                onChange={(e) => {
                                  setTarget((t) => ({ ...t, url: e.target.value }));
                                  clearErrors("target");
                                }}
                                placeholder="https://www.example.com/offer"
                                hint="MarchGear checks the link when it reviews your booking."
                                error={errors["target.url"]}
                                maxLength={300}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {errors["target.kind"] && <p className="mt-2 text-[12.5px] text-red">{errors["target.kind"]}</p>}
                  {placement.format === "sponsored_listing" && (
                    <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
                      Your product is shown with its own name, cover and indicative premium, marked <strong className="font-semibold text-ink">Sponsored</strong>. Only published products appear — if the product is unpublished during the booking, the listing pauses.
                    </p>
                  )}
                </Section>
              )}

              {step === "creative" && placement && (
                <Section title="Add your banners" note="Upload a wide desktop banner and a taller mobile banner (JPEG, PNG or WebP, up to 900 KB each). MarchGear reviews them with the booking.">
                  <CreativeFields
                    value={creative}
                    onChange={(c) => {
                      setCreative(c);
                      clearErrors("creative");
                    }}
                    errors={errors}
                    sizes={placement}
                    advertiser={advertiser}
                    renderImage={(p) => <BannerUpload {...p} />}
                  />
                </Section>
              )}

              {step === "review" && placement && (
                <Section title="Review and submit" note="Check the details. Nothing is charged now.">
                  <div className="space-y-4">
                    <TextField
                      label="Campaign name (for your records)"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        clearErrors("name");
                      }}
                      placeholder={defaultName}
                      maxLength={160}
                      hint={name ? undefined : `Leave empty to use “${defaultName}”`}
                      error={errors.name}
                    />
                    <div className="border border-line bg-white">
                      <ReviewRow label="Placement" onEdit={() => goTo("placement")}>
                        {placement.name} <span className="text-muted">· {AD_FORMAT_LABEL[placement.format]}</span>
                      </ReviewRow>
                      <ReviewRow label="Dates" onEdit={() => goTo("dates")}>
                        {startsOn && endsOn ? `${rangeLabel(startsOn, endsOn)} · ${days} days` : "—"}
                      </ReviewRow>
                      <ReviewRow label="Link" onEdit={() => goTo("target")}>
                        {target.kind === "product" ? (product ? `${product.name} (product page)` : "—") : target.kind === "provider" ? `${provider?.name ?? "Provider"} (provider page)` : target.kind === "path" ? target.path : target.url}
                      </ReviewRow>
                      {placement.format === "banner" && (
                        <ReviewRow label="Creative" onEdit={() => goTo("creative")}>
                          <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                            {creative.desktopImage && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img loading="lazy" decoding="async" src={creative.desktopImage} alt="" className="aspect-[4/1] w-full max-w-[180px] shrink-0 rounded-[2px] object-cover ring-1 ring-line sm:w-36" />
                            )}
                            <span className="min-w-0">
                              <span className="block break-words">{creative.headline || creative.alt || "Banner"}</span>
                              <span className="block text-[12px] text-muted">Desktop and mobile banners · reviewed by MarchGear</span>
                            </span>
                          </span>
                        </ReviewRow>
                      )}
                    </div>

                    {price && (
                      <div className="border border-line bg-white p-5">
                        <p className="type-eyebrow text-muted">Price</p>
                        <dl className="mt-3 space-y-2 text-[14px]">
                          <div className="flex justify-between gap-4">
                            <dt className="text-muted num">
                              {rupees(placement.pricePerDay)} × {days} day{days === 1 ? "" : "s"}
                            </dt>
                            <dd className="num">{rupees(price.amount)}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-muted">GST (18%)</dt>
                            <dd className="num">{rupees(price.gst)}</dd>
                          </div>
                          <div className="flex justify-between gap-4 border-t border-line pt-3">
                            <dt className="font-semibold">Total</dt>
                            <dd className="font-display text-[22px] font-semibold tracking-[-0.02em] num">{rupees(price.total)}</dd>
                          </div>
                        </dl>
                      </div>
                    )}

                    <Callout tone="neutral" icon={<FileText />} title="How payment works">
                      Nothing is charged now and there&apos;s no card payment. When MarchGear approves the booking, an invoice for {price ? rupees(price.total) : "the total"} is raised in your portal. Pay it by bank transfer (or UPI / cheque) using the details on the invoice — by the start date or within the payment terms, whichever is sooner — and record the reference there.
                    </Callout>

                    <label className={cn("flex cursor-pointer items-start gap-3 border bg-white px-4 py-3.5", errors.confirm ? "border-red" : "border-line")}>
                      <input
                        type="checkbox"
                        checked={confirm}
                        onChange={(e) => {
                          setConfirm(e.target.checked);
                          clearErrors("confirm");
                        }}
                        className="mt-0.5 size-4 shrink-0 accent-[var(--color-red)]"
                      />
                      <span className="text-[13px] leading-relaxed">
                        We have the rights to these images and claims, the advertised product details are accurate, and we&apos;ll pay MarchGear&apos;s invoice for this booking if it&apos;s approved.
                        {errors.confirm && <span className="mt-1 block text-[12px] text-red">{errors.confirm}</span>}
                      </span>
                    </label>
                  </div>
                </Section>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            {index > 0 ? (
              <Button variant="ghost" onClick={() => goTo(steps[index - 1])} icon={<ArrowLeft className="size-4" aria-hidden />}>
                {STEP_INFO[steps[index - 1]].title}
              </Button>
            ) : (
              <Button href="/insurance-vendor/advertising" variant="ghost">
                Cancel
              </Button>
            )}
            {step === "review" ? (
              <Button size="lg" onClick={submit} disabled={submitting} icon={submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}>
                {submitting ? "Submitting…" : "Submit for approval"}
              </Button>
            ) : (
              <Button variant="dark" onClick={next} disabled={step === "dates" && availability.state === "checking"}>
                Continue to {STEP_INFO[steps[index + 1]].title.toLowerCase()} <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>

        {/* Summary */}
        <aside className="lg:block">
          <div className="sticky top-24 border border-line bg-white">
            <div className="border-b border-line px-5 py-4">
              <p className="type-eyebrow text-muted">Your booking</p>
              <p className="mt-2 text-[15px] font-semibold leading-snug">{placement?.name ?? "Choose a placement"}</p>
              {placement && <p className="mt-0.5 text-[12.5px] text-muted">{placement.location}</p>}
            </div>
            <dl className="space-y-2.5 px-5 py-4 text-[13px]">
              <SummaryRow label="Rate">{placement ? `${rupees(placement.pricePerDay)}/day` : "—"}</SummaryRow>
              <SummaryRow label="Dates">{startsOn && endsOn ? rangeLabel(startsOn, endsOn) : startsOn ? `From ${dayLabel(startsOn)}` : "—"}</SummaryRow>
              <SummaryRow label="Days">{days || "—"}</SummaryRow>
              <SummaryRow label="Before GST">{price ? rupees(price.amount) : "—"}</SummaryRow>
              <SummaryRow label="GST 18%">{price ? rupees(price.gst) : "—"}</SummaryRow>
            </dl>
            <div className="flex items-baseline justify-between border-t border-line px-5 py-4">
              <span className="text-[13px] font-semibold">Total</span>
              <span className="font-display text-[22px] font-semibold tracking-[-0.02em] num">{price ? rupees(price.total) : "—"}</span>
            </div>
            <p className="border-t border-line bg-[#F6F6F6] px-5 py-3 text-[11.5px] leading-relaxed text-muted">Invoiced on approval · bank transfer, UPI or cheque · no card payment</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] md:text-[24px]">{title}</h2>
      {note && <p className="mb-5 mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">{note}</p>}
      {children}
    </section>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium num">{children}</dd>
    </div>
  );
}

function ReviewRow({ label, children, onEdit }: { label: string; children: ReactNode; onEdit: () => void }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-start gap-3 border-b border-line px-4 py-3 text-[13.5px] last:border-b-0 sm:grid-cols-[110px_minmax(0,1fr)_auto]">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
      <button type="button" onClick={onEdit} className="text-[12.5px] font-medium text-red hover:underline">
        Edit
      </button>
    </div>
  );
}

function DatesStatus({ startsOn, endsOn, days, clashes, availability, error, price }: { startsOn: string; endsOn: string; days: number; clashes: string[]; availability: Availability; error?: string; price: { total: number } | null }) {
  if (!startsOn || !endsOn) return error ? <p className="mt-3 text-[12.5px] text-red">{error}</p> : null;
  const full = clashes.length ? clashes : availability.state === "full" ? availability.days : [];
  if (full.length)
    return (
      <Callout tone="red" icon={<AlertTriangle />} title="Some days are sold out" className="mt-4">
        Every slot is taken on {full.slice(0, 4).map((d) => dayLabel(d, false)).join(", ")}
        {full.length > 4 ? ` and ${full.length - 4} more` : ""}. Choose a range without them.
      </Callout>
    );
  if (error)
    return (
      <Callout tone="amber" icon={<AlertTriangle />} className="mt-4">
        {error}
      </Callout>
    );
  return (
    <div className="mt-4 flex items-start gap-3 border border-line bg-white px-4 py-3 text-[13px]" role="status" aria-live="polite">
      {availability.state === "checking" || availability.state === "idle" ? (
        <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-muted" />
      ) : availability.state === "ok" ? (
        <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-[#1e7a3c]" />
      ) : (
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-[#9a5b00]" />
      )}
      <span>
        <span className="font-medium">
          {availability.state === "ok" ? "Available" : availability.state === "error" ? availability.message : "Checking availability…"} · {rangeLabel(startsOn, endsOn)}
        </span>
        <span className="block text-muted num">
          {days} days{price ? ` · ${rupees(price.total)} incl. GST` : ""}
        </span>
      </span>
    </div>
  );
}

function Submitted({ done }: { done: { id: number; reference: string; total: number } }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="mx-auto max-w-2xl border border-line bg-white px-6 py-14 text-center md:px-12">
      <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.15 }} className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-red text-white">
        <Check className="size-7" strokeWidth={2.5} aria-hidden />
      </motion.span>
      <h2 className="type-h2 mt-6">Sent for approval</h2>
      <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-muted">
        MarchGear reviews the booking and its creatives. You&apos;ll get a notification when it&apos;s decided; once approved, an invoice for {rupees(done.total)} appears in your portal, payable by bank transfer.
      </p>
      <div className="mx-auto mt-6 inline-flex items-center gap-3 border border-line px-4 py-2.5 text-[13px]">
        <span className="text-muted">Booking reference</span>
        <span className="font-mono font-semibold tracking-wider">{done.reference}</span>
      </div>
      <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
        <Button href={`/insurance-vendor/advertising/${done.id}`} variant="dark">
          View booking
        </Button>
        <Button href="/insurance-vendor/advertising/new" variant="outline" icon={<Plus className="size-4" aria-hidden />}>
          Book another
        </Button>
        <Link href="/insurance-vendor/advertising" className="inline-flex h-11 items-center justify-center gap-2 px-4 text-[14px] font-medium text-ink/80 hover:text-ink">
          <Building2 className="size-4" aria-hidden /> Advertising
        </Link>
      </div>
    </motion.div>
  );
}
