import type { UsedCar } from "@/types";
import { clamp } from "@/lib/utils";

/** FNV-1a — a stable 32-bit hash so derived figures never change between renders. */
export function hashString(value: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const INSPECTION_CATEGORIES = ["Engine", "Transmission", "Exterior", "Interior", "Tyres", "Electricals"] as const;
export type InspectionCategory = (typeof INSPECTION_CATEGORIES)[number];

const NOTES: Record<InspectionCategory, [string, string, string]> = {
  Engine: ["No leaks, smooth idle, clean compression", "Healthy; minor oil seepage at the sump", "Service due; tappet noise on cold start"],
  Transmission: ["Crisp shifts, no slip under load", "Smooth; slight hesitation from standstill", "Clutch wear noted; replacement advised"],
  Exterior: ["Original paint on every panel", "Minor scuffs on the rear bumper", "Repainted panels; small dents noted"],
  Interior: ["Clean upholstery, no odours", "Light wear on the driver's bolster", "Visible wear; trim rattles noted"],
  Tyres: ["Over 80% tread on all four", "50–70% tread, even wear", "Below 40% tread; replacement soon"],
  Electricals: ["All systems tested and working", "One minor fault code cleared", "Battery weak; infotainment lag"],
};

export interface InspectionReport {
  overall: number;
  grade: string;
  checksPassed: number;
  checksTotal: number;
  categories: { label: InspectionCategory; score: number; note: string }[];
}

export function gradeFor(score: number) {
  if (score >= 9.2) return "Excellent";
  if (score >= 8.6) return "Very good";
  if (score >= 8) return "Good";
  return "Fair";
}

/**
 * Category scores derived from the overall score and the listing id.
 * Offsets are centred so the category average stays close to the headline.
 */
export function deriveInspection(car: Pick<UsedCar, "id" | "inspectionScore" | "verified">): InspectionReport {
  const h = hashString(car.id);
  const raw = INSPECTION_CATEGORIES.map((_, i) => ((h >>> (i * 5)) & 0x1f) / 31 - 0.5);
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
  const spread = 1.4 - (car.inspectionScore - 7.5) * 0.35; // tighter for top-scoring cars

  const categories = INSPECTION_CATEGORIES.map((label, i) => {
    const score = clamp(Math.round((car.inspectionScore + (raw[i] - mean) * spread) * 10) / 10, 6, 10);
    const tier = score >= 9.2 ? 0 : score >= 8.3 ? 1 : 2;
    return { label, score, note: NOTES[label][tier] };
  });

  const checksTotal = car.verified ? 200 : 50;
  const failed = Math.round((10 - car.inspectionScore) * (car.verified ? 6 : 1.8));
  return {
    overall: car.inspectionScore,
    grade: gradeFor(car.inspectionScore),
    checksPassed: checksTotal - failed,
    checksTotal,
    categories,
  };
}

/**
 * Indicative fair-market band for a listing. Well-inspected cars are priced
 * slightly under the band's midpoint; weaker ones slightly over.
 */
export function fairPriceBand(car: Pick<UsedCar, "id" | "price" | "inspectionScore">) {
  const h = hashString(`${car.id}-market`);
  const tilt = (car.inspectionScore - 8.7) * 0.035 + (((h & 0xff) / 255) - 0.5) * 0.03;
  const mid = car.price * (1 + tilt);
  const low = mid * 0.94;
  const high = mid * 1.06;
  const position = (car.price - low) / (high - low);
  const verdict = car.price < mid * 0.975 ? "Great price" : car.price > high ? "Above market" : "Fair price";
  return { low, mid, high, position, verdict } as const;
}

/** A fictional, stable phone number for private sellers. */
export function sellerPhone(id: string) {
  const h = hashString(`${id}-phone`);
  const digits = String(9_000_000_000 + (h % 999_999_999)).padStart(10, "9");
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function maskPhone(phone: string) {
  // "+91 98765 43210" → "+91 98••• •••10"
  const [cc, a, b] = phone.split(" ");
  return `${cc} ${a.slice(0, 2)}${"•".repeat(a.length - 2)} ${"•".repeat(b.length - 2)}${b.slice(-2)}`;
}
