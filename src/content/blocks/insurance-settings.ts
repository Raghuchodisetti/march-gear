import { z } from "zod";
import { defineBlock, flag, number, optionalText } from "../define";

/** How the insurance marketplace behaves. Edited at /admin/insurance/settings. */
export const insuranceSettings = defineBlock({
  key: "insuranceSettings",
  title: "Insurance marketplace settings",
  group: "Insurance",
  description: "Quote validity, how many insurers a customer can ask at once, vendor trial and payment terms, lead fees and the compliance note on public pages.",
  usedOn: ["/insurance", "Insurance vendor portal", "/admin/insurance"],
  schema: z.object({
    quoteValidityDays: number("quote validity", 1, 60),
    maxQuoteRequests: number("number of insurers per request", 1, 5),
    vendorTrialDays: number("trial length", 0, 365),
    paymentTermsDays: number("payment terms", 1, 60),
    renewalWindowDays: number("renewal window", 7, 120),
    leadFeeEnabled: flag,
    leadFeeAmount: number("lead fee", 0, 100000),
    complianceNote: optionalText(800),
    vendorSupportEmail: optionalText(190),
    vendorSupportPhone: optionalText(30),
  }),
  defaults: {
    quoteValidityDays: 15,
    maxQuoteRequests: 3,
    vendorTrialDays: 30,
    paymentTermsDays: 15,
    renewalWindowDays: 45,
    leadFeeEnabled: false,
    leadFeeAmount: 0,
    complianceNote: "",
    vendorSupportEmail: "",
    vendorSupportPhone: "",
  },
  sections: [
    {
      title: "Customers",
      fields: [
        { name: "maxQuoteRequests", label: "Insurers a customer can ask for quotes at once", type: "number", required: true, min: 1, max: 5 },
        { name: "quoteValidityDays", label: "Default quote validity", type: "number", required: true, suffix: "days", min: 1, max: 60 },
        { name: "renewalWindowDays", label: "Show renewals as upcoming this many days before expiry", type: "number", required: true, suffix: "days", min: 7 },
        {
          name: "complianceNote",
          label: "Compliance note on public insurance pages",
          type: "textarea",
          hint: "E.g. your registration as an intermediary. Shown in the insurance footer when filled in.",
        },
      ],
    },
    {
      title: "Vendors",
      fields: [
        { name: "vendorTrialDays", label: "Free trial after approval", type: "number", required: true, suffix: "days", min: 0 },
        { name: "paymentTermsDays", label: "Invoice payment terms", type: "number", required: true, suffix: "days", min: 1 },
        { name: "vendorSupportEmail", label: "Vendor support email", type: "text", hint: "Shown on the application status and support pages." },
        { name: "vendorSupportPhone", label: "Vendor support phone", type: "text" },
      ],
    },
    {
      title: "Lead fees",
      description: "Only turn this on if charging for leads is permitted for your licence category.",
      fields: [
        { name: "leadFeeEnabled", label: "Charge vendors per verified policy conversion", type: "checkbox" },
        { name: "leadFeeAmount", label: "Fee per verified conversion", type: "number", prefix: "₹", min: 0 },
      ],
    },
  ],
});
