/* Launch defaults for dealer subscription plans. Live prices come from the `partnerPlans`
   content block (admin → Site content), so read plans from the catalogue, not from here. */

export interface PartnerPlan {
  id: "starter" | "growth" | "enterprise";
  name: string;
  monthly: number;
  summary: string;
  limits: { listings: number | null; activeOffers: number | null; staff: number | null; showrooms: number | null };
  features: string[];
}

export const GST_RATE = 0.18;

export const PARTNER_PLANS: PartnerPlan[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 4999,
    summary: "For a single showroom getting started online.",
    limits: { listings: 25, activeOffers: 2, staff: 3, showrooms: 1 },
    features: ["25 live vehicle listings", "2 active offers", "Enquiry CRM", "Test-drive scheduling", "Email support"],
  },
  {
    id: "growth",
    name: "Growth",
    monthly: 12999,
    summary: "For busy dealerships with a sales team.",
    limits: { listings: 150, activeOffers: 10, staff: 15, showrooms: 3 },
    features: ["150 live vehicle listings", "10 active offers", "Festival campaign templates", "Staff roles & assignment", "Analytics & exports", "Priority support"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthly: 29999,
    summary: "For dealer groups with many branches.",
    limits: { listings: null, activeOffers: null, staff: null, showrooms: null },
    features: ["Unlimited listings and offers", "Unlimited branches and staff", "Account manager", "Custom reporting", "Phone support"],
  },
];

export const planById = (id: string) => PARTNER_PLANS.find((p) => p.id === id) ?? PARTNER_PLANS[0];
