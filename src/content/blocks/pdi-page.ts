import { z } from "zod";
import { pdiFaqs, pdiHeroStats, pdiProblems, pdiSampleReport, pdiStartingPriceLabel, pdiSteps, pdiStepsTitle } from "@/data/pdi";
import { PDI_ICONS, PDI_ICON_NAMES } from "@/lib/pdi";
import { defineBlock, number, rows, text } from "../define";

const score = (label: string) => number(label, 0, 100).int("Use a whole number from 0 to 100");

/** The rest of /pdi-check: hero stats, why it matters, how it works, the sample report and the FAQs. */
export const pdiPage = defineBlock({
  key: "pdiPage",
  title: "PDI page content",
  group: "PDI",
  description: "Why a PDI matters, how it works, the sample report and the FAQs.",
  usedOn: ["/pdi-check"],
  schema: z.object({
    heroStats: rows(z.object({ value: text("value", 24), label: text("label", 40) }), "stat").max(3, "Up to three — the starting price is added as the fourth"),
    startingPriceLabel: text("starting price label", 40),
    problems: rows(z.object({ icon: z.enum(PDI_ICON_NAMES, { error: "Choose an icon" }), title: text("title", 80), text: text("text", 300) }), "issue"),
    stepsTitle: text("heading", 120),
    steps: rows(z.object({ title: text("step title", 80), text: text("step text", 300) }), "step", 1),
    report: z.object({
      car: text("car", 120),
      dealer: text("dealership", 120),
      date: text("date", 40),
      score: score("score"),
      categories: rows(z.object({ label: text("category", 60), value: score("category score") }), "category", 1),
      findings: rows(
        z.object({
          level: z.enum(["attention", "minor"], { error: "Choose how serious it is" }),
          text: text("finding", 160),
          action: text("what was done", 160),
        }),
        "finding",
        1,
      ),
    }),
    faqs: rows(z.object({ q: text("question", 200), a: text("answer", 1500) }), "question"),
  }),
  defaults: {
    heroStats: pdiHeroStats.map((s) => ({ ...s })),
    startingPriceLabel: pdiStartingPriceLabel,
    problems: pdiProblems.map((p) => ({ ...p })),
    stepsTitle: pdiStepsTitle,
    steps: pdiSteps.map((s) => ({ ...s })),
    report: {
      ...pdiSampleReport,
      categories: pdiSampleReport.categories.map((c) => ({ ...c })),
      findings: pdiSampleReport.findings.map((f) => ({ ...f })),
    },
    faqs: pdiFaqs.map((f) => ({ ...f })),
  },
  sections: [
    {
      title: "Hero stats",
      description: "The strip under the buttons at the top of the page. The cheapest plan's price is added automatically as the last stat.",
      fields: [
        {
          name: "heroStats",
          label: "Stats",
          type: "rows",
          addLabel: "Add stat",
          itemTitle: "value",
          fields: [
            { name: "value", label: "Value", type: "text", required: true, placeholder: "200+" },
            { name: "label", label: "Label", type: "text", required: true, placeholder: "points checked" },
          ],
        },
        { name: "startingPriceLabel", label: "Starting price label", type: "text", required: true, placeholder: "starting price", hint: "Shown under the cheapest plan's price (from PDI plans & prices)." },
      ],
    },
    {
      title: "Why a PDI matters",
      description: "The common problems, shown as cards. Four fill one row on a desktop. Remove them all to hide the section.",
      fields: [
        {
          name: "problems",
          label: "Problems",
          type: "rows",
          addLabel: "Add problem",
          itemTitle: "title",
          fields: [
            { name: "title", label: "Title", type: "text", required: true },
            { name: "icon", label: "Icon", type: "select", required: true, options: [...PDI_ICONS] },
            { name: "text", label: "Text", type: "textarea", required: true, rows: 2 },
          ],
        },
      ],
    },
    {
      title: "How it works",
      fields: [
        { name: "stepsTitle", label: "Heading", type: "text", required: true, wide: true, hint: "Mentions the number of steps — update it when you add or remove one." },
        {
          name: "steps",
          label: "Steps",
          type: "rows",
          addLabel: "Add step",
          itemTitle: "title",
          fields: [
            { name: "title", label: "Title", type: "text", required: true, wide: true },
            { name: "text", label: "Text", type: "textarea", required: true, rows: 2 },
          ],
        },
      ],
    },
    {
      title: "Sample report",
      description: "The example report next to the booking form.",
      fields: [
        {
          name: "report",
          label: "Sample report",
          type: "group",
          fields: [
            { name: "car", label: "Car", type: "text", required: true, wide: true },
            { name: "dealer", label: "Dealership", type: "text", required: true },
            { name: "date", label: "Date", type: "text", required: true, placeholder: "14 Nov 2026" },
            { name: "score", label: "Overall score", type: "number", required: true, min: 0, max: 100, suffix: "/ 100" },
            {
              name: "categories",
              label: "Category scores",
              type: "rows",
              addLabel: "Add category",
              itemTitle: "label",
              fields: [
                { name: "label", label: "Category", type: "text", required: true },
                { name: "value", label: "Score", type: "number", required: true, min: 0, max: 100, suffix: "/ 100" },
              ],
            },
            {
              name: "findings",
              label: "Findings",
              type: "rows",
              addLabel: "Add finding",
              itemTitle: "text",
              fields: [
                { name: "text", label: "Finding", type: "text", required: true, wide: true },
                { name: "action", label: "What was done", type: "text", required: true },
                {
                  name: "level",
                  label: "Severity",
                  type: "select",
                  required: true,
                  options: [
                    { value: "attention", label: "Needs attention (red)" },
                    { value: "minor", label: "Minor" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      title: "FAQs",
      description: "Remove them all to hide the section.",
      fields: [
        {
          name: "faqs",
          label: "Questions & answers",
          type: "rows",
          addLabel: "Add question",
          itemTitle: "q",
          fields: [
            { name: "q", label: "Question", type: "text", required: true, wide: true },
            { name: "a", label: "Answer", type: "textarea", required: true },
          ],
        },
      ],
    },
  ],
});
