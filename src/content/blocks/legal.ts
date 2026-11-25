import { z } from "zod";
import { LEGAL_TOKENS, LEGAL_UPDATED, privacySections, privacySummary, termsSections, termsSummary, type LegalSection } from "@/data/editorial-legal";
import type { Field } from "@/components/admin/fields";
import { defineBlock, rows, text } from "../define";

/* Shared by the four policy blocks: legal (privacy + terms), cookiePolicy and refundPolicy. */

/** One-per-line text, blank lines dropped. Length is checked on the whole list so the message shows under the field. */
export const lineList = (max: number, what: string) =>
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

export const legalDocument = (label: string) =>
  rows(section, "section", 1).superRefine((sections, ctx) => {
    const seen = new Set<string>();
    sections.forEach((s, i) => {
      if (!s.anchor) return;
      if (seen.has(s.anchor)) ctx.addIssue({ code: "custom", path: [i, "anchor"], message: `Another ${label} section already uses this anchor` });
      seen.add(s.anchor);
    });
  });

/** The "In short" points at the top of a policy. Optional, so blocks saved before it existed still load. */
export const legalSummary = lineList(300, "point");

/** "YYYY-MM-DD" that is a real date. */
export const legalDate = z
  .string({ error: "Choose the date" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, "Choose a real date");

export const toRows = (sections: LegalSection[]) => sections.map((s) => ({ title: s.title, anchor: s.id, paragraphs: s.paragraphs, list: s.list ?? [] }));

const tokenHint = Object.keys(LEGAL_TOKENS)
  .map((k) => `{${k}}`)
  .join(", ");

/** Admin hint listing what can go in the text. */
export const LEGAL_TEXT_HINT = `One per line. Links: [label](/path). Business details from “Contact details, business details & analytics”: ${tokenHint}.`;

export const sectionFields = (extraTokens = ""): Field[] => [
  { name: "title", label: "Heading", type: "text", required: true },
  {
    name: "anchor",
    label: "Anchor",
    type: "text",
    placeholder: "what-we-collect",
    hint: "The #link to this section. Empty makes one from the heading. Forms and other pages link to some of these (e.g. /terms#user-content, /privacy#your-rights), so change with care.",
  },
  { name: "paragraphs", label: "Paragraphs", type: "lines", required: true, rows: 5, hint: `${LEGAL_TEXT_HINT}${extraTokens}` },
  { name: "list", label: "Bullet points", type: "lines", rows: 4, hint: "Optional. One point per line, shown after the paragraphs. Same links and {tokens} as the paragraphs." },
];

export const summaryField = (name: string): Field => ({
  name,
  label: "In short",
  type: "lines",
  rows: 4,
  hint: "Optional. A few plain-language points shown in a box at the top. One per line; links and {tokens} work here too.",
});

/** The privacy policy and terms & conditions. */
export const legal = defineBlock({
  key: "legal",
  title: "Privacy policy & terms",
  group: "Legal",
  description: "The privacy policy (DPDP Act, 2023) and the terms & conditions, section by section, with their “last updated” date. Business details and the Grievance Officer come from the “site” block.",
  usedOn: ["/privacy", "/terms"],
  schema: z.object({
    updated: legalDate,
    privacySummary: legalSummary,
    privacy: legalDocument("privacy"),
    termsSummary: legalSummary,
    terms: legalDocument("terms"),
  }),
  defaults: {
    updated: LEGAL_UPDATED,
    privacySummary,
    privacy: toRows(privacySections),
    termsSummary,
    terms: toRows(termsSections),
  },
  sections: [
    {
      title: "Last updated",
      fields: [
        {
          name: "updated",
          label: "Last updated",
          type: "date",
          required: true,
          hint: "Shown at the top of both pages and saved with each new account as the version it accepted. Change it whenever you change the wording.",
        },
      ],
    },
    {
      title: "Privacy policy",
      description: "Shown at /privacy, numbered in this order, with a contents list built from the headings. Keep it accurate to what the site does — and have it reviewed by a lawyer.",
      fields: [summaryField("privacySummary"), { name: "privacy", label: "Sections", type: "rows", addLabel: "Add section", itemTitle: "title", fields: sectionFields() }],
    },
    {
      title: "Terms & conditions",
      description: "Shown at /terms, numbered in this order, with a contents list built from the headings.",
      fields: [summaryField("termsSummary"), { name: "terms", label: "Sections", type: "rows", addLabel: "Add section", itemTitle: "title", fields: sectionFields() }],
    },
  ],
});
