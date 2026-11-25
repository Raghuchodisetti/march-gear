import { C, Eyebrow, Wordmark, ogImage } from "@/components/seo/og";

/**
 * Share card for the insurance section (/og/insurance), used by every /insurance page. A route handler
 * rather than an opengraph-image file so its URL is stable: metadata files inside the (site) route group
 * get a hashed suffix, and the insurance sub-pages need to point at one shared image.
 */
export const dynamic = "force-static";

const POINTS = ["Cover & add-ons side by side", "IDV & indicative premiums", "Quotes from insurers you pick"];

export async function GET() {
  return ogImage(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: C.ink, padding: "64px 72px", position: "relative" }}>
      {/* A shield outline, faint, on the right */}
      <svg width="300" height="350" viewBox="0 0 24 28" style={{ position: "absolute", right: 80, top: 120 }}>
        <path d="M12 1.5 2.5 5v8.2c0 6.1 4 10.9 9.5 13.3 5.5-2.4 9.5-7.2 9.5-13.3V5L12 1.5Z" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="m7.8 14.2 3 3 5.6-6" fill="none" stroke={C.red} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <Wordmark />

      <div style={{ display: "flex", flexDirection: "column", maxWidth: 800 }}>
        <Eyebrow>Car insurance</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 26, fontFamily: "Archivo", fontSize: 60, lineHeight: 1.05, letterSpacing: -2, color: C.white }}>
          <span>Compare cover clearly.</span>
          <span>Then ask for real quotes.</span>
        </div>
        <div style={{ display: "flex", marginTop: 24, fontFamily: "Geist", fontSize: 22, color: "rgba(255,255,255,0.6)" }}>
          Premiums shown are indicative — the insurer confirms the final price.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.14)", paddingTop: 26 }}>
        <div style={{ display: "flex", gap: 40, fontFamily: "Geist", fontWeight: 600, fontSize: 19, color: "rgba(255,255,255,0.8)" }}>
          {POINTS.map((p) => (
            <span key={p} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: C.red, display: "flex" }} />
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>,
  );
}
