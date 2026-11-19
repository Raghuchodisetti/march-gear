import type { CategorySlug } from "@/types";
import { u } from "@/lib/utils";
import { IMG } from "./images";

export interface Category {
  slug: CategorySlug;
  name: string;
  plural: string;
  blurb: string;
  image: string;
  focus?: string;
}

export const categories: Category[] = [
  {
    slug: "suv",
    name: "SUV",
    plural: "SUVs",
    blurb: "Commanding views, tall clearance and room for the whole story.",
    image: u("photo-1533473359331-0135ef1b58bf"),
    focus: "62% 60%",
  },
  {
    slug: "sedan",
    name: "Sedan",
    plural: "Sedans",
    blurb: "Long-distance comfort with a quiet, composed ride.",
    image: u("photo-1546614042-7df3c24c9e5d"),
  },
  {
    slug: "hatchback",
    name: "Hatchback",
    plural: "Hatchbacks",
    blurb: "City-sized, easy to park and frugal to run.",
    image: u("photo-1550355291-bbee04a92027"),
    focus: "40% 50%",
  },
  {
    slug: "muv",
    name: "MUV",
    plural: "MUVs",
    blurb: "Seven seats, flexible space and road-trip readiness.",
    image: IMG.camper,
  },
  {
    slug: "luxury",
    name: "Luxury",
    plural: "Luxury Cars",
    blurb: "Craftsmanship, technology and effortless performance.",
    image: IMG.rollsWraith,
  },
  {
    slug: "electric",
    name: "Electric",
    plural: "Electric Cars",
    blurb: "Silent, instant and increasingly long-legged.",
    image: IMG.chargeStation,
  },
];

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
