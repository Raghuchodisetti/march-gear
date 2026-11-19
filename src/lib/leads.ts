import type { LeadStatus, LeadType } from "@/db/enums";

/** Human labels for lead types and statuses — shared by the admin UI and CSV export. */
export const LEAD_TYPE_LABEL: Record<LeadType, string> = {
  test_drive: "Test drive",
  best_price: "Best price",
  contact_dealer: "Dealer enquiry",
  callback: "Callback",
  inspection: "Used-car inspection",
  pdi_booking: "PDI booking",
  pdi_checklist: "PDI checklist",
  sell_car: "Sell car",
  used_car: "Used-car offer",
  contact: "Contact form",
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  closed: "Closed",
};

export const LEAD_STATUS_TONE: Record<LeadStatus, "red" | "amber" | "blue" | "green" | "neutral"> = {
  new: "red",
  contacted: "amber",
  qualified: "blue",
  converted: "green",
  closed: "neutral",
};

const DETAIL_LABEL: Record<string, string> = {
  date: "Preferred date",
  slot: "Time slot",
  timeline: "Buying timeline",
  plan: "PDI plan",
  dealer: "Dealership",
  deliveryDate: "Delivery date",
  brand: "Brand",
  model: "Model",
  fuel: "Fuel",
  year: "Year",
  transmission: "Transmission",
  km: "Kilometres",
  estimate: "Our estimate",
  offer: "Offer",
  askingPrice: "Asking price",
};

export const detailLabel = (key: string) =>
  DETAIL_LABEL[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

const TIMELINE: Record<string, string> = { week: "Within a week", month: "Within a month", later: "Just researching" };

export function detailValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "timeline") return TIMELINE[String(value)] ?? String(value);
  if (key === "slot") return String(value).replace(/^./, (c) => c.toUpperCase());
  if ((key === "offer" || key === "askingPrice") && typeof value === "number") return `₹${value.toLocaleString("en-IN")}`;
  if (key === "km" && typeof value === "number") return `${value.toLocaleString("en-IN")} km`;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
