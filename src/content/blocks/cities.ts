import { z } from "zod";
import { cities as launchCities, DEFAULT_CITY, EV_ON_ROAD_SHARE } from "@/data/cities";
import { CITY_COORDS } from "@/lib/catalog";
import { defineBlock, flag, number, rows, text } from "../define";

const city = z.object({
  slug: z
    .string({ error: "Enter the slug" })
    .trim()
    .toLowerCase()
    .min(1, "Enter the slug")
    .max(60, "Keep the slug under 60 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens, e.g. new-delhi"),
  name: text("city name", 60),
  state: text("state", 60),
  onRoadFactor: number("on-road factor", 1, 1.5),
  popular: flag,
  isDefault: flag,
  /** For "Use my location". Optional — cities without coordinates just aren't auto-detected. */
  lat: z.number().min(-90, "Latitude is between -90 and 90").max(90, "Latitude is between -90 and 90").nullish().transform((v) => v ?? null),
  lng: z.number().min(-180, "Longitude is between -180 and 180").max(180, "Longitude is between -180 and 180").nullish().transform((v) => v ?? null),
});

/** Slugs are saved in visitors' browsers and names on dealers and listings, so both must be unique; one default at most. */
const cityList = rows(city, "city", 1).superRefine((items, ctx) => {
  const slugs = new Map<string, number>();
  const names = new Map<string, number>();
  items.forEach((c, i) => {
    const sameSlug = slugs.get(c.slug);
    if (sameSlug !== undefined) ctx.addIssue({ code: "custom", path: [i, "slug"], message: `“${c.slug}” is already used by city ${sameSlug + 1}` });
    else slugs.set(c.slug, i);
    const sameName = names.get(c.name.toLowerCase());
    if (sameName !== undefined) ctx.addIssue({ code: "custom", path: [i, "name"], message: `${c.name} is already listed (city ${sameName + 1})` });
    else names.set(c.name.toLowerCase(), i);
  });
  // Shown under the list: checkbox fields don't display their own errors.
  const ticked = items.filter((c) => c.isDefault).map((c) => c.name);
  if (ticked.length > 1) ctx.addIssue({ code: "custom", path: [], message: `Only one city can be the default — untick all but one of ${ticked.join(", ")}` });
});

/** Cities visitors can pick, and how on-road prices are estimated for each. */
export const cities = defineBlock({
  key: "cities",
  title: "Cities & on-road pricing",
  group: "Pricing & tools",
  description:
    "Cities visitors can pick, and the factor used to estimate on-road prices from ex-showroom. The same list is offered for dealers and used-car listings in admin.",
  usedOn: ["City picker", "Car & variant prices", "Compare", "Ownership cost", "Enquiry & PDI forms", "Admin city lists"],
  schema: z.object({
    items: cityList,
    evMarkupShare: number("EV share of the on-road markup", 0, 100),
  }),
  defaults: {
    items: launchCities.map((c) => ({
      slug: c.slug,
      name: c.name,
      state: c.state,
      onRoadFactor: c.onRoadFactor,
      popular: Boolean(c.popular),
      isDefault: c.slug === DEFAULT_CITY,
      lat: CITY_COORDS[c.name]?.[0] ?? null,
      lng: CITY_COORDS[c.name]?.[1] ?? null,
    })),
    // 0.35 → 35, without floating-point noise.
    evMarkupShare: Math.round(EV_ON_ROAD_SHARE * 1e6) / 1e4,
  },
  sections: [
    {
      title: "Cities",
      description:
        "Shown in the city picker in this order — popular cities first as quick picks, the rest as a list. Removing a city moves visitors who chose it to the default city.",
      fields: [
        {
          name: "items",
          label: "Cities",
          type: "rows",
          addLabel: "Add city",
          itemTitle: "name",
          fields: [
            { name: "name", label: "City name", type: "text", required: true, placeholder: "Visakhapatnam" },
            { name: "state", label: "State", type: "text", required: true, placeholder: "Andhra Pradesh" },
            {
              name: "slug",
              label: "Slug",
              type: "text",
              required: true,
              placeholder: "visakhapatnam",
              hint: "Lowercase, unique. Saved in visitors' browsers — changing it resets their choice to the default city.",
            },
            {
              name: "onRoadFactor",
              label: "On-road factor",
              type: "number",
              required: true,
              step: 0.01,
              min: 1,
              max: 1.5,
              suffix: "× ex-showroom",
              hint: "Ex-showroom × this = indicative on-road price. 1.19 adds 19% for RTO, road tax, insurance and handling. Between 1.00 and 1.50.",
            },
            { name: "popular", label: "Popular city", type: "checkbox", hint: "Quick pick in the city picker, sell-car form and on-road price comparison." },
            {
              name: "isDefault",
              label: "Default city",
              type: "checkbox",
              hint: "For visitors who haven't picked a city yet, and anyone whose saved city is removed. If none is ticked, the first city is used.",
            },
            { name: "lat", label: "Latitude", type: "number", step: 0.001, min: -90, max: 90, hint: "For “Use my location”. On Google Maps, right-click the city → copy the first number." },
            { name: "lng", label: "Longitude", type: "number", step: 0.001, min: -180, max: 180, hint: "The second number." },
          ],
        },
      ],
    },
    {
      title: "Electric cars",
      fields: [
        {
          name: "evMarkupShare",
          label: "EV share of the on-road markup",
          type: "number",
          required: true,
          step: 1,
          min: 0,
          max: 100,
          suffix: "%",
          hint: "Most states waive road tax on EVs, so an EV pays only this share of the city's markup. At 35%, a 1.20 city factor becomes 1.07 for an EV.",
        },
      ],
    },
  ],
});
