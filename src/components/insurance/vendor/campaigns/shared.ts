import type { InsCampaignStatus, InsCampaignType, InsProductCategory } from "@/db/enums";
import type { InsCampaignDisplay } from "@/insurance/labels";

/* Promotional campaigns in the insurance vendor portal — shapes and rules shared by the editor, list and server. Client-safe. */

export interface CampaignInput {
  title: string;
  summary: string;
  description: string;
  type: InsCampaignType | "";
  productIds: number[];
  /** Public /media URL or "". */
  banner: string;
  ctaLabel: string;
  /** IST date + time, as typed. */
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export const EMPTY_CAMPAIGN: CampaignInput = {
  title: "",
  summary: "",
  description: "",
  type: "",
  productIds: [],
  banner: "",
  ctaLabel: "",
  startDate: "",
  startTime: "09:00",
  endDate: "",
  endTime: "23:59",
};

export interface CampaignProductOption {
  id: number;
  name: string;
  reference: string;
  category: InsProductCategory;
  /** Only published products can be promoted; older picks that were unpublished are flagged. */
  published: boolean;
}

export interface CampaignListItem {
  id: number;
  reference: string;
  title: string;
  summary: string;
  type: InsCampaignType;
  typeLabel: string;
  banner: string | null;
  ctaLabel: string | null;
  startsAt: string;
  endsAt: string;
  status: InsCampaignStatus;
  display: InsCampaignDisplay;
  adminRemarks: string | null;
  approvedAt: string | null;
  submittedAt: string | null;
  updatedAt: string;
  productNames: string[];
  views: number;
  clicks: number;
  enquiries: number;
  conversions: number;
}

export interface CampaignApprovalEntry {
  id: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  remarks: string | null;
  actorSide: "vendor" | "admin" | "system";
  actorName: string | null;
  createdAt: string;
}

/** Editing in these statuses saves a draft. */
export const CAMPAIGN_DRAFT_STATUSES: InsCampaignStatus[] = ["draft", "changes_requested", "rejected"];
/** Editing in these statuses (approved, paused) sends the campaign back for approval. */
export const CAMPAIGN_LIVE_STATUSES: InsCampaignStatus[] = ["approved", "paused"];

export const CTA_DEFAULT = "Get a quote";
export const CTA_SUGGESTIONS = ["Get a quote", "Compare plans", "Check your premium", "Renew now", "See the cover"];

export const CAMPAIGN_LIMITS = { title: 160, summary: 300, description: 4000, cta: 40 } as const;

/** Advertising-rule reminders shown on the editor and the submit dialog. */
export const COMPLIANCE_RULES = [
  "No inducements or rebates: no cashback, gifts, vouchers or a share of commission for buying a policy.",
  "No misleading claims: no “cheapest”, “No. 1” or “100% claims settled” unless you can prove it, and no guaranteed savings.",
  "Discounts must be ones the insurer has filed (for example NCB or a voluntary deductible) — name them plainly.",
  "Premiums are indicative until the insurer issues the policy. Don't present a figure as a final price.",
];

const FLAGS: [RegExp, string][] = [
  [/\bcash\s?-?back\b/i, "“Cashback” on a policy is an inducement — remove it."],
  [/\brebates?\b/i, "Rebates on premium aren't allowed."],
  [/\b(free\s+(gift|voucher|phone|watch|fuel|recharge)|gift\s+(card|voucher)|vouchers?)\b/i, "Gifts or vouchers for buying a policy are inducements."],
  [/\bguarantee(d|s)?\b/i, "Avoid guarantees (claims, savings or approval) unless the policy wording guarantees it."],
  [/\b100\s?%\s*(claims?|settle)/i, "Absolute claim promises are misleading."],
  [/\b(cheapest|lowest\s+premium|best\s+(insurer|insurance|in\s+india)|no\.?\s?1|number\s+one)\b/i, "Superlatives like “cheapest” or “No. 1” need proof — leave them out."],
  [/\b\d{1,3}\s?%\s*off\b/i, "Say which filed discount this is (e.g. NCB) rather than “% off”."],
];

/** Phrases that usually break insurance advertising rules — warnings, not blockers (MarchGear reviews every campaign). */
export function complianceFlags(...texts: string[]): string[] {
  const all = texts.join(" \n ");
  return FLAGS.filter(([re]) => re.test(all)).map(([, msg]) => msg);
}

/** The commands that apply to a campaign in its current state. */
export type CampaignCommand = "edit" | "editLive" | "submit" | "withdraw" | "pause" | "resume" | "cancel" | "duplicate" | "delete" | "history";

export function campaignCommands(c: Pick<CampaignListItem, "status" | "display" | "approvedAt">, canManage: boolean): CampaignCommand[] {
  if (!canManage) return ["history"];
  const d = c.display;
  const out: CampaignCommand[] = [];
  if (d === "draft" || d === "changes_requested" || d === "rejected") out.push("edit", "submit");
  if (d === "pending_approval") out.push("withdraw");
  if (d === "scheduled" || d === "active") out.push("pause", "editLive");
  if (d === "paused") out.push("resume", "editLive");
  if (d === "expired") out.push("editLive");
  out.push("duplicate", "history");
  if (["pending_approval", "changes_requested", "scheduled", "active", "paused"].includes(d)) out.push("cancel");
  if (d === "draft" && !c.approvedAt) out.push("delete");
  return out;
}
