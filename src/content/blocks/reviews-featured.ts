import { z } from "zod";
import { defineBlock, lines } from "../define";

const CAR_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The editor's shortlist on /reviews — the highest-scoring pick becomes the cover review. */
export const reviewsFeatured = defineBlock({
  key: "reviewsFeatured",
  title: "Featured reviews",
  group: "Editorial",
  description: "Which expert reviews are featured at the top of the reviews page.",
  usedOn: ["/reviews"],
  schema: z.object({
    picks: lines(120)
      .transform((slugs) => [...new Set(slugs.map((s) => s.toLowerCase()))])
      .refine((slugs) => slugs.every((s) => CAR_SLUG.test(s)), "Use car slugs: lowercase letters, numbers and hyphens, one per line")
      .refine((slugs) => slugs.length <= 24, "Keep the shortlist to 24 cars or fewer"),
  }),
  defaults: {
    picks: ["mahindra-xev-9e", "toyota-innova-hycross", "range-rover-sport", "porsche-911", "hyundai-creta", "byd-seal"],
  },
  sections: [
    {
      title: "Editor's shortlist",
      description:
        "The cars whose expert reviews are in the running for the cover of the reviews page. The pick with the highest expert score leads as the cover review.",
      fields: [
        {
          name: "picks",
          label: "Featured cars",
          type: "lines",
          rows: 8,
          placeholder: "mahindra-xev-9e\nporsche-911",
          hint: "One car slug per line — the last part of the car's page address (/cars/porsche-911 → porsche-911). Cars that are unpublished or no longer exist are skipped. Leave empty to feature the highest-scoring review overall.",
        },
      ],
    },
  ],
});
