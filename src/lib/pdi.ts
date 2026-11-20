import type { FuelType } from "@/types";

/* ──────────────────────────────────────────────────────────────
   PDI (pre-delivery inspection) shapes and pure helpers.
   The content itself is editable (src/content/blocks/pdi-*.ts);
   these helpers take it as an argument so the page, the booking
   form and the checklist PDF all work from the same copy.
   No React or icon imports here: block files import this too.
   ────────────────────────────────────────────────────────────── */

/** Icons admins can pick for plans, checklist sections and "why it matters" cards. Mapped to components in components/pdi/icons.ts. */
export const PDI_ICONS = [
  { value: "clipboard-check", label: "Clipboard check" },
  { value: "scan-search", label: "Scan / search" },
  { value: "battery-charging", label: "Battery charging" },
  { value: "paintbrush", label: "Paintbrush" },
  { value: "file-warning", label: "Document warning" },
  { value: "package-x", label: "Missing package" },
  { value: "zap", label: "Lightning" },
  { value: "gauge", label: "Gauge" },
  { value: "shield-check", label: "Shield check" },
  { value: "wrench", label: "Wrench" },
  { value: "car", label: "Car" },
  { value: "key-round", label: "Key" },
  { value: "fuel", label: "Fuel pump" },
  { value: "plug-zap", label: "Charging plug" },
  { value: "lightbulb", label: "Light bulb" },
  { value: "camera", label: "Camera" },
  { value: "file-text", label: "Document" },
  { value: "armchair", label: "Seat" },
  { value: "droplets", label: "Fluids" },
  { value: "thermometer", label: "Thermometer" },
  { value: "triangle-alert", label: "Warning" },
  { value: "badge-check", label: "Badge check" },
  { value: "sparkles", label: "Sparkles" },
  { value: "clock", label: "Clock" },
] as const;

export type PdiIcon = (typeof PDI_ICONS)[number]["value"];
export const PDI_ICON_NAMES = PDI_ICONS.map((i) => i.value) as [PdiIcon, ...PdiIcon[]];

/** Fuel types the checklist has extra checks for, in picker order. */
export const PDI_FUELS: FuelType[] = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"];

/* ── Plans ──────────────────────────────────────────────────── */

export interface PdiPlan {
  /** Stable key — saved in the visitor's browser and used to pick the plan. */
  id: string;
  name: string;
  price: number;
  duration: string;
  checks: number;
  summary: string;
  features: string[];
  popular?: boolean;
  icon: PdiIcon;
}

/** The plan for a saved choice: that plan if it still exists, else the "most popular" one, else the first. */
export const resolvePlan = (plans: readonly PdiPlan[], id: string | null | undefined): PdiPlan =>
  plans.find((p) => p.id === id) ?? plans.find((p) => p.popular) ?? plans[0];

/** The cheapest plan's price (the hero's "starting price"). */
export const startingPrice = (plans: readonly PdiPlan[]) => Math.min(...plans.map((p) => p.price));

/* ── Checklist ──────────────────────────────────────────────── */

export interface ChecklistItem {
  /** Stable key — visitors' ticks are saved against it. */
  id: string;
  text: string;
  tip?: string;
}

export interface ChecklistGroup {
  id: string;
  title: string;
  icon: PdiIcon;
  items: ChecklistItem[];
}

/** The extra section added for one fuel type. */
export interface FuelChecks {
  title: string;
  icon: PdiIcon;
  items: ChecklistItem[];
}

export interface PdiChecklistContent {
  groups: ChecklistGroup[];
  fuels: Record<FuelType, FuelChecks>;
  /** Electric cars have no engine — these sections are renamed for them. */
  evGroupTitles: { id: string; title: string }[];
  /** …and these checks reworded. */
  evWording: { id: string; text: string }[];
}

/** Anchor/section id of a fuel type's extra checks. */
export const fuelGroupId = (fuel: FuelType) => `fuel-${fuel.toLowerCase()}`;

/** The DIY checklist tailored to a fuel type — its extra checks go just before the last section (the test drive). */
export function checklistFor(content: PdiChecklistContent, fuel?: FuelType): ChecklistGroup[] {
  const { groups } = content;
  if (!fuel) return groups;
  const ev = fuel === "Electric";
  const titles = new Map<string, string>(ev ? content.evGroupTitles.map((t) => [t.id, t.title] as const) : []);
  const wording = new Map<string, string>(ev ? content.evWording.map((w) => [w.id, w.text] as const) : []);
  const tailored = groups.map((g) => ({
    ...g,
    title: titles.get(g.id) ?? g.title,
    items: g.items.map((i) => ({ ...i, text: wording.get(i.id) ?? i.text })),
  }));
  const fc = content.fuels[fuel];
  const extra: ChecklistGroup = { id: fuelGroupId(fuel), title: fc.title, icon: fc.icon, items: fc.items };
  return fc.items.length ? [...tailored.slice(0, -1), extra, ...tailored.slice(-1)] : tailored;
}

export const checklistCount = (groups: readonly ChecklistGroup[]) => groups.reduce((n, g) => n + g.items.length, 0);

/* ── Page ───────────────────────────────────────────────────── */

export interface PdiProblem {
  icon: PdiIcon;
  title: string;
  text: string;
}

export interface PdiStep {
  title: string;
  text: string;
}

export interface PdiSampleReport {
  car: string;
  dealer: string;
  date: string;
  score: number;
  categories: { label: string; value: number }[];
  findings: { level: "attention" | "minor"; text: string; action: string }[];
}

export interface PdiFaq {
  q: string;
  a: string;
}
