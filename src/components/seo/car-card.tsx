import { getCatalog } from "@/server/catalog";
import { formatPriceRange } from "@/lib/format";
import { C, Eyebrow, Wordmark, clip, ogImage, photo } from "./og";

/**
 * Share card for a catalogue car: photo, brand, name, indicative price and key facts. Used by the model,
 * variant and electric-car pages (their opengraph-image files). Unknown slugs get a generic card.
 */
export async function carShareCard(slug: string) {
  const cat = await getCatalog();
  const car = cat.getCar(slug);
  const brand = car ? cat.brandName(car.brand) : "";
  const img = car ? await photo(car.images[0], 620, 630) : null;

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
              <span style={{ fontFamily: "Geist", fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Ex-showroom (indicative)</span>
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
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, background: C.red, display: "flex" }} />
      </div>
    </div>,
  );
}
