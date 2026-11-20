import type { FuelType } from "@/types";
import type { ChecklistGroup, FuelChecks, PdiFaq, PdiPlan, PdiProblem, PdiSampleReport, PdiStep } from "@/lib/pdi";

/** Launch PDI (pre-delivery inspection) content — the defaults for the editable PDI blocks
    (src/content/blocks/pdi-*.ts). Read the live copy from `content.pdiPlans` / `pdiChecklist` /
    `pdiPage`; helpers live in src/lib/pdi.ts. Prices are indicative demo figures. */

export const pdiPlans: PdiPlan[] = [
  {
    id: "essential",
    name: "Essential PDI",
    price: 1499,
    duration: "45–60 min",
    checks: 120,
    summary: "The must-do checks before you sign for any new car.",
    icon: "clipboard-check",
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
    icon: "scan-search",
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
    icon: "battery-charging",
    features: [
      "Everything in Complete",
      "Battery health and state-of-charge report",
      "AC and DC charging port test",
      "Portable charger and cable check",
      "High-voltage system warning scan",
    ],
  },
];

export const pdiProblems: PdiProblem[] = [
  { icon: "paintbrush", title: "Hidden dents & repaints", text: "Cars get scratched in transit and quietly repainted at the yard. A paint gauge shows what the eye can't." },
  { icon: "file-warning", title: "Old stock", text: "A car built 10 months ago is sold at the same price as a fresh one. We check the real manufacturing date." },
  { icon: "package-x", title: "Missing items", text: "Floor mats, the second key, the toolkit or a paid accessory — easy to miss on delivery day." },
  { icon: "zap", title: "Electrical faults", text: "Warning lights, dead speakers or a faulty camera are far easier to fix before you sign." },
];

/** "How it works" heading — it names the number of steps, so it's edited alongside them. */
export const pdiStepsTitle = "Four simple steps to a worry-free delivery.";

export const pdiSteps: PdiStep[] = [
  { title: "Book in 2 minutes", text: "Tell us your car, dealership and delivery date. Pick a plan." },
  { title: "Expert meets you", text: "A certified inspector joins you at the dealership or stockyard before delivery." },
  { title: "200+ point inspection", text: "Body, paint, documents, tyres, electricals and a short drive — with professional tools." },
  { title: "Report & decision", text: "Get a photo report on the spot. Take delivery, or ask the dealer to fix issues first." },
];

/** Free do-it-yourself checklist — plain-language, in the order you'd do it at the dealership. */
export const pdiChecklist: ChecklistGroup[] = [
  {
    id: "docs",
    title: "Documents",
    icon: "clipboard-check",
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
    icon: "paintbrush",
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
    icon: "gauge",
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
    icon: "shield-check",
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
    icon: "wrench",
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
    icon: "zap",
    items: [
      { id: "ho-drive", text: "Short drive: brakes, steering and gears feel normal" },
      { id: "ho-noise", text: "No rattles, squeaks or unusual noises" },
      { id: "ho-acc", text: "Every accessory you paid for is fitted" },
      { id: "ho-fuel", text: "Fuel (or charge) level is as promised" },
      { id: "ho-write", text: "Any issue is written on the delivery note before you sign" },
    ],
  },
];

/** What the locked preview says is behind the lock (everything after the free first section). */
export const pdiLockedSummary = "Exterior, tyres, interior, electricals and the test drive.";

/** The extra section for the buyer's fuel type — added to the unlocked list and the PDF, before the test drive. */
export const pdiFuelChecks: Record<FuelType, FuelChecks> = {
  Petrol: {
    title: "Extra checks for your petrol car",
    icon: "gauge",
    items: [
      { id: "fuel-petrol-idle", text: "Engine idles smoothly with no shaking after a cold start" },
      { id: "fuel-petrol-exhaust", text: "No smoke or strong smell from the exhaust" },
      { id: "fuel-petrol-cap", text: "Fuel lid opens and the cap closes and locks properly" },
    ],
  },
  Diesel: {
    title: "Extra checks for your diesel car",
    icon: "gauge",
    items: [
      { id: "fuel-diesel-start", text: "Starts cleanly with no black smoke from the exhaust" },
      { id: "fuel-diesel-adblue", text: "AdBlue (DEF) is topped up and its warning light is off", tip: "Many BS6 diesels need AdBlue — ask the dealer to fill it before delivery." },
      { id: "fuel-diesel-cap", text: "Fuel lid is marked 'Diesel' and the cap closes properly" },
    ],
  },
  CNG: {
    title: "Extra checks for your CNG car",
    icon: "gauge",
    items: [
      { id: "fuel-cng-cert", text: "CNG cylinder test certificate is in your documents", tip: "It shows the cylinder's test date. The cylinder must be re-tested every 3 years." },
      { id: "fuel-cng-rc", text: "Registration papers show the fuel as 'Petrol/CNG'" },
      { id: "fuel-cng-switch", text: "Car switches between CNG and petrol smoothly" },
      { id: "fuel-cng-smell", text: "No gas smell in the boot or near the cylinder" },
    ],
  },
  Hybrid: {
    title: "Extra checks for your hybrid car",
    icon: "gauge",
    items: [
      { id: "fuel-hyb-ready", text: "Car shows 'Ready' on start and no hybrid warning light stays on" },
      { id: "fuel-hyb-regen", text: "Energy screen shows the battery charging when you brake or coast" },
      { id: "fuel-hyb-warranty", text: "Hybrid battery warranty is written in the warranty booklet", tip: "Usually 8 years — check the exact years and kilometres." },
    ],
  },
  Electric: {
    title: "Extra checks for your electric car",
    icon: "battery-charging",
    items: [
      { id: "fuel-ev-charge", text: "Battery is charged above 80% and the range shown looks right" },
      { id: "fuel-ev-cable", text: "Portable charging cable is in the car and home charger installation is booked" },
      { id: "fuel-ev-port", text: "Charging port flap opens and locks, and a test charge starts" },
      { id: "fuel-ev-warranty", text: "Battery warranty (years and km) is written in your documents", tip: "Most EV batteries get 8 years — some brands offer more for the first owner." },
    ],
  },
};

// An electric car has no engine, so these sections and checks are worded differently.
export const pdiEvGroupTitles: { id: string; title: string }[] = [{ id: "electrical", title: "Motor & electricals" }];

export const pdiEvWording: { id: string; text: string }[] = [
  { id: "docs-vin", text: "VIN and motor number on the car match the invoice" },
  { id: "ele-start", text: "Car switches on ('Ready') and no warning lights stay on" },
  { id: "ele-fluids", text: "Coolant and brake fluid are at the right level" },
];

/** Hero strip on /pdi-check. The "starting price" stat is added after these from the cheapest plan. */
export const pdiHeroStats: { value: string; label: string }[] = [
  { value: "200+", label: "points checked" },
  { value: "60–90 min", label: "at the dealership" },
  { value: "On the spot", label: "photo report" },
];
export const pdiStartingPriceLabel = "starting price";

export const pdiSampleReport: PdiSampleReport = {
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
    { level: "attention", text: "Front-left tyre made 11 months ago", action: "Dealer agreed to replace it before delivery" },
    { level: "minor", text: "Light scratch on rear bumper", action: "Polished out on the spot" },
    { level: "minor", text: "Floor mats missing from accessory pack", action: "Fitted before handover" },
  ],
};

export const pdiFaqs: PdiFaq[] = [
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
