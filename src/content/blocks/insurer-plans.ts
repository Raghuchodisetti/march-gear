import { z } from "zod";
import { defineBlock, lines, number, rows, text } from "../define";

const limit = z.number().int().min(1).max(100000).nullish().transform((v) => v ?? null);

export const INSURER_PLAN_IDS = ["basic", "professional", "enterprise"] as const;
export type InsurerPlanId = (typeof INSURER_PLAN_IDS)[number];

/** Insurance vendor subscription plans (vendor portal → Billing; subscription invoices use these prices). */
export const insurerPlans = defineBlock({
  key: "insurerPlans",
  title: "Insurance vendor plans",
  group: "Insurance",
  description: "The plans insurance vendors can choose, their monthly price (before GST) and limits. Leave a limit empty for unlimited. Launch prices are placeholders — set your own.",
  usedOn: ["Insurance vendor portal → Billing", "Insurance vendor invoices"],
  schema: z.object({
    plans: rows(
      z.object({
        id: z.enum(INSURER_PLAN_IDS),
        name: text("plan name", 40),
        monthly: number("monthly price", 0, 1_000_000),
        summary: text("summary", 160),
        products: limit,
        activeCampaigns: limit,
        members: limit,
        features: lines(120),
      }),
      "plan",
      1,
    ).refine((p) => new Set(p.map((x) => x.id)).size === p.length, "Each plan can appear once"),
  }),
  defaults: {
    plans: [
      {
        id: "basic",
        name: "Basic",
        monthly: 0,
        summary: "List a few products and receive quote requests.",
        products: 3,
        activeCampaigns: 1,
        members: 3,
        features: ["Up to 3 published products", "Customer enquiries and quotes", "1 promotional campaign at a time"],
      },
      {
        id: "professional",
        name: "Professional",
        monthly: 14999,
        summary: "For growing insurers and intermediaries.",
        products: 15,
        activeCampaigns: 5,
        members: 15,
        features: ["Up to 15 published products", "Renewal management", "Analytics and exports", "5 promotional campaigns at a time"],
      },
      {
        id: "enterprise",
        name: "Enterprise",
        monthly: 39999,
        summary: "Unlimited products and team members.",
        products: null,
        activeCampaigns: null,
        members: null,
        features: ["Unlimited products and campaigns", "Unlimited team members", "Priority support"],
      },
    ],
  },
  sections: [
    {
      title: "Plans",
      description: "Prices are per month, before 18% GST. Advertising is billed separately per booking.",
      fields: [
        {
          name: "plans",
          label: "Plans",
          type: "rows",
          addLabel: "Add plan",
          itemTitle: "name",
          fields: [
            {
              name: "id",
              label: "Plan",
              type: "select",
              required: true,
              options: [
                { value: "basic", label: "Basic" },
                { value: "professional", label: "Professional" },
                { value: "enterprise", label: "Enterprise" },
              ],
            },
            { name: "name", label: "Display name", type: "text", required: true },
            { name: "monthly", label: "Monthly price", type: "number", required: true, prefix: "₹", min: 0 },
            { name: "summary", label: "Summary", type: "text", required: true, wide: true },
            { name: "products", label: "Published products", type: "number", min: 1, hint: "Empty = unlimited" },
            { name: "activeCampaigns", label: "Active campaigns", type: "number", min: 1, hint: "Empty = unlimited" },
            { name: "members", label: "Team members", type: "number", min: 1, hint: "Empty = unlimited" },
            { name: "features", label: "Features", type: "lines", rows: 5 },
          ],
        },
      ],
    },
  ],
});
