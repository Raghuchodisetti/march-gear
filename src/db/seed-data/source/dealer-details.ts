import type { DealerProfile } from "@/lib/catalog";

/**
 * Showroom profiles that extend the shared dealer records. Fictional,
 * for demonstration only.
 *
 * `bearing` is the compass direction (degrees, 0 = north, clockwise) used to
 * place the showroom on the schematic dealer map; `distanceKm` on the dealer
 * sets how far from the centre it sits.
 */
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
