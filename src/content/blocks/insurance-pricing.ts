import { z } from "zod";
import { DEFAULT_PRICING_CONFIG } from "@/insurance/estimator";
import { defineBlock, number, optionalText, rows } from "../define";

const slab = (unit: string) =>
  z.object({
    max: z
      .number()
      .min(1, `The ${unit} limit must be above 0`)
      .max(100000)
      .nullish()
      .transform((v) => v ?? null),
    annual: number("1-year premium", 0, 1_000_000),
    threeYear: number("3-year premium", 0, 3_000_000),
  });

const ascending = (label: string) => (s: { max: number | null }[]) => {
  const bounded = s.filter((x) => x.max !== null).map((x) => x.max as number);
  return bounded.every((v, i) => i === 0 || v > bounded[i - 1]) && s.filter((x) => x.max === null).length <= 1 && (s.length === 0 || s[s.length - 1].max === null)
    ? true
    : `List ${label} slabs from smallest to largest and leave the last one's limit empty`;
};

/**
 * The rates behind every indicative premium on the site (quotes, compare, the vendor quote builder).
 * Edited at /admin/insurance/pricing.
 */
export const insurancePricing = defineBlock({
  key: "insurancePricing",
  title: "Insurance pricing configuration",
  group: "Insurance",
  description:
    "Third-party rates, IDV depreciation, GST and the allowed own-damage rate range used for indicative premiums. Check third-party rates against the latest regulator notification before going live.",
  usedOn: ["/insurance/quotes", "/insurance/compare", "Insurance vendor portal → Quotes"],
  schema: z.object({
    tpPrivateCar: rows(slab("cc"), "slab", 1).superRefine((s, ctx) => {
      const r = ascending("engine")(s);
      if (r !== true) ctx.addIssue({ code: "custom", message: r });
    }),
    tpElectric: rows(slab("kW"), "slab", 1).superRefine((s, ctx) => {
      const r = ascending("motor power")(s);
      if (r !== true) ctx.addIssue({ code: "custom", message: r });
    }),
    depreciation: rows(z.object({ maxAgeMonths: number("age in months", 1, 600), pct: number("depreciation", 0, 95) }), "row", 1).refine(
      (d) => d.every((x, i) => i === 0 || x.maxAgeMonths > d[i - 1].maxAgeMonths),
      "List ages from youngest to oldest",
    ),
    // Stored as rows ({ pct }) so the admin form round-trips; plain numbers from older saves are accepted too.
    // pricingConfigFrom() turns them into the estimator's number list.
    olderDepreciationPct: z.array(z.union([z.object({ pct: number("depreciation", 0, 95) }), number("depreciation", 0, 95).transform((pct) => ({ pct }))])),
    gstPct: number("GST rate", 0, 40),
    paOwnerDriver: number("personal accident premium", 0, 10000),
    odRate: z
      .object({ min: number("minimum OD rate", 0, 20), max: number("maximum OD rate", 0, 20), default: number("default OD rate", 0, 20) })
      .refine((r) => r.min <= r.default && r.default <= r.max, "The default rate must sit between the minimum and maximum"),
    maxVehicleAgeYears: number("maximum car age", 1, 30),
    disclaimer: optionalText(600),
  }),
  defaults: {
    tpPrivateCar: DEFAULT_PRICING_CONFIG.tpPrivateCar,
    tpElectric: DEFAULT_PRICING_CONFIG.tpElectric,
    depreciation: DEFAULT_PRICING_CONFIG.depreciation,
    olderDepreciationPct: DEFAULT_PRICING_CONFIG.olderDepreciationPct.map((pct) => ({ pct })),
    gstPct: DEFAULT_PRICING_CONFIG.gstPct,
    paOwnerDriver: DEFAULT_PRICING_CONFIG.paOwnerDriver,
    odRate: DEFAULT_PRICING_CONFIG.odRate,
    maxVehicleAgeYears: DEFAULT_PRICING_CONFIG.maxVehicleAgeYears,
    disclaimer: "",
  },
  sections: [
    {
      title: "Third-party premiums",
      description: "Third-party rates are notified by the regulator — confirm them before going live. Leave the last slab's limit empty (it covers everything above).",
      fields: [
        {
          name: "tpPrivateCar",
          label: "Petrol, diesel, CNG and hybrid cars (by engine cc)",
          type: "rows",
          addLabel: "Add slab",
          fields: [
            { name: "max", label: "Up to (cc)", type: "number", min: 1, hint: "Empty = above the previous slab" },
            { name: "annual", label: "1 year", type: "number", required: true, prefix: "₹", min: 0 },
            { name: "threeYear", label: "3 years (new cars)", type: "number", required: true, prefix: "₹", min: 0 },
          ],
        },
        {
          name: "tpElectric",
          label: "Electric cars (by motor kW)",
          type: "rows",
          addLabel: "Add slab",
          fields: [
            { name: "max", label: "Up to (kW)", type: "number", min: 1, hint: "Empty = above the previous slab" },
            { name: "annual", label: "1 year", type: "number", required: true, prefix: "₹", min: 0 },
            { name: "threeYear", label: "3 years (new cars)", type: "number", required: true, prefix: "₹", min: 0 },
          ],
        },
      ],
    },
    {
      title: "IDV depreciation",
      description: "How much of the ex-showroom price is deducted to get the insured declared value (IDV), by the car's age.",
      fields: [
        {
          name: "depreciation",
          label: "Up to 5 years",
          type: "rows",
          addLabel: "Add age band",
          fields: [
            { name: "maxAgeMonths", label: "Up to (months)", type: "number", required: true, min: 1 },
            { name: "pct", label: "Depreciation", type: "number", required: true, suffix: "%", min: 0, max: 95 },
          ],
        },
        {
          name: "olderDepreciationPct",
          label: "Each further year (approximate — IDV is agreed with the insurer)",
          type: "rows",
          addLabel: "Add year",
          fields: [{ name: "pct", label: "Depreciation", type: "number", required: true, suffix: "%", min: 0, max: 95 }],
        },
      ],
    },
    {
      title: "Rates and limits",
      fields: [
        { name: "gstPct", label: "GST on motor insurance", type: "number", required: true, suffix: "%", step: 0.5, min: 0 },
        { name: "paOwnerDriver", label: "Owner-driver personal accident cover (per year)", type: "number", required: true, prefix: "₹", min: 0, hint: "A typical premium; insurers' own rates vary." },
        {
          name: "odRate",
          label: "Own-damage rate vendors may set (% of IDV per year)",
          type: "group",
          fields: [
            { name: "min", label: "Minimum", type: "number", required: true, suffix: "%", step: 0.1, min: 0 },
            { name: "default", label: "Default", type: "number", required: true, suffix: "%", step: 0.1, min: 0 },
            { name: "max", label: "Maximum", type: "number", required: true, suffix: "%", step: 0.1, min: 0 },
          ],
        },
        { name: "maxVehicleAgeYears", label: "Oldest car we estimate for", type: "number", required: true, suffix: "years", min: 1 },
        { name: "disclaimer", label: "Extra note under estimates", type: "textarea", hint: "Optional. Added to the standard “indicative premium” note." },
      ],
    },
  ],
});
