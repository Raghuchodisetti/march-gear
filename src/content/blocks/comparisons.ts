import { z } from "zod";
import { popularComparisons } from "@/data/compare-listing";
import { defineBlock, rows, text } from "../define";

/** Same limit as the compare tool (MAX_COMPARE in the app provider). */
const MAX_CARS = 4;

// Checked as a whole list so the message shows under the field (the form doesn't show per-line errors).
const carSlugs = z
  .array(z.string())
  .default([])
  .transform((a) => Array.from(new Set(a.map((s) => s.trim().toLowerCase()).filter(Boolean))))
  .refine((a) => a.every((s) => s.length <= 120 && /^[a-z0-9-]+$/.test(s)), "Car slugs use lowercase letters, numbers and hyphens — e.g. hyundai-creta")
  .refine((a) => a.length >= 2, "List at least two cars")
  .refine((a) => a.length <= MAX_CARS, `The compare tool takes at most ${MAX_CARS} cars`);

/** Curated comparison starters on /compare. */
export const comparisons = defineBlock({
  key: "comparisons",
  title: "Popular comparisons",
  group: "Pages",
  description: "Curated comparison starting points on the compare page.",
  usedOn: ["/compare"],
  schema: z.object({
    items: rows(
      z.object({
        theme: text("theme", 60),
        note: text("note", 200),
        cars: carSlugs,
      }),
      "comparison",
    ),
  }),
  defaults: {
    items: popularComparisons.map((p) => ({ theme: p.theme, note: p.note, cars: [...p.cars] })),
  },
  sections: [
    {
      title: "Comparisons",
      description:
        "Each card opens the compare tool with its cars side by side. A card is hidden while fewer than two of its cars are published, so unknown or unpublished slugs are skipped safely. Remove every comparison to hide the section.",
      fields: [
        {
          name: "items",
          label: "Comparisons",
          type: "rows",
          addLabel: "Add comparison",
          itemTitle: "theme",
          fields: [
            { name: "theme", label: "Theme", type: "text", required: true, placeholder: "The midsize benchmark" },
            { name: "note", label: "Note", type: "textarea", required: true, rows: 2 },
            {
              name: "cars",
              label: "Cars",
              type: "lines",
              rows: 4,
              required: true,
              hint: `One car slug per line, 2 to ${MAX_CARS} — the last part of the car's page address, e.g. hyundai-creta for /cars/hyundai-creta.`,
            },
          ],
        },
      ],
    },
  ],
});
