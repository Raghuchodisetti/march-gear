import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { customerNotifications, customerVehicles } from "@/db/schema";
import { getCatalog } from "@/server/catalog";
import type { BodyType } from "@/types";
import { todayISO } from "@/server/validation";
import { notifyCustomer } from "@/server/customer/notify";
import { formatDate } from "@/lib/format";
import { FUELS, isValidReg, normaliseReg } from "@/insurance/search";
import { isIndianState } from "@/data/states";
import { getPolicyForGarage } from "@/server/customer/insurance";
import {
  EMPTY_GARAGE_FORM,
  NOT_LISTED,
  REMINDER_KIND_LABEL,
  reminderHref,
  remindersFor,
  sortReminders,
  type GarageCar,
  type GarageFormValues,
  type GarageReminder,
} from "@/components/customer/garage/shared";

/* ──────────────────────────────────────────────────────────────
   My garage (/account/garage): the cars a customer owns, and the
   reminders their own dates produce. Every query is scoped by the
   customer's user id. Reminders show in the portal and as
   notifications — no SMS or email (not configured).
   ────────────────────────────────────────────────────────────── */

export type { GarageCar, GarageReminder };
export type GarageVehicle = typeof customerVehicles.$inferSelect;

/** The customer's cars, oldest first (the order they added them). */
export async function getGarage(userId: number): Promise<GarageVehicle[]> {
  return getDb().select().from(customerVehicles).where(eq(customerVehicles.userId, userId)).orderBy(asc(customerVehicles.createdAt), asc(customerVehicles.id));
}

/** How many cars the customer has. */
export async function countGarage(userId: number) {
  const [{ n }] = await getDb().select({ n: count() }).from(customerVehicles).where(eq(customerVehicles.userId, userId));
  return n;
}

/** One of the customer's cars, or null when it isn't theirs (or doesn't exist). */
export async function getGarageVehicle(userId: number, id: number): Promise<GarageVehicle | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [row] = await getDb()
    .select()
    .from(customerVehicles)
    .where(and(eq(customerVehicles.id, id), eq(customerVehicles.userId, userId)));
  return row ?? null;
}

/** Days before expiry that insurance reminders start (the insurance settings' renewal window). */
export async function insuranceReminderWindow() {
  return (await getCatalog()).content.insuranceSettings.renewalWindowDays;
}

/**
 * Reminders due across the customer's garage, most urgent first: insurance expiring within the renewal
 * window (or expired), PUC and service within 30 days (or overdue), warranty ending within 60 days.
 */
export async function getGarageReminders(userId: number, today: string = todayISO()): Promise<GarageReminder[]> {
  const [cars, window] = await Promise.all([getGarage(userId), insuranceReminderWindow()]);
  return sortReminders(cars.flatMap((c) => remindersFor(c, today, window)));
}

const running = new Set<number>();

/**
 * Turns due reminders into customer notifications (kind "reminder") — once per car, kind and due date.
 * The notification's link is the idempotency key. Call it when the customer visits; never throws.
 */
export async function notifyGarageReminders(userId: number, reminders: GarageReminder[]) {
  if (!reminders.length || running.has(userId)) return;
  running.add(userId);
  try {
    const hrefs = reminders.map(reminderHref);
    const existing = await getDb()
      .select({ href: customerNotifications.href })
      .from(customerNotifications)
      .where(and(eq(customerNotifications.userId, userId), eq(customerNotifications.kind, "reminder"), inArray(customerNotifications.href, hrefs)));
    const have = new Set(existing.map((e) => e.href));
    for (const r of reminders) {
      const href = reminderHref(r);
      if (have.has(href)) continue;
      have.add(href);
      await notifyCustomer(userId, { kind: "reminder", title: `${reminderTitle(r)} — ${r.vehicle}`, body: reminderBody(r), href });
    }
  } catch (err) {
    console.error("[garage] reminder notifications failed", err);
  } finally {
    running.delete(userId);
  }
}

/** Notification titles use the date itself ("due 25 Nov 2026"), not "in 5 days", which goes stale. */
function reminderTitle(r: GarageReminder) {
  const day = formatDate(r.dueOn);
  const past = r.daysLeft < 0;
  switch (r.kind) {
    case "insurance":
      return past ? `Insurance expired on ${day}` : `Insurance renewal due ${day}`;
    case "puc":
      return past ? `PUC certificate expired on ${day}` : `PUC certificate expires ${day}`;
    case "service":
      return past ? `Service was due on ${day}` : `Service due ${day}`;
    default:
      return `Warranty ends ${day}`;
  }
}

function reminderBody(r: GarageReminder) {
  const day = formatDate(r.dueOn);
  switch (r.kind) {
    case "insurance":
      return r.daysLeft < 0
        ? `The policy date you saved for your ${r.vehicle} was ${day}. Driving without valid insurance isn't allowed — compare renewal quotes or update the date if you've already renewed.`
        : `The policy you saved for your ${r.vehicle} ends on ${day}. Compare indicative renewal premiums from listed insurers before it lapses.`;
    case "puc":
      return `The PUC certificate date you saved for your ${r.vehicle} is ${day}. Get it re-tested, then update the date in your garage.`;
    case "service":
      return `The next service you saved for your ${r.vehicle} is on ${day}.`;
    case "warranty":
      return `The warranty you saved for your ${r.vehicle} ends on ${day}. Ask your dealer about extended warranty before then.`;
    default:
      return `${REMINDER_KIND_LABEL[r.kind]} · ${day}`;
  }
}

/**
 * The catalogue photo for a garage car (when its model is in the catalogue). A catalogue model without photos
 * yet gets `src: ""` and its body type, so the card can show the body-type placeholder.
 */
export async function garageImages(cars: Pick<GarageVehicle, "id" | "model">[]): Promise<Record<number, { src: string; focus?: string; bodyType?: BodyType } | null>> {
  const { getCar } = await getCatalog();
  const out: Record<number, { src: string; focus?: string; bodyType?: BodyType } | null> = {};
  for (const c of cars) {
    const car = c.model ? getCar(c.model) : undefined;
    out[c.id] = car?.images[0] ? { src: car.images[0], focus: car.focus } : car ? { src: "", bodyType: car.bodyType } : null;
  }
  return out;
}

/**
 * Garage form values from one of the customer's issued policies (by enquiry reference): the car, its
 * registration and the policy, with expiry = issue date + 1 year − 1 day. With `existing` (a saved car's
 * values) only the policy fields change. Null when the reference isn't an issued policy of this customer.
 */
export async function garagePrefillFromPolicy(userId: number, reference: string, existing?: GarageFormValues) {
  const p = await getPolicyForGarage(userId, reference);
  if (!p) return null;
  const { getCar, cars } = await getCatalog();
  const policy = { reference: p.reference, issuedOn: p.issuedOn, insuranceExpiry: p.insuranceExpiry, policyNumber: p.policyNumber };
  const insurance = { insurer: p.insurer ?? existing?.insurer ?? "", policyNumber: p.policyNumber ?? existing?.policyNumber ?? "", insuranceExpiry: p.insuranceExpiry };
  if (existing) return { values: { ...existing, ...insurance }, policy };

  const car = p.model ? getCar(p.model) : undefined;
  const brandOk = Boolean(p.brand && cars.some((c) => c.brand === p.brand));
  const modelOk = Boolean(car && car.brand === p.brand);
  const variantOk = Boolean(car && modelOk && p.variant && car.variants.some((v) => v.slug === p.variant));
  const reg = p.regNumber ? normaliseReg(p.regNumber) : "";
  const state = p.state && isIndianState(p.state) ? p.state : "";
  const values: GarageFormValues = {
    ...EMPTY_GARAGE_FORM,
    ...insurance,
    brand: brandOk && p.brand ? p.brand : NOT_LISTED,
    brandName: brandOk ? "" : (p.brandName ?? ""),
    model: modelOk && p.model ? p.model : brandOk ? NOT_LISTED : "",
    modelName: modelOk ? "" : (p.modelName ?? ""),
    variant: variantOk && p.variant ? p.variant : "",
    variantName: modelOk ? "" : (p.variantName ?? ""),
    year: p.year ? String(p.year) : "",
    fuel: p.fuel && (FUELS as string[]).includes(p.fuel) ? p.fuel : "",
    transmission: variantOk && car ? (car.variants.find((v) => v.slug === p.variant)?.transmission ?? "") : "",
    regNumber: reg && isValidReg(reg) ? reg : "",
    state,
    city: state ? (p.city ?? "") : "",
  };
  return { values, policy };
}
