import type { InsProductCategory, InsProductStatus, InsQuoteAuthorization } from "@/db/enums";
import { ageYears, eligibilityProblems, estimatePremium, vehicleAgeMonths, type PricingConfig } from "@/insurance/estimator";
import type { CoverPricing, FuelName, ProductCoverage, ProductDeductibles, ProductEligibility, ProductPricing, QuoteBreakdown, QuoteCoverLine } from "@/insurance/types";

/* ──────────────────────────────────────────────────────────────
   Vendor quote builder maths. Pure and client-safe: the builder's
   live preview and the Server Action that saves a quote both run
   priceQuote(), so what the vendor sees is what gets stored — the
   server never trusts the browser's figures.
   ────────────────────────────────────────────────────────────── */

/** The customer's car, resolved from the catalogue variant (same as the public estimator). */
export interface BuilderVehicle {
  brand: string;
  model: string;
  variant: string;
  brandName: string;
  modelName: string;
  variantName: string;
  year: number | null;
  isNew: boolean;
  fuel: FuelName | "";
  /** Ex-showroom price of the variant (₹). */
  exShowroom: number;
  engineCc: number | null;
  motorKw: number | null;
  bodyType: string | null;
  isLuxury: boolean;
  city: string;
  state: string;
}

export interface BuilderCover {
  coverId: number;
  key: string;
  name: string;
  description: string;
  pricing: CoverPricing;
  maxVehicleAgeYears: number | null;
  fuels: string[];
}

export interface BuilderAddOn extends BuilderCover {
  /** Bundled into the product's price. */
  included: boolean;
}

/** One of the vendor's approved or published products, with only its approved covers. */
export interface BuilderProduct {
  id: number;
  reference: string;
  name: string;
  code: string;
  uin: string | null;
  category: InsProductCategory;
  status: InsProductStatus;
  companyName: string;
  eligibility: ProductEligibility;
  coverage: ProductCoverage;
  pricing: ProductPricing;
  deductibles: ProductDeductibles;
  addOns: BuilderAddOn[];
  coverageItems: BuilderCover[];
  /** Covers the product lists that aren't approved yet (left out of the quote). */
  unapprovedCovers: number;
  exclusions: string[];
  terms: string | null;
}

export interface QuoteChoices {
  idv: number | null;
  ncbPct: number;
  includePa: boolean;
  /** Optional add-ons the vendor ticked (cover ids). Included ones are always in. */
  addOnIds: number[];
  voluntaryDeductible: number;
  /** ₹ on own damage: negative = discount, positive = loading. */
  adjustment: number;
}

export interface QuoteForm extends QuoteChoices {
  productId: number | null;
  coverage: QuoteCoverLine[];
  validUntil: string;
  authorization: InsQuoteAuthorization;
  insurerQuoteRef: string;
  declaration: boolean;
  notes: string;
  terms: string;
}

export const MAX_COVER_LINES = 20;

/** Why an add-on can't go on this car (null = fine). */
export function addOnProblem(a: Pick<BuilderCover, "maxVehicleAgeYears" | "fuels">, v: Pick<BuilderVehicle, "fuel" | "year" | "isNew">, today: string): string | null {
  const age = ageYears(vehicleAgeMonths(v.year, v.isNew, today));
  if (a.maxVehicleAgeYears !== null && a.maxVehicleAgeYears !== undefined && age > a.maxVehicleAgeYears) return `Only for cars up to ${a.maxVehicleAgeYears} years old`;
  if (a.fuels.length && v.fuel && !a.fuels.includes(v.fuel)) return `Only for ${a.fuels.join(", ")} cars`;
  return null;
}

/** Why this product can't be quoted for this car (empty = eligible). */
export function productProblems(p: BuilderProduct, v: BuilderVehicle, config: PricingConfig, today: string): string[] {
  const age = ageYears(vehicleAgeMonths(v.year, v.isNew, today));
  const out = eligibilityProblems(p.eligibility, { brand: v.brand, model: v.model, bodyType: v.bodyType, isLuxury: v.isLuxury, fuel: v.fuel, ageYears: age, state: v.state, city: v.city });
  if (age > config.maxVehicleAgeYears) out.push(`MarchGear estimates premiums for cars up to ${config.maxVehicleAgeYears} years old`);
  if (!p.coverage.ownDamage && !p.coverage.thirdParty) out.push("The product has neither own-damage nor third-party cover");
  return out;
}

/** Coverage lines to start from: the product's own cover plus its approved coverage items. */
export function defaultCoverLines(p: BuilderProduct, includePa: boolean): QuoteCoverLine[] {
  const lines: QuoteCoverLine[] = [];
  if (p.coverage.ownDamage)
    lines.push({ name: "Own damage", detail: `Accidental damage, fire, theft and natural or man-made calamities, up to the insured declared value (IDV)${p.pricing.odYears > 1 ? ` · ${p.pricing.odYears} years` : ""}.` });
  if (p.coverage.thirdParty)
    lines.push({
      name: "Third-party liability",
      detail: `Death or injury to other people, and damage to their property${p.coverage.tpPropertyLimit ? ` up to ${p.coverage.tpPropertyLimit}` : ""}${p.pricing.tpYears > 1 ? ` · ${p.pricing.tpYears} years` : ""}.`,
    });
  if (p.coverage.thirdParty && (p.coverage.paOwnerDriver === "included" || (p.coverage.paOwnerDriver === "optional" && includePa)))
    lines.push({ name: "Personal accident cover", detail: "Compulsory personal accident cover for the owner-driver." });
  for (const c of p.coverageItems) lines.push({ name: c.name, detail: c.description.slice(0, 300) });
  return lines.slice(0, MAX_COVER_LINES);
}

const round = (n: number) => Math.round(n);

/**
 * The quotation's premium. Uses estimatePremium() with the product's pricing and the admin's rates, then applies the
 * vendor's own adjustment to own damage. Returns the breakdown plus anything that had to be clamped.
 */
export function priceQuote(v: BuilderVehicle, p: BuilderProduct, c: QuoteChoices, config: PricingConfig, today: string): { breakdown: QuoteBreakdown; problems: Record<string, string> } {
  const problems: Record<string, string> = {};
  const isNew = v.isNew;
  const selected = new Set(c.addOnIds);
  for (const id of selected) {
    const a = p.addOns.find((x) => x.coverId === id);
    if (!a) problems.addOnIds = "Choose add-ons from this product's approved add-on covers";
    else {
      const why = addOnProblem(a, v, today);
      if (why) problems.addOnIds = `${a.name}: ${why.toLowerCase()}`;
    }
  }
  if (!config.ncbSlabs.includes(c.ncbPct)) problems.ncbPct = "Choose a no-claim bonus slab";

  const est = estimatePremium({
    exShowroom: v.exShowroom,
    ageMonths: vehicleAgeMonths(v.year, isNew, today),
    isNew,
    fuel: v.fuel,
    engineCc: v.engineCc,
    motorKw: v.motorKw,
    ncbPct: isNew ? 0 : config.ncbSlabs.includes(c.ncbPct) ? c.ncbPct : 0,
    pricing: p.pricing,
    paOwnerDriver: p.coverage.thirdParty ? p.coverage.paOwnerDriver : "none",
    includePa: c.includePa,
    addOns: p.addOns.map((a) => ({ coverId: a.coverId, key: a.key, name: a.name, pricing: a.pricing, included: a.included, selected: selected.has(a.coverId) })),
    idv: c.idv,
    config,
  });
  if (est.odYears > 0 && c.idv !== null && (c.idv < est.idvMin || c.idv > est.idvMax)) problems.idv = `Keep the IDV between ₹${est.idvMin.toLocaleString("en-IN")} and ₹${est.idvMax.toLocaleString("en-IN")}`;

  // Vendor adjustment on own damage: a discount can't take OD (after NCB) below zero; a loading is capped at +100% of OD.
  const odNet = est.od - est.ncbDiscount;
  let adjustment = round(c.adjustment || 0);
  if (est.odYears === 0 && adjustment !== 0) {
    problems.adjustment = "This product has no own-damage premium to adjust";
    adjustment = 0;
  } else if (adjustment < -odNet) {
    problems.adjustment = `The discount can't be more than the own-damage premium after NCB (₹${odNet.toLocaleString("en-IN")})`;
    adjustment = -odNet;
  } else if (adjustment > est.od) {
    problems.adjustment = `A loading can't be more than the own-damage premium (₹${est.od.toLocaleString("en-IN")})`;
    adjustment = est.od;
  }

  const voluntary = round(c.voluntaryDeductible || 0);
  if (voluntary && !p.deductibles.voluntary.includes(voluntary)) problems.voluntaryDeductible = "Choose one of the product's voluntary deductibles";
  const deductible = (p.deductibles.compulsory || 0) + (p.deductibles.voluntary.includes(voluntary) ? voluntary : 0);

  const net = Math.max(0, est.net + adjustment);
  const gst = round((net * est.gstPct) / 100);
  return {
    breakdown: { ...est, adjustment, deductible, net, gst, total: net + gst },
    problems,
  };
}

/** Lines for a breakdown table: [label, amount, kind]. */
export function breakdownLines(b: QuoteBreakdown): { label: string; amount: number; kind: "plus" | "minus" | "included" | "subtotal" | "tax" | "total" }[] {
  const out: ReturnType<typeof breakdownLines> = [];
  if (b.odYears > 0) out.push({ label: `Own damage${b.odYears > 1 ? ` (${b.odYears} years)` : ""}`, amount: b.od, kind: "plus" });
  if (b.ncbDiscount) out.push({ label: `No-claim bonus (${b.ncbPct}%)`, amount: -b.ncbDiscount, kind: "minus" });
  if (b.adjustment) out.push({ label: b.adjustment < 0 ? "Discount on own damage" : "Loading on own damage", amount: b.adjustment, kind: b.adjustment < 0 ? "minus" : "plus" });
  if (b.tpYears > 0) out.push({ label: `Third-party liability${b.tpYears > 1 ? ` (${b.tpYears} years)` : ""}`, amount: b.tp, kind: "plus" });
  if (b.pa) out.push({ label: "Personal accident (owner-driver)", amount: b.pa, kind: "plus" });
  for (const a of b.addOns) out.push({ label: `${a.name}${a.included ? " (included)" : ""}`, amount: a.premium, kind: a.included && !a.premium ? "included" : "plus" });
  out.push({ label: "Net premium", amount: b.net, kind: "subtotal" });
  out.push({ label: `GST (${b.gstPct}%)`, amount: b.gst, kind: "tax" });
  out.push({ label: "Total premium", amount: b.total, kind: "total" });
  return out;
}

export const AUTH_EXPLAINER: Record<InsQuoteAuthorization, { title: string; body: string }> = {
  indicative: {
    title: "Indicative estimate",
    body: "Your own estimate, priced with MarchGear's indicative rates and your product's pricing. The customer sees it labelled “Indicative estimate — not an insurer quotation”. The insurer sets the final premium, IDV and terms when the policy is issued.",
  },
  insurer_authorised: {
    title: "Insurer-authorised quotation",
    body: "A quotation the insurer itself has issued (for example from its quoting system), which you're authorised to share. Enter the insurer's quotation reference — it's shown to the customer and on the PDF.",
  },
};

export const AUTH_DECLARATION = "This quotation was issued by the insurer and I'm authorised to share it.";
