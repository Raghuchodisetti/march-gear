"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Circle, Eye, History, Loader2, Plus, Save, Send, Sparkles, Trash2, X } from "lucide-react";
import type { PartnerVehicleStatus } from "@/db/enums";
import type { CarModel, Variant } from "@/types";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { LEGACY_BRANDS } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/field";
import { formatDateTime } from "@/components/portal/ui";
import { DocumentUploader, ImageUploader } from "@/components/portal/uploader";
import { useCatalog } from "@/components/providers/catalog-provider";
import { useUI } from "@/components/providers/app-provider";
import { saveVehicleAction } from "@/server/actions/partner-inventory";
import { ConfirmDialog, HistoryDrawer, PreviewModal, RemarksCallout, StatusBadge } from "./dialogs";
import {
  BODY_TYPES,
  FUELS,
  INDIAN_STATES,
  INSURANCE_OPTIONS,
  LIVE,
  MAX_FEATURES,
  MAX_IMAGES,
  MAX_SPECS,
  MAX_VIDEOS,
  MIN_DESCRIPTION,
  MIN_YEAR,
  TRANSMISSIONS,
  VIN_PATTERN,
  currentYear,
  emptyUsed,
  formToPublic,
  parseVideo,
  type PublicVehicle,
  type UsedFormValue,
  type VehicleFormValue,
} from "./shared";

/* ──────────────────────────────────────────────────────────────
   Add / edit a vehicle. Brand → model → variant come from the
   catalogue and prefill the specification (all editable); models
   that aren't in the catalogue can be typed in. "Save draft" works
   any time; "Submit for approval" needs everything MarchGear checks.
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
  };
  initial: VehicleFormValue;
  showrooms: { id: number; name: string; city: string; address: string; isPrimary: boolean }[];
  authorisedBrands: string[];
  partnerId: number;
  dealer: PublicVehicle["dealer"];
}

const OTHER = "__other";
const control =
  "h-12 w-full rounded-[3px] border border-line bg-white px-4 text-[15px] text-ink placeholder:text-muted/70 outline-none transition-[border-color] duration-[250ms] hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red disabled:cursor-not-allowed disabled:bg-mist disabled:text-muted";

/** Specification rows from a catalogue model (and variant, when chosen). */
function catalogueSpecs(car: CarModel, variant?: Variant): { label: string; value: string }[] {
  const d = car.dimensions;
  const rows: [string, string | number | undefined | null][] = [
    ["Engine", car.engine],
    ["Power", car.power],
    ["Torque", car.torque],
    [car.ev ? "Range" : "Mileage", variant?.efficiency ?? car.efficiency],
    ["Seating", car.seats.length ? `${car.seats.join(" / ")} seats` : ""],
    ["Airbags", car.airbags ? String(car.airbags) : ""],
    ["Safety rating", car.safetyAgency !== "Not tested" ? `${car.safetyRating}-star ${car.safetyAgency}` : ""],
    ["Boot space", car.bootSpace ? `${car.bootSpace} litres` : ""],
    ["Ground clearance", car.groundClearance ? `${car.groundClearance} mm` : ""],
    ["Fuel tank", car.fuelTank ? `${car.fuelTank} litres` : ""],
    ["Length × width × height", d ? `${d.length} × ${d.width} × ${d.height} mm` : ""],
    ["Wheelbase", d?.wheelbase ? `${d.wheelbase} mm` : ""],
    ["0–100 km/h", car.acceleration],
    ["Top speed", car.topSpeed ? `${car.topSpeed} km/h` : ""],
    ...(car.ev
      ? ([
          ["Battery", `${car.ev.batteryKwh} kWh`],
          ["DC fast charging", car.ev.dcCharge],
          ["AC charging", car.ev.acCharge],
        ] as [string, string][])
      : []),
  ];
  return rows.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "").map(([label, value]) => ({ label, value: String(value) }));
}

const priceHint = (v: string) => {
  const n = Number(v.replace(/[,\s₹]/g, ""));
  return v.trim() && Number.isFinite(n) && n > 0 ? formatPrice(n) : undefined;
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
  groups,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options?: { value: string; label: string }[];
  groups?: { label: string; options: { value: string; label: string }[] }[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}) {
  const opt = (o: { value: string; label: string }) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  );
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={error ? true : undefined} className={cn(control, "cursor-pointer appearance-none pr-10")}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {groups ? groups.filter((g) => g.options.length).map((g) => <optgroup key={g.label} label={g.label}>{g.options.map(opt)}</optgroup>) : options?.map(opt)}
      </select>
      <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="m4 6 4 4 4-4" />
      </svg>
    </div>
  );
}

/* ── The form ───────────────────────────────────────────────── */

export function VehicleForm({ vehicle, initial, showrooms, authorisedBrands, partnerId, dealer }: VehicleFormProps) {
  const router = useRouter();
  const { toast } = useUI();
  const cat = useCatalog();
  const uid = useId();
  const fid = (k: string) => `${uid}-${k}`;

  const [v, setV] = useState<VehicleFormValue>(() => {
    const car = initial.modelSlug ? cat.getCar(initial.modelSlug) : undefined;
    const variant = car?.variants.find((x) => x.name === initial.variant);
    const room = !vehicle && !initial.showroomId && showrooms.length ? String((showrooms.find((s) => s.isPrimary) ?? showrooms[0]).id) : initial.showroomId;
    return { ...initial, variantSlug: variant?.slug ?? "", showroomId: room };
  });
  const [modes, setModes] = useState(() => {
    const car = initial.modelSlug ? cat.getCar(initial.modelSlug) : undefined;
    return {
      model: initial.modelSlug || !initial.model ? ("catalogue" as const) : ("custom" as const),
      variant: car && initial.variant && !car.variants.some((x) => x.name === initial.variant) ? ("custom" as const) : ("catalogue" as const),
      colour: car?.colors.length && initial.colour && !car.colors.some((c) => c.name === initial.colour) ? ("custom" as const) : ("catalogue" as const),
    };
  });
  const [touched, setTouched] = useState({ specs: initial.specs.length > 0, features: initial.features.length > 0 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [videoErrors, setVideoErrors] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [confirm, setConfirm] = useState<"draft" | "submit" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<PublicVehicle | null>(null);
  const [history, setHistory] = useState(false);
  const [feature, setFeature] = useState("");

  const status = vehicle?.status;
  const live = status ? LIVE.includes(status) : false;
  const isUsed = v.kind === "used";
  const car = v.modelSlug ? cat.getCar(v.modelSlug) : undefined;
  const brandHasCars = v.brand ? cat.carsByBrand(v.brand).length > 0 : false;
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

  /* Catalogue cascade */
  const brandGroups = useMemo(() => {
    const all = [...cat.brands].sort((a, b) => a.name.localeCompare(b.name)).map((b) => ({ value: b.slug, label: b.name }));
    const mine = all.filter((b) => authorisedBrands.includes(b.value));
    const others = all.filter((b) => !authorisedBrands.includes(b.value));
    const legacy = Object.entries(LEGACY_BRANDS)
      .filter(([slug]) => slug !== "multi-brand" && !cat.getBrand(slug))
      .map(([value, label]) => ({ value, label }));
    return [
      ...(mine.length ? [{ label: "Your authorised brands", options: mine }] : []),
      { label: mine.length ? "Other brands" : "Brands", options: others },
      ...(isUsed ? [{ label: "No longer sold new (pre-owned only)", options: legacy }] : []),
    ];
  }, [cat, authorisedBrands, isUsed]);

  const onBrand = (brand: string) => {
    if (brand === v.brand) return;
    const hasCars = cat.carsByBrand(brand).length > 0;
    patch({ brand, modelSlug: "", model: "", variantSlug: "", variant: "", colour: "" });
    setModes({ model: hasCars ? "catalogue" : "custom", variant: hasCars ? "catalogue" : "custom", colour: "catalogue" });
  };

  const onModel = (slug: string) => {
    if (slug === OTHER) {
      patch({ modelSlug: "", model: "", variantSlug: "", variant: "" });
      setModes((m) => ({ ...m, model: "custom", variant: "custom", colour: "custom" }));
      return;
    }
    const c = cat.getCar(slug);
    if (!c) {
      patch({ modelSlug: "", model: "", variantSlug: "", variant: "" });
      return;
    }
    const keepColour = c.colors.some((x) => x.name === v.colour);
    patch({
      modelSlug: c.slug,
      model: c.name,
      variantSlug: "",
      variant: "",
      bodyType: c.bodyType,
      colour: keepColour ? v.colour : "",
      ...(touched.specs ? {} : { specs: catalogueSpecs(c) }),
    });
    setModes({ model: "catalogue", variant: "catalogue", colour: c.colors.length ? "catalogue" : "custom" });
  };

  const onVariant = (slug: string) => {
    if (slug === OTHER) {
      patch({ variantSlug: "", variant: "" });
      setModes((m) => ({ ...m, variant: "custom" }));
      return;
    }
    const x = car?.variants.find((y) => y.slug === slug);
    if (!car || !x) {
      patch({ variantSlug: "", variant: "" });
      return;
    }
    patch({
      variantSlug: x.slug,
      variant: x.name,
      fuel: x.fuel,
      transmission: x.transmission,
      bodyType: car.bodyType,
      exShowroom: String(x.price),
      ...(touched.specs ? {} : { specs: catalogueSpecs(car, x) }),
      ...(touched.features || !x.features.length ? {} : { features: [...x.features] }),
    });
    setModes((m) => ({ ...m, variant: "catalogue" }));
  };

  const loadCatalogueSpecs = () => {
    if (!car) return;
    const x = car.variants.find((y) => y.slug === v.variantSlug);
    patch({ specs: catalogueSpecs(car, x) });
    setTouched((t) => ({ ...t, specs: false }));
  };
  const loadCatalogueFeatures = () => {
    if (!car) return;
    const x = car.variants.find((y) => y.slug === v.variantSlug);
    patch({ features: x?.features.length ? [...x.features] : car.highlights.slice(0, 8) });
    setTouched((t) => ({ ...t, features: false }));
  };

  const addFeature = () => {
    const f = feature.trim();
    if (!f) return;
    if (v.features.some((x) => x.toLowerCase() === f.toLowerCase())) {
      setFeature("");
      return;
    }
    if (v.features.length >= MAX_FEATURES) return toast(`Up to ${MAX_FEATURES} features.`, { tone: "error" });
    patch({ features: [...v.features, f.slice(0, 120)] });
    setTouched((t) => ({ ...t, features: true }));
    setFeature("");
  };

  /* Readiness (mirrors the server's submit check) */
  const checks = useMemo(() => {
    const u = v.used;
    const list = [
      { label: "Brand, model and variant", ok: Boolean(v.brand && v.model && v.variant && v.year) },
      { label: "Body, fuel, gearbox and colour", ok: Boolean(v.bodyType && v.fuel && v.transmission && v.colour) },
      { label: "Price and stock", ok: Boolean(v.sellingPrice && (isUsed || v.exShowroom) && Number(v.stock) >= 1) },
      ...(showrooms.length ? [{ label: "Showroom", ok: Boolean(v.showroomId) }] : []),
      { label: `Description (${MIN_DESCRIPTION}+ characters)`, ok: v.description.trim().length >= MIN_DESCRIPTION },
      { label: "At least one photo", ok: v.images.length > 0 },
      ...(isUsed
        ? [
            { label: "Registration and odometer", ok: Boolean(u.registrationYear && u.km !== "" && u.owners && u.registrationNumber && u.registrationState) },
            {
              label: "Accident and insurance",
              ok: Boolean(
                u.accident &&
                  (u.accident === "no" || u.accidentDetails.trim().length >= 10) &&
                  u.insuranceStatus &&
                  (u.insuranceStatus === "expired" || u.insuranceStatus === "none" || u.insuranceValidUntil),
              ),
            },
          ]
        : []),
    ];
    return list;
  }, [v, isUsed, showrooms.length]);
  const ready = checks.every((c) => c.ok);

  /* Saving */
  const save = async (intent: "draft" | "submit", acknowledgeLive = false) => {
    const bad = v.videos.map((x, i) => (x.trim() && !parseVideo(x) ? i : -1)).filter((i) => i >= 0);
    if (bad.length) {
      setVideoErrors(Object.fromEntries(bad.map((i) => [i, "Paste a YouTube or Vimeo link"])));
      document.querySelector(`[data-field="videos.${bad[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(intent);
    setConfirm(null);
    const res = await saveVehicleAction({ id: vehicle?.id, intent, acknowledgeLive, values: v });
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
    if (intent === "submit") {
      toast(`${res.reference} sent to MarchGear for approval`, { tone: "success" });
      router.push("/dealer/inventory?status=pending_approval");
      router.refresh();
      return;
    }
    toast(vehicle ? `${res.reference} saved as a draft` : `Draft ${res.reference} created`, { tone: "success" });
    if (!vehicle) router.replace(`/dealer/inventory/${res.id}`);
    router.refresh();
  };

  const request = (intent: "draft" | "submit") => {
    if (live || (status === "pending_approval" && intent === "draft")) setConfirm(intent);
    else save(intent);
  };

  const openPreview = () => {
    const room = showrooms.find((s) => String(s.id) === v.showroomId);
    setPreview(formToPublic(v, { id: vehicle?.id, partnerId, reference: vehicle?.reference, dealer, showroom: room ? { name: room.name, city: room.city, address: room.address } : null }));
  };

  /* Options */
  const modelOptions = v.brand ? [...cat.carsByBrand(v.brand).map((c) => ({ value: c.slug, label: c.name })), { value: OTHER, label: "Another model (not in the catalogue)" }] : [];
  const variantOptions = car
    ? [...car.variants.map((x) => ({ value: x.slug, label: `${x.name} · ${x.fuel} ${x.transmission} · ${formatPrice(x.price)}` })), { value: OTHER, label: "Another variant" }]
    : [];
  const yearOptions = (isUsed ? Array.from({ length: year - 1995 + 1 }, (_, i) => year - i) : [year + 1, year, year - 1]).map((y) => ({ value: String(y), label: String(y) }));
  if (v.year && !yearOptions.some((o) => o.value === v.year)) yearOptions.push({ value: v.year, label: v.year });
  const regYears = Array.from({ length: year - MIN_YEAR + 1 }, (_, i) => String(year - i)).filter((y) => !v.year || Number(y) >= Number(v.year) || y === v.used.registrationYear);
  const unauthorised = v.kind === "new" && v.brand && authorisedBrands.length > 0 && !authorisedBrands.includes(v.brand);
  const busy = saving !== null;
  const order = ["type", "vehicle", "price", ...(isUsed ? ["used"] : []), "description", "specs", "features", "photos", "videos"];
  const idx = (k: string) => String(order.indexOf(k) + 1).padStart(2, "0");

  return (
    // Enter in a field must never submit for approval, so the buttons act directly.
    <form noValidate onSubmit={(e) => e.preventDefault()} className="pb-32">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {status && <RemarksCallout status={status} remarks={vehicle?.adminRemarks ?? null} />}
          {live && (
            <div className="flex gap-3 border-l-2 border-ink bg-white px-4 py-3 text-[13.5px]" role="note">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
              <p>
                <span className="font-semibold">This listing is {status === "published" ? "live on the website" : "approved"}.</span> Saving any change sends it back to MarchGear for approval
                {status === "published" ? " and hides it from buyers until it's approved again" : ""}.
              </p>
            </div>
          )}
          {status === "archived" && (
            <p className="border-l-2 border-line bg-white px-4 py-3 text-[13.5px] text-muted" role="note">
              This vehicle is archived. Saving restores it as a draft.
            </p>
          )}

          <Section index={idx("type")} title="Listing type" description={vehicle ? "A listing can't switch between new and used — duplicate it from the list instead." : "New-car stock shows on your dealer page; pre-owned cars also appear on /used-cars."}>
            <Segmented
              ariaLabel="Listing type"
              className="w-full sm:w-80"
              value={v.kind}
              onChange={(kind) => {
                if (vehicle || kind === v.kind) return;
                patch({ kind, year: kind === "new" ? String(year) : "", used: emptyUsed() });
                if (kind === "new" && v.brand && !cat.getBrand(v.brand)) onBrand("");
              }}
              options={[
                { value: "new", label: "New car" },
                { value: "used", label: "Used car" },
              ]}
            />
          </Section>

          <Section index={idx("vehicle")} title="Vehicle" description="Pick from the MarchGear catalogue to prefill the specification — everything stays editable.">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                name="brand"
                label="Brand"
                htmlFor={fid("brand")}
                error={err("brand")}
                hint={unauthorised ? <span className="text-[#9a5b00]">Your dealership isn&rsquo;t authorised for this brand yet — add it under Brands, or MarchGear may reject the listing.</span> : undefined}
              >
                <Select id={fid("brand")} value={v.brand} onChange={onBrand} placeholder="Choose a brand" groups={brandGroups} error={err("brand")} />
              </Field>

              <Field name="model" label="Model" htmlFor={fid("model")} error={modes.model === "catalogue" || !brandHasCars ? err("model") : undefined}>
                {brandHasCars ? (
                  <Select
                    id={fid("model")}
                    value={modes.model === "custom" ? OTHER : v.modelSlug}
                    onChange={onModel}
                    placeholder={v.brand ? "Choose a model" : "Choose a brand first"}
                    options={modelOptions}
                    disabled={!v.brand}
                    error={modes.model === "catalogue" ? err("model") : undefined}
                  />
                ) : (
                  <input id={fid("model")} className={control} value={v.model} onChange={(e) => patch({ model: e.target.value })} placeholder={v.brand ? "Model name, e.g. EcoSport" : "Choose a brand first"} disabled={!v.brand} maxLength={120} aria-invalid={err("model") ? true : undefined} />
                )}
              </Field>

              {brandHasCars && modes.model === "custom" && (
                <Field name="model" label="Model name" htmlFor={fid("modelName")} error={err("model")} hint="Shown as typed. Catalogue models get richer public pages.">
                  <input id={fid("modelName")} className={control} value={v.model} onChange={(e) => patch({ model: e.target.value })} placeholder="e.g. Creta N Line" maxLength={120} aria-invalid={err("model") ? true : undefined} />
                </Field>
              )}

              <Field name="variant" label="Variant" htmlFor={fid("variant")} error={!car || modes.variant === "catalogue" ? err("variant") : undefined}>
                {car ? (
                  <Select id={fid("variant")} value={modes.variant === "custom" ? OTHER : v.variantSlug} onChange={onVariant} placeholder="Choose a variant" options={variantOptions} error={modes.variant === "catalogue" ? err("variant") : undefined} />
                ) : (
                  <input id={fid("variant")} className={control} value={v.variant} onChange={(e) => patch({ variant: e.target.value })} placeholder="e.g. SX(O) 1.5 Turbo DCT" maxLength={120} disabled={!v.brand} aria-invalid={err("variant") ? true : undefined} />
                )}
              </Field>

              {car && modes.variant === "custom" && (
                <Field name="variant" label="Variant name" htmlFor={fid("variantName")} error={err("variant")}>
                  <input id={fid("variantName")} className={control} value={v.variant} onChange={(e) => patch({ variant: e.target.value })} placeholder="e.g. Signature edition" maxLength={120} aria-invalid={err("variant") ? true : undefined} />
                </Field>
              )}

              <Field name="year" label={isUsed ? "Manufacturing year" : "Model year"} htmlFor={fid("year")} error={err("year")}>
                <Select id={fid("year")} value={v.year} onChange={(year) => patch({ year })} placeholder="Choose the year" options={yearOptions} error={err("year")} />
              </Field>

              <Field name="bodyType" label="Body type" htmlFor={fid("body")} error={err("bodyType")}>
                <Select id={fid("body")} value={v.bodyType} onChange={(bodyType) => patch({ bodyType })} placeholder="Choose" options={BODY_TYPES.map((b) => ({ value: b, label: b }))} error={err("bodyType")} />
              </Field>

              <Field name="fuel" label="Fuel" htmlFor={fid("fuel")} error={err("fuel")}>
                <Select id={fid("fuel")} value={v.fuel} onChange={(fuel) => patch({ fuel })} placeholder="Choose" options={FUELS.map((f) => ({ value: f, label: f }))} error={err("fuel")} />
              </Field>

              <Field name="transmission" label="Transmission" htmlFor={fid("gear")} error={err("transmission")}>
                <Select id={fid("gear")} value={v.transmission} onChange={(transmission) => patch({ transmission })} placeholder="Choose" options={TRANSMISSIONS.map((t) => ({ value: t, label: t }))} error={err("transmission")} />
              </Field>

              <Field name="colour" label="Colour" htmlFor={fid("colour")} error={err("colour")} hint={car?.colors.length && modes.colour === "catalogue" ? `${car.colors.length} factory colours for the ${car.name}` : undefined}>
                {car?.colors.length && modes.colour === "catalogue" ? (
                  <Select
                    id={fid("colour")}
                    value={v.colour}
                    onChange={(c) => {
                      if (c === OTHER) {
                        setModes((m) => ({ ...m, colour: "custom" }));
                        patch({ colour: "" });
                      } else patch({ colour: c });
                    }}
                    placeholder="Choose a colour"
                    options={[...car.colors.map((c) => ({ value: c.name, label: c.name })), { value: OTHER, label: "Another colour" }]}
                    error={err("colour")}
                  />
                ) : (
                  <div className="flex gap-2">
                    <input id={fid("colour")} className={control} value={v.colour} onChange={(e) => patch({ colour: e.target.value })} placeholder="e.g. Abyss Black" maxLength={60} aria-invalid={err("colour") ? true : undefined} />
                    {car?.colors.length ? (
                      <button type="button" onClick={() => setModes((m) => ({ ...m, colour: "catalogue" }))} className="shrink-0 px-2 text-[12.5px] font-medium text-muted hover:text-ink">
                        List
                      </button>
                    ) : null}
                  </div>
                )}
              </Field>

              {car?.colors.length && modes.colour === "catalogue" && v.colour ? (
                <div className="flex items-end pb-3 sm:col-span-2">
                  <ul className="flex flex-wrap gap-2" aria-label="Factory colours">
                    {car.colors.map((c) => (
                      <li key={c.name}>
                        <button
                          type="button"
                          title={c.name}
                          aria-label={c.name}
                          aria-pressed={v.colour === c.name}
                          onClick={() => patch({ colour: c.name })}
                          className={cn("block size-7 rounded-full border transition-[box-shadow,transform] duration-300 hover:scale-105", v.colour === c.name ? "border-ink ring-2 ring-ink ring-offset-2" : "border-line")}
                          style={{ backgroundColor: c.hex }}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Section>

          <Section index={idx("price")} title="Price & stock" description="Buyers see the selling price. Ex-showroom is shown for reference.">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                name="exShowroom"
                label={isUsed ? "Original ex-showroom price" : "Ex-showroom price"}
                htmlFor={fid("exs")}
                optional={isUsed}
                error={err("exShowroom")}
                hint={priceHint(v.exShowroom) ?? (car ? "Prefilled from the catalogue variant" : undefined)}
              >
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-muted">₹</span>
                  <input id={fid("exs")} inputMode="numeric" className={cn(control, "pl-9 num")} value={v.exShowroom} onChange={(e) => patch({ exShowroom: e.target.value })} placeholder="e.g. 1250000" aria-invalid={err("exShowroom") ? true : undefined} />
                </div>
              </Field>
              <Field name="sellingPrice" label={isUsed ? "Asking price" : "Selling price"} htmlFor={fid("price")} error={err("sellingPrice")} hint={priceHint(v.sellingPrice) ?? "Your price to the buyer"}>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-muted">₹</span>
                  <input id={fid("price")} inputMode="numeric" className={cn(control, "pl-9 num")} value={v.sellingPrice} onChange={(e) => patch({ sellingPrice: e.target.value })} placeholder="e.g. 1199000" aria-invalid={err("sellingPrice") ? true : undefined} />
                </div>
              </Field>
              <Field name="stock" label="Units in stock" htmlFor={fid("stock")} error={err("stock")} hint={isUsed ? "Usually 1 for a pre-owned car. 0 marks it sold." : "Update it any time from the vehicle list."}>
                <input id={fid("stock")} type="number" min={0} max={999} inputMode="numeric" className={cn(control, "num")} value={v.stock} onChange={(e) => patch({ stock: e.target.value })} aria-invalid={err("stock") ? true : undefined} />
              </Field>
              <Field name="showroomId" label="Showroom" htmlFor={fid("room")} error={err("showroomId")} hint={showrooms.length ? undefined : "Add your showrooms under Showrooms to pick where the car is."}>
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
              <Field
                name="vin"
                label="VIN / chassis number"
                htmlFor={fid("vin")}
                optional
                wide
                error={err("vin") ?? (v.vin && v.vin.replace(/[\s-]/g, "").length === 17 && !VIN_PATTERN.test(v.vin.toUpperCase().replace(/[\s-]/g, "")) ? "A VIN has no I, O or Q" : undefined)}
                hint="17 characters. Only you and MarchGear see it — it's never shown on the website."
              >
                <input
                  id={fid("vin")}
                  className={cn(control, "font-mono uppercase tracking-[0.08em]")}
                  value={v.vin}
                  onChange={(e) => patch({ vin: e.target.value.toUpperCase() })}
                  maxLength={20}
                  placeholder="MA3EWDE1S00123456"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={err("vin") ? true : undefined}
                />
              </Field>
            </div>
          </Section>

          {isUsed && (
            <Section index={idx("used")} title="Pre-owned details" description="Be specific — MarchGear checks these before the car goes live.">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                <Field name="used.registrationNumber" label="Registration number" htmlFor={fid("reg")} error={err("used.registrationNumber")} hint="Not shown publicly — buyers only see the state.">
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

          <Section index={idx("description")} title="Description" description="What makes this car worth a visit: condition, warranty, accessories, offers included.">
            <div data-field="description">
              <textarea
                aria-label="Description"
                className={cn(control, "h-auto min-h-40 py-3 leading-relaxed")}
                value={v.description}
                onChange={(e) => patch({ description: e.target.value })}
                maxLength={5000}
                placeholder={isUsed ? "Single owner, full service history at the authorised workshop, new tyres in 2026…" : "Ready for immediate delivery. Includes the accessories pack and extended warranty…"}
                aria-invalid={err("description") ? true : undefined}
              />
              <div className="mt-1.5 flex justify-between gap-4 text-xs">
                <span className={err("description") ? "text-red" : "text-muted"}>{err("description") ?? `At least ${MIN_DESCRIPTION} characters to submit.`}</span>
                <span className={cn("shrink-0 num", v.description.trim().length >= MIN_DESCRIPTION ? "text-muted" : "text-ink")}>{v.description.trim().length} / 5000</span>
              </div>
            </div>
          </Section>

          <Section
            index={idx("specs")}
            title="Specifications"
            description="Label and value rows, shown as a table on the listing."
            action={
              car && touched.specs ? (
                <button type="button" onClick={loadCatalogueSpecs} className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
                  <Sparkles aria-hidden className="size-3.5" /> <span className="hidden sm:inline">Reload from</span> catalogue
                </button>
              ) : undefined
            }
          >
            <div data-field="specs" className="space-y-2">
              {v.specs.length === 0 && <p className="text-[13.5px] text-muted">{car ? "Choose a variant to prefill the specification, or add rows." : "Add rows such as Engine, Power or Mileage."}</p>}
              {v.specs.map((s, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-2">
                  <div data-field={`specs.${i}.label`}>
                    <input
                      aria-label={`Specification ${i + 1} label`}
                      className={cn(control, "h-11 text-[14px]")}
                      value={s.label}
                      maxLength={60}
                      placeholder="Label"
                      onChange={(e) => {
                        patch({ specs: v.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) });
                        setTouched((t) => ({ ...t, specs: true }));
                      }}
                      aria-invalid={err(`specs.${i}.label`) ? true : undefined}
                    />
                    {err(`specs.${i}.label`) && <p className="mt-1 text-xs text-red">{err(`specs.${i}.label`)}</p>}
                  </div>
                  <div data-field={`specs.${i}.value`}>
                    <input
                      aria-label={`Specification ${i + 1} value`}
                      className={cn(control, "h-11 text-[14px]")}
                      value={s.value}
                      maxLength={160}
                      placeholder="Value"
                      onChange={(e) => {
                        patch({ specs: v.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) });
                        setTouched((t) => ({ ...t, specs: true }));
                      }}
                      aria-invalid={err(`specs.${i}.value`) ? true : undefined}
                    />
                    {err(`specs.${i}.value`) && <p className="mt-1 text-xs text-red">{err(`specs.${i}.value`)}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      patch({ specs: v.specs.filter((_, j) => j !== i) });
                      setTouched((t) => ({ ...t, specs: true }));
                      setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("specs."))));
                    }}
                    aria-label={`Remove ${s.label || `row ${i + 1}`}`}
                    className="inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-mist hover:text-red"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {err("specs") && <p className="text-xs text-red">{err("specs")}</p>}
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus aria-hidden className="size-4" />}
                disabled={v.specs.length >= MAX_SPECS}
                onClick={() => {
                  patch({ specs: [...v.specs, { label: "", value: "" }] });
                  setTouched((t) => ({ ...t, specs: true }));
                }}
              >
                Add row
              </Button>
            </div>
          </Section>

          <Section
            index={idx("features")}
            title="Features"
            description="Equipment buyers care about — one per line."
            action={
              car && touched.features ? (
                <button type="button" onClick={loadCatalogueFeatures} className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
                  <Sparkles aria-hidden className="size-3.5" /> <span className="hidden sm:inline">Reload from</span> catalogue
                </button>
              ) : undefined
            }
          >
            <div data-field="features">
              {v.features.length > 0 && (
                <ul className="mb-4 flex flex-wrap gap-2">
                  {v.features.map((f) => (
                    <li key={f} className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-[#fafafa] py-1 pl-3 pr-1 text-[13px]">
                      <span className="truncate">{f}</span>
                      <button
                        type="button"
                        onClick={() => {
                          patch({ features: v.features.filter((x) => x !== f) });
                          setTouched((t) => ({ ...t, features: true }));
                        }}
                        aria-label={`Remove ${f}`}
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white hover:text-red"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  aria-label="Add a feature"
                  className={control}
                  value={feature}
                  onChange={(e) => setFeature(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFeature();
                    }
                  }}
                  maxLength={120}
                  placeholder="e.g. Ventilated front seats"
                />
                <Button variant="outline" className="h-12 shrink-0" onClick={addFeature} disabled={!feature.trim()}>
                  Add
                </Button>
              </div>
              <p className={cn("mt-1.5 text-xs", err("features") ? "text-red" : "text-muted")}>{err("features") ?? `${v.features.length} of ${MAX_FEATURES}. Press Enter to add.`}</p>
            </div>
          </Section>

          <Section index={idx("photos")} title="Photos" description="The first photo is the cover. Daylight exterior shots from the front three-quarter work best.">
            <div data-field="images">
              <ImageUploader
                multiple
                max={MAX_IMAGES}
                value={v.images}
                onChange={(images) => patch({ images })}
                label="Add photos"
                hint={`${v.images.length} of ${MAX_IMAGES}. Listings with 6 or more photos get noticeably more enquiries. Uploads also appear in your media library.`}
                error={err("images")}
              />
            </div>
          </Section>

          <Section index={idx("videos")} title="Videos" description="Walkarounds or test drives on YouTube or Vimeo." action={<span className="shrink-0 text-[12px] text-muted">Optional</span>}>
            <div className="space-y-2">
              {v.videos.map((url, i) => {
                const parsed = url.trim() ? parseVideo(url) : null;
                const e = videoErrors[i] ?? err(`videos.${i}`);
                return (
                  <div key={i} data-field={`videos.${i}`}>
                    <div className="flex gap-2">
                      <input
                        aria-label={`Video link ${i + 1}`}
                        className={control}
                        type="url"
                        value={url}
                        onChange={(ev) => {
                          patch({ videos: v.videos.map((x, j) => (j === i ? ev.target.value : x)) });
                          setVideoErrors((m) => {
                            const n2 = { ...m };
                            delete n2[i];
                            return n2;
                          });
                        }}
                        onBlur={() => url.trim() && !parseVideo(url) && setVideoErrors((m) => ({ ...m, [i]: "Paste a YouTube or Vimeo link, e.g. https://youtu.be/…" }))}
                        placeholder="https://www.youtube.com/watch?v=…"
                        aria-invalid={e ? true : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          patch({ videos: v.videos.filter((_, j) => j !== i) });
                          setVideoErrors({});
                          setErrors((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !k.startsWith("videos"))));
                        }}
                        aria-label={`Remove video ${i + 1}`}
                        className="inline-flex size-12 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-mist hover:text-red"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {e ? <p className="mt-1.5 text-xs text-red">{e}</p> : parsed ? <p className="mt-1.5 text-xs text-[#1e7a3c]">{parsed.provider === "vimeo" ? "Vimeo" : "YouTube"} video · {parsed.id}</p> : null}
                  </div>
                );
              })}
              {err("videos") && <p className="text-xs text-red">{err("videos")}</p>}
              <Button variant="ghost" size="sm" icon={<Plus aria-hidden className="size-4" />} disabled={v.videos.length >= MAX_VIDEOS} onClick={() => patch({ videos: [...v.videos, ""] })}>
                Add video link
              </Button>
            </div>
          </Section>
        </div>

        {/* Status & readiness */}
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="border border-line bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12.5px] font-medium text-muted">{vehicle ? vehicle.reference : "New listing"}</p>
              {status ? <StatusBadge status={status} /> : <span className="text-[12px] text-muted">Not saved yet</span>}
            </div>
            {vehicle && <p className="mt-2 text-[12.5px] text-muted">Last saved {formatDateTime(vehicle.updatedAt)}</p>}
            <h2 className="mt-5 text-[13px] font-semibold">Ready for review</h2>
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
            <p className={cn("mt-4 text-[12.5px]", ready ? "font-medium text-[#1e7a3c]" : "text-muted")}>{ready ? "Everything MarchGear needs is filled in." : "Drafts can be saved at any time."}</p>
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
          <p className="px-1 text-[12px] leading-relaxed text-muted">Only MarchGear staff publish listings. You&rsquo;ll get a notification when yours is approved, or if changes are needed.</p>
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
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" disabled={busy} onClick={() => request("draft")} icon={saving === "draft" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />}>
              Save draft
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none" disabled={busy} onClick={() => request("submit")} icon={saving === "submit" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}>
              {live || status === "pending_approval" ? "Resubmit" : "Submit for approval"}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && save(confirm, true)}
        busy={busy}
        tone={live ? "danger" : "dark"}
        title={live ? (confirm === "submit" ? "Resubmit this live listing?" : "Take this listing offline?") : "Withdraw from review?"}
        confirmLabel={live ? (confirm === "submit" ? "Save and resubmit" : "Save as draft") : "Save as draft"}
      >
        {live ? (
          <>
            <p>
              Your changes go back to MarchGear for approval.{" "}
              {status === "published" ? <strong className="font-semibold text-ink">The listing disappears from the website until it&rsquo;s approved again.</strong> : "It won't go live until it's approved again."}
            </p>
            {confirm === "draft" && <p>Saving as a draft keeps it offline until you submit it.</p>}
          </>
        ) : (
          <p>This vehicle is waiting for MarchGear&rsquo;s review. Saving it as a draft takes it out of the queue — submit it again when you&rsquo;re ready.</p>
        )}
      </ConfirmDialog>

      <PreviewModal vehicle={preview} brandName={preview ? cat.brandName(preview.brand) : undefined} onClose={() => setPreview(null)} />
      {vehicle && <HistoryDrawer vehicleId={history ? vehicle.id : null} onClose={() => setHistory(false)} />}
    </form>
  );
}
