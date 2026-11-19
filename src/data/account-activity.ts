/** Demo account history shown on /profile. Names, times and outcomes are illustrative. */

export type ActivityKind = "test-drive" | "best-price" | "callback" | "inspection" | "valuation";
export type ActivityStatus = "Confirmed" | "Quotes received" | "In progress" | "Completed";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  /** ISO date */
  date: string;
  status: ActivityStatus;
  href: string;
  cta: string;
}

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  "test-drive": "Test drive",
  "best-price": "Best price",
  callback: "Loan callback",
  inspection: "Inspection",
  valuation: "Valuation",
};

export const accountActivity: ActivityItem[] = [
  {
    id: "act-2041",
    kind: "test-drive",
    title: "Hyundai Creta SX(O) Turbo DCT",
    detail: "Torque Motors, Indiranagar · Saturday 22 Nov, 11:00 am",
    date: "2026-11-17",
    status: "Confirmed",
    href: "/cars/hyundai-creta",
    cta: "View car",
  },
  {
    id: "act-2038",
    kind: "best-price",
    title: "Mahindra XEV 9e Pack Three",
    detail: "3 dealers responded · lowest on-road offer ₹31.4 Lakh",
    date: "2026-11-14",
    status: "Quotes received",
    href: "/cars/mahindra-xev-9e",
    cta: "View car",
  },
  {
    id: "act-2033",
    kind: "callback",
    title: "Car loan pre-approval",
    detail: "₹12 Lakh over 5 years · relationship manager assigned",
    date: "2026-11-11",
    status: "In progress",
    href: "/tools/car-loan",
    cta: "Check eligibility",
  },
  {
    id: "act-2027",
    kind: "inspection",
    title: "2023 Hyundai Creta · KA-03",
    detail: "180-point inspection · score 9.4 / 10",
    date: "2026-11-06",
    status: "Completed",
    href: "/used-cars/mg-1041",
    cta: "View listing",
  },
  {
    id: "act-2019",
    kind: "valuation",
    title: "2019 Honda City VX CVT",
    detail: "Indicative value ₹7.1 – 7.6 Lakh · 48,200 km",
    date: "2026-10-29",
    status: "Completed",
    href: "/tools/car-valuation",
    cta: "Value again",
  },
];
