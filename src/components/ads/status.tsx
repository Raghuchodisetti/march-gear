import type { AdCreativeStatus, InvoiceStatus } from "@/db/enums";
import { AD_CREATIVE_STATUS_LABEL, AD_CREATIVE_STATUS_TONE, AD_STATUS_LABEL, AD_STATUS_TONE, INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE, type AdDisplayStatus } from "@/insurance/labels";
import { StatusPill } from "@/components/admin/partner-ui";

/* Status pills for ad campaigns, creatives and their invoices. Server-safe. */

export const AdStatusPill = ({ display, className }: { display: AdDisplayStatus; className?: string }) => (
  <StatusPill tone={AD_STATUS_TONE[display]} pulse={display === "live" || display === "pending_approval"} className={className}>
    {AD_STATUS_LABEL[display]}
  </StatusPill>
);

export const CreativePill = ({ status }: { status: AdCreativeStatus }) => (
  <StatusPill tone={AD_CREATIVE_STATUS_TONE[status]} pulse={status === "pending"}>
    {AD_CREATIVE_STATUS_LABEL[status]}
  </StatusPill>
);

export const InvoicePill = ({ status }: { status: InvoiceStatus }) => <StatusPill tone={INVOICE_STATUS_TONE[status]}>{INVOICE_STATUS_LABEL[status]}</StatusPill>;
