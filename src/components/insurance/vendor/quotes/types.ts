import type { InsLeadStatus, InsProductCategory, InsQuoteAuthorization, InsQuoteStatus } from "@/db/enums";
import type { QuoteBreakdown, QuoteCoverLine } from "@/insurance/types";
import type { EnquiryEventItem } from "@/components/insurance/vendor/crm/shared";

/* Shapes the quote screens and the PDF receive from the server. Client-safe (types only). */

export type QuoteDisplay = InsQuoteStatus | "viewed" | "expired";

export interface QuoteListItem {
  id: number;
  reference: string;
  status: InsQuoteStatus;
  display: QuoteDisplay;
  authorization: InsQuoteAuthorization;
  insurerQuoteRef: string | null;
  total: number;
  idv: number;
  validUntil: string;
  createdAt: string;
  submittedAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  product: { id: number; name: string } | null;
  enquiry: { id: number; reference: string; name: string; mobile: string; regNumber: string | null; vehicle: string };
}

/** Everything the detail page and the PDF need. */
export interface QuoteView extends QuoteListItem {
  coverage: QuoteCoverLine[];
  breakdown: QuoteBreakdown;
  notes: string | null;
  terms: string | null;
  shareToken: string;
  updatedAt: string;
  createdBy: string | null;
  enquiry: QuoteListItem["enquiry"] & { email: string | null; city: string | null; status: InsLeadStatus; year: number | null; fuel: string | null; isNew: boolean };
  productDetail: { id: number; name: string; code: string; uin: string | null; category: InsProductCategory; companyName: string | null; exclusions: string[] } | null;
  vendor: { name: string; reference: string; supportPhone: string; supportEmail: string; website: string };
  events: EnquiryEventItem[];
}
