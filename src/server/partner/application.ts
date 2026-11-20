import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { and, desc, eq, gt, gte, inArray, isNull } from "drizzle-orm";
import { getDb, type Database } from "@/db";
import { media, partnerBrands, partnerFiles, partnerOffers, partnerOtps, partnerShowrooms, partnerTestDrives, partnerVehicles } from "@/db/schema";
import type { CatalogData } from "@/lib/catalog";
import { WIZARD_STEPS, emptyApplication, type WizardSlug } from "@/partner/application";
import { PARTNER_EDITABLE, PARTNER_STATUS_LABEL } from "@/partner/labels";
import {
  MEDIA_URL,
  correctionsFor,
  digitsOnly,
  draftSchemas,
  normaliseCode,
  normaliseMobile,
  stepNumber,
  type BankMeta,
  type CatalogLite,
  type DraftOf,
  type FileReview,
  type Section,
  type WizardApplication,
  type WizardBrand,
} from "@/partner/schemas";
import { PATTERNS } from "@/partner/application";
import type { FileRef, PartnerApplication } from "@/partner/types";
import { getCatalog, getCatalogData } from "@/server/catalog";
import { requirePartner, type PartnerRow } from "./context";
import { encryptField, maskAccount } from "./crypto";

/* ──────────────────────────────────────────────────────────────
   Server side of the registration wizard: loading a step for the
   browser (bank number stripped), merging autosaved sections back
   into partners.application (file/media ownership re-checked),
   one-time codes, and materialising showrooms/brands on submit.
   ────────────────────────────────────────────────────────────── */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** No SMS or email provider is configured, so codes are only shown on screen in development. */
export const otpDelivery = (): "screen" | "none" => (process.env.NODE_ENV !== "production" ? "screen" : "none");

export const isEditable = (p: Pick<PartnerRow, "status">) => PARTNER_EDITABLE.includes(p.status);
const clampStep = (n: number) => Math.min(7, Math.max(1, Math.trunc(n) || 1));
export const furthestSlug = (p: Pick<PartnerRow, "step">) => WIZARD_STEPS[clampStep(p.step) - 1].slug;

/* ── Stored JSON ⇄ the wizard's view ────────────────────────── */

function section<S extends Section>(s: S, value: unknown, fallback: DraftOf<S>): DraftOf<S> {
  const r = draftSchemas[s].safeParse(value ?? fallback);
  return (r.success ? r.data : fallback) as DraftOf<S>;
}

/** The application as the browser may see it: no account number, defaults filled in. */
export function toWizard(stored: PartnerApplication): { app: WizardApplication; bank: BankMeta } {
  const empty = emptyApplication({ fullName: stored.personal?.fullName ?? "", email: stored.personal?.email ?? "", mobile: stored.personal?.mobile ?? "" });
  const account = stored.bank?.accountNumber ?? "";
  const app: WizardApplication = {
    personal: section("personal", stored.personal, { ...empty.personal }),
    business: section("business", stored.business, { ...empty.business }),
    showrooms: section("showrooms", stored.showrooms, []),
    brands: section("brands", stored.brands, { mode: "", items: [] }),
    documents: section("documents", stored.documents, { ...empty.documents, brand_authorization: null, cancelled_cheque: null, pan: null, gst: null, registration: null, identity: null, address: null }),
    bank: section("bank", { ...stored.bank, accountNumber: "", accountNumberConfirm: "" }, { ...empty.bank, accountNumber: "", accountNumberConfirm: "" }),
    declaration: { ...section("declaration", stored.declaration, { acceptedTerms: false, declared: false, signedName: "" }), signedAt: stored.declaration?.signedAt ?? null },
  };
  return { app, bank: { hasAccount: Boolean(account), masked: account ? maskAccount(account) : "" } };
}

/** Columns kept in step with the application for admin lists and search. */
export function denormalise(app: PartnerApplication) {
  const room = app.showrooms.find((s) => s.isPrimary) ?? app.showrooms[0];
  const cut = (v: string | undefined, n: number) => (v?.trim() ? v.trim().slice(0, n) : null);
  return {
    legalName: cut(app.business.legalName, 200),
    tradeName: cut(app.business.tradeName, 200),
    city: cut(room?.city, 64),
    state: cut(room?.state, 64),
    gst: cut(app.business.gst, 20),
  };
}

/* ── Ownership checks for files and images ──────────────────── */

const DOC_SLOTS = ["pan", "gst", "registration", "identity", "address", "brand_authorization"] as const;

function collectRefs(s: Section, d: unknown): { files: number[]; media: number[] } {
  const files: number[] = [];
  const mediaIds: number[] = [];
  const img = (url: string) => {
    const m = MEDIA_URL.exec(url);
    if (m) mediaIds.push(Number(m[1]));
  };
  if (s === "personal") img((d as DraftOf<"personal">).photo);
  if (s === "showrooms") (d as DraftOf<"showrooms">).forEach((r) => r.photos.forEach(img));
  if (s === "brands") (d as DraftOf<"brands">).items.forEach((i) => i.certificate && files.push(i.certificate.id));
  if (s === "documents") {
    const docs = d as DraftOf<"documents">;
    DOC_SLOTS.forEach((k) => docs[k] && files.push(docs[k]!.id));
    docs.supporting.forEach((f) => files.push(f.id));
  }
  if (s === "bank") {
    const b = d as DraftOf<"bank">;
    if (b.cheque) files.push(b.cheque.id);
  }
  return { files, media: mediaIds };
}

/** Replaces client-sent file refs with the partner's own rows (right kind only) and drops images it doesn't own. */
export async function sanitise<S extends Section>(partnerId: number, s: S, data: DraftOf<S>): Promise<DraftOf<S>> {
  const refs = collectRefs(s, data);
  const db = getDb();
  const [fileRows, mediaRows] = await Promise.all([
    refs.files.length
      ? db
          .select({ id: partnerFiles.id, kind: partnerFiles.kind, filename: partnerFiles.filename, mime: partnerFiles.mime, size: partnerFiles.size })
          .from(partnerFiles)
          .where(and(eq(partnerFiles.partnerId, partnerId), inArray(partnerFiles.id, refs.files)))
      : Promise.resolve([]),
    refs.media.length ? db.select({ id: media.id }).from(media).where(and(eq(media.partnerId, partnerId), inArray(media.id, refs.media))) : Promise.resolve([]),
  ]);
  const files = new Map(fileRows.map((f) => [f.id, f]));
  const owned = new Set(mediaRows.map((m) => m.id));
  const file = (ref: FileRef | null | undefined, kind: string): FileRef | null => {
    const row = ref ? files.get(ref.id) : undefined;
    return row && row.kind === kind ? { id: row.id, filename: row.filename, mime: row.mime, size: row.size } : null;
  };
  const image = (url: string) => {
    const m = MEDIA_URL.exec(url);
    return m && owned.has(Number(m[1])) ? url : "";
  };

  switch (s) {
    case "personal": {
      const p = data as DraftOf<"personal">;
      return { ...p, photo: p.photo ? image(p.photo) : "" } as DraftOf<S>;
    }
    case "showrooms": {
      const seen = new Set<string>();
      const list = (data as DraftOf<"showrooms">).map((r) => {
        let key = r.key;
        while (seen.has(key)) key = `${r.key}-${seen.size}`;
        seen.add(key);
        return { ...r, key, photos: r.photos.map(image).filter(Boolean) };
      });
      return list as DraftOf<S>;
    }
    case "brands": {
      const b = data as DraftOf<"brands">;
      return { ...b, items: b.items.map((i) => ({ ...i, certificate: file(i.certificate, "brand_authorization") })) } as DraftOf<S>;
    }
    case "documents": {
      const d = data as DraftOf<"documents">;
      const out = { ...d } as DraftOf<"documents">;
      DOC_SLOTS.forEach((k) => (out[k] = file(d[k], k)));
      out.supporting = d.supporting.map((f) => file(f, "supporting")).filter((f): f is FileRef => f !== null);
      return out as DraftOf<S>;
    }
    case "bank": {
      const b = data as DraftOf<"bank">;
      return { ...b, cheque: file(b.cheque, "cancelled_cheque") } as DraftOf<S>;
    }
    default:
      return data;
  }
}

/* ── Merging an autosaved section ───────────────────────────── */

/** Puts one section back into the stored document. Server-controlled fields (verification, signature time, encrypted account) are protected. */
export function mergeSection<S extends Section>(stored: PartnerApplication, s: S, data: DraftOf<S>): { app: PartnerApplication; accountSaved: boolean } {
  const app: PartnerApplication = structuredClone(stored);
  let accountSaved = false;
  switch (s) {
    case "personal": {
      const p = data as DraftOf<"personal">;
      const sameMobile = normaliseMobile(p.mobile) === normaliseMobile(stored.personal.mobile);
      const sameEmail = p.email.trim().toLowerCase() === stored.personal.email.trim().toLowerCase();
      app.personal = {
        fullName: p.fullName,
        designation: p.designation,
        mobile: p.mobile.trim(),
        mobileVerified: sameMobile && stored.personal.mobileVerified,
        email: p.email.trim(),
        emailVerified: sameEmail && stored.personal.emailVerified,
        photo: p.photo,
        authorizedContact: { ...p.authorizedContact },
      };
      break;
    }
    case "business": {
      const b = data as DraftOf<"business">;
      app.business = { ...b, gst: normaliseCode(b.gst), pan: normaliseCode(b.pan) };
      break;
    }
    case "showrooms":
      app.showrooms = (data as DraftOf<"showrooms">).map((r) => ({ ...r, pin: digitsOnly(r.pin) }));
      break;
    case "brands": {
      const b = data as DraftOf<"brands">;
      app.brands = { mode: b.mode, items: b.items as WizardBrand[] };
      break;
    }
    case "documents": {
      const d = data as DraftOf<"documents">;
      app.documents = { ...d, cancelled_cheque: stored.bank?.cheque ?? null };
      break;
    }
    case "bank": {
      const b = data as DraftOf<"bank">;
      const typed = digitsOnly(b.accountNumber);
      let accountNumber = stored.bank?.accountNumber ?? "";
      if (PATTERNS.account.test(typed) && typed === digitsOnly(b.accountNumberConfirm)) {
        accountNumber = encryptField(typed);
        accountSaved = true;
      }
      app.bank = { holder: b.holder, bankName: b.bankName, accountNumber, ifsc: normaliseCode(b.ifsc), branch: b.branch, cheque: b.cheque };
      app.documents = { ...app.documents, cancelled_cheque: b.cheque };
      break;
    }
    case "declaration": {
      const d = data as DraftOf<"declaration">;
      app.declaration = { ...d, signedAt: stored.declaration?.signedAt ?? null };
      break;
    }
  }
  return { app, accountSaved };
}

/* ── Catalogue for brand checks and the brand picker ────────── */

export async function catalogLite(): Promise<CatalogLite> {
  const c = await getCatalog();
  return {
    brands: c.brands.map((b) => ({ slug: b.slug, name: b.name })),
    cars: c.cars.map((car) => ({ slug: car.slug, brand: car.brand, name: car.name, variants: car.variants.map((v) => ({ slug: v.slug, name: v.name })) })),
  };
}

/** The catalogue without the editorial and listings data the wizard doesn't use — for <CatalogProvider>. */
export async function wizardCatalogData(): Promise<CatalogData> {
  const d = await getCatalogData();
  return { ...d, upcoming: [], dealers: [], dealerProfiles: {}, dealerReviews: [], usedCars: [], authors: d.authors.slice(0, 1), articles: [], ownerReviews: [] };
}

/* ── File review states (after staff checked documents) ─────── */

export function referencedFiles(app: WizardApplication): FileRef[] {
  const out: FileRef[] = [];
  DOC_SLOTS.forEach((k) => app.documents[k] && out.push(app.documents[k]!));
  out.push(...app.documents.supporting);
  app.brands.items.forEach((i) => i.certificate && out.push(i.certificate));
  if (app.bank.cheque) out.push(app.bank.cheque);
  return out;
}

export async function fileReviews(partnerId: number, ids: number[]): Promise<Record<number, FileReview>> {
  if (!ids.length) return {};
  const rows = await getDb()
    .select({ id: partnerFiles.id, status: partnerFiles.status, remarks: partnerFiles.remarks })
    .from(partnerFiles)
    .where(and(eq(partnerFiles.partnerId, partnerId), inArray(partnerFiles.id, ids)));
  return Object.fromEntries(rows.map((r) => [r.id, { status: r.status, remarks: r.remarks }]));
}

/* ── Loading a wizard step (pages) ──────────────────────────── */

export async function loadWizard(slug: WizardSlug) {
  const ctx = await requirePartner({ approved: false, next: `/dealer/register/${slug}` });
  const { partner } = ctx;
  if (!isEditable(partner) || !ctx.can("profile.manage")) redirect("/dealer/application-status");
  const furthest = clampStep(partner.step);
  if (stepNumber(slug) > furthest) redirect(`/dealer/register/${furthestSlug(partner)}`);

  const { app, bank } = toWizard(partner.application);
  const reviews = await fileReviews(
    partner.id,
    referencedFiles(app).map((f) => f.id),
  );
  const resubmission = partner.status !== "draft";
  return {
    ctx,
    props: {
      slug,
      reference: partner.reference,
      status: partner.status,
      statusLabel: PARTNER_STATUS_LABEL[partner.status],
      resubmission,
      furthest,
      app,
      bank,
      otp: otpDelivery(),
      savedAt: partner.updatedAt.toISOString(),
      remarks: resubmission ? (partner.adminRemarks ?? null) : null,
      corrections: resubmission ? correctionsFor(partner.requiredCorrections, partner.status) : [],
      reviews,
      /** For the e-signature line, in IST. */
      today: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }),
    },
  };
}

export type WizardProps = Awaited<ReturnType<typeof loadWizard>>["props"];

/* ── One-time codes (mobile / email verification) ───────────── */

const OTP_TTL = 10 * 60_000;
const OTP_ATTEMPTS = 5;
const RESEND_AFTER = 45_000;
const MAX_PER_HOUR = 5;

const hashCode = (userId: number, channel: string, target: string, code: string) => createHash("sha256").update(`${userId}:${channel}:${target}:${code}`).digest("hex");

export async function issueOtp(userId: number, channel: "mobile" | "email", target: string) {
  const db = getDb();
  const now = Date.now();
  const recent = await db
    .select({ createdAt: partnerOtps.createdAt })
    .from(partnerOtps)
    .where(and(eq(partnerOtps.userId, userId), eq(partnerOtps.channel, channel), gte(partnerOtps.createdAt, new Date(now - 3_600_000))))
    .orderBy(desc(partnerOtps.createdAt));
  const last = recent[0]?.createdAt.getTime();
  if (last && now - last < RESEND_AFTER) {
    const wait = Math.ceil((RESEND_AFTER - (now - last)) / 1000);
    return { ok: false as const, error: `Please wait ${wait}s before requesting another code.`, retryIn: wait };
  }
  if (recent.length >= MAX_PER_HOUR) return { ok: false as const, error: "You've requested 5 codes in the last hour. Please try again a little later." };

  // Only the newest code works.
  await db
    .update(partnerOtps)
    .set({ expiresAt: new Date(now) })
    .where(and(eq(partnerOtps.userId, userId), eq(partnerOtps.channel, channel), isNull(partnerOtps.consumedAt), gt(partnerOtps.expiresAt, new Date(now))));
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(now + OTP_TTL);
  await db.insert(partnerOtps).values({ userId, channel, target, codeHash: hashCode(userId, channel, target, code), expiresAt });
  return { ok: true as const, code, expiresAt, resendAt: new Date(now + RESEND_AFTER) };
}

export async function checkOtp(userId: number, channel: "mobile" | "email", code: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(partnerOtps)
    .where(and(eq(partnerOtps.userId, userId), eq(partnerOtps.channel, channel), isNull(partnerOtps.consumedAt)))
    .orderBy(desc(partnerOtps.id))
    .limit(1);
  if (!row || row.expiresAt.getTime() <= Date.now()) return { ok: false as const, error: "This code has expired. Request a new one." };
  if (row.attempts >= OTP_ATTEMPTS) return { ok: false as const, error: "Too many incorrect attempts. Request a new code." };
  const expected = Buffer.from(row.codeHash, "hex");
  const given = Buffer.from(hashCode(userId, channel, row.target, code), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    const used = row.attempts + 1;
    await db.update(partnerOtps).set({ attempts: used }).where(eq(partnerOtps.id, row.id));
    const left = OTP_ATTEMPTS - used;
    return { ok: false as const, error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "attempt" : "attempts"} left.` : "Too many incorrect attempts. Request a new code." };
  }
  await db.update(partnerOtps).set({ consumedAt: new Date() }).where(eq(partnerOtps.id, row.id));
  return { ok: true as const, target: row.target };
}

/* ── Submit: application JSON → partner_showrooms / partner_brands ── */

/**
 * Showrooms are matched by key (= partner_showrooms.id once materialised) and updated in place,
 * so vehicles, test drives and offers that point at a branch keep pointing at it. A branch removed
 * from the application is deleted only when nothing references it; otherwise it's deactivated.
 * Brands are matched by slug; an approved authorisation stays approved unless its details changed.
 */
export async function materialise(tx: Tx, partnerId: number, app: PartnerApplication): Promise<PartnerApplication> {
  const rooms = await tx.select().from(partnerShowrooms).where(eq(partnerShowrooms.partnerId, partnerId));
  const byKey = new Map(rooms.map((r) => [String(r.id), r]));
  const keyToId = new Map<string, number>();

  for (const s of app.showrooms) {
    const values = {
      name: s.name.trim().slice(0, 160),
      address: s.address.trim().slice(0, 300),
      state: s.state.slice(0, 64),
      district: s.district.trim().slice(0, 64),
      city: s.city.trim().slice(0, 64),
      pin: digitsOnly(s.pin).slice(0, 6),
      lat: s.lat,
      lng: s.lng,
      phone: s.phone.trim() ? s.phone.trim().slice(0, 30) : null,
      hours: s.hours,
      photos: s.photos,
      serviceCentre: s.serviceCentre,
      isPrimary: s.isPrimary,
      isActive: true,
    };
    const existing = byKey.get(s.key);
    if (existing) {
      await tx
        .update(partnerShowrooms)
        .set(values)
        .where(and(eq(partnerShowrooms.id, existing.id), eq(partnerShowrooms.partnerId, partnerId)));
      keyToId.set(s.key, existing.id);
    } else {
      const [res] = await tx.insert(partnerShowrooms).values({ partnerId, ...values });
      keyToId.set(s.key, res.insertId);
    }
  }

  const kept = new Set(keyToId.values());
  const removed = rooms.filter((r) => !kept.has(r.id)).map((r) => r.id);
  if (removed.length) {
    const [vehicles, drives, offers] = await Promise.all([
      tx.selectDistinct({ id: partnerVehicles.showroomId }).from(partnerVehicles).where(and(eq(partnerVehicles.partnerId, partnerId), inArray(partnerVehicles.showroomId, removed))),
      tx.selectDistinct({ id: partnerTestDrives.showroomId }).from(partnerTestDrives).where(and(eq(partnerTestDrives.partnerId, partnerId), inArray(partnerTestDrives.showroomId, removed))),
      tx.select({ locations: partnerOffers.locations }).from(partnerOffers).where(eq(partnerOffers.partnerId, partnerId)),
    ]);
    const inUse = new Set<number>([...vehicles, ...drives].map((r) => r.id).filter((id): id is number => id !== null));
    offers.forEach((o) => o.locations?.showroomIds?.forEach((id) => inUse.add(id)));
    const deactivate = removed.filter((id) => inUse.has(id));
    const drop = removed.filter((id) => !inUse.has(id));
    if (deactivate.length)
      await tx
        .update(partnerShowrooms)
        .set({ isActive: false, isPrimary: false })
        .where(and(eq(partnerShowrooms.partnerId, partnerId), inArray(partnerShowrooms.id, deactivate)));
    if (drop.length) await tx.delete(partnerShowrooms).where(and(eq(partnerShowrooms.partnerId, partnerId), inArray(partnerShowrooms.id, drop)));
  }

  const allIds = [...keyToId.values()];
  const brandRows = await tx.select().from(partnerBrands).where(eq(partnerBrands.partnerId, partnerId));
  const items = app.brands.items as WizardBrand[];
  const nextItems: WizardBrand[] = [];
  for (const item of items) {
    const mapped = (item.showroomKeys ?? []).map((k) => keyToId.get(k)).filter((id): id is number => id !== undefined);
    const showroomIds = allIds.length <= 1 || !mapped.length ? allIds : mapped;
    const values = { models: item.models, variants: item.variants, certificate: item.certificate, validUntil: item.validUntil || null, showroomIds };
    const existing = brandRows.find((b) => b.brand === item.brand);
    if (existing) {
      const changed =
        (existing.certificate?.id ?? null) !== (item.certificate?.id ?? null) ||
        (existing.validUntil ?? null) !== values.validUntil ||
        JSON.stringify(existing.models) !== JSON.stringify(item.models) ||
        JSON.stringify(existing.variants) !== JSON.stringify(item.variants);
      await tx
        .update(partnerBrands)
        .set({ ...values, ...(changed || existing.status !== "approved" ? { status: "pending" as const, remarks: changed ? null : existing.remarks } : {}) })
        .where(and(eq(partnerBrands.id, existing.id), eq(partnerBrands.partnerId, partnerId)));
    } else {
      await tx.insert(partnerBrands).values({ partnerId, brand: item.brand, status: "pending", ...values });
    }
    nextItems.push({ ...item, showroomKeys: showroomIds.map(String) });
  }
  const gone = brandRows.filter((b) => !items.some((i) => i.brand === b.brand));
  if (gone.length) {
    const used = await tx
      .selectDistinct({ brand: partnerVehicles.brand })
      .from(partnerVehicles)
      .where(
        and(
          eq(partnerVehicles.partnerId, partnerId),
          inArray(
            partnerVehicles.brand,
            gone.map((b) => b.brand),
          ),
        ),
      );
    const keep = new Set(used.map((u) => u.brand));
    const drop = gone.filter((b) => !keep.has(b.brand)).map((b) => b.id);
    if (drop.length) await tx.delete(partnerBrands).where(and(eq(partnerBrands.partnerId, partnerId), inArray(partnerBrands.id, drop)));
  }

  return {
    ...app,
    showrooms: app.showrooms.map((s) => ({ ...s, key: String(keyToId.get(s.key) ?? s.key) })),
    brands: { mode: app.brands.mode, items: nextItems },
  };
}
