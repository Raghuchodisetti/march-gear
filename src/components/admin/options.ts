import type { DealerReview } from "@/lib/catalog";

/* Option lists shared by admin forms and the Server Actions that validate them (no server imports). */

/** How a lead entered by staff reached us. */
export const LEAD_CHANNELS = ["Phone call", "Walk-in", "WhatsApp", "Email", "Other"] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];

/** Visit types shown on public dealer reviews. */
export const DEALER_VISITS = ["Purchase", "Service", "Test drive", "Pre-owned purchase", "Trade-in"] as const satisfies readonly DealerReview["visit"][];
