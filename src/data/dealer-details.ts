import type { Dealer } from "@/types";
import { dealers } from "./dealers";

/**
 * Showroom profiles that extend the shared dealer records. Fictional,
 * for demonstration only.
 *
 * `bearing` is the compass direction (degrees, 0 = north, clockwise) used to
 * place the showroom on the schematic dealer map; `distanceKm` on the dealer
 * sets how far from the centre it sits.
 */
export interface DealerProfile {
  about: string;
  facilities: string[];
  showroomArea: string;
  serviceBays: number;
  languages: string[];
  bearing: number;
}

export const dealerProfiles: Record<string, DealerProfile> = {
  "torque-blr": {
    about:
      "A two-level Hyundai flagship on Indiranagar's 100 Feet Road, with a dedicated certified pre-owned floor and a same-day express service lane.",
    facilities: ["Customer lounge & café", "Free Wi-Fi", "EV fast charger", "Kids' corner", "Valet parking", "Doorstep test drives"],
    showroomArea: "18,500 sq ft",
    serviceBays: 24,
    languages: ["English", "Kannada", "Hindi", "Tamil"],
    bearing: 58,
  },
  "apex-mumbai": {
    about:
      "A gallery-style pre-owned showroom in Worli specialising in low-mileage luxury and performance cars, each sold with a 200-point inspection report.",
    facilities: ["Private viewing suite", "Free Wi-Fi", "Detailing studio", "Valet parking", "Doorstep test drives", "Finance desk"],
    showroomArea: "9,200 sq ft",
    serviceBays: 6,
    languages: ["English", "Hindi", "Marathi", "Gujarati"],
    bearing: 238,
  },
  "meridian-toyota-hyd": {
    about:
      "One of the city's longest-running Toyota partners, with a hybrid-certified workshop and a Toyota U Trust pre-owned yard behind the showroom.",
    facilities: ["Customer lounge & café", "Free Wi-Fi", "Hybrid service centre", "Kids' corner", "Covered parking", "Pick-up & drop"],
    showroomArea: "22,000 sq ft",
    serviceBays: 32,
    languages: ["English", "Telugu", "Hindi", "Urdu"],
    bearing: 312,
  },
  "bavaria-delhi": {
    about:
      "A BMW and MINI destination in Saket's District Centre with a Premium Selection pre-owned gallery and an in-house M Performance parts studio.",
    facilities: ["Customer lounge & café", "Free Wi-Fi", "EV fast charger", "Valet parking", "Delivery bay", "Pick-up & drop"],
    showroomArea: "16,000 sq ft",
    serviceBays: 20,
    languages: ["English", "Hindi", "Punjabi"],
    bearing: 152,
  },
  "quattro-chennai": {
    about:
      "An Audi showroom on the OMR IT corridor, combining new-car sales, the Audi Approved: plus pre-owned programme and a detailing studio.",
    facilities: ["Customer lounge & café", "Free Wi-Fi", "EV fast charger", "Detailing studio", "Covered parking", "Pick-up & drop"],
    showroomArea: "14,000 sq ft",
    serviceBays: 18,
    languages: ["English", "Tamil", "Hindi"],
    bearing: 128,
  },
  "sahyadri-tata-pune": {
    about:
      "A high-volume Tata Motors dealership in Baner with an EV experience zone, home-charger installation team and a Tata Assured pre-owned bay.",
    facilities: ["Customer lounge", "Free Wi-Fi", "EV fast charger", "Kids' corner", "Covered parking", "Body shop"],
    showroomArea: "20,000 sq ft",
    serviceBays: 28,
    languages: ["English", "Marathi", "Hindi"],
    bearing: 270,
  },
  "northern-drive-chd": {
    about:
      "An enthusiast-run pre-owned house for performance and collectible cars, with consignment sales and track-day preparation in-house.",
    facilities: ["Private viewing suite", "Free Wi-Fi", "Detailing studio", "Covered parking", "Doorstep test drives", "Finance desk"],
    showroomArea: "7,500 sq ft",
    serviceBays: 8,
    languages: ["English", "Hindi", "Punjabi"],
    bearing: 22,
  },
  "coastline-goa": {
    about:
      "A relaxed highway showroom in Porvorim known for classic and collectible cars, with inter-state transfer and re-registration handled end to end.",
    facilities: ["Customer lounge", "Free Wi-Fi", "Covered parking", "Doorstep test drives", "Insurance desk", "Pick-up & drop"],
    showroomArea: "8,000 sq ft",
    serviceBays: 6,
    languages: ["English", "Konkani", "Hindi", "Marathi"],
    bearing: 196,
  },
  "volta-mahindra-mumbai": {
    about:
      "Mahindra's SUV and born-electric experience centre on the Western Express Highway, open late seven days a week with a dedicated BE & XEV zone.",
    facilities: ["Customer lounge & café", "Free Wi-Fi", "EV fast charger", "Kids' corner", "Covered parking", "Accessories studio"],
    showroomArea: "24,000 sq ft",
    serviceBays: 30,
    languages: ["English", "Hindi", "Marathi"],
    bearing: 98,
  },
  "stellar-mercedes-blr": {
    about:
      "A Mercedes-Benz lounge in Whitefield with an AMG performance centre, certified pre-owned gallery and a concierge desk for corporate buyers.",
    facilities: ["Private viewing suite", "Customer lounge & café", "Free Wi-Fi", "EV fast charger", "Valet parking", "Pick-up & drop"],
    showroomArea: "19,000 sq ft",
    serviceBays: 22,
    languages: ["English", "Kannada", "Hindi"],
    bearing: 262,
  },
};

const FALLBACK: DealerProfile = {
  about: "An authorised March Gear partner showroom.",
  facilities: ["Customer lounge", "Free Wi-Fi", "Covered parking"],
  showroomArea: "—",
  serviceBays: 0,
  languages: ["English", "Hindi"],
  bearing: 0,
};

export const dealerProfile = (id: string) => dealerProfiles[id] ?? FALLBACK;

/** Approximate city centres (lat, lng) for "nearby" calculations. */
const CITY_COORDS: Record<string, [number, number]> = {
  Mumbai: [19.076, 72.878],
  "New Delhi": [28.614, 77.209],
  Bengaluru: [12.972, 77.595],
  Hyderabad: [17.385, 78.487],
  Chennai: [13.083, 80.271],
  Pune: [18.52, 73.857],
  Kolkata: [22.573, 88.364],
  Ahmedabad: [23.023, 72.571],
  Jaipur: [26.912, 75.787],
  Kochi: [9.931, 76.267],
  Chandigarh: [30.733, 76.779],
  Lucknow: [26.847, 80.947],
  Panaji: [15.49, 73.828],
  Indore: [22.72, 75.858],
  Coimbatore: [11.017, 76.956],
  Bhubaneswar: [20.296, 85.825],
};

/** Great-circle distance between two cities in km (0 when unknown or equal). */
export function cityDistanceKm(a: string, b: string) {
  if (a === b) return 0;
  const p = CITY_COORDS[a];
  const q = CITY_COORDS[b];
  if (!p || !q) return 0;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(q[0] - p[0]);
  const dLng = rad(q[1] - p[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(p[0])) * Math.cos(rad(q[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}

/** Other showrooms, same city first, then by distance between cities. */
export function nearbyDealers(dealer: Dealer, limit = 3) {
  return dealers
    .filter((d) => d.id !== dealer.id)
    .map((d) => ({ dealer: d, km: cityDistanceKm(dealer.city, d.city) }))
    .sort((a, b) => a.km - b.km || b.dealer.rating - a.dealer.rating)
    .slice(0, limit);
}
