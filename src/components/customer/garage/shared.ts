import type { Tone } from "@/partner/labels";
import { carPrefillQuery, gearboxKind, type CarPrefill } from "@/components/valuation/prefill";
import { FUELS, searchQuery } from "@/insurance/search";
import type { FuelName } from "@/insurance/types";
import { addDays, addMonths, daysBetween } from "@/components/portal/billing/shared";
import { formatDate } from "@/lib/format";

/* ──────────────────────────────────────────────────────────────
   My garage — rules shared by the server (reminders, actions) and
   the browser (cards, form). Client-safe: no database imports.
   Dates are IST calendar days as "YYYY-MM-DD" strings.
   ────────────────────────────────────────────────────────────── */

/** Cars a customer can keep in their garage. */
export const GARAGE_LIMIT = 10;

export const TRANSMISSIONS = ["Manual", "Automatic", "AMT", "DCT", "CVT"] as const;
export type GarageTransmission = (typeof TRANSMISSIONS)[number];

export { FUELS };

/** A garage car as pages and components use it (a `customer_vehicles` row without timestamps). */
export interface GarageCar {
  id: number;
  nickname: string | null;
  brand: string | null;
  brandName: string;
  model: string | null;
  modelName: string;
  variant: string | null;
  variantName: string | null;
  year: number | null;
  fuel: string | null;
  transmission: string | null;
  regNumber: string | null;
  city: string | null;
  state: string | null;
  purchasedOn: string | null;
  odometerKm: number | null;
  insurer: string | null;
  policyNumber: string | null;
  insuranceExpiry: string | null;
  pucExpiry: string | null;
  serviceDueOn: string | null;
  serviceDueKm: number | null;
  warrantyUntil: string | null;
  notes: string | null;
}

export type ReminderKind = "insurance" | "puc" | "service" | "warranty";

export interface GarageReminder {
  vehicleId: number;
  /** The car's display name (nickname, or brand + model). */
  vehicle: string;
  kind: ReminderKind;
  /** IST day, YYYY-MM-DD. */
  dueOn: string;
  /** Negative once it's passed. */
  daysLeft: number;
  label: string;
  tone: Tone;
  action: { label: string; href: string } | null;
}

export const REMINDER_KIND_LABEL: Record<ReminderKind, string> = {
  insurance: "Insurance",
  puc: "PUC certificate",
  service: "Service",
  warranty: "Warranty",
};

/** Days ahead each reminder starts (insurance uses the renewal window from the insurance settings). */
export const REMINDER_WINDOWS = { puc: 30, service: 30, warranty: 60 } as const;

/* ── Names ─────────────────────────────────────────────────── */

type Named = Pick<GarageCar, "brandName" | "modelName" | "nickname">;

/** "Hyundai Creta". */
export const carTitle = (v: Pick<GarageCar, "brandName" | "modelName">) => `${v.brandName} ${v.modelName}`.trim();
/** The nickname when there is one, else "Hyundai Creta". */
export const carName = (v: Named) => v.nickname?.trim() || carTitle(v);
/** "SX(O) · 2023 · Petrol · Automatic". */
export const carSpecLine = (v: Pick<GarageCar, "variantName" | "year" | "fuel" | "transmission">) =>
  [v.variantName, v.year ? String(v.year) : null, v.fuel, v.transmission].filter(Boolean).join(" · ");

/** "MH 12 AB 1234" — easier to read than the stored "MH12AB1234". */
export function formatReg(reg: string) {
  const bh = /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/.exec(reg);
  if (bh) return `${bh[1]} ${bh[2]} ${bh[3]} ${bh[4]}`;
  const m = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(reg);
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(" ") : reg;
}

/* ── Dates ─────────────────────────────────────────────────── */

/** "in 12 days", "today", "3 days ago". */
export function relativeDays(n: number) {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** Not delivered yet: the purchase (delivery) date is still ahead. */
export const isNotDelivered = (v: Pick<GarageCar, "purchasedOn">, today: string) => Boolean(v.purchasedOn && v.purchasedOn > today);

/** A policy's last day when only its issue day is known: one year, less a day. */
export const policyExpiryFromIssue = (issueDay: string) => addDays(addMonths(issueDay, 12), -1);

const urgencyTone = (daysLeft: number): Tone => (daysLeft <= 7 ? "red" : daysLeft <= 30 ? "amber" : "blue");

/** What a date row on a card shows: a status chip for the date, whether or not a reminder is due. */
export function dateStatus(kind: ReminderKind, due: string | null, today: string, insuranceWindowDays: number): { text: string; tone: Tone } {
  if (!due) return { text: "Not added", tone: "neutral" };
  const n = daysBetween(today, due);
  const window = kind === "insurance" ? insuranceWindowDays : REMINDER_WINDOWS[kind];
  if (n < 0) {
    if (kind === "warranty") return { text: "Ended", tone: "neutral" };
    if (kind === "service") return { text: `Overdue ${-n}d`, tone: "red" };
    return { text: "Expired", tone: "red" };
  }
  if (n <= window) return { text: n === 0 ? "Due today" : `Due in ${n}d`, tone: urgencyTone(n) };
  return { text: kind === "service" ? "Scheduled" : "Valid", tone: "green" };
}

/* ── Links ─────────────────────────────────────────────────── */

const policyFor = (expiry: string | null, today: string) => {
  if (!expiry) return "" as const;
  if (expiry >= today) return "active" as const;
  return daysBetween(expiry, today) <= 90 ? ("expired_recent" as const) : ("expired_long" as const);
};

/** /insurance/quotes prefilled for this car — a renewal, or a new-car policy when it isn't delivered yet. */
export function renewalQuotesHref(v: GarageCar, today: string) {
  const fresh = isNotDelivered(v, today);
  const fuel = v.fuel && (FUELS as string[]).includes(v.fuel) ? (v.fuel as FuelName) : "";
  return `/insurance/quotes?${searchQuery({
    intent: fresh ? "new" : "renewal",
    brand: v.brand ?? "",
    model: v.model ?? "",
    variant: v.variant ?? "",
    year: v.year,
    fuel,
    city: v.city ?? "",
    state: v.state ?? "",
    reg: v.regNumber ?? "",
    expiry: fresh ? "" : (v.insuranceExpiry ?? ""),
    policy: fresh ? "new_vehicle" : policyFor(v.insuranceExpiry, today),
  })}`;
}

/** Dealers for the car's brand (the dealer directory reads ?brand= and ?city=). */
export function dealersHref(v: Pick<GarageCar, "brand" | "city">) {
  const q = new URLSearchParams();
  if (v.brand) q.set("brand", v.brand);
  if (v.city) q.set("city", v.city);
  const s = q.toString();
  return s ? `/dealers?${s}` : "/dealers";
}

export const garageHref = (id: number) => `/account/garage/${id}`;
export const editHref = (id: number) => `/account/garage/${id}?edit=1`;

/** The notification link for a reminder — also its idempotency key (one per car, kind and due date). */
export const reminderHref = (r: Pick<GarageReminder, "vehicleId" | "kind" | "dueOn">) => `${garageHref(r.vehicleId)}?reminder=${r.kind}-${r.dueOn}`;

export type QuickActionKey = "quotes" | "value" | "sell" | "pdi" | "reviews";

export interface QuickAction {
  key: QuickActionKey;
  label: string;
  description: string;
  href: string;
}

/** What the customer can do next with this car. `hasModelPage`: the model is in the catalogue. */
export function quickActions(v: GarageCar, today: string, hasModelPage: boolean): QuickAction[] {
  const fresh = isNotDelivered(v, today);
  const out: QuickAction[] = [
    {
      key: "quotes",
      label: fresh ? "Get new-car insurance quotes" : "Get renewal quotes",
      description: fresh ? "Compare indicative premiums before delivery day." : v.insuranceExpiry ? `Your policy ${v.insuranceExpiry < today ? "expired" : "ends"} on ${formatDate(v.insuranceExpiry)}.` : "Compare indicative premiums from listed insurers.",
      href: renewalQuotesHref(v, today),
    },
  ];
  if (fresh) out.push({ key: "pdi", label: "Book a PDI check", description: "Have an expert inspect it at the dealership before you sign.", href: "/pdi-check" });
  if (!fresh) {
    const prefill = carPrefillQuery({
      brand: v.brand ?? undefined,
      model: v.model ?? undefined,
      modelName: v.model ? undefined : v.modelName,
      year: v.year ?? undefined,
      km: v.odometerKm ?? undefined,
      fuel: (v.fuel as CarPrefill["fuel"]) ?? undefined,
      transmission: gearboxKind(v.transmission),
      city: v.city ?? undefined,
    });
    const q = prefill ? `?${prefill}` : "";
    out.push({ key: "value", label: "Check its value", description: "An indicative market value in under a minute.", href: `/tools/car-valuation${q}` });
    out.push({ key: "sell", label: "Sell this car", description: "Instant indicative price and a doorstep inspection.", href: `/sell-car${q}` });
  }
  if (hasModelPage && v.model) out.push({ key: "reviews", label: "See its reviews", description: "Owner reviews and our expert verdict.", href: `/cars/${v.model}#reviews` });
  return out;
}

/* ── Reminders ─────────────────────────────────────────────── */

/**
 * The car's reminders that are due: insurance within the renewal window (or expired), PUC and service
 * within 30 days (or overdue), warranty ending within 60 days. Most urgent first.
 */
export function remindersFor(v: GarageCar, today: string, insuranceWindowDays: number): GarageReminder[] {
  const name = carName(v);
  const out: GarageReminder[] = [];
  const push = (kind: ReminderKind, dueOn: string | null, window: number, allowPast: boolean, label: (n: number) => string, action: GarageReminder["action"]) => {
    if (!dueOn) return;
    const n = daysBetween(today, dueOn);
    if (n > window || (n < 0 && !allowPast)) return;
    out.push({ vehicleId: v.id, vehicle: name, kind, dueOn, daysLeft: n, label: label(n), tone: n < 0 ? "red" : urgencyTone(n), action });
  };

  push(
    "insurance",
    v.insuranceExpiry,
    insuranceWindowDays,
    true,
    (n) => (n < 0 ? `Insurance expired ${relativeDays(n)}` : n === 0 ? "Insurance expires today" : `Insurance renewal due ${relativeDays(n)}`),
    { label: v.insuranceExpiry && v.insuranceExpiry < today ? "Get quotes now" : "Get renewal quotes", href: renewalQuotesHref(v, today) },
  );
  push(
    "puc",
    v.pucExpiry,
    REMINDER_WINDOWS.puc,
    true,
    (n) => (n < 0 ? `PUC certificate expired ${relativeDays(n)}` : n === 0 ? "PUC certificate expires today" : `PUC certificate expires ${relativeDays(n)}`),
    { label: "Update the PUC date", href: editHref(v.id) },
  );
  const km = v.serviceDueKm ? ` or at ${v.serviceDueKm.toLocaleString("en-IN")} km` : "";
  push(
    "service",
    v.serviceDueOn,
    REMINDER_WINDOWS.service,
    true,
    (n) => (n < 0 ? `Service overdue by ${-n} day${n === -1 ? "" : "s"}` : n === 0 ? `Service due today${km}` : `Service due ${relativeDays(n)}${km}`),
    { label: "Find a service centre", href: dealersHref(v) },
  );
  push(
    "warranty",
    v.warrantyUntil,
    REMINDER_WINDOWS.warranty,
    false,
    (n) => (n === 0 ? "Warranty ends today" : `Warranty ends ${relativeDays(n)}`),
    { label: "Ask a dealer about extended warranty", href: dealersHref(v) },
  );
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export const sortReminders = (list: GarageReminder[]) => [...list].sort((a, b) => a.daysLeft - b.daysLeft || a.vehicle.localeCompare(b.vehicle));

/* ── The form ──────────────────────────────────────────────── */

/** "Not listed" in the brand/model pickers. */
export const NOT_LISTED = "__other";

/** The add/edit form's fields, as strings. */
export interface GarageFormValues {
  brand: string;
  brandName: string;
  model: string;
  modelName: string;
  variant: string;
  variantName: string;
  year: string;
  fuel: string;
  transmission: string;
  regNumber: string;
  state: string;
  city: string;
  purchasedOn: string;
  odometerKm: string;
  nickname: string;
  insurer: string;
  policyNumber: string;
  insuranceExpiry: string;
  pucExpiry: string;
  serviceDueOn: string;
  serviceDueKm: string;
  warrantyUntil: string;
  notes: string;
}

export const EMPTY_GARAGE_FORM: GarageFormValues = {
  brand: "",
  brandName: "",
  model: "",
  modelName: "",
  variant: "",
  variantName: "",
  year: "",
  fuel: "",
  transmission: "",
  regNumber: "",
  state: "",
  city: "",
  purchasedOn: "",
  odometerKm: "",
  nickname: "",
  insurer: "",
  policyNumber: "",
  insuranceExpiry: "",
  pucExpiry: "",
  serviceDueOn: "",
  serviceDueKm: "",
  warrantyUntil: "",
  notes: "",
};

/** A saved car as form values (catalogue slugs when it has them, "not listed" + names when it doesn't). */
export function formValuesFor(v: GarageCar): GarageFormValues {
  const s = (x: string | number | null | undefined) => (x === null || x === undefined ? "" : String(x));
  return {
    brand: v.brand ?? NOT_LISTED,
    brandName: v.brand ? "" : v.brandName,
    model: v.model ?? (v.brand ? NOT_LISTED : ""),
    modelName: v.model ? "" : v.modelName,
    variant: v.variant ?? "",
    variantName: v.variant ? "" : s(v.variantName),
    year: s(v.year),
    fuel: s(v.fuel),
    transmission: s(v.transmission),
    regNumber: s(v.regNumber),
    state: s(v.state),
    city: s(v.city),
    purchasedOn: s(v.purchasedOn),
    odometerKm: s(v.odometerKm),
    nickname: s(v.nickname),
    insurer: s(v.insurer),
    policyNumber: s(v.policyNumber),
    insuranceExpiry: s(v.insuranceExpiry),
    pucExpiry: s(v.pucExpiry),
    serviceDueOn: s(v.serviceDueOn),
    serviceDueKm: s(v.serviceDueKm),
    warrantyUntil: s(v.warrantyUntil),
    notes: s(v.notes),
  };
}
