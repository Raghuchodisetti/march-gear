import type { Metadata } from "next";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { getDb } from "@/db";
import { partnerApprovals, partnerBrands, partnerChangeRequests, partnerShowrooms, users } from "@/db/schema";
import { emptyProfile } from "@/partner/application";
import { requirePartner } from "@/server/partner/context";
import { maskAccount } from "@/server/partner/crypto";
import { getCatalog } from "@/server/catalog";
import { PortalHeader, formatDateTime, formatDay } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { PageTabs } from "@/components/portal/profile/kit";
import { PublicProfileForm } from "@/components/portal/profile/public-profile-form";
import { BusinessDetails, type ChangeRequestView, type DetailField } from "@/components/portal/profile/business-details";
import { PrimaryContactForm } from "@/components/portal/profile/primary-contact";

export const metadata: Metadata = { title: "Dealership profile" };

const LABEL: Record<string, string> = {
  "business.legalName": "Legal name",
  "business.tradeName": "Trade name",
  "business.businessType": "Business type",
  "business.gst": "GSTIN",
  "business.pan": "PAN",
  "business.registrationNumber": "Registration number",
  "business.establishedOn": "Established on",
  "business.email": "Business email",
  "business.phone": "Business phone",
  "business.website": "Website",
  "bank.holder": "Account holder",
  "bank.bankName": "Bank",
  "bank.accountNumber": "Account number",
  "bank.ifsc": "IFSC",
  "bank.branch": "Branch",
};

export default async function ProfilePage(props: PageProps<"/dealer/profile">) {
  const ctx = await requirePartner({ perm: "profile.manage" });
  const { tab } = await props.searchParams;
  const { partner } = ctx;
  const db = getDb();
  const app = partner.application;

  const [rooms, brands, requests, catalog] = await Promise.all([
    db
      .select({ city: partnerShowrooms.city, district: partnerShowrooms.district })
      .from(partnerShowrooms)
      .where(and(eq(partnerShowrooms.partnerId, partner.id), eq(partnerShowrooms.isActive, true)))
      .orderBy(desc(partnerShowrooms.isPrimary), asc(partnerShowrooms.id))
      .limit(1),
    db.select({ brand: partnerBrands.brand }).from(partnerBrands).where(and(eq(partnerBrands.partnerId, partner.id), eq(partnerBrands.status, "approved"))),
    db
      .select({ r: partnerChangeRequests, by: users.name })
      .from(partnerChangeRequests)
      .leftJoin(users, eq(users.id, partnerChangeRequests.requestedBy))
      .where(eq(partnerChangeRequests.partnerId, partner.id))
      .orderBy(desc(partnerChangeRequests.createdAt), desc(partnerChangeRequests.id))
      .limit(20),
    getCatalog(),
  ]);
  const reasons = requests.length
    ? await db
        .select({ targetId: partnerApprovals.targetId, remarks: partnerApprovals.remarks })
        .from(partnerApprovals)
        .where(
          and(
            eq(partnerApprovals.partnerId, partner.id),
            eq(partnerApprovals.target, "profile_change"),
            eq(partnerApprovals.action, "submitted"),
            inArray(
              partnerApprovals.targetId,
              requests.map((x) => x.r.id),
            ),
          ),
        )
    : [];
  const reasonOf = new Map(reasons.map((r) => [r.targetId, r.remarks]));

  const name = partner.tradeName || partner.legalName || app.business.tradeName || app.business.legalName || "Your dealership";
  const room = rooms[0];
  const brandLabel = brands.length === 1 ? `${catalog.brandName(brands[0].brand)} dealer` : brands.length ? "Multi-brand dealer" : "Dealer partner";

  const b = app.business;
  const bank = app.bank;
  const business: DetailField[] = [
    { key: "business.legalName", label: LABEL["business.legalName"], value: b.legalName },
    { key: "business.tradeName", label: LABEL["business.tradeName"], value: b.tradeName },
    { key: "business.businessType", label: LABEL["business.businessType"], value: b.businessType, input: "type" },
    { key: "business.gst", label: LABEL["business.gst"], value: b.gst },
    { key: "business.pan", label: LABEL["business.pan"], value: b.pan },
    { key: "business.registrationNumber", label: LABEL["business.registrationNumber"], value: b.registrationNumber },
    { key: "business.establishedOn", label: LABEL["business.establishedOn"], value: b.establishedOn, input: "date" },
  ];
  const contact: DetailField[] = [
    { key: "business.email", label: LABEL["business.email"], value: b.email, input: "email" },
    { key: "business.phone", label: LABEL["business.phone"], value: b.phone },
    { key: "business.website", label: LABEL["business.website"], value: b.website },
  ];
  const bankFields: DetailField[] = [
    { key: "bank.holder", label: LABEL["bank.holder"], value: bank.holder },
    { key: "bank.bankName", label: LABEL["bank.bankName"], value: bank.bankName },
    { key: "bank.accountNumber", label: LABEL["bank.accountNumber"], value: maskAccount(bank.accountNumber), input: "account" },
    { key: "bank.ifsc", label: LABEL["bank.ifsc"], value: bank.ifsc },
    { key: "bank.branch", label: LABEL["bank.branch"], value: bank.branch },
  ];

  const requestViews: ChangeRequestView[] = requests.map(({ r, by }) => ({
    id: r.id,
    status: r.status,
    fields: Object.entries(r.fields).map(([key, ft]) => ({
      key,
      label: LABEL[key] ?? key,
      from: ft.from,
      // The new account number is stored encrypted; show only its last digits.
      to: key === "bank.accountNumber" ? maskAccount(ft.to) : ft.to,
    })),
    reason: reasonOf.get(r.id) ?? null,
    remarks: r.remarks,
    requestedBy: by,
    createdAt: formatDateTime(r.createdAt),
    decidedAt: r.decidedAt ? formatDay(r.decidedAt) : null,
  }));

  const profile = { ...emptyProfile(), ...(partner.profile ?? {}) };
  const personal = app.personal;
  const pendingCount = requestViews.filter((r) => r.status === "pending").length;

  return (
    <>
      <PortalHeader
        title="Dealership profile"
        description="How customers see you on MarchGear, and the verified details on your partner record."
        actions={
          partner.publicDealerId ? (
            <Button href={`/dealers/${partner.publicDealerId}`} target="_blank" variant="outline" size="sm" icon={<ExternalLink className="size-4" aria-hidden />}>
              View public page
            </Button>
          ) : undefined
        }
      />
      <PageTabs
        initial={typeof tab === "string" ? tab : "public"}
        items={[
          { value: "public", label: "Public profile" },
          { value: "business", label: "Business & bank details", count: pendingCount || undefined },
          { value: "contact", label: "Primary contact" },
        ]}
        panels={{
          public: (
            <PublicProfileForm
              initial={profile}
              listing={{ name, city: room?.city ?? partner.city ?? "", area: room?.district ?? "", brandLabel, publicId: partner.publicDealerId, approved: ctx.approved }}
            />
          ),
          business: (
            <BusinessDetails
              verified={ctx.approved}
              requests={requestViews}
              groups={[
                { title: "Business", icon: "business", fields: business },
                { title: "Contact", icon: "business", fields: contact },
                { title: "Bank account", icon: "bank", fields: bankFields },
              ]}
            />
          ),
          contact: (
            <PrimaryContactForm
              editable={partner.ownerUserId === ctx.user.id}
              initial={{
                fullName: personal.fullName,
                designation: personal.designation,
                mobile: personal.mobile,
                mobileVerified: personal.mobileVerified,
                email: personal.email,
                emailVerified: personal.emailVerified,
                photo: personal.photo,
              }}
            />
          ),
        }}
      />
    </>
  );
}
