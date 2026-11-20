import { z } from "zod";
import { aboutStats, aboutTimeline, aboutValues, editorialPrinciples } from "@/data/editorial-company";
import { defineBlock, number, rows, text } from "../define";
import type { Field } from "@/components/admin/fields";

/** Prefix/suffix around a counter — kept exactly as typed (a leading space matters: "24 hrs" vs "2.4M"). */
const affix = z
  .string()
  .max(12, "Keep this under 12 characters")
  .nullish()
  .transform((v) => v ?? "");

const titled = (label: string) => z.object({ title: text(`${label} title`, 80), body: text(`${label} text`, 400) });

const titledFields: Field[] = [
  { name: "title", label: "Title", type: "text", required: true, wide: true },
  { name: "body", label: "Text", type: "textarea", required: true, rows: 3 },
];

/** Stats, values, editorial principles and timeline on /about. */
export const about = defineBlock({
  key: "about",
  title: "About page",
  group: "Pages",
  description: "Stats, values, editorial principles and timeline on the about page.",
  usedOn: ["/about"],
  schema: z.object({
    timeline: rows(z.object({ year: text("year", 12), title: text("milestone title", 60), body: text("milestone text", 240) }), "milestone", 1),
    stats: rows(
      z.object({
        value: number("number", 0, 1e12),
        decimals: z.number().int("Use a whole number of decimals").min(0).max(3).nullish().transform((v) => v ?? 0),
        prefix: affix,
        suffix: affix,
        label: text("label", 60),
        note: text("note", 80),
      }),
      "stat",
      1,
    ),
    values: rows(titled("value"), "value", 1),
    principles: rows(titled("principle"), "principle", 1),
  }),
  defaults: {
    timeline: aboutTimeline.map((t) => ({ year: t.year, title: t.title, body: t.body })),
    stats: aboutStats.map((s) => ({ value: s.value, decimals: s.decimals ?? 0, prefix: s.prefix ?? "", suffix: s.suffix ?? "", label: s.label, note: s.note })),
    values: aboutValues.map((v) => ({ title: v.title, body: v.body })),
    principles: editorialPrinciples.map((p) => ({ title: p.title, body: p.body })),
  },
  sections: [
    {
      title: "Timeline",
      description: "The milestones under “Our story”. Four fit one row on desktop.",
      fields: [
        {
          name: "timeline",
          label: "Milestones",
          type: "rows",
          addLabel: "Add milestone",
          itemTitle: "year",
          fields: [
            { name: "year", label: "Year", type: "text", required: true, placeholder: "2019" },
            { name: "title", label: "Title", type: "text", required: true },
            { name: "body", label: "Text", type: "textarea", required: true, rows: 2 },
          ],
        },
      ],
    },
    {
      title: "In numbers",
      description: "The counters that animate in. Four fit one row on desktop.",
      fields: [
        {
          name: "stats",
          label: "Stats",
          type: "rows",
          addLabel: "Add stat",
          itemTitle: "label",
          fields: [
            { name: "value", label: "Number", type: "number", required: true, step: 0.1, min: 0 },
            { name: "decimals", label: "Decimal places", type: "number", step: 1, min: 0, max: 3, hint: "0 for whole numbers, 1 for 2.4 and so on." },
            { name: "prefix", label: "Before the number", type: "text", placeholder: "₹", hint: "Shown exactly as typed." },
            { name: "suffix", label: "After the number", type: "text", placeholder: "+", hint: "Shown exactly as typed — start with a space for “24 hrs”." },
            { name: "label", label: "Label", type: "text", required: true },
            { name: "note", label: "Note", type: "text", required: true },
          ],
        },
      ],
    },
    {
      title: "Mission & values",
      description: "Numbered cards beside “Our mission”.",
      fields: [{ name: "values", label: "Values", type: "rows", addLabel: "Add value", itemTitle: "title", fields: titledFields }],
    },
    {
      title: "Editorial independence",
      description: "The numbered principles in the dark “not for sale” section.",
      fields: [{ name: "principles", label: "Principles", type: "rows", addLabel: "Add principle", itemTitle: "title", fields: titledFields }],
    },
  ],
});
