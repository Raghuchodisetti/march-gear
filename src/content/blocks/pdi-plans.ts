import { z } from "zod";
import { pdiPlans as launchPlans } from "@/data/pdi";
import { PDI_ICONS, PDI_ICON_NAMES } from "@/lib/pdi";
import { defineBlock, flag, lines, number, rows, text } from "../define";

const plan = z.object({
  id: z
    .string({ error: "Enter the plan key" })
    .trim()
    .min(1, "Enter the plan key")
    .max(40, "Keep the plan key under 40 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens, e.g. complete"),
  // Sent with each booking lead (details.plan), which allows 40 characters.
  name: text("plan name", 40),
  icon: z.enum(PDI_ICON_NAMES, { error: "Choose an icon" }),
  price: number("price", 0, 1_000_000).int("Use a whole number of rupees"),
  duration: text("duration", 40),
  checks: number("number of checks", 1, 10_000).int("Use a whole number"),
  summary: text("summary", 200),
  features: lines(200).refine((a) => a.length > 0, "Add at least one feature"),
  popular: flag,
});

/** The inspection plans: cards on /pdi-check, the booking form's choices, and the hero's "starting price". */
export const pdiPlans = defineBlock({
  key: "pdiPlans",
  title: "PDI plans & prices",
  group: "PDI",
  description: "The inspection plans, prices and what each includes. The cheapest price is shown as the “starting price” at the top of the page.",
  usedOn: ["/pdi-check (plans, booking form, hero)"],
  schema: z.object({
    plans: rows(plan, "plan", 1).superRefine((plans, ctx) => {
      const seen = new Set<string>();
      plans.forEach((p, i) => {
        if (seen.has(p.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: "Another plan already uses this key" });
        seen.add(p.id);
      });
      const popular = plans.flatMap((p, i) => (p.popular ? [i] : []));
      for (const i of popular.slice(1)) ctx.addIssue({ code: "custom", path: [i, "popular"], message: "Only one plan can be marked most popular" });
    }),
  }),
  defaults: { plans: launchPlans.map((p) => ({ ...p, features: [...p.features], popular: Boolean(p.popular) })) },
  sections: [
    {
      title: "Plans",
      description: "Shown as cards and as the choices in the booking form, in this order. Prices include GST.",
      fields: [
        {
          name: "plans",
          label: "Plans",
          type: "rows",
          addLabel: "Add plan",
          itemTitle: "name",
          fields: [
            { name: "name", label: "Name", type: "text", required: true, placeholder: "Complete PDI", hint: "The booking form shows it without the word “PDI”." },
            { name: "id", label: "Key", type: "text", required: true, placeholder: "complete", hint: "Lowercase, e.g. complete. Saved with each visitor's choice — don't change it later." },
            { name: "price", label: "Price", type: "number", required: true, prefix: "₹", min: 0, step: 1 },
            { name: "checks", label: "Number of checks", type: "number", required: true, min: 1, step: 1, hint: "Shown as “220+ checks”." },
            { name: "duration", label: "Duration", type: "text", required: true, placeholder: "60–90 min" },
            { name: "icon", label: "Icon", type: "select", required: true, options: [...PDI_ICONS] },
            { name: "summary", label: "Summary", type: "text", required: true, wide: true },
            { name: "features", label: "What's included", type: "lines", required: true, rows: 6 },
            { name: "popular", label: "Most popular", type: "checkbox", hint: "Dark card with a badge, and pre-selected in the booking form. Only one plan." },
          ],
        },
      ],
    },
  ],
});
