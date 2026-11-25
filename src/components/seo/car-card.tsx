import { getCatalog } from "@/server/catalog";
import { creditFor } from "@/server/photo-credits";
import { sourceName } from "@/lib/photo-credits";
import { formatPriceRange } from "@/lib/format";
import { C, Eyebrow, Wordmark, clip, ogImage, photo } from "./og";
import { PROFILES, WHEEL_Y } from "@/components/vehicle/silhouettes";
import type { BodyType } from "@/types";

/** The body-type line art for models without photos yet, drawn for the share card's right-hand panel. */
function Silhouette({ bodyType }: { bodyType: BodyType }) {
  const p = PROFILES[bodyType] ?? PROFILES.SUV;
  return (
    <svg width="520" height="208" viewBox="0 0 240 96" fill="none" stroke="rgba(255,255,255,0.42)" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="120" cy="86" rx="104" ry="3.2" fill="rgba(255,255,255,0.08)" stroke="none" />
      <path d={p.body} strokeWidth="0.75" />
      {p.glass.map((d) => (
        <path key={d} d={d} strokeWidth="0.55" stroke="rgba(255,255,255,0.3)" />
      ))}
      {p.extra && <path d={p.extra} strokeWidth="0.75" />}
      {p.wheels.map((x) => (
        <circle key={x} cx={x} cy={WHEEL_Y} r={p.r} strokeWidth="0.75" />
      ))}
      {p.wheels.map((x) => (
        <circle key={`h${x}`} cx={x} cy={WHEEL_Y} r={p.r * 0.42} strokeWidth="0.55" stroke="rgba(255,255,255,0.3)" />
      ))}
    </svg>
  );
}

/**
 * Share card for a catalogue car: photo, brand, name, indicative price and key facts. Used by the model,
 * variant and electric-car pages (their opengraph-image files). Unknown slugs get a generic card.
 */
export async function carShareCard(slug: string) {
  const cat = await getCatalog();
  const car = cat.getCar(slug);
  const brand = car ? cat.brandName(car.brand) : "";
  const img = car?.images[0] ? await photo(car.images[0], 620, 630) : null;
  // Free-licensed photos carry their credit on the card too (the licence travels with the picture).
  const credit = img ? await creditFor(car?.images[0]) : null;

  const facts = car
    ? [
        car.bodyType,
        car.fuelTypes.join(" · "),
        car.ev ? `${car.ev.rangeKm} km range` : car.efficiency,
      ].filter(Boolean)
    : [];

  return ogImage(
    <div style={{ width: "100%", height: "100%", display: "flex", background: C.ink }}>
      <div style={{ width: 580, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 56px 52px 64px" }}>
        <Wordmark scale={0.85} />
        {car ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Eyebrow>{brand}</Eyebrow>
            <div style={{ display: "flex", marginTop: 22, fontFamily: "Archivo", fontSize: car.name.length > 14 ? 58 : 70, lineHeight: 1.02, letterSpacing: -2.5, color: C.white }}>
              {clip(car.name, 28)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
              <span style={{ fontFamily: "Geist", fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
                {car.priceCity ? `Ex-showroom ${car.priceCity}` : "Ex-showroom (indicative)"}
              </span>
              <span style={{ marginTop: 8, fontFamily: "Archivo", fontSize: 40, letterSpacing: -1, color: C.white }}>{formatPriceRange(car.priceMin, car.priceMax)}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontFamily: "Archivo", fontSize: 64, color: C.white }}>New cars in India</div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {facts.map((f) => (
            <span key={f} style={{ display: "flex", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 3, padding: "7px 12px", fontFamily: "Geist", fontWeight: 600, fontSize: 17, color: "rgba(255,255,255,0.82)" }}>
              {f}
            </span>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, height: "100%", display: "flex", position: "relative", background: C.ink2 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og (Satori), not the browser */}
        {img && <img src={img} width={620} height={630} alt="" style={{ width: 620, height: 630, objectFit: "cover" }} />}
        {credit && (
          <div style={{ position: "absolute", right: 0, bottom: 0, display: "flex", maxWidth: 600, padding: "6px 12px", background: "rgba(17,17,17,0.72)", fontFamily: "Geist", fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
            {clip(`Photo: ${credit.author} · ${credit.license} · ${sourceName(credit.sourceUrl)} · resized`, 90)}
          </div>
        )}
        {/* No photo yet: the body-type silhouette on the graphite panel, not an empty box. */}
        {!img && car && (
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <Silhouette bodyType={car.bodyType} />
            <span style={{ marginTop: 26, fontFamily: "Geist", fontWeight: 600, fontSize: 16, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
              {car.variants.length} {car.variants.length === 1 ? "variant" : "variants"} · {car.seats.join(" / ")} seats
            </span>
          </div>
        )}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, background: C.red, display: "flex" }} />
      </div>
    </div>,
  );
}
