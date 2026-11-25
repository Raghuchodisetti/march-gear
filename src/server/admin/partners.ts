import "server-only";
import { and, asc, count, desc, eq, gt, gte, inArray, like, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { getDb } from "@/db";
import {
  APPROVAL_TARGETS,
  OFFER_STATUS,
  PARTNER_STATUS,
  PARTNER_VEHICLE_STATUS,
  brands,
  cars,
  dealers,
  partnerApprovals,
  partnerBrands,
  partnerChangeRequests,
  partnerFiles,
  partnerLeads,
  partnerMembers,
  partnerOffers,
  partnerShowrooms,
  partnerVehicles,
  partners,
  users,
  type ApprovalTarget,
  type OfferStatus,
  type PartnerStatus,
  type PartnerVehicleStatus,
} from "@/db/schema";
import { PATTERNS } from "@/partner/application";
import { DOC_KIND_LABEL } from "@/partner/labels";
import type { PartnerApplication } from "@/partner/types";
import { requireStaff } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { maskAccount } from "@/server/partner/crypto";
import { catalogueOf } from "@/server/partner/inventory";
import { catalogueFeatures, catalogueSpecs, isUsedDetails, newDetailsOf } from "@/components/portal/inventory/shared";
import { todayISO } from "@/server/validation";
import { IN_REVIEW, KYC_DOC_KINDS, WITH_DEALER, isBankPath, partnerName, requiredDocKinds } from "@/components/admin/partner-ui";

/* ──────────────────────────────────────────────────────────────
   Read side of the dealer partner approvals (admin panel).
   Every function re-checks staff access. Private file bytes and
   bank account numbers never leave this module: files are listed
   without their data and account numbers come back masked.
   ────────────────────────────────────────────────────────────── */

export const PARTNERS_PAGE_SIZE = 20;
export const VEHICLES_PAGE_SIZE = 20;
export const OFFERS_PAGE_SIZE = 20;
export const HISTORY_PAGE_SIZE = 40;

const owner = alias(users, "owner");
const actor = alias(users, "actor");
const decider = alias(users, "decider");

const term = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
const pageOf = (page: number | undefined, total: number, size: number) => Math.min(Math.max(1, page ?? 1), Math.max(1, Math.ceil(total / size)));
const isOneOf = <T extends string>(list: readonly T[], v: string | undefined): v is T => !!v && (list as readonly string[]).includes(v);

/* ── Dashboard ──────────────────────────────────────────────── */

export async function partnerNetworkStats() {
  await requireStaff();
  const db = getDb();
  const now = new Date();
  const [byStatus, [vehiclesPending], [offersPending], [activeCampaigns], [scheduledCampaigns], [enquiries], [enquiries30], [changes], [docs], dealerQueue, vehicleQueue, offerQueue, changeQueue, recent] =
    await Promise.all([
      db.select({ status: partners.status, n: count() }).from(partners).groupBy(partners.status),
      db.select({ n: count() }).from(partnerVehicles).where(and(eq(partnerVehicles.kind, "used"), eq(partnerVehicles.status, "pending_approval"))),
      db.select({ n: count() }).from(partnerOffers).where(inArray(partnerOffers.status, ["submitted", "pending_approval"])),
      // Live / upcoming on the website: approved offers of approved dealerships only (a suspended dealer's offers are hidden).
      db.select({ n: count() }).from(partnerOffers).innerJoin(partners, eq(partners.id, partnerOffers.partnerId)).where(and(eq(partnerOffers.status, "approved"), lte(partnerOffers.startsAt, now), gte(partnerOffers.endsAt, now), eq(partners.status, "approved"))),
      db.select({ n: count() }).from(partnerOffers).innerJoin(partners, eq(partners.id, partnerOffers.partnerId)).where(and(eq(partnerOffers.status, "approved"), gt(partnerOffers.startsAt, now), eq(partners.status, "approved"))),
      db.select({ n: count() }).from(partnerLeads),
      db.select({ n: count() }).from(partnerLeads).where(gte(partnerLeads.createdAt, new Date(Date.now() - 30 * 86_400_000))),
      db.select({ n: count() }).from(partnerChangeRequests).where(eq(partnerChangeRequests.status, "pending")),
      db
        .select({ n: count() })
        .from(partnerFiles)
        .innerJoin(partners, eq(partners.id, partnerFiles.partnerId))
        .where(and(eq(partnerFiles.status, "pending"), inArray(partnerFiles.kind, [...KYC_DOC_KINDS]), ne(partners.status, "draft"))),
      db
        .select({ id: partners.id, reference: partners.reference, status: partners.status, legalName: partners.legalName, tradeName: partners.tradeName, city: partners.city, submittedAt: partners.submittedAt, createdAt: partners.createdAt, ownerName: owner.name })
        .from(partners)
        .innerJoin(owner, eq(owner.id, partners.ownerUserId))
        .where(inArray(partners.status, IN_REVIEW))
        .orderBy(sql`${partners.submittedAt} is null`, asc(partners.submittedAt), asc(partners.id))
        .limit(6),
      db
        .select({ id: partnerVehicles.id, reference: partnerVehicles.reference, brand: partnerVehicles.brand, model: partnerVehicles.model, variant: partnerVehicles.variant, kind: partnerVehicles.kind, price: partnerVehicles.sellingPrice, image: sql<string | null>`json_unquote(json_extract(${partnerVehicles.images}, '$[0]'))`, submittedAt: partnerVehicles.submittedAt, createdAt: partnerVehicles.createdAt, partnerName: sql<string | null>`coalesce(nullif(${partners.tradeName}, ''), ${partners.legalName})` })
        .from(partnerVehicles)
        .innerJoin(partners, eq(partners.id, partnerVehicles.partnerId))
        .where(and(eq(partnerVehicles.kind, "used"), eq(partnerVehicles.status, "pending_approval")))
        .orderBy(sql`${partnerVehicles.submittedAt} is null`, asc(partnerVehicles.submittedAt), asc(partnerVehicles.id))
        .limit(6),
      db
        .select({ id: partnerOffers.id, reference: partnerOffers.reference, title: partnerOffers.title, category: partnerOffers.category, startsAt: partnerOffers.startsAt, endsAt: partnerOffers.endsAt, submittedAt: partnerOffers.submittedAt, createdAt: partnerOffers.createdAt, partnerName: sql<string | null>`coalesce(nullif(${partners.tradeName}, ''), ${partners.legalName})` })
        .from(partnerOffers)
        .innerJoin(partners, eq(partners.id, partnerOffers.partnerId))
        .where(inArray(partnerOffers.status, ["submitted", "pending_approval"]))
        .orderBy(sql`${partnerOffers.submittedAt} is null`, asc(partnerOffers.submittedAt), asc(partnerOffers.id))
        .limit(6),
      db
        .select({ id: partnerChangeRequests.id, partnerId: partnerChangeRequests.partnerId, fields: partnerChangeRequests.fields, createdAt: partnerChangeRequests.createdAt, partnerName: sql<string | null>`coalesce(nullif(${partners.tradeName}, ''), ${partners.legalName})`, reference: partners.reference })
        .from(partnerChangeRequests)
        .innerJoin(partners, eq(partners.id, partnerChangeRequests.partnerId))
        .where(eq(partnerChangeRequests.status, "pending"))
        .orderBy(asc(partnerChangeRequests.createdAt))
        .limit(6),
      db
        .select({ ...historyColumns })
        .from(partnerApprovals)
        .innerJoin(partners, eq(partners.id, partnerApprovals.partnerId))
        .leftJoin(actor, eq(actor.id, partnerApprovals.actorUserId))
        .where(and(eq(partnerApprovals.actorSide, "admin"), ne(partnerApprovals.action, "internal_note")))
        .orderBy(desc(partnerApprovals.createdAt), desc(partnerApprovals.id))
        .limit(10),
    ]);
  const status = Object.fromEntries(PARTNER_STATUS.map((s) => [s, 0])) as Record<PartnerStatus, number>;
  for (const r of byStatus) status[r.status] = r.n;
  const total = Object.values(status).reduce((a, b) => a + b, 0);
  return {
    now: now.getTime(),
    status,
    total,
    pending: IN_REVIEW.reduce((a, s) => a + status[s], 0),
    withDealer: WITH_DEALER.reduce((a, s) => a + status[s], 0),
    vehiclesPending: vehiclesPending.n,
    offersPending: offersPending.n,
    activeCampaigns: activeCampaigns.n,
    scheduledCampaigns: scheduledCampaigns.n,
    enquiries: enquiries.n,
    enquiries30: enquiries30.n,
    changesPending: changes.n,
    docsPending: docs.n,
    dealerQueue: dealerQueue.map((d) => ({ ...d, name: partnerName(d) })),
    vehicleQueue,
    offerQueue,
    changeQueue: changeQueue.map((c) => ({ ...c, fields: Object.keys(c.fields) })),
    recent: await withTargetLabels(recent),
  };
}

/* ── Dealers list ───────────────────────────────────────────── */

export interface PartnerListFilters {
  q?: string;
  /** A partner status, or "queue" (waiting for us) / "with_dealer" (waiting for the dealer). */
  status?: string;
  sort?: string;
  page?: number;
}

export const PARTNER_SORTS = {
  newest: "Newest first",
  waiting: "Longest waiting",
  name: "Name A–Z",
  updated: "Recently updated",
  oldest: "Oldest first",
} as const;

function partnerWhere(f: PartnerListFilters) {
  const conds: SQL[] = [];
  if (f.status === "queue") conds.push(inArray(partners.status, IN_REVIEW));
  else if (f.status === "with_dealer") conds.push(inArray(partners.status, WITH_DEALER));
  else if (isOneOf(PARTNER_STATUS, f.status)) conds.push(eq(partners.status, f.status));
  if (f.q) {
    const t = term(f.q);
    conds.push(or(like(partners.legalName, t), like(partners.tradeName, t), like(partners.reference, t), like(partners.gst, t), like(partners.city, t), like(owner.email, t), like(owner.name, t))!);
  }
  return conds.length ? and(...conds) : undefined;
}

export async function listPartners(f: PartnerListFilters) {
  await requireStaff();
  const db = getDb();
  const w = partnerWhere(f);
  const [[{ total }], counts] = await Promise.all([
    db.select({ total: count() }).from(partners).innerJoin(owner, eq(owner.id, partners.ownerUserId)).where(w),
    db.select({ status: partners.status, n: count() }).from(partners).groupBy(partners.status),
  ]);
  const page = pageOf(f.page, total, PARTNERS_PAGE_SIZE);
  const order =
    f.sort === "name"
      ? [sql`coalesce(nullif(${partners.tradeName}, ''), nullif(${partners.legalName}, ''), ${owner.name})`, asc(partners.id)]
      : f.sort === "oldest"
        ? [asc(partners.createdAt), asc(partners.id)]
        : f.sort === "updated"
          ? [desc(partners.updatedAt), desc(partners.id)]
          : f.sort === "waiting"
            ? [sql`${partners.status} in ('submitted', 'pending_approval', 'under_review') desc`, sql`${partners.submittedAt} is null`, asc(partners.submittedAt), asc(partners.id)]
            : [desc(partners.createdAt), desc(partners.id)];
  const rows = await db
    .select({
      id: partners.id,
      reference: partners.reference,
      status: partners.status,
      legalName: partners.legalName,
      tradeName: partners.tradeName,
      city: partners.city,
      state: partners.state,
      gst: partners.gst,
      plan: partners.plan,
      planStatus: partners.planStatus,
      publicDealerId: partners.publicDealerId,
      step: partners.step,
      submittedAt: partners.submittedAt,
      approvedAt: partners.approvedAt,
      createdAt: partners.createdAt,
      updatedAt: partners.updatedAt,
      ownerName: owner.name,
      ownerEmail: owner.email,
      ownerPhone: owner.phone,
      vehicles: sql<number>`(select count(*) from ${partnerVehicles} where ${partnerVehicles.partnerId} = ${partners.id} and ${partnerVehicles.status} = 'published')`.mapWith(Number),
      pendingItems: sql<number>`((select count(*) from ${partnerVehicles} where ${partnerVehicles.partnerId} = ${partners.id} and ${partnerVehicles.status} = 'pending_approval') + (select count(*) from ${partnerOffers} where ${partnerOffers.partnerId} = ${partners.id} and ${partnerOffers.status} in ('submitted', 'pending_approval')) + (select count(*) from ${partnerChangeRequests} where ${partnerChangeRequests.partnerId} = ${partners.id} and ${partnerChangeRequests.status} = 'pending'))`.mapWith(Number),
    })
    .from(partners)
    .innerJoin(owner, eq(owner.id, partners.ownerUserId))
    .where(w)
    .orderBy(...order)
    .limit(PARTNERS_PAGE_SIZE)
    .offset((page - 1) * PARTNERS_PAGE_SIZE);
  const byStatus = Object.fromEntries(PARTNER_STATUS.map((s) => [s, 0])) as Record<PartnerStatus, number>;
  for (const c of counts) byStatus[c.status] = c.n;
  return { rows: rows.map((r) => ({ ...r, name: partnerName(r) })), total, page, byStatus, now: Date.now() };
}

/* ── One dealer ─────────────────────────────────────────────── */

const fileColumns = {
  id: partnerFiles.id,
  kind: partnerFiles.kind,
  filename: partnerFiles.filename,
  mime: partnerFiles.mime,
  size: partnerFiles.size,
  status: partnerFiles.status,
  remarks: partnerFiles.remarks,
  createdAt: partnerFiles.createdAt,
};
export type PartnerFileRow = { id: number; kind: string; filename: string; mime: string; size: number; status: "pending" | "verified" | "rejected"; remarks: string | null; createdAt: Date };

/** The application as the browser may see it: the bank account number masked. */
function safeApplication(app: PartnerApplication): PartnerApplication {
  return { ...app, bank: { ...app.bank, accountNumber: app.bank?.accountNumber ? maskAccount(app.bank.accountNumber) : "" } };
}

/** Change-request values as the browser may see them (bank numbers masked). */
function safeFields(fields: Record<string, { from: string; to: string }>) {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, isBankPath(k) ? { from: v.from ? maskAccount(String(v.from)) : "", to: v.to ? maskAccount(String(v.to)) : "" } : { from: String(v.from ?? ""), to: String(v.to ?? "") }]),
  );
}

export async function getPartnerDetail(id: number) {
  await requireStaff();
  const db = getDb();
  const [row] = await db
    .select({
      partner: partners,
      owner: { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone, isActive: owner.isActive, createdAt: owner.createdAt },
      deciderName: decider.name,
    })
    .from(partners)
    .innerJoin(owner, eq(owner.id, partners.ownerUserId))
    .leftJoin(decider, eq(decider.id, partners.decidedBy))
    .where(eq(partners.id, id));
  if (!row) return null;
  const p = row.partner;
  const [showrooms, brandRows, files, vehicles, offers, changes, members, history, [leadCount], publicDealer, brandNames] = await Promise.all([
    db.select().from(partnerShowrooms).where(eq(partnerShowrooms.partnerId, id)).orderBy(desc(partnerShowrooms.isPrimary), asc(partnerShowrooms.id)),
    db.select().from(partnerBrands).where(eq(partnerBrands.partnerId, id)).orderBy(asc(partnerBrands.brand)),
    db.select(fileColumns).from(partnerFiles).where(eq(partnerFiles.partnerId, id)).orderBy(desc(partnerFiles.createdAt), desc(partnerFiles.id)),
    db
      .select({ id: partnerVehicles.id, reference: partnerVehicles.reference, kind: partnerVehicles.kind, brand: partnerVehicles.brand, modelSlug: partnerVehicles.modelSlug, model: partnerVehicles.model, variant: partnerVehicles.variant, year: partnerVehicles.year, sellingPrice: partnerVehicles.sellingPrice, status: partnerVehicles.status, images: partnerVehicles.images, used: partnerVehicles.used, views: partnerVehicles.views, enquiries: partnerVehicles.enquiries, updatedAt: partnerVehicles.updatedAt, submittedAt: partnerVehicles.submittedAt })
      .from(partnerVehicles)
      .where(eq(partnerVehicles.partnerId, id))
      .orderBy(desc(partnerVehicles.updatedAt)),
    db
      .select({ id: partnerOffers.id, reference: partnerOffers.reference, title: partnerOffers.title, category: partnerOffers.category, status: partnerOffers.status, startsAt: partnerOffers.startsAt, endsAt: partnerOffers.endsAt, views: partnerOffers.views, enquiries: partnerOffers.enquiries, conversions: partnerOffers.conversions, updatedAt: partnerOffers.updatedAt })
      .from(partnerOffers)
      .where(eq(partnerOffers.partnerId, id))
      .orderBy(desc(partnerOffers.updatedAt)),
    db
      .select({ id: partnerChangeRequests.id, fields: partnerChangeRequests.fields, status: partnerChangeRequests.status, remarks: partnerChangeRequests.remarks, createdAt: partnerChangeRequests.createdAt, decidedAt: partnerChangeRequests.decidedAt, requestedBy: owner.name, decidedBy: decider.name })
      .from(partnerChangeRequests)
      .leftJoin(owner, eq(owner.id, partnerChangeRequests.requestedBy))
      .leftJoin(decider, eq(decider.id, partnerChangeRequests.decidedBy))
      .where(eq(partnerChangeRequests.partnerId, id))
      .orderBy(sql`${partnerChangeRequests.status} = 'pending' desc`, desc(partnerChangeRequests.createdAt)),
    db
      .select({ id: partnerMembers.id, role: partnerMembers.role, isActive: partnerMembers.isActive, permissions: partnerMembers.permissions, createdAt: partnerMembers.createdAt, userId: users.id, name: users.name, email: users.email, phone: users.phone, userActive: users.isActive })
      .from(partnerMembers)
      .innerJoin(users, eq(users.id, partnerMembers.userId))
      .where(eq(partnerMembers.partnerId, id))
      .orderBy(asc(partnerMembers.id)),
    db
      .select({ ...historyColumns })
      .from(partnerApprovals)
      .innerJoin(partners, eq(partners.id, partnerApprovals.partnerId))
      .leftJoin(actor, eq(actor.id, partnerApprovals.actorUserId))
      .where(eq(partnerApprovals.partnerId, id))
      .orderBy(desc(partnerApprovals.createdAt), desc(partnerApprovals.id)),
    db.select({ n: count() }).from(partnerLeads).where(eq(partnerLeads.partnerId, id)),
    p.publicDealerId ? db.select({ id: dealers.id, isActive: dealers.isActive, name: dealers.name }).from(dealers).where(eq(dealers.id, p.publicDealerId)) : Promise.resolve([]),
    db.select({ slug: brands.slug, name: brands.name }).from(brands),
  ]);
  const modelSlugs = [...new Set(brandRows.flatMap((b) => b.models))];
  const modelRows = modelSlugs.length ? await db.select({ slug: cars.slug, name: cars.name }).from(cars).where(inArray(cars.slug, modelSlugs)) : [];
  const modelName = new Map(modelRows.map((m) => [m.slug, m.name]));
  const brandName = new Map(brandNames.map((b) => [b.slug, b.name]));
  const app = p.application;
  const partner = { ...p, application: safeApplication(app) };
  const [labelledHistory, cat] = await Promise.all([withTargetLabels(history), getCatalog()]);
  return {
    partner,
    name: partnerName({ ...p, ownerName: row.owner.name }),
    owner: row.owner,
    deciderName: row.deciderName,
    showrooms,
    brands: brandRows.map((b) => ({ ...b, brandName: brandName.get(b.brand) ?? b.brand, modelNames: b.models.map((m) => modelName.get(m) ?? m) })),
    files: files as PartnerFileRow[],
    // New cars show the catalogue's photo; used cars the dealer's own.
    vehicles: vehicles.map(({ images, used, modelSlug, ...v }) => {
      const { car, ok } = catalogueOf({ ...v, modelSlug, used }, cat);
      return { ...v, image: (v.kind === "new" ? car?.images[0] : images[0]) ?? null, needsCatalogue: !ok };
    }),
    offers,
    // The dealer's reason is on their "submitted" approval entry for the request.
    changes: changes.map((c) => ({ ...c, fields: safeFields(c.fields), reason: history.find((h) => h.target === "profile_change" && h.targetId === c.id && h.action === "submitted")?.remarks ?? null })),
    members,
    history: labelledHistory.filter((h) => h.action !== "internal_note"),
    notes: labelledHistory.filter((h) => h.action === "internal_note"),
    leadCount: leadCount.n,
    publicDealer: publicDealer[0] ?? null,
    brandName: Object.fromEntries(brandName),
    checklist: buildChecklist(app, files as PartnerFileRow[], brandRows, showrooms.length),
    hasBankNumber: Boolean(app.bank?.accountNumber),
    resubmitted: IN_REVIEW.includes(p.status) && history.some((h) => h.toStatus === "changes_requested" || h.toStatus === "documents_required"),
  };
}
export type PartnerDetail = NonNullable<Awaited<ReturnType<typeof getPartnerDetail>>>;

export interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

/** What a reviewer checks before approving an application. */
export function buildChecklist(app: PartnerApplication, files: PartnerFileRow[], brandRows: { status: string; certificate: unknown; validUntil: string | null; brand: string }[], showroomCount: number): ChecklistItem[] {
  const today = todayISO();
  const required = requiredDocKinds(app.brands?.mode ?? "");
  const latest = new Map<string, PartnerFileRow>();
  for (const f of files) if (!latest.has(f.kind)) latest.set(f.kind, f); // newest first
  const missing = required.filter((k) => !latest.get(k));
  const verified = required.filter((k) => latest.get(k)?.status === "verified");
  const rejected = required.filter((k) => latest.get(k)?.status === "rejected");
  const gst = (app.business?.gst ?? "").toUpperCase();
  const pan = (app.business?.pan ?? "").toUpperCase();
  const gstOk = PATTERNS.gst.test(gst);
  const panOk = PATTERNS.pan.test(pan);
  const panInGst = gstOk && panOk && gst.slice(2, 12) === pan;
  const mode = app.brands?.mode ?? "";
  const brandItems = brandRows.length
    ? brandRows.map((b) => ({ brand: b.brand, cert: Boolean(b.certificate), until: b.validUntil ?? "" }))
    : (app.brands?.items ?? []).map((b) => ({ brand: b.brand, cert: Boolean(b.certificate), until: b.validUntil }));
  const certIssues = brandItems.filter((b) => !b.cert || !b.until || b.until < today);
  const showrooms = showroomCount || app.showrooms?.length || 0;
  const bank = app.bank ?? { ifsc: "", accountNumber: "", holder: "" };
  const bankOk = Boolean(bank.accountNumber) && PATTERNS.ifsc.test((bank.ifsc ?? "").toUpperCase()) && Boolean(bank.holder);
  const contactOk = Boolean(app.personal?.mobileVerified && app.personal?.emailVerified);
  const declared = Boolean(app.declaration?.declared && app.declaration?.acceptedTerms && app.declaration?.signedName);
  return [
    {
      key: "docs_uploaded",
      label: "Required documents uploaded",
      ok: missing.length === 0,
      detail: missing.length ? `Missing: ${missing.map((k) => DOC_KIND_LABEL[k]).join(", ")}` : `${required.length} of ${required.length} uploaded`,
    },
    {
      key: "docs_verified",
      label: "Documents verified",
      ok: verified.length === required.length,
      detail: `${verified.length} of ${required.length} verified${rejected.length ? ` · ${rejected.length} rejected` : ""}`,
    },
    { key: "gst", label: "GST number format", ok: gstOk, detail: gst ? `${gst}${gstOk ? "" : " — not a valid GSTIN"}` : "Not provided" },
    {
      key: "pan",
      label: "PAN format (and matches GST)",
      ok: panOk && (!gstOk || panInGst),
      detail: pan ? `${pan}${!panOk ? " — not a valid PAN" : gstOk ? (panInGst ? " · matches the GSTIN" : " · doesn't match the GSTIN") : ""}` : "Not provided",
    },
    {
      key: "brands",
      label: "Brand certificates valid",
      ok: mode === "multi_brand" && brandItems.length === 0 ? true : brandItems.length > 0 && certIssues.length === 0,
      detail:
        mode === "multi_brand" && brandItems.length === 0
          ? "Multi-brand dealer — no authorisation needed"
          : brandItems.length === 0
            ? "No brands added"
            : certIssues.length
              ? `${certIssues.length} of ${brandItems.length} missing a certificate or expired`
              : `${brandItems.length} certificate${brandItems.length === 1 ? "" : "s"} valid`,
    },
    { key: "showrooms", label: "Showroom details", ok: showrooms > 0, detail: showrooms ? `${showrooms} showroom${showrooms === 1 ? "" : "s"}` : "No showroom added" },
    { key: "bank", label: "Bank details & IFSC", ok: bankOk, detail: bankOk ? `${(bank.ifsc ?? "").toUpperCase()} · account on file` : "Incomplete bank details" },
    { key: "contact", label: "Mobile & email verified", ok: contactOk, detail: contactOk ? "Both verified by OTP" : `${app.personal?.mobileVerified ? "Mobile verified" : "Mobile not verified"} · ${app.personal?.emailVerified ? "email verified" : "email not verified"}` },
    { key: "declaration", label: "Declaration signed", ok: declared, detail: declared ? `Signed by ${app.declaration.signedName}` : "Not signed" },
  ];
}

/* ── Verification queue ─────────────────────────────────────── */

export async function verificationQueue(view: "review" | "dealer" | "decided") {
  await requireStaff();
  const db = getDb();
  const statuses: PartnerStatus[] = view === "dealer" ? WITH_DEALER : view === "decided" ? ["approved", "rejected", "suspended", "deactivated"] : IN_REVIEW;
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: partners.id,
        reference: partners.reference,
        status: partners.status,
        legalName: partners.legalName,
        tradeName: partners.tradeName,
        city: partners.city,
        state: partners.state,
        submittedAt: partners.submittedAt,
        updatedAt: partners.updatedAt,
        createdAt: partners.createdAt,
        ownerName: owner.name,
        docsTotal: sql<number>`(select count(*) from ${partnerFiles} where ${partnerFiles.partnerId} = ${partners.id} and ${partnerFiles.kind} in (${sql.join(KYC_DOC_KINDS.map((k) => sql`${k}`), sql`, `)}))`.mapWith(Number),
        docsVerified: sql<number>`(select count(*) from ${partnerFiles} where ${partnerFiles.partnerId} = ${partners.id} and ${partnerFiles.status} = 'verified' and ${partnerFiles.kind} in (${sql.join(KYC_DOC_KINDS.map((k) => sql`${k}`), sql`, `)}))`.mapWith(Number),
        resubmitted: sql<number>`exists(select 1 from ${partnerApprovals} where ${partnerApprovals.partnerId} = ${partners.id} and ${partnerApprovals.toStatus} in ('changes_requested', 'documents_required'))`.mapWith(Number),
      })
      .from(partners)
      .innerJoin(owner, eq(owner.id, partners.ownerUserId))
      .where(inArray(partners.status, statuses))
      .orderBy(...(view === "decided" ? [desc(partners.updatedAt)] : [sql`${partners.submittedAt} is null`, asc(partners.submittedAt), asc(partners.id)]))
      .limit(view === "decided" ? 30 : 100),
    db.select({ status: partners.status, n: count() }).from(partners).where(inArray(partners.status, [...IN_REVIEW, ...WITH_DEALER])).groupBy(partners.status),
  ]);
  const n = (list: PartnerStatus[]) => counts.filter((c) => list.includes(c.status)).reduce((a, c) => a + c.n, 0);
  return { rows: rows.map((r) => ({ ...r, name: partnerName(r), resubmitted: Boolean(r.resubmitted) && IN_REVIEW.includes(r.status) })), counts: { review: n(IN_REVIEW), dealer: n(WITH_DEALER) }, now: Date.now() };
}

/* ── Vehicles ───────────────────────────────────────────────── */

export interface VehicleFilters {
  /** queue: used cars waiting for review · new: new-car stock (live and paused) · all: every listing. */
  view?: "queue" | "new" | "all";
  status?: string;
  kind?: string;
  q?: string;
  partner?: number;
  page?: number;
}

export async function listPartnerVehicles(f: VehicleFilters) {
  await requireStaff();
  const db = getDb();
  const conds: SQL[] = [];
  const view = f.view === "all" || f.view === "new" ? f.view : "queue";
  // Only used cars are reviewed; new-car listings go live when the dealer publishes them.
  if (view === "queue") conds.push(eq(partnerVehicles.kind, "used"), eq(partnerVehicles.status, "pending_approval"));
  else if (view === "new") {
    conds.push(eq(partnerVehicles.kind, "new"));
    conds.push(isOneOf(PARTNER_VEHICLE_STATUS, f.status) ? eq(partnerVehicles.status, f.status) : inArray(partnerVehicles.status, ["published", "unpublished"]));
  } else if (isOneOf(PARTNER_VEHICLE_STATUS, f.status)) conds.push(eq(partnerVehicles.status, f.status));
  if (view === "all" && (f.kind === "new" || f.kind === "used")) conds.push(eq(partnerVehicles.kind, f.kind));
  if (f.partner) conds.push(eq(partnerVehicles.partnerId, f.partner));
  if (f.q) {
    const t = term(f.q);
    conds.push(or(like(partnerVehicles.reference, t), like(partnerVehicles.brand, t), like(partnerVehicles.model, t), like(partnerVehicles.variant, t), like(partnerVehicles.vin, t), like(partners.tradeName, t), like(partners.legalName, t), like(partners.reference, t))!);
  }
  const w = conds.length ? and(...conds) : undefined;
  const [[{ total }], [{ queue }], [{ liveNew }], byStatus] = await Promise.all([
    db.select({ total: count() }).from(partnerVehicles).innerJoin(partners, eq(partners.id, partnerVehicles.partnerId)).where(w),
    db.select({ queue: count() }).from(partnerVehicles).where(and(eq(partnerVehicles.kind, "used"), eq(partnerVehicles.status, "pending_approval"))),
    db.select({ liveNew: count() }).from(partnerVehicles).where(and(eq(partnerVehicles.kind, "new"), inArray(partnerVehicles.status, ["published", "unpublished"]))),
    db.select({ status: partnerVehicles.status, n: count() }).from(partnerVehicles).groupBy(partnerVehicles.status),
  ]);
  const page = pageOf(f.page, total, VEHICLES_PAGE_SIZE);
  const rows = await db
    .select({
      id: partnerVehicles.id,
      reference: partnerVehicles.reference,
      kind: partnerVehicles.kind,
      brand: partnerVehicles.brand,
      modelSlug: partnerVehicles.modelSlug,
      model: partnerVehicles.model,
      variant: partnerVehicles.variant,
      year: partnerVehicles.year,
      fuel: partnerVehicles.fuel,
      transmission: partnerVehicles.transmission,
      sellingPrice: partnerVehicles.sellingPrice,
      exShowroom: partnerVehicles.exShowroom,
      colour: partnerVehicles.colour,
      stock: partnerVehicles.stock,
      used: partnerVehicles.used,
      adminRemarks: partnerVehicles.adminRemarks,
      status: partnerVehicles.status,
      image: sql<string | null>`json_unquote(json_extract(${partnerVehicles.images}, '$[0]'))`,
      imageCount: sql<number>`json_length(${partnerVehicles.images})`.mapWith(Number),
      submittedAt: partnerVehicles.submittedAt,
      updatedAt: partnerVehicles.updatedAt,
      createdAt: partnerVehicles.createdAt,
      partnerId: partners.id,
      partnerRef: partners.reference,
      partnerName: sql<string | null>`coalesce(nullif(${partners.tradeName}, ''), ${partners.legalName})`,
      partnerStatus: partners.status,
    })
    .from(partnerVehicles)
    .innerJoin(partners, eq(partners.id, partnerVehicles.partnerId))
    .where(w)
    .orderBy(...(view === "queue" ? [sql`${partnerVehicles.submittedAt} is null`, asc(partnerVehicles.submittedAt), asc(partnerVehicles.id)] : [desc(partnerVehicles.updatedAt), desc(partnerVehicles.id)]))
    .limit(VEHICLES_PAGE_SIZE)
    .offset((page - 1) * VEHICLES_PAGE_SIZE);
  const cat = await getCatalog();
  return {
    rows: rows.map(({ used, ...r }) => {
      const c = catalogueOf({ ...r, used }, cat);
      const nd = newDetailsOf(used);
      return {
        ...r,
        catalogue: catalogueRef(c),
        // A new car's photo is the catalogue's; a used car's the dealer's.
        image: r.kind === "new" ? (c.car?.images[0] ?? null) : r.image,
        availability: r.kind === "new" ? nd.availability : ("in_stock" as const),
        waitingWeeks: r.kind === "new" ? nd.waitingWeeks : null,
      };
    }),
    total,
    page,
    queue,
    liveNew,
    byStatus: Object.fromEntries(byStatus.map((b) => [b.status, b.n])) as Partial<Record<PartnerVehicleStatus, number>>,
    now: Date.now(),
  };
}

/** What the reviewer compares a listing with: the catalogue model and its variant's ex-showroom price. */
function catalogueRef({ car, variant }: ReturnType<typeof catalogueOf>) {
  if (!car) return null;
  return { carName: car.name, variantName: variant?.name ?? null, price: variant?.price ?? null, priceMin: car.priceMin, priceMax: car.priceMax, slug: car.slug };
}

export async function getVehicleReview(id: number) {
  await requireStaff();
  const db = getDb();
  const [row] = await db
    .select({ vehicle: partnerVehicles, partnerName: sql<string | null>`coalesce(nullif(${partners.tradeName}, ''), ${partners.legalName})`, partnerRef: partners.reference, partnerStatus: partners.status, partnerCity: partners.city, publicDealerId: partners.publicDealerId })
    .from(partnerVehicles)
    .innerJoin(partners, eq(partners.id, partnerVehicles.partnerId))
    .where(eq(partnerVehicles.id, id));
  if (!row) return null;
  const v = row.vehicle;
  const used = isUsedDetails(v.used) ? v.used : null;
  const [room, history, cat, inspection, brandRow] = await Promise.all([
    v.showroomId ? db.select({ name: partnerShowrooms.name, city: partnerShowrooms.city }).from(partnerShowrooms).where(eq(partnerShowrooms.id, v.showroomId)) : Promise.resolve([]),
    db
      .select({ ...historyColumns })
      .from(partnerApprovals)
      .innerJoin(partners, eq(partners.id, partnerApprovals.partnerId))
      .leftJoin(actor, eq(actor.id, partnerApprovals.actorUserId))
      .where(and(eq(partnerApprovals.target, "vehicle"), eq(partnerApprovals.targetId, id)))
      .orderBy(desc(partnerApprovals.createdAt), desc(partnerApprovals.id)),
    getCatalog(),
    used?.inspection?.id ? db.select(fileColumns).from(partnerFiles).where(and(eq(partnerFiles.id, used.inspection.id), eq(partnerFiles.partnerId, v.partnerId))) : Promise.resolve([]),
    db.select({ name: brands.name }).from(brands).where(eq(brands.slug, v.brand)),
  ]);
  const c = catalogueOf(v, cat);
  return {
    vehicle: v,
    used,
    newDetails: v.kind === "new" ? newDetailsOf(v.used) : null,
    partner: { id: v.partnerId, name: row.partnerName ?? row.partnerRef, reference: row.partnerRef, status: row.partnerStatus, city: row.partnerCity, publicDealerId: row.publicDealerId },
    showroom: room[0] ?? null,
    history,
    catalogue: catalogueRef(c),
    /** What the listing shows from the catalogue (all of a new car; the specs of a used car). */
    fromCatalogue: c.car
      ? { images: c.car.images, specs: catalogueSpecs(c.car, c.variant), features: catalogueFeatures(c.car, c.variant), colourHex: c.car.colors.find((x) => x.name === v.colour)?.hex ?? null, ok: c.ok }
      : null,
    inspection: (inspection[0] as PartnerFileRow | undefined) ?? null,
    brandName: brandRow[0]?.name ?? v.brand,
  };
}
export type VehicleReview = NonNullable<Awaited<ReturnType<typeof getVehicleReview>>>;

/* ── Offers & campaigns ─────────────────────────────────────── */

export interface OfferFilters {
  view?: "queue" | "all";
  status?: string;
  q?: string;
  partner?: number;
  page?: number;
}

const offerListColumns = {
  id: partnerOffers.id,
  reference: partnerOffers.reference,
  title: partnerOffers.title,
  campaignName: partnerOffers.campaignName,
  category: partnerOffers.category,
  status: partnerOffers.status,
  startsAt: partnerOffers.startsAt,
  endsAt: partnerOffers.endsAt,
  discount: partnerOffers.discount,
  scope: partnerOffers.scope,
  thumbnail: sql<string | null>`coalesce(nullif(json_unquote(json_extract(${partnerOffers.media}, '$.thumbnail')), ''), nullif(json_unquote(json_extract(${partnerOffers.media}, '$.desktopBanner')), ''))`,
  views: partnerOffers.views,
  enquiries: partnerOffers.enquiries,
  conversions: partnerOffers.conversions,
  redemptions: partnerOffers.redemptions,
  maxRedemptions: partnerOffers.maxRedemptions,
  submittedAt: partnerOffers.submittedAt,
  approvedAt: partnerOffers.approvedAt,
  updatedAt: partnerOffers.updatedAt,
  createdAt: partnerOffers.createdAt,
  partnerId: partners.id,
  partnerRef: partners.reference,
  partnerName: sql<string | null>`coalesce(nullif(${partners.tradeName}, ''), ${partners.legalName})`,
  partnerStatus: partners.status,
};

export async function listPartnerOffers(f: OfferFilters) {
  await requireStaff();
  const db = getDb();
  const conds: SQL[] = [];
  if (f.view !== "all") conds.push(inArray(partnerOffers.status, ["submitted", "pending_approval"]));
  else if (isOneOf(OFFER_STATUS, f.status)) conds.push(eq(partnerOffers.status, f.status));
  if (f.partner) conds.push(eq(partnerOffers.partnerId, f.partner));
  if (f.q) {
    const t = term(f.q);
    conds.push(or(like(partnerOffers.reference, t), like(partnerOffers.title, t), like(partnerOffers.campaignName, t), like(partners.tradeName, t), like(partners.legalName, t), like(partners.reference, t))!);
  }
  const w = conds.length ? and(...conds) : undefined;
  const [[{ total }], [{ queue }], byStatus] = await Promise.all([
    db.select({ total: count() }).from(partnerOffers).innerJoin(partners, eq(partners.id, partnerOffers.partnerId)).where(w),
    db.select({ queue: count() }).from(partnerOffers).where(inArray(partnerOffers.status, ["submitted", "pending_approval"])),
    db.select({ status: partnerOffers.status, n: count() }).from(partnerOffers).groupBy(partnerOffers.status),
  ]);
  const page = pageOf(f.page, total, OFFERS_PAGE_SIZE);
  const rows = await db
    .select(offerListColumns)
    .from(partnerOffers)
    .innerJoin(partners, eq(partners.id, partnerOffers.partnerId))
    .where(w)
    .orderBy(...(f.view !== "all" ? [sql`${partnerOffers.submittedAt} is null`, asc(partnerOffers.submittedAt), asc(partnerOffers.id)] : [desc(partnerOffers.updatedAt), desc(partnerOffers.id)]))
    .limit(OFFERS_PAGE_SIZE)
    .offset((page - 1) * OFFERS_PAGE_SIZE);
  return { rows, total, page, queue, byStatus: Object.fromEntries(byStatus.map((b) => [b.status, b.n])) as Partial<Record<OfferStatus, number>>, now: Date.now() };
}

export async function getOfferReview(id: number) {
  await requireStaff();
  const db = getDb();
  const [row] = await db
    .select({ offer: partnerOffers, partnerName: sql<string | null>`coalesce(nullif(${partners.tradeName}, ''), ${partners.legalName})`, partnerRef: partners.reference, partnerStatus: partners.status })
    .from(partnerOffers)
    .innerJoin(partners, eq(partners.id, partnerOffers.partnerId))
    .where(eq(partnerOffers.id, id));
  if (!row) return null;
  const o = row.offer;
  const [rooms, brandRows, carRows, history, vehicleCount] = await Promise.all([
    db.select({ id: partnerShowrooms.id, name: partnerShowrooms.name, city: partnerShowrooms.city }).from(partnerShowrooms).where(eq(partnerShowrooms.partnerId, o.partnerId)),
    o.scope.brands.length ? db.select({ slug: brands.slug, name: brands.name }).from(brands).where(inArray(brands.slug, o.scope.brands)) : Promise.resolve([]),
    o.scope.models.length ? db.select({ slug: cars.slug, name: cars.name }).from(cars).where(inArray(cars.slug, o.scope.models)) : Promise.resolve([]),
    db
      .select({ ...historyColumns })
      .from(partnerApprovals)
      .innerJoin(partners, eq(partners.id, partnerApprovals.partnerId))
      .leftJoin(actor, eq(actor.id, partnerApprovals.actorUserId))
      .where(and(eq(partnerApprovals.target, "offer"), eq(partnerApprovals.targetId, id)))
      .orderBy(desc(partnerApprovals.createdAt), desc(partnerApprovals.id)),
    db
      .select({ n: count() })
      .from(partnerVehicles)
      .where(and(eq(partnerVehicles.partnerId, o.partnerId), eq(partnerVehicles.status, "published"), ...(o.scope.vehicleType === "both" ? [] : [eq(partnerVehicles.kind, o.scope.vehicleType)]))),
  ]);
  const brandName = new Map(brandRows.map((b) => [b.slug, b.name]));
  const carName = new Map(carRows.map((c) => [c.slug, c.name]));
  return {
    offer: o,
    partner: { id: o.partnerId, name: row.partnerName ?? row.partnerRef, reference: row.partnerRef, status: row.partnerStatus },
    showrooms: rooms,
    brandNames: o.scope.brands.map((b) => brandName.get(b) ?? b),
    modelNames: o.scope.models.map((m) => carName.get(m) ?? m),
    history,
    liveVehicles: vehicleCount[0]?.n ?? 0,
  };
}
export type OfferReview = NonNullable<Awaited<ReturnType<typeof getOfferReview>>>;

export const CAMPAIGN_VIEWS = ["active", "scheduled", "paused", "expired"] as const;
export type CampaignView = (typeof CAMPAIGN_VIEWS)[number];

/** Approved and paused offers across all dealers, with their date-derived display status. */
export async function listCampaigns(f: { show?: string; q?: string }) {
  await requireStaff();
  const db = getDb();
  const now = new Date();
  const byView: Record<CampaignView, SQL> = {
    active: and(eq(partnerOffers.status, "approved"), lte(partnerOffers.startsAt, now), gte(partnerOffers.endsAt, now))!,
    scheduled: and(eq(partnerOffers.status, "approved"), gt(partnerOffers.startsAt, now))!,
    paused: eq(partnerOffers.status, "paused"),
    expired: and(eq(partnerOffers.status, "approved"), lt(partnerOffers.endsAt, now))!,
  };
  const conds: SQL[] = [isOneOf(CAMPAIGN_VIEWS, f.show) ? byView[f.show] : inArray(partnerOffers.status, ["approved", "paused"])];
  if (f.q) {
    const t = term(f.q);
    conds.push(or(like(partnerOffers.reference, t), like(partnerOffers.title, t), like(partnerOffers.campaignName, t), like(partners.tradeName, t), like(partners.legalName, t))!);
  }
  const [rows, [{ live }], ...counts] = await Promise.all([
    db
      .select(offerListColumns)
      .from(partnerOffers)
      .innerJoin(partners, eq(partners.id, partnerOffers.partnerId))
      .where(and(...conds))
      .orderBy(asc(partnerOffers.startsAt), asc(partnerOffers.id))
      .limit(200),
    // "Active" offers that are actually on the website: the dealership must be approved too.
    db.select({ live: count() }).from(partnerOffers).innerJoin(partners, eq(partners.id, partnerOffers.partnerId)).where(and(byView.active, eq(partners.status, "approved"))),
    ...CAMPAIGN_VIEWS.map((v) => db.select({ n: count() }).from(partnerOffers).where(byView[v])),
  ]);
  const totals = Object.fromEntries(CAMPAIGN_VIEWS.map((v, i) => [v, counts[i][0].n])) as Record<CampaignView, number>;
  const perf = rows.reduce((a, r) => ({ views: a.views + r.views, enquiries: a.enquiries + r.enquiries, conversions: a.conversions + r.conversions }), { views: 0, enquiries: 0, conversions: 0 });
  return { rows, totals, live, perf, now: now.getTime() };
}

/* ── Approval history ───────────────────────────────────────── */

const historyColumns = {
  id: partnerApprovals.id,
  partnerId: partnerApprovals.partnerId,
  target: partnerApprovals.target,
  targetId: partnerApprovals.targetId,
  action: partnerApprovals.action,
  fromStatus: partnerApprovals.fromStatus,
  toStatus: partnerApprovals.toStatus,
  remarks: partnerApprovals.remarks,
  actorSide: partnerApprovals.actorSide,
  actorUserId: partnerApprovals.actorUserId,
  actorName: actor.name,
  createdAt: partnerApprovals.createdAt,
  partnerRef: partners.reference,
  partnerName: sql<string | null>`coalesce(nullif(${partners.tradeName}, ''), ${partners.legalName})`,
};
type HistoryRow = { id: number; partnerId: number; target: ApprovalTarget; targetId: number | null; action: string; fromStatus: string | null; toStatus: string | null; remarks: string | null; actorSide: "dealer" | "admin" | "system"; actorUserId: number | null; actorName: string | null; createdAt: Date; partnerRef: string; partnerName: string | null };

/** Adds the vehicle / offer / document / brand reference each entry is about. */
async function withTargetLabels<T extends HistoryRow>(rows: T[]): Promise<(T & { targetLabel: string | null })[]> {
  const ids = (t: ApprovalTarget) => [...new Set(rows.filter((r) => r.target === t && r.targetId).map((r) => r.targetId!))];
  const db = getDb();
  const [veh, off, docs, brs] = await Promise.all([
    ids("vehicle").length ? db.select({ id: partnerVehicles.id, label: sql<string>`concat(${partnerVehicles.reference}, ' · ', ${partnerVehicles.model}, ' ', ${partnerVehicles.variant})` }).from(partnerVehicles).where(inArray(partnerVehicles.id, ids("vehicle"))) : Promise.resolve([]),
    ids("offer").length ? db.select({ id: partnerOffers.id, label: sql<string>`concat(${partnerOffers.reference}, ' · ', ${partnerOffers.title})` }).from(partnerOffers).where(inArray(partnerOffers.id, ids("offer"))) : Promise.resolve([]),
    ids("document").length ? db.select({ id: partnerFiles.id, kind: partnerFiles.kind }).from(partnerFiles).where(inArray(partnerFiles.id, ids("document"))) : Promise.resolve([]),
    ids("brand").length ? db.select({ id: partnerBrands.id, label: sql<string>`coalesce(${brands.name}, ${partnerBrands.brand})` }).from(partnerBrands).leftJoin(brands, eq(brands.slug, partnerBrands.brand)).where(inArray(partnerBrands.id, ids("brand"))) : Promise.resolve([]),
  ]);
  const label = new Map<string, string>();
  for (const v of veh) label.set(`vehicle:${v.id}`, v.label);
  for (const o of off) label.set(`offer:${o.id}`, o.label);
  for (const d of docs) label.set(`document:${d.id}`, DOC_KIND_LABEL[d.kind as keyof typeof DOC_KIND_LABEL] ?? d.kind);
  for (const b of brs) label.set(`brand:${b.id}`, b.label);
  return rows.map((r) => ({ ...r, targetLabel: r.targetId ? (label.get(`${r.target}:${r.targetId}`) ?? null) : null }));
}

export interface HistoryFilters {
  q?: string;
  partner?: string;
  target?: string;
  action?: string;
  side?: string;
  from?: string;
  to?: string;
  page?: number;
}

const IST_MS = 330 * 60_000;
const istStart = (d: string) => new Date(new Date(`${d}T00:00:00Z`).getTime() - IST_MS);
/** "2026-11-20" and a real calendar day (not "2026-13-45"). */
export const isCalendarDay = (d: string | undefined): d is string => {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
};

function historyWhere(f: HistoryFilters) {
  const conds: SQL[] = [];
  if (f.partner && /^\d+$/.test(f.partner)) conds.push(eq(partnerApprovals.partnerId, Number(f.partner)));
  if (isOneOf(APPROVAL_TARGETS, f.target)) conds.push(eq(partnerApprovals.target, f.target));
  if (f.action && /^[a-z_]{1,30}$/.test(f.action)) conds.push(eq(partnerApprovals.action, f.action));
  if (f.side === "dealer" || f.side === "admin" || f.side === "system") conds.push(eq(partnerApprovals.actorSide, f.side));
  if (isCalendarDay(f.from)) conds.push(gte(partnerApprovals.createdAt, istStart(f.from)));
  if (isCalendarDay(f.to)) conds.push(lt(partnerApprovals.createdAt, new Date(istStart(f.to).getTime() + 86_400_000)));
  if (f.q) {
    const t = term(f.q);
    conds.push(or(like(partnerApprovals.remarks, t), like(partners.reference, t), like(partners.tradeName, t), like(partners.legalName, t), like(actor.name, t), like(partnerApprovals.action, t))!);
  }
  return conds.length ? and(...conds) : undefined;
}

export async function listApprovalHistory(f: HistoryFilters) {
  await requireStaff();
  const db = getDb();
  const w = historyWhere(f);
  const [{ total }] = await db
    .select({ total: count() })
    .from(partnerApprovals)
    .innerJoin(partners, eq(partners.id, partnerApprovals.partnerId))
    .leftJoin(actor, eq(actor.id, partnerApprovals.actorUserId))
    .where(w);
  const page = pageOf(f.page, total, HISTORY_PAGE_SIZE);
  const rows = await db
    .select(historyColumns)
    .from(partnerApprovals)
    .innerJoin(partners, eq(partners.id, partnerApprovals.partnerId))
    .leftJoin(actor, eq(actor.id, partnerApprovals.actorUserId))
    .where(w)
    .orderBy(desc(partnerApprovals.createdAt), desc(partnerApprovals.id))
    .limit(HISTORY_PAGE_SIZE)
    .offset((page - 1) * HISTORY_PAGE_SIZE);
  return { rows: await withTargetLabels(rows), total, page };
}

/** Everything matching the filters, for the CSV download (capped). */
export async function exportApprovalHistory(f: HistoryFilters) {
  await requireStaff();
  const rows = await getDb()
    .select(historyColumns)
    .from(partnerApprovals)
    .innerJoin(partners, eq(partners.id, partnerApprovals.partnerId))
    .leftJoin(actor, eq(actor.id, partnerApprovals.actorUserId))
    .where(historyWhere(f))
    .orderBy(desc(partnerApprovals.createdAt), desc(partnerApprovals.id))
    .limit(20_000);
  return withTargetLabels(rows);
}

export async function historyFilterOptions() {
  await requireStaff();
  const db = getDb();
  const [actions, dealerRows] = await Promise.all([
    db.selectDistinct({ action: partnerApprovals.action }).from(partnerApprovals).orderBy(asc(partnerApprovals.action)),
    db
      .select({ id: partners.id, reference: partners.reference, legalName: partners.legalName, tradeName: partners.tradeName, ownerName: owner.name })
      .from(partners)
      .innerJoin(owner, eq(owner.id, partners.ownerUserId))
      .orderBy(sql`coalesce(nullif(${partners.tradeName}, ''), nullif(${partners.legalName}, ''), ${owner.name})`)
      .limit(500),
  ]);
  return { actions: actions.map((a) => a.action), dealers: dealerRows.map((d) => ({ value: String(d.id), label: `${partnerName(d)} · ${d.reference}` })) };
}
