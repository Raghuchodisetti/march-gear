import type { City } from "@/types";

/* Launch defaults for the `cities` content block (src/content/blocks/cities.ts).
   The site reads the saved block through the catalogue: `cities`, `getCity` and
   `onRoadPrice` from getCatalog() / useCatalog(). */

export const cities: City[] = [
  { slug: "mumbai", name: "Mumbai", state: "Maharashtra", onRoadFactor: 1.19, popular: true },
  { slug: "delhi", name: "New Delhi", state: "Delhi", onRoadFactor: 1.14, popular: true },
  { slug: "bengaluru", name: "Bengaluru", state: "Karnataka", onRoadFactor: 1.24, popular: true },
  { slug: "hyderabad", name: "Hyderabad", state: "Telangana", onRoadFactor: 1.22, popular: true },
  { slug: "chennai", name: "Chennai", state: "Tamil Nadu", onRoadFactor: 1.2, popular: true },
  { slug: "pune", name: "Pune", state: "Maharashtra", onRoadFactor: 1.18, popular: true },
  { slug: "kolkata", name: "Kolkata", state: "West Bengal", onRoadFactor: 1.15, popular: true },
  { slug: "ahmedabad", name: "Ahmedabad", state: "Gujarat", onRoadFactor: 1.13, popular: true },
  { slug: "jaipur", name: "Jaipur", state: "Rajasthan", onRoadFactor: 1.16 },
  { slug: "kochi", name: "Kochi", state: "Kerala", onRoadFactor: 1.21 },
  { slug: "chandigarh", name: "Chandigarh", state: "Chandigarh", onRoadFactor: 1.11 },
  { slug: "lucknow", name: "Lucknow", state: "Uttar Pradesh", onRoadFactor: 1.15 },
  { slug: "goa", name: "Panaji", state: "Goa", onRoadFactor: 1.12 },
  { slug: "indore", name: "Indore", state: "Madhya Pradesh", onRoadFactor: 1.17 },
  { slug: "coimbatore", name: "Coimbatore", state: "Tamil Nadu", onRoadFactor: 1.2 },
  { slug: "bhubaneswar", name: "Bhubaneswar", state: "Odisha", onRoadFactor: 1.14 },
];

export const DEFAULT_CITY = "mumbai";

/** EVs attract near-zero road tax in most states, so they pay only this share of a city's on-road markup. */
export const EV_ON_ROAD_SHARE = 0.35;
