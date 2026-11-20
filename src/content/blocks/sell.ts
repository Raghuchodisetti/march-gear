import { z } from "zod";
import { SELL_BENEFITS, SELL_FAQS, SELL_STATS, SELL_STEPS, SELL_TESTIMONIALS } from "@/data/used-sell";
import type { Option } from "@/components/admin/fields";
import { defineBlock, number, rows, text } from "../define";

/** Icons a benefit card can show. The page maps each name to its icon. */
export const SELL_ICONS = ["banknote", "wrench", "timer", "file", "shield", "handshake", "clock", "car", "badge", "phone"] as const;
export type SellIcon = (typeof SELL_ICONS)[number];

const ICON_OPTIONS: Option[] = [
  { value: "banknote", label: "Banknote (price, money)" },
  { value: "wrench", label: "Wrench (inspection)" },
  { value: "timer", label: "Timer (speed)" },
  { value: "file", label: "Document (paperwork)" },
  { value: "shield", label: "Shield (privacy, safety)" },
  { value: "handshake", label: "Handshake (agreement)" },
  { value: "clock", label: "Clock (time)" },
  { value: "car", label: "Car" },
  { value: "badge", label: "Badge with tick (verified)" },
  { value: "phone", label: "Phone (call)" },
];

/** Icon names the launch copy used, by benefit key. */
const LAUNCH_ICONS: Record<(typeof SELL_BENEFITS)[number]["key"], SellIcon> = {
  price: "banknote",
  inspection: "wrench",
  payment: "timer",
  paperwork: "file",
  privacy: "shield",
  flexible: "handshake",
};

/** Text after the counter — kept exactly as typed, since a leading space matters (" hrs", " / 5"). */
const affix = z
  .string()
  .max(12, "Keep this under 12 characters")
  .nullish()
  .transform((v) => v ?? "");

/** Stats, steps, benefits, testimonials and FAQs on /sell-car. */
export const sell = defineBlock({
  key: "sell",
  title: "Sell your car page",
  group: "Pages",
  description: "Stats, steps, benefits, testimonials and FAQs on the sell-your-car page.",
  usedOn: ["/sell-car"],
  schema: z.object({
    stats: rows(
      z.object({
        value: number("number", 0, 1e12),
        decimals: z.number().int("Use a whole number of decimals").min(0).max(3).nullish().transform((v) => v ?? 0),
        prefix: affix,
        suffix: affix,
        label: text("label", 60),
      }),
      "stat",
      1,
    ).max(4, "Use at most 4 stats — that's what fits under the headline"),
    steps: rows(z.object({ title: text("step title", 60), body: text("step text", 300), meta: text("timing", 30) }), "step", 1),
    benefits: rows(
      z.object({ icon: z.enum(SELL_ICONS, { error: "Choose an icon" }), title: text("benefit title", 60), body: text("benefit text", 300) }),
      "benefit",
      1,
    ),
    testimonials: rows(
      z.object({
        quote: text("quote", 400),
        name: text("name", 60),
        city: text("city", 40),
        car: text("car", 60),
        soldFor: number("sale price", 1, 1e10),
      }),
      "testimonial",
      1,
    ),
    faqs: rows(z.object({ q: text("question", 200), a: text("answer", 1000) }), "question", 1),
  }),
  defaults: {
    stats: SELL_STATS.map((s) => ({ value: s.value, decimals: "decimals" in s ? s.decimals : 0, prefix: "", suffix: s.suffix, label: s.label })),
    steps: SELL_STEPS.map((s) => ({ title: s.title, body: s.body, meta: s.meta })),
    benefits: SELL_BENEFITS.map((b) => ({ icon: LAUNCH_ICONS[b.key], title: b.title, body: b.body })),
    testimonials: SELL_TESTIMONIALS.map((t) => ({ quote: t.quote, name: t.name, city: t.city, car: t.car, soldFor: t.soldFor })),
    faqs: SELL_FAQS.map((f) => ({ q: f.q, a: f.a })),
  },
  sections: [
    {
      title: "Headline stats",
      description: "The counters under the headline, up to four.",
      fields: [
        {
          name: "stats",
          label: "Stats",
          type: "rows",
          addLabel: "Add stat",
          itemTitle: "label",
          fields: [
            { name: "value", label: "Number", type: "number", required: true, step: 0.1, min: 0 },
            { name: "decimals", label: "Decimal places", type: "number", step: 1, min: 0, max: 3, hint: "0 for whole numbers, 1 for 4.8 and so on." },
            { name: "prefix", label: "Before the number", type: "text", placeholder: "₹", hint: "Shown exactly as typed." },
            { name: "suffix", label: "After the number", type: "text", placeholder: "+", hint: "Shown exactly as typed — start with a space for “24 hrs”." },
            { name: "label", label: "Label", type: "text", required: true, wide: true },
          ],
        },
      ],
    },
    {
      title: "How it works",
      description: "The numbered steps. The heading reads “Four steps. One visit.” and four fit one row on desktop.",
      fields: [
        {
          name: "steps",
          label: "Steps",
          type: "rows",
          addLabel: "Add step",
          itemTitle: "title",
          fields: [
            { name: "title", label: "Title", type: "text", required: true },
            { name: "meta", label: "Timing", type: "text", required: true, placeholder: "60 seconds" },
            { name: "body", label: "Text", type: "textarea", required: true, rows: 2 },
          ],
        },
      ],
    },
    {
      title: "Why March Gear",
      description: "The benefit cards, two per row.",
      fields: [
        {
          name: "benefits",
          label: "Benefits",
          type: "rows",
          addLabel: "Add benefit",
          itemTitle: "title",
          fields: [
            { name: "icon", label: "Icon", type: "select", required: true, options: ICON_OPTIONS },
            { name: "title", label: "Title", type: "text", required: true },
            { name: "body", label: "Text", type: "textarea", required: true, rows: 2 },
          ],
        },
      ],
    },
    {
      title: "Seller stories",
      description: "The testimonial carousel.",
      fields: [
        {
          name: "testimonials",
          label: "Testimonials",
          type: "rows",
          addLabel: "Add testimonial",
          itemTitle: "name",
          fields: [
            { name: "quote", label: "Quote", type: "textarea", required: true, rows: 3, hint: "Without quotation marks — they're added for you." },
            { name: "name", label: "Name", type: "text", required: true },
            { name: "city", label: "City", type: "text", required: true },
            { name: "car", label: "Car sold", type: "text", required: true, placeholder: "2019 Honda City ZX CVT" },
            { name: "soldFor", label: "Sold for", type: "number", required: true, prefix: "₹", step: 1000, min: 1, hint: "Full amount in rupees, e.g. 865000." },
          ],
        },
      ],
    },
    {
      title: "Questions",
      description: "The FAQ list. The first one starts open.",
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
