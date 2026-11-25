import { z } from "zod";

/* ──────────────────────────────────────────────────────────────
   The researched new-car catalogue: one JSON file per brand in
   src/db/catalogue-data/brands/<brand-slug>.json, validated by
   this schema and loaded by `npm run db:import-catalogue`.

   Facts only, from official Indian sources (each model lists the
   pages it came from). No ratings, scores, opinions or photos:
   photos are uploaded by MarchGear staff in the admin. Unknown
   values are null — never guessed.
   ────────────────────────────────────────────────────────────── */

const url = z.string().url().refine((u) => u.startsWith("https://") || u.startsWith("http://"), "Use a full URL");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lower-case words joined by dashes");
const text = (max: number) => z.string().trim().min(1).max(max);
const positiveInt = z.number().int().positive();

export const BODY_TYPES = ["SUV", "Sedan", "Hatchback", "MUV", "Coupe"] as const;
export const FUELS = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"] as const;
/** The site's gearbox families. Map: MT→Manual; torque-converter AT→Automatic; AMT/AGS→AMT; DCT/DSG/DCA→DCT; CVT/IVT/e-CVT→CVT; single-speed EV→Automatic. */
export const TRANSMISSIONS = ["Manual", "Automatic", "AMT", "DCT", "CVT"] as const;
export const FEATURE_GROUPS = ["Comfort", "Infotainment", "Safety", "Exterior", "Interior", "Performance"] as const;
export const SAFETY_AGENCIES = ["Bharat NCAP", "Global NCAP", "Euro NCAP", "ASEAN NCAP"] as const;

export const variantSchema = z.object({
  /** As the brand names it, e.g. "SX(O) 1.5 Turbo DCT" — unique within the model. */
  name: text(120),
  fuel: z.enum(FUELS),
  transmission: z.enum(TRANSMISSIONS),
  /** The brand's own description, e.g. "6-speed MT", "IVT", "7-speed DCT", "e-CVT". */
  transmissionDetail: text(60).nullable(),
  /** Ex-showroom price in rupees (whole number) in the file's priceCity, as listed on the date in `asOf`. */
  price: positiveInt.max(1_000_000_000),
  /** Claimed figure as published: "20.1 kmpl", "26.5 km/kg", or for EVs the claimed range "502 km". null if not published. */
  efficiency: text(40).nullable(),
  /** Key equipment that distinguishes this trim (up to 10), factual. */
  features: z.array(text(160)).max(10),
});

export const modelSchema = z.object({
  /** Keep the existing slug for models already on the site (see the brief); otherwise "<brand-short>-<model>". */
  slug,
  name: text(120),
  bodyType: z.enum(BODY_TYPES),
  /** The real body style when it isn't one of the five above, e.g. "Pickup", "Convertible", "Crossover", "Estate". */
  bodyStyle: text(40).nullable(),
  isLuxury: z.boolean(),
  /** India launch of the current generation, if published: YYYY-MM-DD (use the 1st if only the month is known). */
  launchedOn: isoDate.nullable(),
  /** e.g. "1197 cc" or "1199 – 1497 cc"; for EVs "Electric motor". */
  engine: text(160),
  /** Range across variants as published, e.g. "82 – 118 bhp" / "60 – 150 kW". null if not published. */
  power: text(80).nullable(),
  torque: text(80).nullable(),
  seats: z.array(z.number().int().min(1).max(12)).min(1),
  /** Maximum airbags available on the model. null if not published. */
  airbags: z.number().int().min(0).max(16).nullable(),
  /** Only an official crash-test result for this model generation. */
  safety: z.object({ rating: z.number().int().min(0).max(5), agency: z.enum(SAFETY_AGENCIES), year: z.number().int().min(2010).max(2030) }).nullable(),
  bootSpaceL: positiveInt.max(5000).nullable(),
  groundClearanceMm: positiveInt.max(500).nullable(),
  fuelTankL: positiveInt.max(200).nullable(),
  topSpeedKmh: positiveInt.max(450).nullable(),
  /** As published, e.g. "0–100 km/h in 9.8 s". */
  acceleration: text(40).nullable(),
  dimensions: z.object({ length: positiveInt, width: positiveInt, height: positiveInt, wheelbase: positiveInt }).nullable(),
  ev: z
    .object({
      rangeKm: positiveInt,
      /** "ARAI", "MIDC", "MIDC P1+P2", "WLTP"… as published. */
      rangeStandard: text(30).nullable(),
      batteryKwh: z.number().positive().max(300),
      /** e.g. "58 min (10–80%, 50 kW)". */
      dcCharge: text(60).nullable(),
      acCharge: text(60).nullable(),
      motorKw: positiveInt.nullable(),
    })
    .nullable(),
  /** Official colour names; hex is an approximate swatch for display. */
  colors: z.array(z.object({ name: text(60), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).max(30),
  features: z.array(z.object({ group: z.enum(FEATURE_GROUPS), items: z.array(text(160)).min(1).max(30) })).max(6),
  /** Factual one-liners (no opinions), e.g. "Level 2 ADAS on top variants". */
  highlights: z.array(text(160)).max(5),
  variants: z.array(variantSchema).min(1),
  /** Official pages (model page, price list, brochure, spec sheet, press release) the data came from. */
  sources: z.array(url).min(1),
  /** Anything uncertain or worth a human check. */
  notes: z.string().max(1000).nullable(),
});

export const brandFileSchema = z
  .object({
    brand: z.object({
      slug,
      name: text(80),
      country: text(60),
      founded: z.number().int().min(1800).max(2030).nullable(),
      /** Short and factual, e.g. "Korean carmaker, in India since 1996". */
      tagline: text(160),
      /** 1–3 factual sentences (history in India, line-up). No marketing claims. */
      description: text(600),
      isLuxury: z.boolean(),
      /** Official Indian website. */
      website: url,
    }),
    /** The date the prices and line-up were checked. */
    asOf: isoDate,
    /** City of the ex-showroom prices, e.g. "Delhi". */
    priceCity: text(40),
    models: z.array(modelSchema),
  })
  .superRefine((f, ctx) => {
    const seen = new Set<string>();
    f.models.forEach((m, i) => {
      if (seen.has(m.slug)) ctx.addIssue({ code: "custom", path: ["models", i, "slug"], message: `Duplicate model slug ${m.slug}` });
      seen.add(m.slug);
      const names = new Set<string>();
      m.variants.forEach((v, j) => {
        if (names.has(v.name)) ctx.addIssue({ code: "custom", path: ["models", i, "variants", j, "name"], message: `Duplicate variant name "${v.name}" in ${m.slug}` });
        names.add(v.name);
      });
      const hasEv = m.variants.some((v) => v.fuel === "Electric");
      if (hasEv && !m.ev) ctx.addIssue({ code: "custom", path: ["models", i, "ev"], message: `${m.slug} has electric variants but no ev block` });
    });
  });

export type BrandFile = z.infer<typeof brandFileSchema>;
export type CatalogueModel = z.infer<typeof modelSchema>;
export type CatalogueVariant = z.infer<typeof variantSchema>;
