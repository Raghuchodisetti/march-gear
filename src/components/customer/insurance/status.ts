import type { InsLeadStatus, InsQuoteStatus } from "@/db/enums";
import type { Tone } from "@/partner/labels";

/* What customers see for insurance statuses (/account/insurance and the overview). Client-safe. */

export interface CustomerStatus {
  label: string;
  tone: Tone;
}

/** What the customer sees for the vendor's pipeline status. */
export function customerEnquiryStatus(status: InsLeadStatus, verified: boolean): CustomerStatus {
  switch (status) {
    case "new":
    case "assigned":
      return { label: "Sent to the insurer", tone: "blue" };
    case "contacted":
    case "quote_requested":
    case "follow_up":
      return { label: "Preparing your quote", tone: "blue" };
    case "quote_submitted":
      return { label: "Quote ready", tone: "amber" };
    case "interested":
      return { label: "You're interested", tone: "green" };
    case "policy_issued":
      return verified ? { label: "Policy confirmed", tone: "green" } : { label: "Policy issued — reported by the insurer", tone: "green" };
    default:
      return { label: "Closed", tone: "neutral" };
  }
}

export type CustomerQuoteState = InsQuoteStatus | "viewed" | "expired";

export const CUSTOMER_QUOTE_STATUS: Record<CustomerQuoteState, CustomerStatus> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "New — not opened yet", tone: "amber" },
  viewed: { label: "Opened", tone: "blue" },
  accepted: { label: "You're interested", tone: "green" },
  declined: { label: "You declined", tone: "neutral" },
  withdrawn: { label: "Withdrawn by the insurer", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
};
