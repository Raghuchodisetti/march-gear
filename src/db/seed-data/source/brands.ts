import type { Brand } from "@/types";
import { u } from "@/lib/utils";

export const brands: Brand[] = [
  {
    slug: "maruti-suzuki",
    name: "Maruti Suzuki",
    country: "India / Japan",
    founded: 1981,
    tagline: "The everyday standard",
    description:
      "India's largest carmaker, known for frugal engines, an unmatched service footprint and some of the strongest resale values in the market.",
    heroImage: u("photo-1582639510494-c80b5de9f148"),
  },
  {
    slug: "hyundai",
    name: "Hyundai",
    country: "South Korea",
    founded: 1967,
    tagline: "Feature-rich, finely finished",
    description:
      "A benchmark for equipment and refinement in the mainstream segments, with a line-up that spans city hatchbacks to long-range electric SUVs.",
    heroImage: u("photo-1575090536203-2a6193126514"),
  },
  {
    slug: "tata",
    name: "Tata Motors",
    country: "India",
    founded: 1945,
    tagline: "Built safe, built here",
    description:
      "Home-grown engineering with a reputation for five-star crash ratings and the country's broadest range of affordable electric vehicles.",
    heroImage: u("photo-1609521263047-f8f205293f24"),
  },
  {
    slug: "mahindra",
    name: "Mahindra",
    country: "India",
    founded: 1945,
    tagline: "SUVs with real-world grit",
    description:
      "Rugged, torque-rich SUVs and a bold new generation of born-electric models built on the INGLO platform.",
    heroImage: u("photo-1529369623266-f5264b696110"),
  },
  {
    slug: "toyota",
    name: "Toyota",
    country: "Japan",
    founded: 1937,
    tagline: "Reliability, refined",
    description:
      "Legendary durability, strong-hybrid efficiency and ownership costs that stay low long after the warranty ends.",
    heroImage: u("photo-1621993202323-f438eec934ff"),
  },
  {
    slug: "honda",
    name: "Honda",
    country: "Japan",
    founded: 1948,
    tagline: "Engineering first",
    description:
      "Smooth, high-revving engines and spacious, sensibly packaged cabins with a loyal ownership base.",
    heroImage: u("photo-1634737581963-5a22ba471961"),
  },
  {
    slug: "kia",
    name: "Kia",
    country: "South Korea",
    founded: 1944,
    tagline: "Design-led family cars",
    description:
      "Distinctive styling, generous warranties and family-friendly packaging across SUVs and MPVs.",
    heroImage: u("photo-1533473359331-0135ef1b58bf"),
  },
  {
    slug: "skoda",
    name: "Skoda",
    country: "Czech Republic",
    founded: 1895,
    tagline: "European solidity",
    description:
      "Locally built on the MQB-A0-IN platform, with crisp TSI engines and five-star Global NCAP results.",
    heroImage: u("photo-1581540222194-0def2dda95b8"),
  },
  {
    slug: "mg",
    name: "MG",
    country: "United Kingdom / China",
    founded: 1924,
    tagline: "Connected by default",
    description:
      "Tech-forward cabins, inventive ownership models such as battery-as-a-service, and a fast-growing EV range.",
    heroImage: u("photo-1560958089-b8a1929cea89"),
  },
  {
    slug: "byd",
    name: "BYD",
    country: "China",
    founded: 1995,
    tagline: "Battery-native engineering",
    description:
      "The world's largest EV maker, bringing Blade Battery safety and long range to the premium electric segment.",
    heroImage: u("photo-1536700503339-1e4b06520771"),
  },
  {
    slug: "tesla",
    name: "Tesla",
    country: "United States",
    founded: 2003,
    tagline: "Software-defined driving",
    description:
      "Over-the-air updates, a minimalist cabin and access to the Supercharger network in key Indian metros.",
    heroImage: u("photo-1600661653561-629509216228"),
    isLuxury: true,
  },
  {
    slug: "bmw",
    name: "BMW",
    country: "Germany",
    founded: 1916,
    tagline: "Sheer driving pleasure",
    description:
      "Locally assembled at Chennai, combining rear-drive dynamics with long-wheelbase comfort tuned for Indian buyers.",
    heroImage: u("photo-1601362840469-51e4d8d58785"),
    isLuxury: true,
  },
  {
    slug: "mercedes-benz",
    name: "Mercedes-Benz",
    country: "Germany",
    founded: 1926,
    tagline: "The best or nothing",
    description:
      "India's luxury segment leader, from executive sedans assembled in Pune to the iconic G-Class.",
    heroImage: u("photo-1610099610040-ab19f3a5ec35"),
    isLuxury: true,
  },
  {
    slug: "audi",
    name: "Audi",
    country: "Germany",
    founded: 1909,
    tagline: "Progress through technology",
    description:
      "Understated design, quattro all-wheel drive and precise, tech-rich cabins across sedans and SUVs.",
    heroImage: u("photo-1540066019607-e5f69323a8dc"),
    isLuxury: true,
  },
  {
    slug: "land-rover",
    name: "Land Rover",
    country: "United Kingdom",
    founded: 1948,
    tagline: "Above and beyond",
    description:
      "Peerless off-road capability wrapped in the most desirable luxury SUV design in the market.",
    heroImage: u("photo-1563720223185-11003d516935"),
    isLuxury: true,
  },
  {
    slug: "porsche",
    name: "Porsche",
    country: "Germany",
    founded: 1931,
    tagline: "There is no substitute",
    description:
      "Benchmark sports cars, effortless grand tourers and the electric Taycan, each engineered around the driver.",
    heroImage: u("photo-1594502184342-2e12f877aa73"),
    isLuxury: true,
  },
];
