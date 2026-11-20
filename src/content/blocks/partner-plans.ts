import { z } from "zod";
import { PARTNER_PLANS } from "@/partner/plans";
import { defineBlock, lines, number, rows, text } from "../define";

const limit = z.number().int().min(1).max(100000).nullish().transform((v) => v ?? null);

/** Dealer subscription plans and prices (shown in the dealer portal; invoices use these prices). */
export const partnerPlans = defineBlock({
  key: "partnerPlans",
  title: "Dealer subscription plans",
  group: "Pricing & tools",
  description: "The plans dealer partners can choose, their monthly price (before GST) and limits. Leave a limit empty for unlimited.",
  usedOn: ["Dealer portal → Subscriptions", "Dealer invoices"],
  schema: z.object({
    plans: rows(
      z.object({
        id: z.enum(["starter", "growth", "enterprise"]),
        name: text("plan name", 40),
        monthly: number("monthly price", 0, 1_000_000),
        summary: text("summary", 160),
        listings: limit,
        activeOffers: limit,
        staff: limit,
        showrooms: limit,
        features: lines(120),
      }),
      "plan",
      1,
    ).refine((p) => new Set(p.map((x) => x.id)).size === p.length, "Each plan can appear once"),
  }),
  defaults: {
    plans: PARTNER_PLANS.map((p) => ({ id: p.id, name: p.name, monthly: p.monthly, summary: p.summary, ...p.limits, features: p.features })),
  },
  sections: [
    {
      title: "Plans",
      description: "Prices are per month, before 18% GST.",
      fields: [
        {
          name: "plans",
          label: "Plans",
          type: "rows",
          addLabel: "Add plan",
          itemTitle: "name",
          fields: [
            { name: "id", label: "Plan", type: "select", required: true, options: [{ value: "starter", label: "Starter" }, { value: "growth", label: "Growth" }, { value: "enterprise", label: "Enterprise" }] },
            { name: "name", label: "Display name", type: "text", required: true },
            { name: "monthly", label: "Monthly price", type: "number", required: true, prefix: "₹", min: 0 },
            { name: "summary", label: "Summary", type: "text", required: true, wide: true },
            { name: "listings", label: "Live listings", type: "number", min: 1, hint: "Empty = unlimited" },
            { name: "activeOffers", label: "Active offers", type: "number", min: 1, hint: "Empty = unlimited" },
            { name: "staff", label: "Staff accounts", type: "number", min: 1, hint: "Empty = unlimited" },
            { name: "showrooms", label: "Showrooms", type: "number", min: 1, hint: "Empty = unlimited" },
            { name: "features", label: "Features", type: "lines", rows: 5 },
          ],
        },
      ],
    },
  ],
});
