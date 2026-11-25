import { z } from "zod";
import { LEGAL_UPDATED, refundSections, refundSummary } from "@/data/editorial-legal";
import { defineBlock, text } from "../define";
import { legalDate, legalDocument, legalSummary, sectionFields, summaryField, toRows } from "./legal";

/** The refund & cancellation policy at /refund-policy, with its editable timelines. */
export const refundPolicy = defineBlock({
  key: "refundPolicy",
  title: "Refund & cancellation policy",
  group: "Legal",
  description:
    "Cancellations and refunds for dealer and insurance vendor subscriptions, advertising and PDI inspections, with the refund timeline and PDI cancellation terms. Trial lengths and payment terms are filled in from the billing settings.",
  usedOn: ["/refund-policy", "PDI booking confirmation"],
  schema: z.object({
    updated: legalDate,
    refundTimeline: text("refund timeline", 120),
    pdiCancellation: text("PDI cancellation terms", 160),
    summary: legalSummary,
    sections: legalDocument("refund policy"),
  }),
  defaults: {
    updated: LEGAL_UPDATED,
    refundTimeline: "within 7–10 working days of approval",
    pdiCancellation: "free of charge at any time before the inspector sets off for the dealership",
    summary: refundSummary,
    sections: toRows(refundSections),
  },
  sections: [
    {
      title: "Dates & timelines",
      description: "Used in the text wherever {refundTimeline} and {pdiCancellation} appear.",
      fields: [
        { name: "updated", label: "Last updated", type: "date", required: true },
        {
          name: "refundTimeline",
          label: "Refund timeline",
          type: "text",
          required: true,
          placeholder: "within 7–10 working days of approval",
          hint: "Reads as “Approved refunds are paid …”. Make sure your accounts team can meet it.",
        },
        {
          name: "pdiCancellation",
          label: "PDI cancellation terms",
          type: "text",
          required: true,
          wide: true,
          placeholder: "free of charge at any time before the inspector sets off",
          hint: "Reads as “You can cancel or reschedule …”.",
        },
      ],
    },
    {
      title: "Refund & cancellation policy",
      fields: [
        summaryField("summary"),
        {
          name: "sections",
          label: "Sections",
          type: "rows",
          addLabel: "Add section",
          itemTitle: "title",
          fields: sectionFields(
            " Billing: {refundTimeline}, {pdiCancellation}, {dealerTrialDays}, {vendorTrialDays}, {dealerPaymentTerms}, {vendorPaymentTerms} (trial and payment terms come from the billing settings).",
          ),
        },
      ],
    },
  ],
});
