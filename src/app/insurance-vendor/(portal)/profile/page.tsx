import type { Metadata } from "next";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { insApprovals, insBranches, insChangeRequests, insCompanies, insFiles, users } from "@/db/schema";
import type { FileReviewStatus } from "@/db/enums";
import type { InsurerApplication } from "@/insurance/types";
import { requireInsurer, vendorName } from "@/server/insurance/context";
import { maskAccount } from "@/server/partner/crypto";
import { PortalHeader, formatDateTime, formatDay } from "@/components/portal/ui";
import { PageTabs } from "@/components/portal/profile/kit";
import { PublicProfileForm } from "@/components/insurance/vendor/profile/public-profile";
import { BranchManager } from "@/components/insurance/vendor/profile/branches";
import { VerifiedDetails, type DetailField } from "@/components/insurance/vendor/profile/verified-details";
import { KycDocuments } from "@/components/insurance/vendor/profile/documents";
import { CHANGE_LABEL, docSlots, emptyInsurerProfile, readPath, type ChangeField, type ChangeRequestView, type DocView } from "@/components/insurance/vendor/profile/shared";

export const metadata: Metadata = { title: "Company profile" };

export default async function ProfilePage(props: PageProps<"/insurance-vendor/profile">) {
  const ctx = await requireInsurer({ perm: "profile.manage", next: "/insurance-vendor/profile" });
  const { tab } = await props.searchParams;
  const { vendor } = ctx;
  const app = vendor.application as InsurerApplication;
  const db = getDb();
  const slots = docSlots(app);

  const [company, branches, requests, files] = await Promise.all([
    vendor.category === "insurer"
      ? db
          .select({ name: insCompanies.name, slug: insCompanies.slug, isActive: insCompanies.isActive, garageCount: insCompanies.garageCount, garageNote: insCompanies.garageNote })
          .from(insCompanies)
          .where(eq(insCompanies.vendorId, vendor.id))
          .limit(1)
      : Promise.resolve([]),
    db.select().from(insBranches).where(eq(insBranches.vendorId, vendor.id)).orderBy(desc(insBranches.isPrimary), asc(insBranches.name)),
    db
      .select({ r: insChangeRequests, by: users.name })
      .from(insChangeRequests)
      .leftJoin(users, eq(users.id, insChangeRequests.requestedBy))
      .where(eq(insChangeRequests.vendorId, vendor.id))
      .orderBy(desc(insChangeRequests.createdAt), desc(insChangeRequests.id))
      .limit(20),
    slots.length
      ? db
          .select({ id: insFiles.id, kind: insFiles.kind, status: insFiles.status, remarks: insFiles.remarks, createdAt: insFiles.createdAt })
          .from(insFiles)
          .where(and(eq(insFiles.vendorId, vendor.id), inArray(insFiles.id, slots.map((s) => s.file.id))))
      : Promise.resolve([]),
  ]);
  const reasons = requests.length
    ? await db
        .select({ targetId: insApprovals.targetId, remarks: insApprovals.remarks })
        .from(insApprovals)
        .where(and(eq(insApprovals.vendorId, vendor.id), eq(insApprovals.target, "profile_change"), eq(insApprovals.action, "submitted"), inArray(insApprovals.targetId, requests.map((x) => x.r.id))))
    : [];
  const reasonOf = new Map(reasons.map((r) => [r.targetId, r.remarks]));
  const co = company[0] ?? null;

  const f = (key: ChangeField, input?: DetailField["input"]): DetailField => ({ key, label: CHANGE_LABEL[key], value: key === "bank.accountNumber" ? app.bank.accountMasked || maskAccount(app.bank.accountNumber) : readPath(app, key), input });
  const groups: { title: string; icon: "company" | "regulatory" | "bank"; fields: DetailField[] }[] = [
    { title: "Company", icon: "company", fields: [f("company.legalName"), f("company.brandName"), f("company.businessType", "type"), f("company.address"), f("registration.gstin"), f("registration.pan"), f("registration.cin")] },
    { title: "Regulatory", icon: "regulatory", fields: [f("regulatory.category", "category"), f("regulatory.registrationType"), f("regulatory.licenceNumber"), f("regulatory.licenceValidUntil", "date")] },
    { title: "Bank account", icon: "bank", fields: [f("bank.holder"), f("bank.bankName"), f("bank.accountNumber", "account"), f("bank.ifsc")] },
  ];
  // Licence expiry reads better as a date.
  for (const g of groups) for (const x of g.fields) if (x.input === "date" && x.value) x.value = formatDay(x.value);

  const requestViews: ChangeRequestView[] = requests.map(({ r, by }) => ({
    id: r.id,
    status: r.status,
    fields: Object.entries(r.fields).map(([key, ft]) => ({
      key,
      label: CHANGE_LABEL[key as ChangeField] ?? key,
      from: ft.from,
      // A new account number is stored encrypted; show only its last digits.
      to: key === "bank.accountNumber" ? maskAccount(ft.to) : ft.to,
    })),
    reason: reasonOf.get(r.id) ?? null,
    remarks: r.remarks,
    requestedBy: by,
    createdAt: formatDateTime(r.createdAt),
    decidedAt: r.decidedAt ? formatDay(r.decidedAt) : null,
  }));

  const fileById = new Map(files.map((x) => [x.id, x]));
  const docs: DocView[] = slots.map((s) => {
    const row = fileById.get(s.file.id);
    return { path: s.path, label: s.label, kind: row?.kind ?? "supporting", file: s.file, status: (row?.status ?? "pending") as FileReviewStatus, remarks: row?.remarks ?? null, uploadedAt: row?.createdAt.toISOString() ?? null };
  });

  const profile = { ...emptyInsurerProfile(), ...(vendor.profile ?? {}) };
  const pendingCount = requestViews.filter((r) => r.status === "pending").length;
  const rejectedDocs = docs.filter((d) => d.status === "rejected").length;

  return (
    <>
      <PortalHeader title="Company profile" description="How customers see you on MarchGear, your offices, and the verified details on your record." />
      <PageTabs
        initial={typeof tab === "string" ? tab : "public"}
        items={[
          { value: "public", label: "Public profile" },
          { value: "branches", label: "Branches", count: branches.length },
          { value: "verified", label: "Verified details", count: pendingCount || undefined },
          { value: "documents", label: "Documents", count: rejectedDocs || undefined },
        ]}
        panels={{
          public: (
            <PublicProfileForm
              name={vendorName(vendor)}
              company={co ? { name: co.name, slug: co.slug, isActive: co.isActive } : null}
              initial={{ ...profile, garageCount: co?.garageCount ? String(co.garageCount) : "", garageNote: co?.garageNote ?? "" }}
            />
          ),
          branches: (
            <BranchManager
              branches={branches.map((b) => ({ id: b.id, name: b.name, address: b.address, city: b.city, state: b.state, pin: b.pin, phone: b.phone, email: b.email, isPrimary: b.isPrimary }))}
            />
          ),
          verified: <VerifiedDetails groups={groups} requests={requestViews} verifiedAt={vendor.approvedAt ? formatDay(vendor.approvedAt) : null} />,
          documents: <KycDocuments docs={docs} />,
        }}
      />
    </>
  );
}
