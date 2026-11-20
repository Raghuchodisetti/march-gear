import { z } from "zod";
import type { CategorySlug } from "@/types";
import { categories } from "@/data/categories";
import { defineBlock, image, optionalText, text } from "../define";

/** The body-type categories the catalogue knows how to filter by. */
export const CATEGORY_OPTIONS: { value: CategorySlug; label: string }[] = [
  { value: "suv", label: "SUV" },
  { value: "sedan", label: "Sedan" },
  { value: "hatchback", label: "Hatchback" },
  { value: "muv", label: "MUV" },
  { value: "luxury", label: "Luxury" },
  { value: "electric", label: "Electric" },
];
const SLUGS = CATEGORY_OPTIONS.map((o) => o.value) as [CategorySlug, ...CategorySlug[]];

const focus = () =>
  optionalText(20).refine((v) => v === "" || /^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/.test(v), "Use two percentages, e.g. 62% 60%");

/** Category tiles: the home-page mosaic and the body-type filter on /new-cars. */
export const homeCategories = defineBlock({
  key: "homeCategories",
  title: "Browse by category",
  group: "Home",
  description: "The category tiles on the home page and the body-type filter tiles on the new-cars listing.",
  usedOn: ["/", "/new-cars"],
  schema: z.object({
    items: z
      .array(
        z.object({
          slug: z.enum(SLUGS, { error: "Choose a category" }),
          plural: text("tile name", 30),
          blurb: text("blurb", 140),
          image: image("photo"),
          focus: focus(),
        }),
      )
      .superRefine((items, ctx) => {
        const seen = new Set<string>();
        items.forEach((c, i) => {
          if (seen.has(c.slug)) ctx.addIssue({ code: "custom", path: [i, "slug"], message: "This category is already in the list" });
          seen.add(c.slug);
        });
        const missing = CATEGORY_OPTIONS.filter((o) => !seen.has(o.value)).map((o) => o.label);
        if (missing.length) ctx.addIssue({ code: "custom", message: `Every category needs a tile — add ${missing.join(", ")}` });
      }),
  }),
  defaults: {
    items: categories.map((c) => ({ slug: c.slug, plural: c.plural, blurb: c.blurb, image: c.image, focus: c.focus ?? "" })),
  },
  sections: [
    {
      title: "Category tiles",
      description:
        "Every category appears once. On the home page the first tile is the large one and the last spans the full width (both show the blurb); on /new-cars they're the body-type filter, in this order.",
      fields: [
        {
          name: "items",
          label: "Categories",
          type: "rows",
          addLabel: "Add category",
          itemTitle: "plural",
          fields: [
            { name: "slug", label: "Category", type: "select", required: true, options: CATEGORY_OPTIONS },
            { name: "plural", label: "Tile name", type: "text", required: true, placeholder: "SUVs" },
            { name: "blurb", label: "Blurb", type: "text", required: true, wide: true, hint: "One short sentence. Shown on the large and full-width home tiles." },
            { name: "image", label: "Photo", type: "image", required: true, wide: true },
            { name: "focus", label: "Photo focus", type: "text", placeholder: "50% 50%", hint: "Horizontal and vertical position to keep in frame. Empty centres the photo." },
          ],
        },
      ],
    },
  ],
});
