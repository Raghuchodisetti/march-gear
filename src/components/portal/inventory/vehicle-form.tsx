"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Check, Circle, CirclePause, Eye, History, Library, Loader2, Rocket, Save, Send } from "lucide-react";
import type { PartnerVehicleStatus } from "@/db/enums";
import type { CarModel } from "@/types";
import type { ActionFailure } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { formatINR, formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/field";
import { formatDateTime } from "@/components/portal/ui";
import { DocumentUploader, ImageUploader } from "@/components/portal/uploader";
import { useCatalog } from "@/components/providers/catalog-provider";
import { useCarDetails } from "@/components/providers/car-details";
import { CarImage } from "@/components/vehicle/car-image";
import { useUI } from "@/components/providers/app-provider";
import { saveVehicleAction } from "@/server/actions/partner-inventory";
import { ConfirmDialog, HistoryDrawer, PreviewModal, RemarksCallout, StatusBadge } from "./dialogs";
import {
  CONDITION_GRADES,
  INDIAN_STATES,
  INSURANCE_OPTIONS,
  LIVE,
  MAX_CONDITION_NOTES,
  MAX_IMAGES,
  MAX_WAITING_WEEKS,
  MIN_CONDITION_NOTES,
  MIN_YEAR,
  PRICE_BAND,
  REQUEST_MODEL_HREF,
  catalogueSpecs,
  currentYear,
  emptyUsed,
  formToPublic,
  priceBand,
  type PublicVehicle,
  type UsedFormValue,
  type VehicleFormValue,
} from "./shared";

/* ──────────────────────────────────────────────────────────────
   Add / edit a vehicle. The car is always picked from MarchGear's
   catalogue (brand → model → variant → colour) — its names, specs,
   features and new-car photos come from there, never from here.
   New cars: the dealer adds price, availability and showroom, and
   publishing puts the listing live at once. Used cars: the dealer
   adds that car's own facts and photos, and MarchGear reviews it.
   ────────────────────────────────────────────────────────────── */

export interface VehicleFormProps {
  vehicle?: {
    id: number;
    reference: string;
    status: PartnerVehicleStatus;
    adminRemarks: string | null;
    updatedAt: string;
    submittedAt: string | null;
    publicHref: string | null;
    /** Set when the stored model or variant is no longer in the catalogue: what the listing said. */
    listedAs: string | null;
  };
  initial: VehicleFormValue;
  /** The listing's catalogue model in full, from the server (others load when picked). */
  initialCar?: CarModel;
  showrooms: { id: number; name: string; city: string; address: string; isPrimary: boolean }[];
  /** Approved brand authorisations and the line-up ticked on /dealer/models. */
  lineups: { brand: string; models: string[]; variants: string[] }[];
  partnerId: number;
  dealer: PublicVehicle["dealer"];
}

type Intent = "draft" | "submit" | "publish" | "pause";

const OTHER = "__other";
const control =
  "h-12 w-full rounded-[3px] border border-line bg-white px-4 text-[15px] text-ink placeholder:text-muted outline-none transition-[border-color] duration-[250ms] hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red disabled:cursor-not-allowed disabled:bg-mist disabled:text-muted";

const toInt = (v: string) => {
  const n = Number(v.replace(/[,\s₹]/g, ""));
  return v.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/* ── Small building blocks ──────────────────────────────────── */

function Section({ index, title, description, children, action }: { index: string; title: string; description?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border border-line bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 md:px-6">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 font-mono text-[11.5px] text-red num">{index}</span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

function Field({
  name,
  label,
  hint,
  error,
  optional,
  wide,
  children,
  htmlFor,
}: {
  name: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  wide?: boolean;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div data-field={name} className={cn("min-w-0", wide && "sm:col-span-2")}>
      <label htmlFor={htmlFor} className="mb-2 block text-[12.5px] font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-red">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={error ? true : undefined} className={cn(control, "cursor-pointer appearance-none truncate pr-10")}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="m4 6 4 4 4-4" />
      </svg>
    </div>
  );
}

function Money({ id, value, onChange, error, placeholder }: { id: string; value: string; onChange: (v: string) => void; error?: string; placeholder: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-muted">₹</span>
      <input id={id} inputMode="numeric" className={cn(control, "pl-9 num")} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-invalid={error ? true : undefined} />
    </div>
  );
}

/** The one rule of the inventory, said plainly wherever the dealer picks a car. */
function CatalogueRule({ isUsed }: { isUsed: boolean }) {
  return (
    <div className="flex gap-3 border border-line bg-[#fafafa] px-4 py-3.5 text-[13.5px] leading-relaxed text-ink/85" role="note">
      <Library aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
      <p>
        <span className="font-semibold text-ink">Cars come from MarchGear&rsquo;s catalogue.</span>{" "}
        {isUsed
          ? "The model's specifications and features are filled in from it — you add this car's own history, condition and photos."
          : "Names, specifications, features and photos are filled in from it — you add your colour, price, stock and showroom."}{" "}
        Can&rsquo;t find a model?{" "}
        <Link href={REQUEST_MODEL_HREF} className="font-medium text-red underline-offset-4 hover:underline">
          Ask MarchGear support to add it
        </Link>
        .
      </p>
    </div>
  );
}

/** What the catalogue says about the chosen car — read-only, so the dealer sees exactly what buyers will. */
function CatalogueCard({ car, variantSlug, brandName, isUsed }: { car: CarModel; variantSlug: string; brandName: string; isUsed: boolean }) {
  const variant = car.variants.find((x) => x.slug === variantSlug);
  const specs = catalogueSpecs(car, variant)
    .filter((s) => ["Engine", "Power", "Mileage", "Range", "Seating", "Safety rating"].includes(s.label))
    .slice(0, 4);
  return (
    <div className="mt-5 grid grid-cols-1 overflow-hidden border border-line sm:grid-cols-[200px_minmax(0,1fr)]">
      <div className="relative aspect-[16/10] bg-mist sm:aspect-auto sm:min-h-[150px]">
        <CarImage car={car} alt={`${brandName} ${car.name}`} sizes="(min-width: 640px) 200px, 100vw" className="object-cover" style={car.focus ? { objectPosition: car.focus } : undefined} />
      </div>
      <div className="min-w-0 p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">From the MarchGear catalogue</p>
        <p className="mt-1.5 text-[16px] font-semibold leading-snug">
          {brandName} {car.name}
          <span className="font-normal text-muted">{variant ? ` · ${variant.name}` : ""}</span>
        </p>
        <p className="mt-1 text-[13px] text-ink/75">
          {variant ? `${variant.fuel} · ${variant.transmission} · ${car.bodyType}` : `${car.bodyType} · ${car.variants.length} variant${car.variants.length === 1 ? "" : "s"} — choose one`}
          {variant ? (
            <span className="text-muted">
              {" "}
              · {isUsed ? "new today " : "ex-showroom "}
              <span className="num">{formatPrice(variant.price)}</span>
            </span>
          ) : null}
        </p>
        {specs.length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-[12.5px]">
            {specs.map((s) => (
              <div key={s.label} className="min-w-0">
                <dt className="text-muted">{s.label}</dt>
                <dd className="truncate font-medium num">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
          <span>{isUsed ? "Specs and features shown from the catalogue" : "Specs, features and photos shown from the catalogue"}</span>
          <a href={`/cars/${car.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline">
            Model page <ArrowUpRight aria-hidden className="size-3.5 text-red" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </p>
      </div>
    </div>
  );
}

const isLight = (hex: string) => {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return false;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
};

/** Factory colours as a radio group of swatches. */
function ColourPicker({ car, value, onChange, error, id }: { car: CarModel; value: string; onChange: (v: string) => void; error?: string; id: string }) {
  return (
    <div role="radiogroup" aria-labelledby={id} aria-invalid={error ? true : undefined} className="flex flex-wrap gap-2">
      {car.colors.map((c) => {
        const on = value === c.name;
        return (
          <button
            key={c.name}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c.name)}
            className={cn(
              "inline-flex h-11 items-center gap-2.5 rounded-[3px] border bg-white pl-2.5 pr-3.5 text-[13.5px] transition-[border-color,box-shadow] duration-[250ms]",
              on ? "border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]" : error ? "border-red/60 hover:border-ink/40" : "border-line hover:border-ink/40",
            )}
          >
            <span aria-hidden className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-black/10" style={{ backgroundColor: c.hex }}>
              {on && <Check className={cn("size-3.5", isLight(c.hex) ? "text-ink" : "text-white")} strokeWidth={3} />}
            </span>
            <span className={cn("whitespace-nowrap", on && "font-medium")}>{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── The form ───────────────────────────────────────────────── */

export function VehicleForm({ vehicle, initial, initialCar, showrooms, lineups, partnerId, dealer }: VehicleFormProps) {
  const router = useRouter();
  const { toast } = useUI();
  const cat = useCatalog();
  const uid = useId();
  const fid = (k: string) => `${uid}-${k}`;

  const [v, setV] = useState<VehicleFormValue>(() => {
    const room = !vehicle && !initial.showroomId && showrooms.length ? String((showrooms.find((s) => s.isPrimary) ?? showrooms[0]).id) : initial.showroomId;
    return { ...initial, showroomId: room };
  });
  // A used car's colour may be one the model no longer comes in.
  const [customColour, setCustomColour] = useState(() => {
    const car = initialCar && initialCar.slug === initial.modelSlug ? initialCar : undefined;
    return initial.kind === "used" && Boolean(initial.colour) && !car?.colors.some((c) => c.name === initial.colour);
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Intent | null>(null);
  const [confirm, setConfirm] = useState<"draft" | "submit" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<PublicVehicle | null>(null);
  const [history, setHistory] = useState(false);

  const status = vehicle?.status;
  const isUsed = v.kind === "used";
  const usedLive = isUsed && status ? LIVE.includes(status) : false;
  const isLiveNew = !isUsed && status === "published";
  // Published but hidden from the website until the dealer picks a catalogue model.
  const hiddenLegacy = Boolean(vehicle?.listedAs);
  const staffPaused = !isUsed && status === "unpublished" && Boolean(vehicle?.adminRemarks);
  const found = v.modelSlug ? cat.getCar(v.modelSlug) : undefined;
  // The browser's catalogue is light; colours and specs of the chosen model load on demand (the initial one comes from the server).
  const chosen = found && found.brand === v.brand ? found : undefined;
  const details = useCarDetails(chosen ? [chosen.slug] : [], initialCar ? [initialCar] : undefined);
  const car = chosen ? details.get(chosen.slug) : undefined;
  const loadingCar = Boolean(chosen && !car);
  const variant = car?.variants.find((x) => x.slug === v.variantSlug);
  const year = currentYear();

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const clear = (...keys: string[]) =>
    setErrors((e) => {
      if (!keys.some((k) => Object.keys(e).some((x) => x === k || x.startsWith(`${k}.`)))) return e;
      const n = { ...e };
      for (const k of Object.keys(n)) if (keys.some((key) => k === key || k.startsWith(`${key}.`))) delete n[k];
      return n;
    });
  const patch = (p: Partial<VehicleFormValue>) => {
    setV((x) => ({ ...x, ...p }));
    setDirty(true);
    clear(...Object.keys(p));
  };
  const patchUsed = (p: Partial<UsedFormValue>) => {
    setV((x) => ({ ...x, used: { ...x.used, ...p } }));
    setDirty(true);
    clear(...Object.keys(p).map((k) => `used.${k}`));
  };
  const err = (k: string) => errors[k];

  /* Catalogue cascade — new cars are limited to the approved brands and the dealer's line-up. */
  const lineup = lineups.find((l) => l.brand === v.brand);
  const withCars = cat.brands.filter((b) => cat.carsByBrand(b.slug).length > 0);
  const brandOptions = (isUsed ? withCars : withCars.filter((b) => lineups.some((l) => l.brand === b.slug)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((b) => ({ value: b.slug, label: b.name }));
  // A listing keeps its own model and variant even if the dealer has since narrowed the line-up.
  const narrowedModels = !isUsed && lineup?.models.length ? lineup.models : null;
  const modelOptions = !v.brand
    ? []
    : cat
        .carsByBrand(v.brand)
        .filter((c) => !narrowedModels || narrowedModels.includes(c.slug) || c.slug === initial.modelSlug)
        .map((c) => ({ value: c.slug, label: narrowedModels && !narrowedModels.includes(c.slug) ? `${c.name} (not in your line-up)` : c.name }));
  const tickedVariants = car && !isUsed && lineup ? lineup.variants.filter((k) => k.startsWith(`${car.slug}/`)) : [];
  const variantOptions = !car
    ? []
    : car.variants
        .filter((x) => !tickedVariants.length || tickedVariants.includes(`${car.slug}/${x.slug}`) || (car.slug === initial.modelSlug && x.slug === initial.variantSlug))
        .map((x) => ({ value: x.slug, label: `${x.name} · ${x.fuel} ${x.transmission} · ${formatPrice(x.price)}` }));
  const noBrands = !isUsed && brandOptions.length === 0;

  const onKind = (kind: "new" | "used") => {
    if (vehicle || kind === v.kind) return;
    const keepBrand = kind === "used" || lineups.some((l) => l.brand === v.brand);
    patch({
      kind,
      year: "",
      used: emptyUsed(),
      images: [],
      stock: "1",
      availability: "in_stock",
      ...(keepBrand ? {} : { brand: "", modelSlug: "", variantSlug: "", colour: "" }),
    });
    setCustomColour(false);
  };
  const onBrand = (brand: string) => {
    if (brand === v.brand) return;
    patch({ brand, modelSlug: "", variantSlug: "", colour: "" });
    setCustomColour(false);
  };
  const onModel = (slug: string) => {
    const c = cat.getCar(slug);
    const colours = c ? details.get(c.slug)?.colors : undefined;
    const keepColour = !!c && (customColour || Boolean(colours?.some((x) => x.name === v.colour)));
    patch({ modelSlug: c ? c.slug : "", variantSlug: "", colour: keepColour ? v.colour : "" });
    if (!keepColour) setCustomColour(false);
  };

  /* Price check (mirrors the server) */
  const price = toInt(v.sellingPrice);
  const band = variant ? priceBand(variant.price) : null;
  const outOfBand = Boolean(!isUsed && price && band && (price < band.min || price > band.max));
  const diff = price && variant ? price - variant.price : null;

  /* Readiness (mirrors the server's checks) */
  const u = v.used;
  const checks = !isUsed
    ? [
        { label: "Catalogue car — brand, model and variant", ok: Boolean(car && variant) },
        { label: "Factory colour", ok: Boolean(car && (car.colors.length ? car.colors.some((c) => c.name === v.colour) : true)) },
        { label: "Selling price within the allowed range", ok: Boolean(price && !outOfBand && variant) },
        { label: v.availability === "on_order" ? "Expected waiting period" : "Units in stock", ok: v.availability === "on_order" ? Boolean(toInt(v.waitingWeeks)) : (toInt(v.stock) ?? 0) >= 1 },
        ...(showrooms.length ? [{ label: "Showroom", ok: Boolean(v.showroomId) }] : []),
      ]
    : [
        { label: "Catalogue car and manufacturing year", ok: Boolean(car && variant && v.year) },
        { label: "Asking price and colour", ok: Boolean(price && v.colour) },
        ...(showrooms.length ? [{ label: "Showroom", ok: Boolean(v.showroomId) }] : []),
        { label: "Registration and odometer", ok: Boolean(u.registrationYear && u.km !== "" && u.owners && u.registrationNumber && u.registrationState) },
        {
          label: "Accident and insurance",
          ok: Boolean(u.accident && (u.accident === "no" || u.accidentDetails.trim().length >= 10) && u.insuranceStatus && (u.insuranceStatus === "expired" || u.insuranceStatus === "none" || u.insuranceValidUntil)),
        },
        { label: "Condition grade and notes", ok: Boolean(u.condition && u.conditionNotes.trim().length >= MIN_CONDITION_NOTES) },
        { label: "At least one photo of the car", ok: v.images.length > 0 },
      ];
  const ready = checks.every((c) => c.ok);

  /* Saving */
  const save = async (intent: Intent, acknowledgeLive = false) => {
    setSaving(intent);
    setConfirm(null);
    const res = await saveVehicleAction({ id: vehicle?.id, intent, acknowledgeLive, values: v }).catch((): ActionFailure => ({ ok: false, error: "Couldn't reach the server. Please try again." }));
    setSaving(null);
    if (!res.ok) {
      const fe = res.fieldErrors ?? {};
      setErrors(fe);
      toast(res.error ?? "Couldn't save. Please try again.", { tone: "error" });
      const keys = Object.keys(fe);
      if (keys.length) {
        requestAnimationFrame(() => {
          const el = Array.from(document.querySelectorAll<HTMLElement>("[data-field]")).find((n) => keys.some((k) => k === n.dataset.field || k.startsWith(`${n.dataset.field}.`)));
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
      return;
    }
    setDirty(false);
    setErrors({});
    if (intent === "publish") {
      toast(isLiveNew ? `Changes to ${res.reference} are live` : `${res.reference} is live on MarchGear`, { tone: "success" });
      if (!vehicle) {
        router.push("/dealer/inventory?tab=new&status=published");
        return;
      }
      router.refresh();
      return;
    }
    if (intent === "submit") {
      toast(`${res.reference} sent to MarchGear for approval`, { tone: "success" });
      router.push("/dealer/inventory?status=pending_approval");
      router.refresh();
      return;
    }
    toast(
      intent === "pause"
        ? isLiveNew
          ? `${res.reference} is paused — hidden from the website`
          : vehicle
            ? `${res.reference} saved, not published`
            : `${res.reference} saved without publishing`
        : vehicle
          ? `${res.reference} saved as a draft`
          : `Draft ${res.reference} created`,
      { tone: "success" },
    );
    if (!vehicle) router.replace(`/dealer/inventory/${res.id}`);
    router.refresh();
  };

  const request = (intent: Intent) => {
    if (isUsed && (usedLive || (status === "pending_approval" && intent === "draft"))) setConfirm(intent === "submit" ? "submit" : "draft");
    else save(intent);
  };

  const openPreview = () => {
    const room = showrooms.find((s) => String(s.id) === v.showroomId);
    setPreview(formToPublic(v, car, { id: vehicle?.id, partnerId, reference: vehicle?.reference, dealer, showroom: room ? { name: room.name, city: room.city, address: room.address } : null, year }));
  };

  /* Options */
  const yearOptions = Array.from({ length: year - 1995 + 1 }, (_, i) => String(year - i)).map((y) => ({ value: y, label: y }));
  if (v.year && !yearOptions.some((o) => o.value === v.year)) yearOptions.push({ value: v.year, label: v.year });
  const regYears = Array.from({ length: year - MIN_YEAR + 1 }, (_, i) => String(year - i)).filter((y) => !v.year || Number(y) >= Number(v.year) || y === v.used.registrationYear);
  const busy = saving !== null;
  const order = isUsed ? ["type", "car", "price", "facts", "condition", "photos"] : ["type", "car", "colour", "price", "availability"];
  const idx = (k: string) => String(order.indexOf(k) + 1).padStart(2, "0");
  const brandName = v.brand ? cat.brandName(v.brand) : "";
  const weeks = toInt(v.waitingWeeks);

  const showroomField = (
    <Field name="showroomId" label="Showroom" htmlFor={fid("room")} error={err("showroomId")} hint={showrooms.length ? (isUsed ? "Where buyers can see the car." : "The showroom that sells and delivers it.") : "Add your showrooms under Showrooms to pick one."}>
      <Select
        id={fid("room")}
        value={v.showroomId}
        onChange={(showroomId) => patch({ showroomId })}
        placeholder={showrooms.length ? "Choose a showroom" : "No showrooms yet"}
        options={showrooms.map((s) => ({ value: String(s.id), label: `${s.name} · ${s.city}` }))}
        disabled={!showrooms.length}
        error={err("showroomId")}
      />
    </Field>
  );
  const stockNoField = (
    <Field name="vin" label="Stock number or VIN" htmlFor={fid("vin")} optional error={err("vin")} hint="For your own records. Only your team and MarchGear see it — never shown on the website.">
      <input
        id={fid("vin")}
        className={cn(control, "font-mono uppercase tracking-[0.06em]")}
        value={v.vin}
        onChange={(e) => patch({ vin: e.target.value.toUpperCase() })}
        maxLength={32}
        placeholder="e.g. STK-2041 or MALPC81DLSM104732"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={err("vin") ? true : undefined}
      />
    </Field>
  );

  return (
    // Enter in a field must never publish or submit, so the buttons act directly.
    <form noValidate onSubmit={(e) => e.preventDefault()} className="pb-32">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {vehicle?.listedAs && (
            <div className="flex gap-3 border-l-2 border-red bg-red-50 px-4 py-3" role="alert">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
              <div className="min-w-0 text-[13.5px]">
                <p className="font-semibold text-red">Needs a catalogue model — pick the model to keep this listing</p>
                <p className="mt-0.5 text-ink/85">
                  It was listed as &ldquo;{vehicle.listedAs}&rdquo;, which isn&rsquo;t in MarchGear&rsquo;s catalogue. It&rsquo;s hidden from the website until you choose the model and variant below. Not in the list?{" "}
                  <Link href={REQUEST_MODEL_HREF} className="font-medium text-red underline-offset-4 hover:underline">
                    Ask MarchGear to add it
                  </Link>
                  .
                </p>
              </div>
            </div>
          )}
          {status && <RemarksCallout status={status} remarks={vehicle?.adminRemarks ?? null} />}
          {staffPaused && (
            <div className="flex gap-3 border-l-2 border-[#c98a1b] bg-[#fdf3e1] px-4 py-3" role="note">
              <CirclePause aria-hidden className="mt-0.5 size-4 shrink-0 text-[#9a5b00]" />
              <div className="min-w-0 text-[13.5px]">
                <p className="font-semibold text-[#9a5b00]">Paused by MarchGear</p>
                <p className="mt-0.5 whitespace-pre-line text-ink/85">{vehicle?.adminRemarks}</p>
                <p className="mt-1 text-[12.5px] text-muted">Fix what&rsquo;s needed, then publish again.</p>
              </div>
            </div>
          )}
          {usedLive && (
            <div className="flex gap-3 border-l-2 border-ink bg-white px-4 py-3 text-[13.5px]" role="note">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
              <p>
                <span className="font-semibold">This listing is {status === "published" ? "live on the website" : "approved"}.</span> Saving any change sends it back to MarchGear for approval
                {status === "published" ? " and hides it from buyers until it's approved again" : ""}.
              </p>
            </div>
          )}
          {isLiveNew && !hiddenLegacy && (
            <p className="flex gap-3 border-l-2 border-[#1e7a3c] bg-white px-4 py-3 text-[13.5px]" role="note">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-[#1e7a3c]" strokeWidth={2.5} />
              <span>
                <span className="font-semibold">This listing is live.</span> Changes to price, stock or showroom go live as soon as you save.
              </span>
            </p>
          )}
          {status === "archived" && (
            <p className="border-l-2 border-line bg-white px-4 py-3 text-[13.5px] text-muted" role="note">
              This vehicle is archived. {isUsed ? "Saving restores it as a draft." : "Publishing restores it to your live stock."}
            </p>
          )}

          <Section index={idx("type")} title="Listing type" description={vehicle ? "A listing can't switch between new and used — add another vehicle instead." : "New-car stock goes live when you publish. Used cars are checked by MarchGear first, then also appear on /used-cars."}>
            <Segmented
              ariaLabel="Listing type"
              className="w-full sm:w-80"
              value={v.kind}
              onChange={onKind}
              options={[
                { value: "new", label: "New car" },
                { value: "used", label: "Used car" },
              ]}
            />
            <div className="mt-5">
              <CatalogueRule isUsed={isUsed} />
            </div>
          </Section>

          <Section index={idx("car")} title="Car" description={isUsed ? "Choose the model and variant this car is, from the MarchGear catalogue." : "Choose from your authorised brands and the line-up you sell."}>
            {noBrands ? (
              <div className="border border-dashed border-ink/15 px-5 py-8 text-center">
                <p className="text-[14.5px] font-semibold">No approved brand authorisation yet</p>
                <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">New cars can be listed for brands MarchGear has authorised your dealership to sell. You can still list used cars of any catalogue brand.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button href="/dealer/brands" size="sm" variant="dark">
                    Go to Brands
                  </Button>
                  {!vehicle && (
                    <Button size="sm" variant="outline" onClick={() => onKind("used")}>
                      List a used car
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field name="brand" label="Brand" htmlFor={fid("brand")} error={err("brand")}>
                    <Select id={fid("brand")} value={brandOptions.some((b) => b.value === v.brand) ? v.brand : ""} onChange={onBrand} placeholder="Choose a brand" options={brandOptions} error={err("brand")} />
                  </Field>
                  <Field
                    name="modelSlug"
                    label="Model"
                    htmlFor={fid("model")}
                    error={err("modelSlug")}
                    hint={
                      !isUsed && v.brand && !lineup?.models.length ? (
                        <>
                          Every {brandName} model is shown.{" "}
                          <Link href={`/dealer/models?brand=${encodeURIComponent(v.brand)}`} className="font-medium text-ink underline-offset-4 hover:underline">
                            Pick your line-up
                          </Link>{" "}
                          to shorten the list.
                        </>
                      ) : undefined
                    }
                  >
                    <Select id={fid("model")} value={car ? car.slug : ""} onChange={onModel} placeholder={v.brand ? "Choose a model" : "Choose a brand first"} options={modelOptions} disabled={!v.brand || !modelOptions.length} error={err("modelSlug")} />
                  </Field>
                  <Field name="variantSlug" label="Variant" htmlFor={fid("variant")} error={err("variantSlug")} wide={!isUsed}>
                    <Select id={fid("variant")} value={variant ? variant.slug : ""} onChange={(variantSlug) => patch({ variantSlug })} placeholder={car ? "Choose a variant" : "Choose a model first"} options={variantOptions} disabled={!car} error={err("variantSlug")} />
                  </Field>
                  {isUsed && (
                    <Field name="year" label="Manufacturing year" htmlFor={fid("year")} error={err("year")}>
                      <Select id={fid("year")} value={v.year} onChange={(y) => patch({ year: y })} placeholder="Choose the year" options={yearOptions} error={err("year")} />
                    </Field>
                  )}
                </div>
                {v.brand && modelOptions.length === 0 && <p className="mt-3 text-[13px] text-muted">No {brandName} models in your line-up yet.</p>}
                {car && <CatalogueCard car={car} variantSlug={v.variantSlug} brandName={brandName} isUsed={isUsed} />}
                {loadingCar && <div className="mt-5 h-[150px] animate-shimmer border border-line bg-[linear-gradient(90deg,var(--color-mist)_0%,#fafafa_50%,var(--color-mist)_100%)] bg-[length:200%_100%]" aria-busy="true" aria-label="Loading the catalogue details" />}
              </>
            )}
          </Section>

          {!isUsed && !noBrands && (
            <Section index={idx("colour")} title="Colour" description={car ? (car.colors.length ? `${car.colors.length} factory colours for the ${car.name}.` : undefined) : loadingCar ? "Loading the factory colours…" : "Choose the model first."}>
              <div data-field="colour">
                <p id={fid("colour")} className="sr-only">
                  Colour
                </p>
                {car?.colors.length ? (
                  <ColourPicker id={fid("colour")} car={car} value={v.colour} onChange={(colour) => patch({ colour })} error={err("colour")} />
                ) : car ? (
                  <p className="text-[13.5px] text-muted">
                    The catalogue doesn&rsquo;t list colours for this model yet, so buyers will be told to ask the showroom.{" "}
                    <Link href={REQUEST_MODEL_HREF} className="font-medium text-ink underline-offset-4 hover:underline">
                      Ask MarchGear to add them
                    </Link>
                  </p>
                ) : (
                  <p className="text-[13.5px] text-muted">The model&rsquo;s factory colours appear here.</p>
                )}
                {err("colour") && <p className="mt-2 text-xs text-red">{err("colour")}</p>}
              </div>
            </Section>
          )}

          {!noBrands && (
            <Section index={idx("price")} title={isUsed ? "Price & showroom" : "Price"} description={isUsed ? "Buyers see your asking price." : "Buyers see your selling price, with the catalogue ex-showroom price beside it."}>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  name="sellingPrice"
                  label={isUsed ? "Asking price" : "Your selling price"}
                  htmlFor={fid("price")}
                  error={err("sellingPrice")}
                  hint={price ? formatPrice(price) : isUsed ? "Your price to the buyer" : "Your price to the buyer, before on-road charges"}
                >
                  <Money id={fid("price")} value={v.sellingPrice} onChange={(sellingPrice) => patch({ sellingPrice })} error={err("sellingPrice")} placeholder={variant ? String(variant.price) : "e.g. 1199000"} />
                </Field>

                {isUsed ? (
                  <div className="min-w-0 self-start border border-line bg-[#fafafa] px-4 py-3 text-[13px]">
                    <p className="text-[12px] text-muted">New price today (catalogue)</p>
                    <p className="mt-0.5 text-[16px] font-semibold num">{variant ? formatINR(variant.price) : "—"}</p>
                    {price && variant ? (
                      <p className={cn("mt-1 text-[12.5px] num", price >= variant.price ? "text-[#9a5b00]" : "text-muted")}>
                        {price >= variant.price ? "At or above the new-car price — MarchGear will ask about it" : `${Math.round((1 - price / variant.price) * 100)}% below the new-car price`}
                      </p>
                    ) : (
                      <p className="mt-1 text-[12.5px] text-muted">{variant ? "For reference only." : "Choose the variant to compare."}</p>
                    )}
                  </div>
                ) : (
                  <div className={cn("min-w-0 self-start border px-4 py-3 text-[13px] transition-colors duration-300", outOfBand ? "border-red/40 bg-red-50/60" : "border-line bg-[#fafafa]")}>
                    <p className="text-[12px] text-muted">Catalogue ex-showroom</p>
                    <p className="mt-0.5 text-[16px] font-semibold num">{variant ? formatINR(variant.price) : "—"}</p>
                    {band ? (
                      <p className="mt-1 text-[12.5px] text-muted num">
                        Allowed: {formatINR(band.min)} – {formatINR(band.max)}
                      </p>
                    ) : (
                      <p className="mt-1 text-[12.5px] text-muted">Choose the variant to see it.</p>
                    )}
                    {diff !== null && variant && !outOfBand && (
                      <p className={cn("mt-1 text-[12.5px] font-medium num", diff < 0 ? "text-[#1e7a3c]" : diff > 0 ? "text-[#9a5b00]" : "text-muted")}>
                        {diff === 0 ? "Same as ex-showroom" : `${formatINR(Math.abs(diff))} ${diff < 0 ? "below" : "above"} ex-showroom (${diff > 0 ? "+" : "−"}${Math.abs((diff / variant.price) * 100).toFixed(1)}%)`}
                      </p>
                    )}
                    {outOfBand && <p className="mt-1 text-[12.5px] font-medium text-red">Outside the allowed range</p>}
                  </div>
                )}
                {!isUsed && (
                  <p className="text-[12.5px] leading-relaxed text-muted sm:col-span-2">
                    <span className="font-medium text-ink">The price rule:</span> your selling price must be between {PRICE_BAND.min * 100}% and {PRICE_BAND.max * 100}% of the catalogue ex-showroom price of the variant. It catches
                    typing mistakes like a missing zero — any discount or premium inside that range is fine.
                  </p>
                )}
                {isUsed && showroomField}
                {isUsed && vehicle && (
                  <div data-field="stock" className="min-w-0">
                    <p className="mb-2 block text-[12.5px] font-medium text-ink">Availability</p>
                    <Segmented
                      ariaLabel="Availability"
                      className="w-full"
                      value={v.stock === "0" ? "0" : "1"}
                      onChange={(stock) => patch({ stock })}
                      options={[
                        { value: "1", label: "Available" },
                        { value: "0", label: "Sold" },
                      ]}
                    />
                    {err("stock") ? <p className="mt-1.5 text-xs text-red">{err("stock")}</p> : <p className="mt-1.5 text-xs text-muted">A sold car shows as sold on /used-cars.</p>}
                  </div>
                )}
                {isUsed && stockNoField}
              </div>
            </Section>
          )}

          {!isUsed && !noBrands && (
            <Section index={idx("availability")} title="Availability & showroom" description="Tell buyers whether the car is ready for delivery or on order.">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div data-field="availability" className="min-w-0 sm:col-span-2">
                  <p className="mb-2 block text-[12.5px] font-medium text-ink">Availability</p>
                  <Segmented
                    ariaLabel="Availability"
                    className="w-full sm:w-96"
                    value={v.availability}
                    onChange={(availability) => patch({ availability, ...(availability === "in_stock" && !toInt(v.stock) ? { stock: "1" } : {}) })}
                    options={[
                      { value: "in_stock", label: "In stock" },
                      { value: "on_order", label: "On order" },
                    ]}
                  />
                </div>
                {v.availability === "in_stock" ? (
                  <Field name="stock" label="Units in stock" htmlFor={fid("stock")} error={err("stock")} hint="Update it any time from the vehicle list. 0 hides the car until it's back.">
                    <input id={fid("stock")} type="number" min={0} max={999} inputMode="numeric" className={cn(control, "num")} value={v.stock} onChange={(e) => patch({ stock: e.target.value })} aria-invalid={err("stock") ? true : undefined} />
                  </Field>
                ) : (
                  <Field
                    name="waitingWeeks"
                    label="Expected waiting period"
                    htmlFor={fid("wait")}
                    error={err("waitingWeeks")}
                    hint={weeks ? `Buyers see “On order · about ${weeks} week${weeks === 1 ? "" : "s"}”.` : `In weeks, from 1 to ${MAX_WAITING_WEEKS}.`}
                  >
                    <div className="relative">
                      <input
                        id={fid("wait")}
                        type="number"
                        min={1}
                        max={MAX_WAITING_WEEKS}
                        inputMode="numeric"
                        className={cn(control, "pr-20 num")}
                        value={v.waitingWeeks}
                        onChange={(e) => patch({ waitingWeeks: e.target.value })}
                        placeholder="e.g. 6"
                        aria-invalid={err("waitingWeeks") ? true : undefined}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">weeks</span>
                    </div>
                  </Field>
                )}
                {showroomField}
                {stockNoField}
              </div>
            </Section>
          )}

          {isUsed && (
            <Section index={idx("facts")} title="This car" description="Its own history — be specific, MarchGear checks these before the car goes live.">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field name="colour" label="Colour" htmlFor={fid("ucolour")} error={err("colour")} wide hint={car?.colors.length && !customColour ? undefined : "As it appears on the registration certificate."}>
                  {car?.colors.length && !customColour ? (
                    <Select
                      id={fid("ucolour")}
                      value={v.colour}
                      onChange={(c) => {
                        if (c === OTHER) {
                          setCustomColour(true);
                          patch({ colour: "" });
                        } else patch({ colour: c });
                      }}
                      placeholder="Choose the colour"
                      options={[...car.colors.map((c) => ({ value: c.name, label: c.name })), { value: OTHER, label: "Another colour (no longer offered)" }]}
                      error={err("colour")}
                    />
                  ) : (
                    <div className="flex gap-2">
                      <input id={fid("ucolour")} className={control} value={v.colour} onChange={(e) => patch({ colour: e.target.value })} placeholder="e.g. Stardust Silver" maxLength={60} aria-invalid={err("colour") ? true : undefined} />
                      {car?.colors.length ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomColour(false);
                            patch({ colour: "" });
                          }}
                          className="shrink-0 px-2 text-[12.5px] font-medium text-muted hover:text-ink"
                        >
                          Factory list
                        </button>
                      ) : null}
                    </div>
                  )}
                </Field>
                <Field name="used.registrationYear" label="Registration year" htmlFor={fid("ry")} error={err("used.registrationYear")}>
                  <Select id={fid("ry")} value={v.used.registrationYear} onChange={(registrationYear) => patchUsed({ registrationYear })} placeholder="Choose" options={regYears.map((y) => ({ value: y, label: y }))} error={err("used.registrationYear")} />
                </Field>
                <Field name="used.km" label="Kilometres driven" htmlFor={fid("km")} error={err("used.km")} hint={v.used.km ? `${Number(v.used.km.replace(/[,\s]/g, "")).toLocaleString("en-IN")} km` : undefined}>
                  <input id={fid("km")} inputMode="numeric" className={cn(control, "num")} value={v.used.km} onChange={(e) => patchUsed({ km: e.target.value })} placeholder="e.g. 32500" aria-invalid={err("used.km") ? true : undefined} />
                </Field>
                <Field name="used.owners" label="Number of owners" htmlFor={fid("own")} error={err("used.owners")}>
                  <Select
                    id={fid("own")}
                    value={v.used.owners}
                    onChange={(owners) => patchUsed({ owners })}
                    placeholder="Choose"
                    options={["1", "2", "3", "4", "5"].map((o) => ({ value: o, label: o === "1" ? "1st owner" : `${o} owners` }))}
                    error={err("used.owners")}
                  />
                </Field>
                <Field name="used.registrationNumber" label="Registration number" htmlFor={fid("reg")} error={err("used.registrationNumber")} hint="Not shown publicly — buyers only see the RTO (e.g. AP-31).">
                  <input
                    id={fid("reg")}
                    className={cn(control, "font-mono uppercase tracking-[0.06em]")}
                    value={v.used.registrationNumber}
                    onChange={(e) => patchUsed({ registrationNumber: e.target.value.toUpperCase() })}
                    placeholder="KA 01 AB 1234"
                    maxLength={16}
                    autoComplete="off"
                    aria-invalid={err("used.registrationNumber") ? true : undefined}
                  />
                </Field>
                <Field name="used.registrationState" label="Registration state" htmlFor={fid("state")} error={err("used.registrationState")}>
                  <Select id={fid("state")} value={v.used.registrationState} onChange={(registrationState) => patchUsed({ registrationState })} placeholder="Choose a state" options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} error={err("used.registrationState")} />
                </Field>

                <fieldset data-field="used.accident" className="min-w-0 sm:col-span-2">
                  <legend className="mb-2 block text-[12.5px] font-medium text-ink">Has the car been in an accident?</legend>
                  <div className="flex flex-wrap gap-2">
                    {(["no", "yes"] as const).map((a) => (
                      <button
                        key={a}
                        type="button"
                        aria-pressed={v.used.accident === a}
                        onClick={() => patchUsed({ accident: a, ...(a === "no" ? { accidentDetails: "" } : {}) })}
                        className={cn(
                          "inline-flex h-11 items-center gap-2 rounded-[3px] border px-4 text-[14px] font-medium transition-colors duration-[250ms]",
                          v.used.accident === a ? "border-ink bg-ink text-white" : err("used.accident") ? "border-red hover:border-ink" : "border-line hover:border-ink/40",
                        )}
                      >
                        {v.used.accident === a && <Check aria-hidden className="size-4" />}
                        {a === "no" ? "No accidents" : "Yes, declare it"}
                      </button>
                    ))}
                  </div>
                  {err("used.accident") && <p className="mt-1.5 text-xs text-red">{err("used.accident")}</p>}
                </fieldset>
                {v.used.accident === "yes" && (
                  <Field name="used.accidentDetails" label="What happened, and what was repaired?" htmlFor={fid("acc")} wide error={err("used.accidentDetails")} hint="Shown to buyers — honesty here builds trust.">
                    <textarea
                      id={fid("acc")}
                      className={cn(control, "h-auto min-h-24 py-3 leading-relaxed")}
                      value={v.used.accidentDetails}
                      onChange={(e) => patchUsed({ accidentDetails: e.target.value })}
                      maxLength={1000}
                      placeholder="e.g. Minor rear-bumper damage in 2024, bumper replaced at the authorised service centre."
                      aria-invalid={err("used.accidentDetails") ? true : undefined}
                    />
                  </Field>
                )}

                <Field name="used.insuranceStatus" label="Insurance" htmlFor={fid("ins")} error={err("used.insuranceStatus")}>
                  <Select
                    id={fid("ins")}
                    value={v.used.insuranceStatus}
                    onChange={(s) => patchUsed({ insuranceStatus: s as UsedFormValue["insuranceStatus"], ...(s === "expired" || s === "none" ? { insuranceValidUntil: "" } : {}) })}
                    placeholder="Choose"
                    options={INSURANCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    error={err("used.insuranceStatus")}
                  />
                </Field>
                {(v.used.insuranceStatus === "comprehensive" || v.used.insuranceStatus === "third_party") && (
                  <Field name="used.insuranceValidUntil" label="Valid until" htmlFor={fid("insd")} error={err("used.insuranceValidUntil")}>
                    <input id={fid("insd")} type="date" className={cn(control, "num")} value={v.used.insuranceValidUntil} onChange={(e) => patchUsed({ insuranceValidUntil: e.target.value })} aria-invalid={err("used.insuranceValidUntil") ? true : undefined} />
                  </Field>
                )}

                <div data-field="used.inspection" className="min-w-0 sm:col-span-2">
                  <DocumentUploader
                    kind="inspection_report"
                    label="Inspection report"
                    value={v.used.inspection}
                    onChange={(inspection) => patchUsed({ inspection })}
                    hint="A recent multi-point inspection (PDF or photo). Private — MarchGear reviews it; buyers see that a report is available."
                    error={err("used.inspection")}
                  />
                </div>
              </div>
            </Section>
          )}

          {isUsed && (
            <Section index={idx("condition")} title="Condition" description="Your honest overall grade, and a few words on anything a buyer should know.">
              <div data-field="used.condition" role="radiogroup" aria-label="Condition grade" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CONDITION_GRADES.map((g) => {
                  const on = v.used.condition === g.value;
                  return (
                    <button
                      key={g.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => patchUsed({ condition: g.value })}
                      className={cn(
                        "flex items-start gap-3 rounded-[3px] border px-4 py-3 text-left transition-[border-color,box-shadow] duration-[250ms]",
                        on ? "border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]" : err("used.condition") ? "border-red/60 hover:border-ink/40" : "border-line hover:border-ink/40",
                      )}
                    >
                      <span aria-hidden className={cn("mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-ink bg-ink" : "border-ink/30")}>
                        {on && <span className="size-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium">{g.label}</span>
                        <span className="block text-[12.5px] text-muted">{g.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {err("used.condition") && <p className="mt-1.5 text-xs text-red">{err("used.condition")}</p>}
              <div data-field="used.conditionNotes" className="mt-5">
                <label htmlFor={fid("notes")} className="mb-2 block text-[12.5px] font-medium text-ink">
                  Condition notes
                </label>
                <textarea
                  id={fid("notes")}
                  className={cn(control, "h-auto min-h-28 py-3 leading-relaxed")}
                  value={v.used.conditionNotes}
                  onChange={(e) => patchUsed({ conditionNotes: e.target.value })}
                  maxLength={MAX_CONDITION_NOTES}
                  placeholder="e.g. Full service history at the authorised workshop, new tyres at 30,000 km, small scratch on the rear bumper."
                  aria-invalid={err("used.conditionNotes") ? true : undefined}
                />
                <div className="mt-1.5 flex justify-between gap-4 text-xs">
                  <span className={err("used.conditionNotes") ? "text-red" : "text-muted"}>{err("used.conditionNotes") ?? "About this car only — the model's specs and features come from the catalogue."}</span>
                  <span className={cn("shrink-0 num", v.used.conditionNotes.trim().length >= MIN_CONDITION_NOTES ? "text-muted" : "text-ink")}>
                    {v.used.conditionNotes.length} / {MAX_CONDITION_NOTES}
                  </span>
                </div>
              </div>
            </Section>
          )}

          {isUsed && (
            <Section index={idx("photos")} title="Photos of this car" description="Real photos of the car you're selling. The first photo is the cover — daylight, front three-quarter works best.">
              <div data-field="images">
                <ImageUploader
                  multiple
                  max={MAX_IMAGES}
                  value={v.images}
                  onChange={(images) => patch({ images })}
                  label="Add photos"
                  hint={`${v.images.length} of ${MAX_IMAGES}. Include the odometer, interior and any marks you've noted. Uploads also appear in your media library.`}
                  error={err("images")}
                />
              </div>
            </Section>
          )}
        </div>

        {/* Status & readiness */}
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="border border-line bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12.5px] font-medium text-muted">{vehicle ? vehicle.reference : "New listing"}</p>
              {status ? <StatusBadge status={status} /> : <span className="text-[12px] text-muted">Not saved yet</span>}
            </div>
            {vehicle && <p className="mt-2 text-[12.5px] text-muted">Last saved {formatDateTime(vehicle.updatedAt)}</p>}
            <h2 className="mt-5 text-[13px] font-semibold">{isUsed ? "Ready for review" : "Ready to publish"}</h2>
            <ul className="mt-3 space-y-2">
              {checks.map((c) => (
                <li key={c.label} className={cn("flex items-start gap-2 text-[13px] transition-colors duration-300", c.ok ? "text-ink" : "text-muted")}>
                  {c.ok ? <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-[#1e7a3c]" strokeWidth={2.5} /> : <Circle aria-hidden className="mt-0.5 size-4 shrink-0 text-line" />}
                  <span>
                    {c.label}
                    <span className="sr-only">{c.ok ? " — done" : " — to do"}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className={cn("mt-4 text-[12.5px]", ready ? "font-medium text-[#1e7a3c]" : "text-muted")}>
              {ready ? (isUsed ? "Everything MarchGear needs is filled in." : "Everything is set — publish when you're ready.") : isUsed ? "Drafts can be saved at any time." : "You can save without publishing at any time."}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" icon={<Eye aria-hidden className="size-4" />} onClick={openPreview}>
                Preview
              </Button>
              {vehicle ? (
                <Button variant="outline" size="sm" icon={<History aria-hidden className="size-4" />} onClick={() => setHistory(true)}>
                  History
                </Button>
              ) : null}
            </div>
            {vehicle?.publicHref && (
              <a href={vehicle.publicHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-[13px] font-medium text-red underline-offset-4 hover:underline">
                View it on the website
              </a>
            )}
          </section>
          <p className="px-1 text-[12px] leading-relaxed text-muted">
            {isUsed
              ? "Used cars are checked by MarchGear before they go live. You'll get a notification when yours is approved, or if changes are needed."
              : "New-car listings go live as soon as you publish — no approval needed. MarchGear may pause a listing that breaks the listing rules, and you'll be notified if it does."}
          </p>
        </aside>
      </div>

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:left-[264px]">
        <div className="mx-auto flex max-w-[1384px] items-center justify-between gap-3 px-4 py-3 md:px-8">
          <p className="hidden min-w-0 truncate text-[13px] text-muted sm:block" aria-live="polite">
            {saving ? "Saving…" : dirty ? <span className="text-ink">Unsaved changes</span> : vehicle ? "All changes saved" : "Not saved yet"}
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="ghost" size="sm" className="hidden md:inline-flex" icon={<Eye aria-hidden className="size-4" />} onClick={openPreview}>
              Preview
            </Button>
            {isUsed ? (
              <>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" disabled={busy} onClick={() => request("draft")} icon={saving === "draft" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />}>
                  Save draft
                </Button>
                <Button size="sm" className="flex-1 sm:flex-none" disabled={busy} onClick={() => request("submit")} icon={saving === "submit" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}>
                  {usedLive || status === "pending_approval" ? "Resubmit" : "Submit for approval"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  disabled={busy || noBrands}
                  onClick={() => request("pause")}
                  icon={saving === "pause" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : isLiveNew ? <CirclePause aria-hidden className="size-4" /> : <Save aria-hidden className="size-4" />}
                >
                  {isLiveNew ? (
                    "Pause listing"
                  ) : (
                    <>
                      <span className="sm:hidden">Save</span>
                      <span className="hidden sm:inline">Save without publishing</span>
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 sm:flex-none"
                  disabled={busy || noBrands}
                  onClick={() => request("publish")}
                  icon={saving === "publish" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : isLiveNew ? <Save aria-hidden className="size-4" /> : <Rocket aria-hidden className="size-4" />}
                >
                  {isLiveNew ? "Save changes" : status && status !== "draft" ? "Publish again" : "Publish now"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && save(confirm, true)}
        busy={busy}
        tone={usedLive ? "danger" : "dark"}
        title={usedLive ? (confirm === "submit" ? "Resubmit this live listing?" : "Take this listing offline?") : "Withdraw from review?"}
        confirmLabel={usedLive ? (confirm === "submit" ? "Save and resubmit" : "Save as draft") : "Save as draft"}
      >
        {usedLive ? (
          <>
            <p>
              Your changes go back to MarchGear for approval.{" "}
              {status === "published" ? <strong className="font-semibold text-ink">The listing disappears from the website until it&rsquo;s approved again.</strong> : "It won't go live until it's approved again."}
            </p>
            {confirm === "draft" && <p>Saving as a draft keeps it offline until you submit it.</p>}
          </>
        ) : (
          <p>This car is waiting for MarchGear&rsquo;s review. Saving it as a draft takes it out of the queue — submit it again when you&rsquo;re ready.</p>
        )}
      </ConfirmDialog>

      <PreviewModal vehicle={preview} brandName={preview ? cat.brandName(preview.brand) : undefined} onClose={() => setPreview(null)} />
      {vehicle && <HistoryDrawer vehicleId={history ? vehicle.id : null} onClose={() => setHistory(false)} />}
    </form>
  );
}
