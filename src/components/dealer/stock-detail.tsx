"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { CarPlaceholder, asBodyType } from "@/components/vehicle/car-image";
import { Check, MapPin, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatINR, formatKm, formatPrice } from "@/lib/format";
import { INSURANCE_OPTIONS, conditionLabel, waitingLabel, type PublicVehicle } from "@/components/portal/inventory/shared";

/* ──────────────────────────────────────────────────────────────
   A dealer's vehicle as buyers see it: gallery, price, key facts,
   specifications and features. Used by the public dealer page's
   stock details and by the dealer portal's preview, so the
   preview is exactly what goes live. A new car's photos, specs
   and features are the catalogue's; a used car shows its own
   photos and history with the catalogue's specs.
   ────────────────────────────────────────────────────────────── */

/** "3 in stock", "On order · about 6 weeks", "Available", "Out of stock". */
export function availabilityText(v: Pick<PublicVehicle, "kind" | "stock" | "availability" | "waitingWeeks">) {
  if (v.kind === "used") return v.stock > 0 ? "Available" : "Sold";
  if (v.availability === "on_order") return `On order · ${waitingLabel(v.waitingWeeks)}`;
  return v.stock > 0 ? `${v.stock} in stock` : "Out of stock";
}

export const stockTitle = (v: Pick<PublicVehicle, "year" | "model">, brandName: string) => [v.year > 0 ? v.year : null, brandName, v.model].filter(Boolean).join(" ");


/** Listing photos; a new car whose catalogue model has no photos yet shows the body-type placeholder. */
export function StockGallery({ images, alt, className, bodyType }: { images: string[]; alt: string; className?: string; bodyType?: string }) {
  const [active, setActive] = useState(0);
  const list = images.length ? images : [];
  const current = list[Math.min(active, list.length - 1)];
  return (
    <div className={className}>
      <div className="relative aspect-[16/10] overflow-hidden bg-mist">
        {current ? (
          <Image key={current} src={current} alt={alt} fill sizes="(min-width: 1024px) 640px, 100vw" className="object-cover" />
        ) : (
          bodyType ? (
            <CarPlaceholder bodyType={asBodyType(bodyType)} />
          ) : (
            <div className="flex size-full items-center justify-center text-[13px] text-muted">No photos yet</div>
          )
        )}
        {list.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 text-[11.5px] font-medium text-white backdrop-blur-sm num">
            {Math.min(active, list.length - 1) + 1} / {list.length}
          </span>
        )}
      </div>
      {list.length > 1 && (
        <ul className="no-scrollbar mt-2 flex gap-2 overflow-x-auto" aria-label="Photos">
          {list.map((src, i) => (
            <li key={`${src}-${i}`} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                className={cn("relative block h-14 w-20 overflow-hidden border-2 bg-mist transition-colors duration-300", i === active ? "border-ink" : "border-transparent opacity-70 hover:opacity-100")}
              >
                <Image src={src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-line pt-3">
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className="mt-1 truncate text-[14px] font-medium text-ink">{value || "—"}</dd>
    </div>
  );
}

const insuranceLabel = (s: string) => INSURANCE_OPTIONS.find((o) => o.value === s)?.label ?? "";

/** The full public view of a dealer vehicle. `actions` renders under the price (enquiry buttons). */
export function StockVehicleDetail({ vehicle: v, brandName, actions, className }: { vehicle: PublicVehicle; brandName: string; actions?: ReactNode; className?: string }) {
  const title = stockTitle(v, brandName) || "Untitled vehicle";
  const used = v.used;
  const saving = v.exShowroom && v.sellingPrice && v.exShowroom > v.sellingPrice ? v.exShowroom - v.sellingPrice : 0;
  const facts: { label: string; value: ReactNode }[] = [
    { label: "Fuel", value: v.fuel },
    { label: "Transmission", value: v.transmission },
    { label: "Body type", value: v.bodyType },
    {
      label: "Colour",
      value: v.colour ? (
        <span className="inline-flex max-w-full items-center gap-1.5">
          {v.colourHex && <span aria-hidden className="size-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: v.colourHex }} />}
          <span className="truncate">{v.colour}</span>
        </span>
      ) : v.kind === "new" ? (
        "Ask the showroom"
      ) : (
        ""
      ),
    },
    ...(used
      ? [
          { label: "Condition", value: conditionLabel(used.condition) },
          { label: "Odometer", value: used.km !== null ? formatKm(used.km) : "" },
          { label: "Owners", value: used.owners ? (used.owners === 1 ? "1st owner" : `${used.owners} owners`) : "" },
          { label: "Registered", value: [used.registrationYear, used.registrationState].filter(Boolean).join(" · ") },
          {
            label: "Insurance",
            value: used.insurance.status ? `${insuranceLabel(used.insurance.status)}${used.insurance.validUntil ? ` till ${formatDate(used.insurance.validUntil)}` : ""}` : "",
          },
        ]
      : [{ label: "Model year", value: v.year > 0 ? String(v.year) : "" }]),
  ];

  return (
    <article className={cn("grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10", className)}>
      <div className="min-w-0">
        <StockGallery images={v.images} alt={title} bodyType={v.bodyType} />
        {v.kind === "new" && v.images.length > 0 && <p className="mt-2 text-[11.5px] text-muted">Photos from the MarchGear catalogue — colours and equipment may differ by variant.</p>}
        {v.description && (
          <section className="mt-8">
            <h3 className="type-eyebrow text-ink">{v.kind === "used" ? "Condition notes" : `About the ${v.model}`}</h3>
            <p className={cn("mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-ink/80", v.kind === "new" && "line-clamp-6")}>{v.description}</p>
          </section>
        )}
        {v.features.length > 0 && (
          <section className="mt-8">
            <h3 className="type-eyebrow text-ink">Features</h3>
            <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {v.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[14px] text-ink/85">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-red" strokeWidth={2.25} />
                  <span className="min-w-0">{f}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="min-w-0">
        <p className="type-eyebrow inline-flex items-center gap-3 text-muted">
          <span aria-hidden className="h-px w-6 bg-red" />
          {v.kind === "used" ? "Pre-owned · Dealer certified listing" : v.availability === "on_order" ? "New car · On order" : "New car · In stock"}
        </p>
        <h2 className="mt-4 font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-balance md:text-[30px]">{title}</h2>
        <p className="mt-1.5 text-[14.5px] text-muted">{[v.variant, v.colour].filter(Boolean).join(" · ") || "Variant not set"}</p>

        <div className="mt-6 border-y border-line py-5">
          <p className="text-[12px] text-muted">{v.kind === "used" ? "Asking price" : "Dealer price"}</p>
          <p className="mt-1 text-[2rem] font-semibold leading-none tracking-[-0.03em] num">{v.sellingPrice > 0 ? formatPrice(v.sellingPrice) : "Price on request"}</p>
          <p className="mt-2 text-[12.5px] text-muted num">
            {v.exShowroom ? (
              <>
                {v.kind === "used" ? "New price" : "Ex-showroom"} {formatINR(v.exShowroom)}
                {saving > 0 && <span className="ml-2 font-medium text-[#1e7a3c]">Save {formatPrice(saving)}</span>}
              </>
            ) : (
              "Indicative · confirm the final price with the showroom"
            )}
          </p>
          <p className="mt-3 inline-flex items-center gap-2 text-[13px] font-medium">
            <span aria-hidden className={cn("size-2 rounded-full", v.stock > 0 ? "bg-[#1e7a3c]" : v.kind === "new" && v.availability === "on_order" ? "bg-[#c98a1b]" : "bg-muted")} />
            {availabilityText(v)}
          </p>
        </div>

        {actions && <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">{actions}</div>}

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
          {facts.map((f) => (
            <Fact key={f.label} label={f.label} value={f.value} />
          ))}
        </dl>

        {used && (
          <div className="mt-6 space-y-2 text-[13px]">
            <p className={cn("flex items-start gap-2", used.accident.hadAccident ? "text-[#9a5b00]" : "text-ink/80")}>
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{used.accident.hadAccident ? `Accident history declared: ${used.accident.details}` : "No accident history declared by the dealer"}</span>
            </p>
            {used.hasInspection && (
              <p className="flex items-start gap-2 text-ink/80">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-red" /> Inspection report available — ask the dealer for a copy
              </p>
            )}
          </div>
        )}

        {v.specs.length > 0 && (
          <section className="mt-8">
            <h3 className="type-eyebrow text-ink">{v.variant ? `Specifications · ${v.variant}` : "Specifications"}</h3>
            <dl className="mt-3 border-t border-line">
              {v.specs.map((s, i) => (
                <div key={`${s.label}-${i}`} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-[13.5px]">
                  <dt className="text-muted">{s.label}</dt>
                  <dd className="text-right font-medium num">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className="mt-8 border border-line p-4">
          <p className="text-[12px] text-muted">Sold by</p>
          <p className="mt-1 text-[14.5px] font-semibold">{v.dealer.name}</p>
          {(v.showroom || v.dealer.city) && (
            <p className="mt-1 flex items-start gap-1.5 text-[13px] text-muted">
              <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span>{v.showroom ? `${v.showroom.name} · ${v.showroom.address}, ${v.showroom.city}` : [v.dealer.area, v.dealer.city].filter(Boolean).join(", ")}</span>
            </p>
          )}
          <p className="mt-2 text-[11.5px] text-muted num">Listing {v.reference}</p>
        </section>
      </div>
    </article>
  );
}
