import { BatteryCharging, ClipboardCheck, FileWarning, Gauge, PackageX, Paintbrush, ScanSearch, ShieldCheck, Wrench, Zap, type LucideIcon } from "lucide-react";
import type { FuelType } from "@/types";

/** PDI (pre-delivery inspection) content. Prices are indicative demo figures. */

export type PdiPlanId = "essential" | "complete" | "ev";

export interface PdiPlan {
  id: PdiPlanId;
  name: string;
  price: number;
  duration: string;
  checks: number;
  summary: string;
  features: string[];
  popular?: boolean;
  icon: LucideIcon;
}

export const pdiPlans: PdiPlan[] = [
  {
    id: "essential",
    name: "Essential PDI",
    price: 1499,
    duration: "45–60 min",
    checks: 120,
    summary: "The must-do checks before you sign for any new car.",
    icon: ClipboardCheck,
    features: [
      "Body, paint and glass walk-around",
      "VIN, engine number and manufacturing date check",
      "Tyre date codes and spare wheel",
      "Lights, horn, wipers and AC test",
      "Photo report on WhatsApp and email",
    ],
  },
  {
    id: "complete",
    name: "Complete PDI",
    price: 2499,
    duration: "60–90 min",
    checks: 220,
    summary: "Our most thorough inspection, with professional tools.",
    icon: ScanSearch,
    popular: true,
    features: [
      "Everything in Essential",
      "Paint-depth gauge on every panel (repaint check)",
      "OBD scan for hidden fault codes",
      "Underbody and fluid-level inspection",
      "Accessories and feature list verified against invoice",
      "Expert stays with you through delivery",
    ],
  },
  {
    id: "ev",
    name: "EV PDI",
    price: 2999,
    duration: "75–90 min",
    checks: 240,
    summary: "Built for electric cars — battery and charging included.",
    icon: BatteryCharging,
    features: [
      "Everything in Complete",
      "Battery health and state-of-charge report",
      "AC and DC charging port test",
      "Portable charger and cable check",
      "High-voltage system warning scan",
    ],
  },
];

export const pdiProblems: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Paintbrush, title: "Hidden dents & repaints", text: "Cars get scratched in transit and quietly repainted at the yard. A paint gauge shows what the eye can't." },
  { icon: FileWarning, title: "Old stock", text: "A car built 10 months ago is sold at the same price as a fresh one. We check the real manufacturing date." },
  { icon: PackageX, title: "Missing items", text: "Floor mats, the second key, the toolkit or a paid accessory — easy to miss on delivery day." },
  { icon: Zap, title: "Electrical faults", text: "Warning lights, dead speakers or a faulty camera are far easier to fix before you sign." },
];

export const pdiSteps: { title: string; text: string }[] = [
  { title: "Book in 2 minutes", text: "Tell us your car, dealership and delivery date. Pick a plan." },
  { title: "Expert meets you", text: "A certified inspector joins you at the dealership or stockyard before delivery." },
  { title: "200+ point inspection", text: "Body, paint, documents, tyres, electricals and a short drive — with professional tools." },
  { title: "Report & decision", text: "Get a photo report on the spot. Take delivery, or ask the dealer to fix issues first." },
];

export interface ChecklistGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: { id: string; text: string; tip?: string }[];
}

/** Free do-it-yourself checklist — plain-language, in the order you'd do it at the dealership. */
export const pdiChecklist: ChecklistGroup[] = [
  {
    id: "docs",
    title: "Documents",
    icon: ClipboardCheck,
    items: [
      { id: "docs-vin", text: "VIN and engine number on the car match the invoice", tip: "The VIN is on the windscreen corner and a plate near the door." },
      { id: "docs-mfg", text: "Manufacturing month is recent (ideally within 3–6 months)", tip: "Shown on the VIN plate or a sticker on the door frame." },
      { id: "docs-variant", text: "Invoice shows the correct variant, colour and price" },
      { id: "docs-papers", text: "Insurance and registration papers are in your name" },
      { id: "docs-booklets", text: "Owner's manual, service booklet and warranty card are present" },
      { id: "docs-keys", text: "Both keys are handed over and both work" },
    ],
  },
  {
    id: "exterior",
    title: "Exterior",
    icon: Paintbrush,
    items: [
      { id: "ext-walk", text: "Walk around in daylight — no dents, scratches or chips" },
      { id: "ext-gaps", text: "Gaps between doors, bonnet and boot look even" },
      { id: "ext-paint", text: "Paint colour and shine match on every panel (no repaint)" },
      { id: "ext-glass", text: "Windscreen, windows, mirrors and lights have no cracks" },
      { id: "ext-badges", text: "Badges and variant name are correct" },
      { id: "ext-under", text: "No oil or water leaking under the car" },
    ],
  },
  {
    id: "tyres",
    title: "Tyres & wheels",
    icon: Gauge,
    items: [
      { id: "tyre-match", text: "All four tyres are the same brand and size" },
      { id: "tyre-date", text: "Tyre manufacturing date is recent", tip: "Look for a 4-digit code on the sidewall: '2426' means week 24 of 2026." },
      { id: "tyre-spare", text: "Spare wheel, jack and toolkit are in the boot" },
      { id: "tyre-alloys", text: "Wheels have no scuffs or scratches" },
    ],
  },
  {
    id: "interior",
    title: "Interior",
    icon: ShieldCheck,
    items: [
      { id: "int-clean", text: "Seats, carpets and roof lining are clean — no stains or tears" },
      { id: "int-odo", text: "Odometer shows very low kilometres (usually under 50 km)" },
      { id: "int-ac", text: "AC cools quickly on all fan speeds" },
      { id: "int-windows", text: "All windows, sunroof and central locking work" },
      { id: "int-media", text: "Touchscreen, speakers, Bluetooth and Android Auto / CarPlay work" },
      { id: "int-seats", text: "Seat adjustments and seat belts work smoothly" },
    ],
  },
  {
    id: "electrical",
    title: "Engine & electricals",
    icon: Wrench,
    items: [
      { id: "ele-start", text: "Engine starts smoothly and no warning lights stay on" },
      { id: "ele-fluids", text: "Engine oil, coolant and brake fluid are at the right level" },
      { id: "ele-lights", text: "Headlamps, indicators, brake and reverse lights work" },
      { id: "ele-horn", text: "Horn, wipers and washer spray work" },
      { id: "ele-camera", text: "Reverse camera and parking sensors work" },
    ],
  },
  {
    id: "handover",
    title: "Test drive & handover",
    icon: Zap,
    items: [
      { id: "ho-drive", text: "Short drive: brakes, steering and gears feel normal" },
      { id: "ho-noise", text: "No rattles, squeaks or unusual noises" },
      { id: "ho-acc", text: "Every accessory you paid for is fitted" },
      { id: "ho-fuel", text: "Fuel (or charge) level is as promised" },
      { id: "ho-write", text: "Any issue is written on the delivery note before you sign" },
    ],
  },
];

type ChecklistItem = ChecklistGroup["items"][number];

export const PDI_FUELS: FuelType[] = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"];

const FUEL_NOUN: Record<FuelType, string> = { Petrol: "petrol", Diesel: "diesel", CNG: "CNG", Hybrid: "hybrid", Electric: "electric" };

/** Extra checks added to the emailed PDF for the buyer's fuel type. */
export const pdiFuelChecks: Record<FuelType, ChecklistItem[]> = {
  Petrol: [
    { id: "fuel-petrol-idle", text: "Engine idles smoothly with no shaking after a cold start" },
    { id: "fuel-petrol-exhaust", text: "No smoke or strong smell from the exhaust" },
    { id: "fuel-petrol-cap", text: "Fuel lid opens and the cap closes and locks properly" },
  ],
  Diesel: [
    { id: "fuel-diesel-start", text: "Starts cleanly with no black smoke from the exhaust" },
    { id: "fuel-diesel-adblue", text: "AdBlue (DEF) is topped up and its warning light is off", tip: "Many BS6 diesels need AdBlue — ask the dealer to fill it before delivery." },
    { id: "fuel-diesel-cap", text: "Fuel lid is marked 'Diesel' and the cap closes properly" },
  ],
  CNG: [
    { id: "fuel-cng-cert", text: "CNG cylinder test certificate is in your documents", tip: "It shows the cylinder's test date. The cylinder must be re-tested every 3 years." },
    { id: "fuel-cng-rc", text: "Registration papers show the fuel as 'Petrol/CNG'" },
    { id: "fuel-cng-switch", text: "Car switches between CNG and petrol smoothly" },
    { id: "fuel-cng-smell", text: "No gas smell in the boot or near the cylinder" },
  ],
  Hybrid: [
    { id: "fuel-hyb-ready", text: "Car shows 'Ready' on start and no hybrid warning light stays on" },
    { id: "fuel-hyb-regen", text: "Energy screen shows the battery charging when you brake or coast" },
    { id: "fuel-hyb-warranty", text: "Hybrid battery warranty is written in the warranty booklet", tip: "Usually 8 years — check the exact years and kilometres." },
  ],
  Electric: [
    { id: "fuel-ev-charge", text: "Battery is charged above 80% and the range shown looks right" },
    { id: "fuel-ev-cable", text: "Portable charging cable is in the car and home charger installation is booked" },
    { id: "fuel-ev-port", text: "Charging port flap opens and locks, and a test charge starts" },
    { id: "fuel-ev-warranty", text: "Battery warranty (years and km) is written in your documents", tip: "Most EV batteries get 8 years — some brands offer more for the first owner." },
  ],
};

// An electric car has no engine, so these checks are worded differently.
const EV_WORDING: Record<string, string> = {
  "docs-vin": "VIN and motor number on the car match the invoice",
  "ele-start": "Car switches on ('Ready') and no warning lights stay on",
  "ele-fluids": "Coolant and brake fluid are at the right level",
};

/** The DIY checklist tailored to a fuel type — adds its own checks before the test drive. */
export function checklistFor(fuel?: FuelType): ChecklistGroup[] {
  if (!fuel) return pdiChecklist;
  const ev = fuel === "Electric";
  const groups = pdiChecklist.map((g) =>
    ev
      ? {
          ...g,
          title: g.id === "electrical" ? "Motor & electricals" : g.title,
          items: g.items.map((i) => (EV_WORDING[i.id] ? { ...i, text: EV_WORDING[i.id] } : i)),
        }
      : g,
  );
  const extra: ChecklistGroup = {
    id: `fuel-${fuel.toLowerCase()}`,
    title: `Extra checks for your ${FUEL_NOUN[fuel]} car`,
    icon: ev ? BatteryCharging : Gauge,
    items: pdiFuelChecks[fuel],
  };
  return [...groups.slice(0, -1), extra, ...groups.slice(-1)];
}

export const checklistCount = (groups: ChecklistGroup[]) => groups.reduce((n, g) => n + g.items.length, 0);

export const pdiSampleReport = {
  car: "Hyundai Creta SX(O) Turbo DCT",
  dealer: "Torque Motors, Indiranagar",
  date: "14 Nov 2026",
  score: 94,
  categories: [
    { label: "Documents", value: 100 },
    { label: "Exterior & paint", value: 92 },
    { label: "Tyres & wheels", value: 84 },
    { label: "Interior", value: 98 },
    { label: "Electricals", value: 100 },
  ],
  findings: [
    { level: "attention" as const, text: "Front-left tyre made 11 months ago", action: "Dealer agreed to replace it before delivery" },
    { level: "minor" as const, text: "Light scratch on rear bumper", action: "Polished out on the spot" },
    { level: "minor" as const, text: "Floor mats missing from accessory pack", action: "Fitted before handover" },
  ],
};

export const pdiFaqs: { q: string; a: string }[] = [
  {
    q: "What exactly is a PDI?",
    a: "PDI stands for pre-delivery inspection. It is a final, detailed check of your new car at the dealership — before you sign the delivery papers and pay the balance — so any damage, missing item or fault is fixed while the dealer is still responsible.",
  },
  {
    q: "When should the PDI be done?",
    a: "Ideally one or two days before delivery, at the dealer's stockyard, while the car is still in the dealer's name. At the latest, do it on delivery day before you sign anything.",
  },
  {
    q: "Will the dealer allow an outside inspector?",
    a: "Yes. A PDI is your right as a buyer. Our inspectors are polite, quick and work alongside the dealer's staff. If you face resistance, our team can speak to the dealership on your behalf.",
  },
  {
    q: "What happens if problems are found?",
    a: "You get a photo report listing every issue and how serious it is. Minor items are usually fixed on the spot; for bigger issues you can ask for repairs or a different car before taking delivery.",
  },
  {
    q: "Is a PDI different for electric cars?",
    a: "An EV PDI adds battery health, charging-port tests (AC and DC), the portable charger and high-voltage warning checks. Choose the EV PDI plan for electric cars.",
  },
  {
    q: "Can I do a PDI myself?",
    a: "Yes — use our free checklist on this page. It covers the most important checks in plain language. An expert adds professional tools such as a paint-depth gauge and OBD scanner that catch what the eye can't.",
  },
];
