"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, count, eq, like, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { customerNotifications, customerVehicles } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { FUELS, isValidReg, normaliseReg } from "@/insurance/search";
import { isIndianState } from "@/data/states";
import { getSessionUser } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { fieldErrors, todayISO } from "@/server/validation";
import { addDays } from "@/components/portal/billing/shared";
import { GARAGE_LIMIT, NOT_LISTED, TRANSMISSIONS, garageHref } from "@/components/customer/garage/shared";

/* ──────────────────────────────────────────────────────────────
   My garage: add, edit and remove the customer's own cars.
   Customer session only; every id is checked against the
   signed-in customer before anything is read or written.
   ────────────────────────────────────────────────────────────── */

const SIGNED_OUT = { ok: false as const, error: "Please sign in again to manage your garage." };
const NOT_FOUND = { ok: false as const, error: "That car isn't in your garage any more." };

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .default("")
    .transform((v) => v || null);
/** An optional IST day within [today + from, today + to] days (bounds checked when the form is parsed). */
const day = (from: number, to: number, msg: string) =>
  z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Choose a date")
    .refine((v) => {
      if (!v) return true;
      const today = todayISO();
      return v >= addDays(today, from) && v <= addDays(today, to);
    }, msg)
    .transform((v) => v || null);
const whole = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v) => v.replace(/[,\s]/g, ""))
    .refine((v) => !v || /^\d+$/.test(v), msg)
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || v <= max, `That's more than ${max.toLocaleString("en-IN")}`);

/** Which car it is — lenient on purpose, so the catalogue checks run (and report) alongside the other fields. */
const loose = z.string().trim().optional().default("").catch("");
const identity = z.object({ brand: loose, brandName: loose, model: loose, modelName: loose, variant: loose, variantName: loose, year: loose, fuel: loose });
type Identity = z.infer<typeof identity>;

const schema = z.object({
  brand: z.string().trim().max(80).optional().default(""),
  brandName: z.string().trim().max(80, "Keep the brand under 80 characters").optional().default(""),
  model: z.string().trim().max(120).optional().default(""),
  modelName: z.string().trim().max(120, "Keep the model under 120 characters").optional().default(""),
  variant: z.string().trim().max(120).optional().default(""),
  variantName: z.string().trim().max(120, "Keep the variant under 120 characters").optional().default(""),
  year: z.string().trim().optional().default(""),
  fuel: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || (FUELS as string[]).includes(v), "Choose a fuel"),
  transmission: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || (TRANSMISSIONS as readonly string[]).includes(v), "Choose a gearbox"),
  regNumber: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform(normaliseReg)
    .refine((v) => !v || isValidReg(v), "Enter a valid registration number, e.g. MH12AB1234"),
  state: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || isIndianState(v), "Choose a state"),
  city: z.string().trim().max(64, "Keep the city under 64 characters").optional().default(""),
  purchasedOn: day(-50 * 366, 366, "Choose a date up to a year from now"),
  odometerKm: whole(2_000_000, "Enter the kilometres as a number"),
  nickname: text(60),
  insurer: text(160),
  policyNumber: text(60),
  insuranceExpiry: day(-5 * 365, 5 * 366, "Choose a date within five years of today"),
  pucExpiry: day(-5 * 365, 3 * 366, "Choose a date within three years from now"),
  serviceDueOn: day(-3 * 365, 3 * 366, "Choose a date within three years of today"),
  serviceDueKm: whole(2_000_000, "Enter the kilometres as a number"),
  warrantyUntil: day(-30 * 366, 10 * 366, "Choose a date within ten years from now"),
  notes: text(500),
});

type Parsed = z.infer<typeof schema>;

/** Resolves the car against the catalogue: slugs when it's listed, names either way. */
async function resolveCar(d: Identity, today: string) {
  const errors: Record<string, string> = {};
  const catalog = await getCatalog();
  const thisYear = Number(today.slice(0, 4));

  let brand: string | null = null;
  let brandName = "";
  let model: string | null = null;
  let modelName = "";
  let variant: string | null = null;
  let variantName: string | null = null;
  let fuel = d.fuel || null;
  let transmission: string | null = null;

  if (d.brand && d.brand !== NOT_LISTED) {
    if (!catalog.cars.some((c) => c.brand === d.brand)) errors.brand = "Choose the brand from the list";
    else {
      brand = d.brand;
      brandName = catalog.brandName(d.brand);
    }
  } else if (d.brandName.length >= 2) brandName = d.brandName;
  else errors[d.brand === NOT_LISTED ? "brandName" : "brand"] = d.brand === NOT_LISTED ? "Type the brand" : "Choose the brand";

  if (brand) {
    if (d.model && d.model !== NOT_LISTED) {
      const car = catalog.getCar(d.model);
      if (!car || car.brand !== brand) errors.model = "Choose the model from the list";
      else {
        model = car.slug;
        modelName = car.name;
        if (d.variant) {
          const v = car.variants.find((x) => x.slug === d.variant);
          if (!v) errors.variant = "Choose the variant from the list";
          else {
            variant = v.slug;
            variantName = v.name;
            // The variant decides fuel and gearbox.
            fuel = (FUELS as string[]).includes(v.fuel) ? v.fuel : fuel;
            transmission = v.transmission;
          }
        }
      }
    } else if (d.modelName.length >= 1) {
      modelName = d.modelName;
      variantName = d.variantName || null;
    } else errors[d.model === NOT_LISTED ? "modelName" : "model"] = d.model === NOT_LISTED ? "Type the model" : "Choose the model";
  } else if (!errors.brand) {
    if (d.modelName.length >= 1) {
      modelName = d.modelName;
      variantName = d.variantName || null;
    } else errors.modelName = "Type the model";
  }

  const year = /^\d{4}$/.test(d.year) ? Number(d.year) : 0;
  if (year < 1980 || year > thisYear + 1) errors.year = "Choose the year";
  return { errors, car: { brand, brandName, model, modelName, variant, variantName, year, fuel, transmission } };
}

/** Checks the whole form: the car (catalogue) and the dates. Returns the row values, or field errors. */
async function vehicleValues(d: Parsed, today: string) {
  const { errors, car } = await resolveCar(d, today);
  if (d.city && !d.state) errors.state = "Choose the state";

  if (d.purchasedOn && car.year && d.purchasedOn < `${car.year - 1}-01-01`) errors.purchasedOn = "That's before the car was made";

  if (Object.keys(errors).length) return { errors };
  return {
    values: {
      nickname: d.nickname,
      brand: car.brand,
      brandName: car.brandName,
      model: car.model,
      modelName: car.modelName,
      variant: car.variant,
      variantName: car.variantName,
      year: car.year,
      fuel: car.fuel,
      transmission: car.transmission ?? (d.transmission || null),
      regNumber: d.regNumber || null,
      city: d.city || null,
      state: d.state || null,
      purchasedOn: d.purchasedOn,
      odometerKm: d.odometerKm,
      insurer: d.insurer,
      policyNumber: d.policyNumber,
      insuranceExpiry: d.insuranceExpiry,
      pucExpiry: d.pucExpiry,
      serviceDueOn: d.serviceDueOn,
      serviceDueKm: d.serviceDueKm,
      warrantyUntil: d.warrantyUntil,
      notes: d.notes,
    },
  };
}

/** Zod's field errors plus the catalogue checks, so the customer sees every problem at once. */
async function parseFailed(input: unknown, error: z.ZodError, today: string) {
  const id = identity.safeParse(input);
  const fromCar = id.success ? (await resolveCar(id.data, today)).errors : {};
  return failed({ ...fromCar, ...fieldErrors(error) });
}

const failed = (errors: Record<string, string>) => ({ ok: false as const, error: "Please check the highlighted fields.", fieldErrors: errors });

async function regTaken(userId: number, reg: string | null, exceptId?: number) {
  if (!reg) return false;
  const [row] = await getDb()
    .select({ id: customerVehicles.id })
    .from(customerVehicles)
    .where(and(eq(customerVehicles.userId, userId), eq(customerVehicles.regNumber, reg), exceptId ? ne(customerVehicles.id, exceptId) : undefined));
  return Boolean(row);
}

const refresh = () => revalidatePath("/account", "layout");

/** Adds a car to the signed-in customer's garage (max GARAGE_LIMIT). */
export async function addGarageVehicleAction(input: unknown): Promise<ActionResult<{ id: number }>> {
  const user = await getSessionUser("customer");
  if (!user) return SIGNED_OUT;
  const today = todayISO();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return parseFailed(input, parsed.error, today);
  const res = await vehicleValues(parsed.data, today);
  if (res.errors) return failed(res.errors);

  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(customerVehicles).where(eq(customerVehicles.userId, user.id));
  if (n >= GARAGE_LIMIT) return { ok: false, error: `Your garage holds up to ${GARAGE_LIMIT} cars. Remove one to add another.` };
  if (await regTaken(user.id, res.values.regNumber)) return failed({ regNumber: "This car is already in your garage" });

  const [row] = await db.insert(customerVehicles).values({ userId: user.id, ...res.values });
  refresh();
  return { ok: true, id: row.insertId };
}

/** Saves changes to one of the customer's cars. */
export async function updateGarageVehicleAction(id: unknown, input: unknown): Promise<ActionResult<{ id: number }>> {
  const user = await getSessionUser("customer");
  if (!user) return SIGNED_OUT;
  const vid = z.number().int().positive().safeParse(id);
  if (!vid.success) return NOT_FOUND;
  const today = todayISO();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return parseFailed(input, parsed.error, today);

  const db = getDb();
  const [own] = await db
    .select({ id: customerVehicles.id })
    .from(customerVehicles)
    .where(and(eq(customerVehicles.id, vid.data), eq(customerVehicles.userId, user.id)));
  if (!own) return NOT_FOUND;

  const res = await vehicleValues(parsed.data, today);
  if (res.errors) return failed(res.errors);
  if (await regTaken(user.id, res.values.regNumber, own.id)) return failed({ regNumber: "Another car in your garage has this registration" });

  await db
    .update(customerVehicles)
    .set(res.values)
    .where(and(eq(customerVehicles.id, own.id), eq(customerVehicles.userId, user.id)));
  refresh();
  return { ok: true, id: own.id };
}

/** Removes a car from the customer's garage, with the reminder notifications that pointed at it. */
export async function deleteGarageVehicleAction(id: unknown): Promise<ActionResult> {
  const user = await getSessionUser("customer");
  if (!user) return SIGNED_OUT;
  const vid = z.number().int().positive().safeParse(id);
  if (!vid.success) return NOT_FOUND;

  const db = getDb();
  const [res] = await db.delete(customerVehicles).where(and(eq(customerVehicles.id, vid.data), eq(customerVehicles.userId, user.id)));
  if (!res.affectedRows) return NOT_FOUND;
  await db
    .delete(customerNotifications)
    .where(and(eq(customerNotifications.userId, user.id), eq(customerNotifications.kind, "reminder"), like(customerNotifications.href, `${garageHref(vid.data)}?%`)));
  refresh();
  return { ok: true };
}
