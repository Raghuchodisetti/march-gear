import { C, Eyebrow, OG_CONTENT_TYPE, OG_SIZE, Wordmark, ogImage } from "@/components/seo/og";

/** The site-wide share card: pages without their own image (and the root default) use it. */
export const alt = "MarchGear — research, compare and buy cars in India";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const PILLARS = ["New cars", "Used cars", "Electric", "Reviews", "Insurance", "Tools"];

export default async function Image() {
  return ogImage(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: C.ink, padding: "64px 72px", position: "relative" }}>
      {/* Gear-gate lines, faint, on the right */}
      <svg width="400" height="630" viewBox="0 0 400 630" style={{ position: "absolute", right: 40, top: 0 }}>
        <path d="M80 150v330M200 150v330M320 150v165M80 315h240" stroke="rgba(255,255,255,0.07)" strokeWidth="26" strokeLinecap="round" fill="none" />
        <circle cx="320" cy="480" r="22" fill={C.red} />
      </svg>

      <Wordmark />

      <div style={{ display: "flex", flexDirection: "column", maxWidth: 820 }}>
        <Eyebrow>India&apos;s car research platform</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, fontFamily: "Archivo", fontSize: 84, lineHeight: 1, letterSpacing: -3, color: C.white }}>
          <span>Find the car</span>
          <span>that moves you.</span>
        </div>
        <div style={{ display: "flex", marginTop: 30, fontFamily: "Geist", fontSize: 26, lineHeight: 1.4, color: "rgba(255,255,255,0.66)" }}>
          Prices, specs and expert reviews — compare, then buy with confidence.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.14)", paddingTop: 26 }}>
        <div style={{ display: "flex", gap: 26, fontFamily: "Geist", fontWeight: 600, fontSize: 20, color: "rgba(255,255,255,0.8)" }}>
          {PILLARS.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
        <span style={{ fontFamily: "Geist", fontSize: 20, color: "rgba(255,255,255,0.5)" }}>marchgear.in</span>
      </div>
    </div>,
  );
}
