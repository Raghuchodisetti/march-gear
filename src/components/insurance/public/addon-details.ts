import type { StandardCover } from "@/insurance/covers";

/* Customer-facing detail for each standard add-on (keys from src/insurance/covers.ts). Generic — not any insurer's terms. Client-safe. */

export interface AddOnDetail {
  pays: string;
  watch: string;
  worth: string;
}

export const ADDON_DETAILS: Record<string, AddOnDetail> = {
  zero_dep: {
    pays: "The depreciation the insurer would otherwise deduct on replaced parts — plastic, rubber, fibreglass and metal — so a covered repair costs you little more than the deductible.",
    watch: "A limit on claims per year (two is common), an age limit for the car, and different treatment of tyres, tubes and batteries on some plans.",
    worth: "New and nearly-new cars, premium cars with expensive parts, and owners who drive in dense traffic.",
  },
  engine_protection: {
    pays: "Repair of engine and gearbox damage caused by water getting in or oil leaking out — the kind of damage a standard policy treats as consequential and excludes.",
    watch: "Restarting a car that has stalled in water can be treated as negligence. Call for a tow instead. Often not offered on older cars.",
    worth: "Cities and roads that flood in the monsoon, and cars whose engines are expensive to rebuild.",
  },
  rsa: {
    pays: "Help when the car won't go: towing to a garage, a flat-tyre change, a battery jump-start, fuel delivery (the fuel itself is charged) and small roadside repairs.",
    watch: "Towing distance limits, the number of call-outs per year, and whether help reaches highways and smaller towns.",
    worth: "Long-distance drivers, and cars outside the manufacturer's own assistance programme.",
  },
  rti: {
    pays: "On theft or total loss, the difference between the IDV and the invoice value — typically including road tax and registration.",
    watch: "Only for total loss or theft, not repairs. Usually available only for the first few years of the car's life.",
    worth: "New cars, expensive cars, and cars bought on a loan where the outstanding amount may exceed the IDV.",
  },
  consumables: {
    pays: "Items used up in a repair that standard policies leave out: engine oil, coolant, brake fluid, nuts, bolts, screws, washers, clips and grease.",
    watch: "Paid only alongside an admissible own-damage claim — never for routine servicing.",
    worth: "Owners who already have zero depreciation and want a claim to cost as little as possible.",
  },
  key_replacement: {
    pays: "Replacing lost or stolen keys — including smart keys, which can be costly to code — and, on some plans, the lock set.",
    watch: "A cap per claim or per year, and a police report when keys are stolen.",
    worth: "Cars with keyless entry or expensive smart keys.",
  },
  pa_cover: {
    pays: "A fixed sum if a passenger or paid driver dies or is permanently disabled in an accident involving the car — or a higher sum for the owner-driver.",
    watch: "Sums are fixed per person and limited. It doesn't replace health or life insurance.",
    worth: "Families who travel together often, and cars with a paid driver.",
  },
  tyre_protection: {
    pays: "Repair or replacement of tyres and tubes damaged by bulges, cuts or bursts — which a standard policy pays only when the car is damaged in the same accident.",
    watch: "Normal wear and everyday punctures are excluded. Usually offered only on young cars.",
    worth: "Low-profile or expensive tyres, and roads that are hard on them.",
  },
  electrical_accessories: {
    pays: "Electrical and electronic accessories fitted after purchase — a music system, cameras, lights — that you declare on the policy with their value.",
    watch: "Only declared items, at their declared and depreciated value. Factory-fitted equipment is already part of the IDV.",
    worth: "Cars with costly aftermarket electronics.",
  },
  ncb_protect: {
    pays: "Keeps your no-claim bonus after a claim, so the next renewal still carries the discount.",
    watch: "Usually limited to one or a set number of claims a year. The premium can still change for other reasons.",
    worth: "Owners with a 35–50% bonus they'd hate to lose to a single claim.",
  },
  personal_belongings: {
    pays: "Personal items stolen from the car or damaged in an accident — a bag, a phone, documents.",
    watch: "Low limits, and cash, jewellery and valuables are often excluded. Theft usually needs a police report.",
    worth: "People who often carry belongings in the car. Check first whether a home or gadget policy already covers them.",
  },
  ev_battery: {
    pays: "Damage to the traction battery, motor and charger from water ingress and electrical short circuits — risks a standard policy may exclude.",
    watch: "Gradual capacity loss with age isn't covered (that's the manufacturer's warranty). Ask whether claims are settled by repairing modules or replacing the pack.",
    worth: "Every electric car, and especially in cities that flood.",
  },
};

export function pricingText(c: StandardCover) {
  switch (c.defaultPricing.basis) {
    case "pct_idv":
      return "Usually a percentage of the IDV — more on expensive cars, less as the car ages.";
    case "pct_od":
      return "Usually a share of the own-damage premium.";
    case "flat":
      return "Usually a flat yearly amount, whatever the car's value.";
    default:
      return "Included at no extra cost on plans that offer it.";
  }
}

export function eligibilityText(c: StandardCover) {
  const parts: string[] = [];
  parts.push(c.typicalMaxAge ? `Typically cars up to ${c.typicalMaxAge} years old` : "Usually available whatever the car's age");
  if (c.fuels?.length === 1) parts.push(`${c.fuels[0]} cars only`);
  else if (c.fuels?.length && !c.fuels.includes("Electric")) parts.push("Not for electric cars");
  return parts.join(" · ");
}
