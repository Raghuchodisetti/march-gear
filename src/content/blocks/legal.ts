import { z } from "zod";
import { LEGAL_UPDATED, privacySections, termsSections, type LegalSection } from "@/data/editorial-legal";
import type { Field } from "@/components/admin/fields";
import { defineBlock, rows, text } from "../define";

/** One-per-line text, blank lines dropped. Length is checked on the whole list so the message shows under the field. */
const lineList = (max: number, what: string) =>
  z
    .array(z.string())
    .default([])
    .transform((a) => a.map((s) => s.trim()).filter(Boolean))
    .refine((a) => a.every((s) => s.length <= max), `Keep each ${what} under ${max} characters`);

const section = z.object({
  title: text("section title", 120),
  anchor: z
    .string()
    .trim()
    .toLowerCase()
    .max(80, "Keep the anchor under 80 characters")
    .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and hyphens")
    .nullish()
    .transform((v) => v ?? ""),
  paragraphs: lineList(2000, "paragraph").refine((a) => a.length > 0, "Add at least one paragraph"),
  list: lineList(600, "bullet point"),
});

const legalDocument = (label: string) =>
  rows(section, "section", 1).superRefine((sections, ctx) => {
    const seen = new Set<string>();
    sections.forEach((s, i) => {
      if (!s.anchor) return;
      if (seen.has(s.anchor)) ctx.addIssue({ code: "custom", path: [i, "anchor"], message: `Another ${label} section already uses this anchor` });
      seen.add(s.anchor);
    });
  });

const toRows = (sections: LegalSection[]) => sections.map((s) => ({ title: s.title, anchor: s.id, paragraphs: s.paragraphs, list: s.list ?? [] }));

const sectionFields: Field[] = [
  { name: "title", label: "Heading", type: "text", required: true },
  {
    name: "anchor",
    label: "Anchor",
    type: "text",
    placeholder: "information-we-collect",
    hint: "The #link to this section. Empty makes one from the heading. Other pages may link here (e.g. /terms#user-content), so change with care.",
  },
  { name: "paragraphs", label: "Paragraphs", type: "lines", required: true, rows: 5, hint: "One paragraph per line." },
  { name: "list", label: "Bullet points", type: "lines", rows: 4, hint: "Optional. One point per line, shown after the paragraphs." },
];

/** The privacy policy and terms of use. */
export const legal = defineBlock({
  key: "legal",
  title: "Privacy policy & terms",
  group: "Legal",
  description: "The privacy policy and terms of use, section by section, and their “last updated” date.",
  usedOn: ["/privacy", "/terms"],
  schema: z.object({
    updated: z
      .string({ error: "Choose the date" })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date")
      .refine((v) => {
        const d = new Date(`${v}T00:00:00Z`);
        return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
      }, "Choose a real date"),
    privacy: legalDocument("privacy"),
    terms: legalDocument("terms"),
  }),
  defaults: {
    updated: LEGAL_UPDATED,
    privacy: toRows(privacySections),
    terms: toRows(termsSections),
  },
  sections: [
    {
      title: "Last updated",
      fields: [{ name: "updated", label: "Last updated", type: "date", required: true, hint: "Shown at the top of both pages. Change it whenever you change the wording." }],
    },
    {
      title: "Privacy policy",
      description: "Shown at /privacy, numbered in this order, with a contents list built from the headings.",
      fields: [{ name: "privacy", label: "Sections", type: "rows", addLabel: "Add section", itemTitle: "title", fields: sectionFields }],
    },
    {
      title: "Terms of use",
      description: "Shown at /terms, numbered in this order, with a contents list built from the headings.",
      fields: [{ name: "terms", label: "Sections", type: "rows", addLabel: "Add section", itemTitle: "title", fields: sectionFields }],
    },
  ],
});
