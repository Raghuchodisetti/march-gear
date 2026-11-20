import type { CrmStatus, LeadEventKind, LeadSource, PartnerRole, TestDriveStatus } from "@/db/enums";

/* Shapes the CRM, test-drive and customer screens pass from server to client. Client-safe (types only). */

export interface MemberOption {
  id: number;
  name: string;
  role: PartnerRole;
  roleLabel: string;
}

export interface VehicleOption {
  id: number;
  reference: string;
  label: string;
  kind: "new" | "used";
  showroomId: number | null;
}

export interface ModelOption {
  value: string; // catalogue car slug
  label: string; // "Hyundai Creta"
  variants: string[];
}

export interface ShowroomOption {
  id: number;
  name: string;
  city: string;
}

export interface OfferOption {
  id: number;
  reference: string;
  title: string;
}

export interface LeadListItem {
  id: number;
  reference: string;
  name: string;
  mobile: string | null;
  email: string | null;
  carLabel: string | null;
  carSlug: string | null;
  variant: string | null;
  budget: string | null;
  location: string | null;
  source: LeadSource;
  status: CrmStatus;
  lostReason: string | null;
  followUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  assigned: { id: number; name: string } | null;
  offer: { id: number; reference: string; title: string } | null;
  vehicle: { id: number; reference: string; label: string } | null;
}

export interface LeadEventItem {
  id: number;
  kind: LeadEventKind;
  body: string;
  meta: Record<string, string | number | boolean | null> | null;
  createdAt: string;
  memberName: string | null;
}

export interface LeadTestDrive {
  id: number;
  reference: string;
  status: TestDriveStatus;
  carLabel: string;
  requestedFor: string | null;
  scheduledAt: string | null;
}

export interface LeadDetail extends LeadListItem {
  events: LeadEventItem[];
  testDrives: LeadTestDrive[];
  /** The public website enquiry it came from, when it did. */
  siteLead: { reference: string; type: string; message: string | null; page: string | null; details: Record<string, string | number | boolean | null> | null } | null;
  customerKey: string | null;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

export interface LeadAnalytics {
  total: number;
  stages: FunnelStage[];
  won: number;
  lost: number;
  conversionPct: number;
  avgFirstResponseMs: number | null;
  responded: number;
  overdue: number;
}

export interface TestDriveItem {
  id: number;
  reference: string;
  status: TestDriveStatus;
  customerName: string;
  mobile: string;
  email: string | null;
  carLabel: string;
  vehicle: { id: number; label: string; reference: string } | null;
  showroom: { id: number; name: string } | null;
  requestedFor: string | null;
  scheduledAt: string | null;
  assigned: { id: number; name: string } | null;
  lead: { id: number; reference: string; status: CrmStatus } | null;
  feedback: string | null;
  rating: number | null;
  createdAt: string;
  updatedAt: string;
}
