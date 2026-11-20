import { z } from "zod";
import { defineBlock, optionalText } from "../define";

/**
 * Where dealer partners pay their subscription invoices. Empty until MarchGear's accounts
 * team fills it in — the portal then says the details will be shared directly.
 */
export const billing = defineBlock({
  key: "billing",
  title: "Billing & payment details",
  group: "Site",
  description: "Bank and UPI details shown to dealer partners and insurance vendors on their invoices, for paying by transfer. Leave empty until your accounts team confirms them.",
  usedOn: ["Dealer portal → Invoices", "Insurance vendor portal → Invoices"],
  schema: z.object({
    accountName: optionalText(120),
    bankName: optionalText(120),
    accountNumber: optionalText(30),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .max(11)
      .nullish()
      .transform((v) => v ?? "")
      .refine((v) => v === "" || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), "Enter a valid IFSC, e.g. HDFC0001234"),
    upi: optionalText(80),
    instructions: optionalText(600),
  }),
  defaults: { accountName: "", bankName: "", accountNumber: "", ifsc: "", upi: "", instructions: "" },
  sections: [
    {
      title: "Payment details",
      description: "Double-check these with your bank — dealers will transfer money to this account.",
      fields: [
        { name: "accountName", label: "Account name", type: "text" },
        { name: "bankName", label: "Bank", type: "text" },
        { name: "accountNumber", label: "Account number", type: "text" },
        { name: "ifsc", label: "IFSC", type: "text" },
        { name: "upi", label: "UPI ID", type: "text" },
        { name: "instructions", label: "Instructions", type: "textarea", hint: "E.g. “Use the invoice number as the payment reference.”" },
      ],
    },
  ],
});
