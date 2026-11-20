/**
 * A clearly-labelled sample dealership for exploring the dealer partner portal (/dealer).
 *
 *   npm run db:seed-demo               create "Sample Motors (demo)" — does nothing if it already exists
 *   npm run db:seed-demo -- --reset    delete it and create it again
 *   npm run db:seed-demo -- --remove   delete it and everything it created
 *
 * Owner login: DEMO_DEALER_EMAIL (default demo-dealer@marchgear.in) / DEMO_DEALER_PASSWORD from .env.local.
 * When the password isn't set, a strong one is generated and written to .env.local (never printed).
 *
 * ⚠ Demo data only — never run this against the live database.
 */
import Module from "node:module";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { jsPDF } from "jspdf";
import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import type { Pool, ResultSetHeader } from "mysql2/promise";
import { closeDb, getDb, type Database } from "./index";
import * as s from "./schema";
import type { CrmStatus, LeadEventKind, LeadSource, OfferStatus, PartnerRole, PartnerVehicleStatus, TestDriveStatus } from "./enums";
import { IMG } from "@/data/images";
import { CRM_STATUS_LABEL, LEAD_SOURCE_LABEL } from "@/partner/labels";
import { formatIstDateTime } from "@/components/portal/crm/pipeline";
import type { DayHours, OfferDiscount, OfferLocations, OfferMedia, OfferScope, PartnerApplication, PartnerProfile, UsedVehicleDetails } from "@/partner/types";
import type { BodyType, FuelType, Transmission } from "@/types";

/* ── Run server modules outside Next.js ─────────────────────────
   The public-sync helpers are server modules: they import the
   "server-only" marker and expire Next's data cache. Neither exists
   in a script, so both are stubbed before those modules load. */
type Loader = (request: string, parent: unknown, isMain: boolean) => unknown;
const mod = Module as unknown as { _load: Loader };
const load = mod._load;
mod._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "next/cache")
    return { revalidateTag() {}, revalidatePath() {}, updateTag() {}, refresh() {}, unstable_noStore() {}, unstable_cache: <T,>(fn: T) => fn, cacheTag() {}, cacheLife() {} };
  return load.call(this, request, parent, isMain);
};

/* ── Constants ──────────────────────────────────────────────── */

const TRADE_NAME = "Sample Motors (demo)";
const LEGAL_NAME = "Sample Motors Private Limited (demo data)";
const CITY = "Visakhapatnam";
const STATE = "Andhra Pradesh";
const args = process.argv.slice(2);
const RESET = args.includes("--reset");
const REMOVE = args.includes("--remove");

const db = getDb();
const pool = () => (db as Database & { $client: Pool }).$client;
const log = (msg: string) => console.log(`  ${msg}`);

/* ── Deterministic randomness & IST dates ───────────────────── */

let seed = 20261120;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];

const NOW = new Date();
const DAY_MS = 86_400_000;
const IST_MS = 5.5 * 3_600_000;
/** IST calendar day, n days from today. */
const istDay = (offset = 0) => new Date(NOW.getTime() + IST_MS + offset * DAY_MS).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const addMonths = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
};
/** An instant at IST hh:mm, `offset` days from today. */
const at = (offset: number, hh: number, mm = 0) => new Date(`${istDay(offset)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`);
/** Never later than a few minutes ago (for things that already happened). */
const past = (d: Date) => new Date(Math.min(d.getTime(), NOW.getTime() - 5 * 60_000));
const plusMin = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = (n = 6) => Array.from({ length: n }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join("");
const usedRefs = new Set<string>();
async function freshRef(prefix: string, table: "partners" | "partner_vehicles" | "partner_offers" | "partner_leads" | "partner_test_drives" | "partner_tickets" | "leads") {
  for (;;) {
    const ref = `${prefix}-${code()}`;
    if (usedRefs.has(ref)) continue;
    const [rows] = await pool().query(`SELECT 1 FROM \`${table}\` WHERE reference = ? LIMIT 1`, [ref]);
    if (!(rows as unknown[]).length) {
      usedRefs.add(ref);
      return ref;
    }
  }
}

/* ── Credentials (.env.local) ───────────────────────────────── */

function credentials() {
  const email = (process.env.DEMO_DEALER_EMAIL?.trim() || "demo-dealer@marchgear.in").toLowerCase();
  let password = process.env.DEMO_DEALER_PASSWORD ?? "";
  let generated = false;
  if (!password) {
    password = `Mg-${randomBytes(18).toString("base64url")}`;
    generated = true;
    const file = path.resolve(process.cwd(), ".env.local");
    let text = existsSync(file) ? readFileSync(file, "utf8") : "";
    const setVar = (key: string, value: string) => {
      const re = new RegExp(`^${key}=.*$`, "m");
      if (re.test(text)) text = text.replace(re, `${key}=${value}`);
      else text += `${text.endsWith("\n") || !text ? "" : "\n"}${key}=${value}\n`;
    };
    if (!/^DEMO_DEALER_EMAIL=/m.test(text) && !/^DEMO_DEALER_PASSWORD=/m.test(text))
      text += `${text.endsWith("\n") || !text ? "" : "\n"}\n# Demo dealership owner login (npm run db:seed-demo). Local/dev databases only.\n`;
    setVar("DEMO_DEALER_EMAIL", email);
    setVar("DEMO_DEALER_PASSWORD", password);
    writeFileSync(file, text);
  }
  return { email, password, generated };
}

/** demo-dealer@marchgear.in → demo-dealer+kiran@marchgear.in */
const staffEmail = (owner: string, tag: string) => owner.replace("@", `+${tag}@`);

/* ── Finding & removing the demo ────────────────────────────── */

async function findDemo(email: string) {
  const rows = await db
    .select({ id: s.partners.id, reference: s.partners.reference, publicDealerId: s.partners.publicDealerId })
    .from(s.partners)
    .leftJoin(s.users, eq(s.users.id, s.partners.ownerUserId))
    .where(or(eq(s.partners.tradeName, TRADE_NAME), eq(s.users.email, email)));
  return rows;
}

async function removePartner(p: { id: number; reference: string; publicDealerId: string | null }) {
  const [vehicles, members, siteLeads] = await Promise.all([
    db.select({ id: s.partnerVehicles.id, mirror: s.partnerVehicles.publicUsedCarId }).from(s.partnerVehicles).where(eq(s.partnerVehicles.partnerId, p.id)),
    db.select({ userId: s.partnerMembers.userId }).from(s.partnerMembers).where(eq(s.partnerMembers.partnerId, p.id)),
    db.select({ id: s.partnerLeads.siteLeadId }).from(s.partnerLeads).where(and(eq(s.partnerLeads.partnerId, p.id), isNotNull(s.partnerLeads.siteLeadId))),
  ]);
  const [owner] = await db.select({ id: s.partners.ownerUserId }).from(s.partners).where(eq(s.partners.id, p.id));
  const mirrors = [...new Set([...vehicles.map((v) => `pv-${v.id}`), ...vehicles.map((v) => v.mirror).filter((m): m is string => Boolean(m))])];
  const userIds = [...new Set([...members.map((m) => m.userId), ...(owner ? [owner.id] : [])])];
  const leadIds = siteLeads.map((l) => l.id).filter((id): id is number => id !== null);

  // Website leads about the demo dealer (its page or its mirrored used cars), including ones not routed to the CRM.
  const leadConds = [
    leadIds.length ? inArray(s.leads.id, leadIds) : undefined,
    p.publicDealerId ? eq(s.leads.dealerId, p.publicDealerId) : undefined,
    mirrors.length ? inArray(s.leads.usedCarId, mirrors) : undefined,
  ].filter((c) => c !== undefined);
  const [leadRes] = leadConds.length ? await db.delete(s.leads).where(or(...leadConds)) : [{ affectedRows: 0 }];
  const [mirrorRes] = mirrors.length ? await db.delete(s.usedCars).where(inArray(s.usedCars.id, mirrors)) : [{ affectedRows: 0 }];
  await db.delete(s.media).where(eq(s.media.partnerId, p.id));
  await db.delete(s.partners).where(eq(s.partners.id, p.id)); // cascades to every partner_* table
  if (p.publicDealerId) await db.delete(s.dealers).where(eq(s.dealers.id, p.publicDealerId)); // and its reviews
  if (userIds.length) {
    // Only dealer logins that no other dealership uses.
    const elsewhere = await db.select({ userId: s.partnerMembers.userId }).from(s.partnerMembers).where(inArray(s.partnerMembers.userId, userIds));
    const keep = new Set(elsewhere.map((e) => e.userId));
    const drop = userIds.filter((id) => !keep.has(id));
    if (drop.length) await db.delete(s.users).where(and(inArray(s.users.id, drop), eq(s.users.role, "dealer")));
  }
  log(`✓ removed ${p.reference}: ${vehicles.length} vehicles, ${mirrorRes.affectedRows} used-car listings, ${userIds.length} logins, ${leadRes.affectedRows} website leads, public page ${p.publicDealerId ?? "—"}`);
}

/* ── Images & documents ─────────────────────────────────────── */

function jpegSize(b: Buffer): { width: number | null; height: number | null } {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return { width: null, height: null };
}

/** Downloads a catalogue photo (src/data/images.ts or a model's gallery) into the dealer's media library, so the portal treats it as their own upload. */
async function makeMediaFactory(partnerId: number, userId: number) {
  const cache = new Map<string, string>();
  let failures = 0;
  return {
    async image(src: string, name: string, alt: string): Promise<string> {
      const hit = cache.get(src);
      if (hit) return hit;
      let url = src;
      try {
        const res = await fetch(`${src}?fm=jpg&fit=crop&w=1280&h=800&q=72`, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = Buffer.from(await res.arrayBuffer());
        if (data[0] !== 0xff || data[1] !== 0xd8 || data.length > 900 * 1024) throw new Error("not a small JPEG");
        const { width, height } = jpegSize(data);
        const filename = `${name.replace(/[^\w-]+/g, "-").slice(0, 70)}.jpg`;
        const [r] = await pool().execute<ResultSetHeader>(
          "INSERT INTO `media` (`filename`, `mime`, `size`, `width`, `height`, `alt`, `data`, `created_by`, `partner_id`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [filename, "image/jpeg", data.length, width, height, alt.slice(0, 300), data, userId, partnerId],
        );
        url = `/media/${r.insertId}/${filename}`;
      } catch (err) {
        failures++;
        if (failures === 1) log(`! couldn't download ${src} (${(err as Error).message}) — using the remote URL; editing that item will ask for a fresh upload`);
      }
      cache.set(src, url);
      return url;
    },
    get failures() {
      return failures;
    },
  };
}

/** A one-page placeholder PDF, clearly marked as demo data. */
function demoPdf(title: string, lines: string[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold").setFontSize(20).text("DEMO DATA — NOT A REAL DOCUMENT", 56, 80);
  doc.setFont("helvetica", "normal").setFontSize(14).text(title, 56, 120);
  doc.setFontSize(11);
  lines.forEach((l, i) => doc.text(l, 56, 160 + i * 18));
  doc.setTextColor(150).text("Generated by npm run db:seed-demo for exploring the MarchGear dealer portal.", 56, 780);
  return Buffer.from(doc.output("arraybuffer"));
}

async function saveFile(partnerId: number, userId: number, kind: string, filename: string, data: Buffer, createdAt: Date) {
  const [r] = await pool().execute<ResultSetHeader>(
    "INSERT INTO `partner_files` (`partner_id`, `kind`, `filename`, `mime`, `size`, `data`, `status`, `uploaded_by`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, 'verified', ?, ?)",
    [partnerId, kind, filename, "application/pdf", data.length, data, userId, createdAt.toISOString().slice(0, 19).replace("T", " ")],
  );
  return { id: r.insertId, filename, mime: "application/pdf", size: data.length };
}

/* ── Catalogue ──────────────────────────────────────────────── */

type CarRow = typeof s.cars.$inferSelect;
type VariantRow = typeof s.variants.$inferSelect;

async function catalogue() {
  const cars = await db.select().from(s.cars).where(inArray(s.cars.brand, ["hyundai", "tata", "mahindra", "maruti-suzuki"]));
  const variants = await db.select().from(s.variants).where(inArray(s.variants.carId, cars.length ? cars.map((c) => c.id) : [0]));
  const brands = await db.select({ slug: s.brands.slug, name: s.brands.name }).from(s.brands);
  const car = (slug: string) => {
    const c = cars.find((x) => x.slug === slug);
    if (!c) throw new Error(`The catalogue has no ${slug} — run npm run db:seed first.`);
    return c;
  };
  const variant = (carSlug: string, slug: string) => {
    const c = car(carSlug);
    const v = variants.find((x) => x.carId === c.id && x.slug === slug);
    if (!v) throw new Error(`The catalogue has no ${carSlug}/${slug} — run npm run db:seed first.`);
    return v;
  };
  const variantsOf = (carSlug: string) => variants.filter((v) => v.carId === car(carSlug).id);
  const brandName = (slug: string) => brands.find((b) => b.slug === slug)?.name ?? slug;
  return { car, variant, variantsOf, brandName };
}

/* ── People ─────────────────────────────────────────────────── */

const OWNER = { name: "Ramesh Chandra Varma", designation: "Managing Director", mobile: "9876500101" };
const STAFF: { key: string; name: string; role: PartnerRole; mobile: string }[] = [
  { key: "kiran", name: "Kiran Kumar Reddy", role: "sales_manager", mobile: "9876500102" },
  { key: "lakshmi", name: "Lakshmi Prasanna", role: "sales_executive", mobile: "9876500103" },
  { key: "saiteja", name: "Sai Teja Naidu", role: "sales_executive", mobile: "9876500104" },
  { key: "harika", name: "Harika Chowdary", role: "marketing_manager", mobile: "9876500105" },
];

const CUSTOMERS = [
  "Venkatesh Pothula", "Swathi Gorle", "Naveen Kumar Bonthu", "Divya Sree Allu", "Srikanth Peddireddy", "Anusha Kolli", "Mahesh Babu Dadi", "Pavani Seepana",
  "Rajesh Gandreti", "Sirisha Varanasi", "Phani Kumar Vadlamani", "Bhavana Ravada", "Chaitanya Mylapalli", "Keerthi Reddy", "Arjun Tammineni", "Sravani Pinninti",
  "Gopi Krishna Mamidi", "Ramya Bhogadi", "Vamsi Krishna Korada", "Tejaswini Pydi", "Hemanth Sanapala", "Deepika Majji", "Suresh Lanka", "Madhavi Chintapalli",
  "Ravi Shankar Velaga", "Harsha Vardhan Boddu", "Yamini Satti", "Prasad Rao Ganta", "Nikhil Varma Datla", "Sowmya Karri", "Kalyan Ram Duvvuri", "Lavanya Bandaru",
  "Ashok Kumar Pilla", "Jyothi Lakshmi Kona", "Vinay Teja Gudla", "Manasa Nallamilli", "Sandeep Ponnada", "Haritha Molleti", "Raghav Simhadri", "Pranitha Uppada",
];
const LOCALITIES = ["MVP Colony", "Madhurawada", "Gajuwaka", "Seethammadhara", "Pendurthi", "Akkayapalem", "Rushikonda", "NAD Junction", "Kommadi", "Dwaraka Nagar", "Anakapalle", "Vizianagaram", "Simhachalam", "Marripalem", "Yendada"];

/* ── Create ─────────────────────────────────────────────────── */

async function createDemo(email: string, password: string) {
  const { syncPartnerEverywhere } = await import("@/server/partner/public-sync");
  const { encryptField } = await import("@/server/partner/crypto");
  const cat = await catalogue();
  const [admin] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.role, "admin")).limit(1);
  const staffId = admin?.id ?? null;

  // Billing calendar: approved ~2 months ago, 30-day trial, one paid month, renewal due in 3 days.
  const renewsAt = istDay(3);
  const paidStart = addMonths(renewsAt, -1);
  const approvedDay = addDays(paidStart, -30);
  const approvedOffset = Math.round((Date.parse(`${approvedDay}T00:00:00Z`) - Date.parse(`${istDay()}T00:00:00Z`)) / DAY_MS);
  const approvedAt = at(approvedOffset, 16, 20);
  const createdAt = at(approvedOffset - 12, 11, 5);
  const firstSubmit = at(approvedOffset - 9, 18, 40);
  const resubmit = at(approvedOffset - 3, 12, 15);

  /* Owner login + staff */
  const [taken] = await db.select({ id: s.users.id, role: s.users.role }).from(s.users).where(eq(s.users.email, email));
  if (taken) {
    const [member] = await db.select({ id: s.partnerMembers.id }).from(s.partnerMembers).where(eq(s.partnerMembers.userId, taken.id)).limit(1);
    if (taken.role !== "dealer" || member) throw new Error(`${email} is already used by another account — set DEMO_DEALER_EMAIL to a different address.`);
    await db.delete(s.users).where(eq(s.users.id, taken.id));
  }
  const unusable = () => bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const [ownerRes] = await db.insert(s.users).values({ name: OWNER.name, email, phone: OWNER.mobile, city: CITY, role: "dealer", passwordHash: await bcrypt.hash(password, 12), createdAt, lastLoginAt: past(at(0, 9, 12)) });
  const ownerId = ownerRes.insertId;

  /* Partner (application filled in below, once showrooms and files exist) */
  const reference = await freshRef("DLR", "partners");
  const [pRes] = await db.insert(s.partners).values({
    reference,
    ownerUserId: ownerId,
    status: "draft",
    application: {} as PartnerApplication,
    step: 1,
    createdAt,
  });
  const pid = pRes.insertId;
  const mediaFor = await makeMediaFactory(pid, ownerId);
  log(`✓ partner ${reference} (#${pid}) for ${email}`);

  const members: Record<string, { memberId: number; userId: number; name: string }> = {};
  const [ownerMember] = await db.insert(s.partnerMembers).values({ partnerId: pid, userId: ownerId, role: "owner", createdAt });
  members.owner = { memberId: ownerMember.insertId, userId: ownerId, name: OWNER.name };
  for (const [i, m] of STAFF.entries()) {
    const added = at(approvedOffset + 1 + i, 11, 30);
    const staffMail = staffEmail(email, m.key);
    await db.delete(s.users).where(and(eq(s.users.email, staffMail), eq(s.users.role, "dealer")));
    const [u] = await db.insert(s.users).values({ name: m.name, email: staffMail, phone: m.mobile, city: CITY, role: "dealer", passwordHash: await unusable(), createdAt: added });
    const [mm] = await db.insert(s.partnerMembers).values({ partnerId: pid, userId: u.insertId, role: m.role, createdAt: added });
    members[m.key] = { memberId: mm.insertId, userId: u.insertId, name: m.name };
  }
  log(`✓ owner + ${STAFF.length} staff (staff have unusable passwords — reset one from Staff to sign in as them)`);

  /* Showrooms */
  const weekHours = (sunday: DayHours | null): DayHours[] =>
    (["mon", "tue", "wed", "thu", "fri", "sat"] as const).map((day) => ({ day, open: "09:30", close: "20:00", closed: false } as DayHours)).concat(sunday ?? { day: "sun", open: "10:00", close: "14:00", closed: true });
  const primaryHours = weekHours({ day: "sun", open: "10:00", close: "14:00", closed: false });
  const branchHours = weekHours(null);
  const rooms = [
    {
      name: "Sample Motors — Dwaraka Nagar",
      address: "47-10-21, Dwaraka Nagar Main Road, near Diamond Park",
      district: "Visakhapatnam",
      pin: "530016",
      lat: 17.7287,
      lng: 83.3049,
      phone: "08912745600",
      hours: primaryHours,
      photos: [await mediaFor.image(IMG.showroomRed, "dwaraka-nagar-showroom", "Sample Motors Dwaraka Nagar showroom floor"), await mediaFor.image(IMG.showroomGallery, "dwaraka-nagar-display", "Display cars at Dwaraka Nagar")],
      serviceCentre: false,
      isPrimary: true,
    },
    {
      name: "Sample Motors — Gajuwaka",
      address: "Plot 12, NH-16 Service Road, near BHPV Junction",
      district: "Visakhapatnam",
      pin: "530026",
      lat: 17.6868,
      lng: 83.2185,
      phone: "08912517400",
      hours: branchHours,
      photos: [await mediaFor.image(IMG.showroomSpot, "gajuwaka-showroom", "Sample Motors Gajuwaka showroom"), await mediaFor.image(IMG.service, "gajuwaka-service", "Service bays at Gajuwaka")],
      serviceCentre: true,
      isPrimary: false,
    },
  ];
  const roomIds: number[] = [];
  for (const r of rooms) {
    const [res] = await db.insert(s.partnerShowrooms).values({ partnerId: pid, ...r, state: STATE, city: CITY, createdAt: firstSubmit });
    roomIds.push(res.insertId);
  }
  const [primaryRoom, branchRoom] = roomIds;
  log(`✓ 2 showrooms`);

  /* KYC documents (placeholder PDFs, verified) */
  const docAt = at(approvedOffset - 10, 15, 0);
  const files = {
    pan: await saveFile(pid, ownerId, "pan", "pan-card-demo.pdf", demoPdf("PAN card", ["Sample Motors Private Limited (demo data)", "PAN: AAKCS4821M"]), docAt),
    gst: await saveFile(pid, ownerId, "gst", "gst-certificate-demo.pdf", demoPdf("GST registration certificate", ["GSTIN: 37AAKCS4821M1Z5", "Andhra Pradesh"]), docAt),
    registration: await saveFile(pid, ownerId, "registration", "certificate-of-incorporation-demo.pdf", demoPdf("Certificate of incorporation", ["CIN: U50100AP2014PTC093412"]), docAt),
    identity: await saveFile(pid, ownerId, "identity", "director-id-demo.pdf", demoPdf("Identity proof", [OWNER.name, "Managing Director"]), docAt),
    address: await saveFile(pid, ownerId, "address", "address-proof-demo.pdf", demoPdf("Address proof", ["47-10-21, Dwaraka Nagar Main Road", "Visakhapatnam 530016"]), at(approvedOffset - 4, 10, 30)),
    cheque: await saveFile(pid, ownerId, "cancelled_cheque", "cancelled-cheque-demo.pdf", demoPdf("Cancelled cheque", ["HDFC Bank, Dwaraka Nagar branch", "A/c ending 5678"]), docAt),
  };

  /* Brand authorisations (approved, no certificate files) */
  const BRANDS: { brand: string; models: { car: string; variants: "all" | string[] }[]; rooms: number[] }[] = [
    { brand: "hyundai", models: [{ car: "hyundai-creta", variants: "all" }, { car: "hyundai-verna", variants: "all" }, { car: "hyundai-i20", variants: "all" }, { car: "hyundai-creta-electric", variants: "all" }], rooms: roomIds },
    { brand: "tata", models: [{ car: "tata-nexon", variants: "all" }, { car: "tata-nexon-ev", variants: "all" }, { car: "tata-altroz", variants: "all" }], rooms: roomIds },
    { brand: "mahindra", models: [{ car: "mahindra-xuv700", variants: "all" }, { car: "mahindra-xev-9e", variants: "all" }], rooms: [primaryRoom] },
  ];
  const validUntil = `${Number(istDay().slice(0, 4)) + 1}-12-31`;
  const brandItems: (PartnerApplication["brands"]["items"][number] & { showroomKeys: string[] })[] = BRANDS.map((b) => ({
    brand: b.brand,
    models: b.models.map((m) => m.car),
    variants: b.models.flatMap((m) => (m.variants === "all" ? cat.variantsOf(m.car).map((v) => v.slug) : m.variants).map((v) => `${m.car}/${v}`)),
    certificate: null,
    validUntil,
    showroomKeys: b.rooms.map(String),
  }));
  const brandIds: number[] = [];
  for (const [i, b] of brandItems.entries()) {
    const [res] = await db
      .insert(s.partnerBrands)
      .values({ partnerId: pid, brand: b.brand, models: b.models, variants: b.variants, certificate: null, validUntil, status: "approved", showroomIds: BRANDS[i].rooms, createdAt: firstSubmit });
    brandIds.push(res.insertId);
  }
  log(`✓ ${brandItems.length} brand authorisations (${brandItems.map((b) => cat.brandName(b.brand)).join(", ")})`);

  /* Application + profile */
  const application: PartnerApplication & { brands: { items: typeof brandItems } } = {
    personal: {
      fullName: OWNER.name,
      designation: OWNER.designation,
      mobile: OWNER.mobile,
      mobileVerified: true,
      email,
      emailVerified: true,
      photo: "",
      authorizedContact: { name: STAFF[0].name, designation: "Sales Manager", mobile: STAFF[0].mobile, email: staffEmail(email, STAFF[0].key) },
    },
    business: {
      legalName: LEGAL_NAME,
      tradeName: TRADE_NAME,
      businessType: "private_limited",
      gst: "37AAKCS4821M1Z5",
      pan: "AAKCS4821M",
      registrationNumber: "U50100AP2014PTC093412",
      establishedOn: "2014-06-12",
      email,
      phone: "08912745600",
      website: "",
    },
    showrooms: rooms.map((r, i) => ({ key: String(roomIds[i]), name: r.name, address: r.address, state: STATE, district: r.district, city: CITY, pin: r.pin, lat: r.lat, lng: r.lng, phone: r.phone, hours: r.hours, photos: r.photos, serviceCentre: r.serviceCentre, isPrimary: r.isPrimary })),
    brands: { mode: "authorized", items: brandItems },
    documents: { pan: files.pan, gst: files.gst, registration: files.registration, identity: files.identity, address: files.address, brand_authorization: null, cancelled_cheque: files.cheque, supporting: [] },
    bank: { holder: "Sample Motors Private Limited", bankName: "HDFC Bank", accountNumber: encryptField("50200071835678"), ifsc: "HDFC0004321", branch: "Dwaraka Nagar, Visakhapatnam", cheque: files.cheque },
    declaration: { acceptedTerms: true, declared: true, signedName: OWNER.name, signedAt: resubmit.toISOString() },
  };
  const profile: PartnerProfile = {
    description:
      "Sample Motors is a demo dealership created to show how the MarchGear partner portal works. In this story it is a family-run dealer group serving Visakhapatnam since 2014, with a flagship Hyundai, Tata and Mahindra showroom in Dwaraka Nagar and a sales-and-service branch on NH-16 at Gajuwaka. Expect transparent on-road quotes, same-day test drives and an in-house finance and insurance desk.",
    logo: "",
    banner: "",
    gallery: [],
    hours: primaryHours,
    facilities: ["Customer lounge", "Free Wi-Fi", "Test-drive fleet", "Service centre", "Finance desk", "Insurance desk", "Exchange evaluation", "Accessories store", "EV charging", "Ample parking"],
    socials: { website: "", instagram: "", facebook: "", youtube: "", whatsapp: "" },
  };
  await db
    .update(s.partners)
    .set({
      application,
      profile,
      status: "approved",
      step: 7,
      legalName: LEGAL_NAME,
      tradeName: TRADE_NAME,
      city: CITY,
      state: STATE,
      gst: application.business.gst,
      plan: "growth",
      planStatus: "active",
      planRenewsAt: renewsAt,
      adminRemarks: "All documents verified — welcome to MarchGear!",
      requiredCorrections: null,
      submittedAt: resubmit,
      approvedAt,
      decidedBy: staffId,
    })
    .where(eq(s.partners.id, pid));

  /* Application history */
  type Approval = Omit<typeof s.partnerApprovals.$inferInsert, "partnerId">;
  const approvals: Approval[] = [
    { target: "partner", targetId: pid, action: "created", toStatus: "draft", actorUserId: ownerId, actorSide: "dealer", createdAt },
    { target: "partner", targetId: pid, action: "submitted", fromStatus: "draft", toStatus: "submitted", actorUserId: ownerId, actorSide: "dealer", createdAt: firstSubmit },
    { target: "partner", targetId: pid, action: "queued", fromStatus: "submitted", toStatus: "pending_approval", remarks: "Added to the verification queue", actorUserId: null, actorSide: "system", createdAt: plusMin(firstSubmit, 1) },
    { target: "partner", targetId: pid, action: "under_review", fromStatus: "pending_approval", toStatus: "under_review", remarks: "Verifying the GST registration and KYC documents.", actorUserId: staffId, actorSide: "admin", createdAt: at(approvedOffset - 8, 11, 0) },
    {
      target: "partner",
      targetId: pid,
      action: "changes_requested",
      fromStatus: "under_review",
      toStatus: "changes_requested",
      remarks: "Please make these 2 corrections and resubmit your application.\n• Add the map pin for the Gajuwaka branch\n• Upload a clearer copy of the address proof",
      actorUserId: staffId,
      actorSide: "admin",
      createdAt: at(approvedOffset - 6, 15, 45),
    },
    { target: "document", targetId: files.address.id, action: "verified", fromStatus: "pending", toStatus: "verified", actorUserId: staffId, actorSide: "admin", createdAt: at(approvedOffset - 1, 12, 0) },
    { target: "partner", targetId: pid, action: "resubmitted", fromStatus: "changes_requested", toStatus: "submitted", remarks: "Updated the application with the requested changes", actorUserId: ownerId, actorSide: "dealer", createdAt: resubmit },
    { target: "partner", targetId: pid, action: "queued", fromStatus: "submitted", toStatus: "pending_approval", remarks: "Added to the verification queue", actorUserId: null, actorSide: "system", createdAt: plusMin(resubmit, 1) },
    ...[files.pan, files.gst, files.registration, files.identity, files.cheque].map(
      (f, i): Approval => ({ target: "document", targetId: f.id, action: "verified", fromStatus: "pending", toStatus: "verified", actorUserId: staffId, actorSide: "admin", createdAt: at(approvedOffset - 1, 11, 10 + i) }),
    ),
    { target: "partner", targetId: pid, action: "approved", fromStatus: "pending_approval", toStatus: "approved", remarks: "All documents verified — welcome to MarchGear!", actorUserId: staffId, actorSide: "admin", createdAt: approvedAt },
    ...brandIds.map((id): Approval => ({ target: "brand", targetId: id, action: "approved", fromStatus: "pending", toStatus: "approved", remarks: "Approved with the application", actorUserId: staffId, actorSide: "admin", createdAt: plusMin(approvedAt, 1) })),
  ];

  /* Vehicles */
  type VehicleSpec = {
    key: string;
    kind: "new" | "used";
    car: string;
    variant: string;
    year: number;
    colour: string;
    price: number;
    stock: number;
    status: PartnerVehicleStatus;
    room: number;
    days: number; // listed this many days ago
    remarks?: string;
    used?: UsedVehicleDetails;
    blurb: string;
    vin?: string;
  };
  const thisYear = Number(istDay().slice(0, 4));
  const usedDetails = (u: Partial<UsedVehicleDetails> & Pick<UsedVehicleDetails, "registrationYear" | "km" | "owners" | "registrationNumber">): UsedVehicleDetails => ({
    registrationState: STATE,
    accident: { hadAccident: false, details: "" },
    insurance: { status: "comprehensive", validUntil: addMonths(istDay(), 7) },
    inspection: null,
    ...u,
  });
  const VEHICLES: VehicleSpec[] = [
    { key: "creta", kind: "new", car: "hyundai-creta", variant: "sx-o-turbo-dct", year: thisYear, colour: "Racing Red", price: 2045000, stock: 3, status: "published", room: primaryRoom, days: 40, vin: "MALPC81DLSM104732", blurb: "Top-spec Creta SX(O) with the 160 PS turbo-petrol and 7-speed DCT. Level 2 ADAS, panoramic sunroof and ventilated seats. Ready for immediate delivery with registration and insurance handled in-house." },
    { key: "verna", kind: "new", car: "hyundai-verna", variant: "sx-turbo-mt", year: thisYear, colour: "Lunar Silver", price: 1519000, stock: 2, status: "published", room: primaryRoom, days: 34, vin: "MALBN51BLSM208815", blurb: "Verna SX Turbo with the six-speed manual — the enthusiast's pick. Ventilated seats, BOSE audio and a 528-litre boot. Demo car available for test drives at Dwaraka Nagar." },
    { key: "i20", kind: "new", car: "hyundai-i20", variant: "sportz-ivt", year: thisYear, colour: "Polar White", price: 962000, stock: 4, status: "published", room: branchRoom, days: 29, vin: "MALBB51CLSM311204", blurb: "i20 Sportz IVT: smooth automatic, wireless Android Auto and Apple CarPlay, and six airbags as standard. Four units in stock at Gajuwaka in white and red." },
    { key: "nexon", kind: "new", car: "tata-nexon", variant: "creative-petrol-dct", year: thisYear, colour: "Deep Ocean Blue", price: 1165000, stock: 5, status: "published", room: primaryRoom, days: 26, vin: "MAT627145SLA40921", blurb: "Nexon Creative 1.2 turbo-petrol with the 6-speed DCA. 5-star Bharat NCAP safety, 10.25-inch touchscreen and connected-car tech. Exchange and finance benefits available." },
    { key: "xuv700", kind: "new", car: "mahindra-xuv700", variant: "ax7-petrol-at", year: thisYear, colour: "Midnight Black", price: 2225000, stock: 2, status: "published", room: primaryRoom, days: 22, vin: "MA1TA2GZXS2K51806", blurb: "XUV700 AX7 7-seater petrol automatic with ADAS, dual 10.25-inch screens and Sony 3D sound. The family SUV that does everything — book a weekend test drive." },
    { key: "nexonev", kind: "new", car: "tata-nexon-ev", variant: "empowered-plus-45", year: thisYear, colour: "Tidal Teal", price: 1715000, stock: 2, status: "pending_approval", room: primaryRoom, days: 2, vin: "MAT612009SLB77314", blurb: "Nexon EV Empowered+ 45 kWh with up to 489 km claimed range, V2L and a 7.2 kW home charger installed free during the launch period." },
    {
      key: "altroz",
      kind: "new",
      car: "tata-altroz",
      variant: "creative-dca",
      year: thisYear,
      colour: "Graphite Grey",
      price: 1005000,
      stock: 3,
      status: "changes_requested",
      room: branchRoom,
      days: 9,
      vin: "MAT608117SLC12508",
      remarks: "Please add photos of the actual car in stock — the current images look like brochure shots. Also check the selling price: it's above the ex-showroom price for this variant.",
      blurb: "Altroz Creative DCA, the premium hatch with a dual-clutch automatic, 5-star safety and a 7-inch digital cluster. Three units at Gajuwaka.",
    },
    { key: "xev9e", kind: "new", car: "mahindra-xev-9e", variant: "pack-two-79", year: thisYear, colour: "Polar White", price: 2690000, stock: 1, status: "draft", room: primaryRoom, days: 1, blurb: "XEV 9e Pack Two with the 79 kWh battery — coupe-SUV styling, triple screens and up to 656 km claimed range. Draft: waiting for the delivery photos." },
    {
      key: "u-swift",
      kind: "used",
      car: "maruti-swift",
      variant: "zxi-amt",
      year: 2021,
      colour: "Racing Red",
      price: 615000,
      stock: 1,
      status: "published",
      room: branchRoom,
      days: 18,
      used: usedDetails({ registrationYear: 2021, km: 32400, owners: 1, registrationNumber: "AP 31 DX 4471" }),
      blurb: "Single-owner Swift ZXi AMT with full Maruti service history. 32,400 km, new tyres at 30,000 km, comprehensive insurance and a 140-point check done at our Gajuwaka workshop.",
    },
    {
      key: "u-creta",
      kind: "used",
      car: "hyundai-creta",
      variant: "sx-tech-diesel-at",
      year: 2020,
      colour: "Polar White",
      price: 1325000,
      stock: 1,
      status: "published",
      room: primaryRoom,
      days: 14,
      used: usedDetails({ registrationYear: 2020, km: 58200, owners: 2, registrationNumber: "AP 39 BQ 2208", accident: { hadAccident: true, details: "Minor rear bumper scrape in 2023, repainted at the authorised Hyundai workshop. No structural damage." } }),
      blurb: "Creta SX diesel automatic — the frugal, torquey family SUV. Panoramic sunroof, Bose audio, two keys and the original invoice. Finance available at 9.25%.",
    },
    {
      key: "u-xuv700",
      kind: "used",
      car: "mahindra-xuv700",
      variant: "ax5-diesel-at",
      year: 2022,
      colour: "Desert Bronze",
      price: 1765000,
      stock: 1,
      status: "pending_approval",
      room: primaryRoom,
      days: 3,
      used: usedDetails({ registrationYear: 2022, km: 41000, owners: 1, registrationNumber: "AP 31 EK 9003", insurance: { status: "comprehensive", validUntil: addMonths(istDay(), 4) } }),
      blurb: "XUV700 AX5 7-seater diesel automatic, one owner, 41,000 km. Extended warranty valid until 2027 and all services at Mahindra. Just in — inspection photos coming.",
    },
    {
      key: "u-dzire",
      kind: "used",
      car: "maruti-dzire",
      variant: "vxi-cng",
      year: 2019,
      colour: "Lunar Silver",
      price: 495000,
      stock: 1,
      status: "draft",
      room: branchRoom,
      days: 1,
      used: usedDetails({ registrationYear: 2019, km: 86500, owners: 1, registrationNumber: "AP 35 AB 6120", insurance: { status: "third_party", validUntil: addMonths(istDay(), 2) } }),
      blurb: "Factory-fitted CNG Dzire VXi — very low running costs, ideal for daily city commutes or a taxi permit. Draft listing.",
    },
  ];

  const SPECS: Record<string, { label: string; value: string }[]> = {
    "hyundai-creta": [{ label: "Engine", value: "1.5 T-GDi turbo-petrol / 1.5 CRDi diesel" }, { label: "Power", value: "158 bhp (turbo-petrol)" }, { label: "Torque", value: "253 Nm" }, { label: "Claimed mileage", value: "18.4 kmpl" }, { label: "Boot space", value: "433 litres" }, { label: "Ground clearance", value: "190 mm" }, { label: "Airbags", value: "6" }],
    "hyundai-verna": [{ label: "Engine", value: "1.5 T-GDi turbo-petrol" }, { label: "Power", value: "158 bhp" }, { label: "Torque", value: "253 Nm" }, { label: "Claimed mileage", value: "20.0 kmpl" }, { label: "Boot space", value: "528 litres" }, { label: "Airbags", value: "6" }],
    "hyundai-i20": [{ label: "Engine", value: "1.2 Kappa petrol" }, { label: "Power", value: "87 bhp" }, { label: "Torque", value: "115 Nm" }, { label: "Claimed mileage", value: "19.6 kmpl" }, { label: "Boot space", value: "311 litres" }, { label: "Airbags", value: "6" }],
    "tata-nexon": [{ label: "Engine", value: "1.2 Revotron turbo-petrol" }, { label: "Power", value: "118 bhp" }, { label: "Torque", value: "170 Nm" }, { label: "Claimed mileage", value: "17.4 kmpl" }, { label: "Boot space", value: "382 litres" }, { label: "Ground clearance", value: "208 mm" }, { label: "Bharat NCAP", value: "5 stars" }],
    "tata-nexon-ev": [{ label: "Battery", value: "45 kWh" }, { label: "Claimed range", value: "489 km (MIDC)" }, { label: "Power", value: "143 bhp" }, { label: "Torque", value: "215 Nm" }, { label: "DC fast charge", value: "40 min (10–80%)" }, { label: "AC charge", value: "6.5 h (7.2 kW)" }],
    "tata-altroz": [{ label: "Engine", value: "1.2 Revotron petrol" }, { label: "Power", value: "87 bhp" }, { label: "Torque", value: "115 Nm" }, { label: "Gearbox", value: "6-speed DCA" }, { label: "Boot space", value: "345 litres" }, { label: "Global NCAP", value: "5 stars" }],
    "mahindra-xuv700": [{ label: "Engine", value: "2.0 mStallion turbo-petrol / 2.2 mHawk diesel" }, { label: "Power", value: "197 bhp (petrol) / 182 bhp (diesel)" }, { label: "Torque", value: "380 Nm (petrol) / 450 Nm (diesel)" }, { label: "Seating", value: "7" }, { label: "Ground clearance", value: "200 mm" }, { label: "Global NCAP", value: "5 stars" }],
    "mahindra-xev-9e": [{ label: "Battery", value: "79 kWh" }, { label: "Claimed range", value: "656 km (MIDC)" }, { label: "Power", value: "282 bhp" }, { label: "Torque", value: "380 Nm" }, { label: "DC fast charge", value: "20 min (20–80%, 175 kW)" }, { label: "Boot space", value: "663 litres" }],
    "maruti-swift": [{ label: "Engine", value: "1.2 DualJet petrol" }, { label: "Power", value: "89 bhp" }, { label: "Torque", value: "113 Nm" }, { label: "Gearbox", value: "5-speed AMT" }, { label: "Claimed mileage", value: "23.8 kmpl" }],
    "maruti-dzire": [{ label: "Engine", value: "1.2 K-series petrol + factory CNG" }, { label: "Power", value: "76 bhp (CNG)" }, { label: "Torque", value: "98 Nm (CNG)" }, { label: "Claimed mileage", value: "31.1 km/kg" }, { label: "Boot space", value: "378 litres" }],
  };

  const vehicleIds: Record<string, number> = {};
  const touched = new Map<number, Date>();
  const vehicleUpdated = (v: VehicleSpec, submitted: Date, reviewedAt: Date) =>
    past(v.status === "changes_requested" ? at(-v.days + 2, 16, 40) : v.status === "published" || v.status === "approved" ? reviewedAt : submitted);
  const vehicleLabels: Record<string, string> = {};
  const vehicleRows: { id: number; spec: VehicleSpec }[] = [];
  for (const v of VEHICLES) {
    const car: CarRow = cat.car(v.car);
    const variant: VariantRow = cat.variant(v.car, v.variant);
    const imgs = (car.images as string[]).slice(0, 3);
    const images: string[] = [];
    for (const [i, src] of imgs.entries()) images.push(await mediaFor.image(src, `${v.key}-${car.slug}-${i + 1}`, `${cat.brandName(car.brand)} ${car.name} ${variant.name}`));
    const groups = (car.features as { group: string; items: string[] }[] | null) ?? [];
    const features = [...(car.highlights as string[]), ...groups.flatMap((g) => g.items)].filter((f, i, all) => all.indexOf(f) === i).slice(0, 14);
    const listed = at(-v.days, 11, 30);
    const submitted = plusMin(listed, 25);
    const isLive = v.status === "published" || v.status === "approved";
    const reviewedAt = past(at(-v.days + 1, 12, 10));
    const ref = await freshRef("VEH", "partner_vehicles");
    const [res] = await db.insert(s.partnerVehicles).values({
      partnerId: pid,
      reference: ref,
      kind: v.kind,
      brand: car.brand,
      modelSlug: car.slug,
      model: car.name,
      variant: variant.name,
      bodyType: car.bodyType as BodyType,
      year: v.year,
      fuel: variant.fuel as FuelType,
      transmission: variant.transmission as Transmission,
      colour: v.colour,
      exShowroom: variant.price,
      sellingPrice: v.key === "altroz" ? variant.price + 6000 : v.price,
      stock: v.stock,
      vin: v.vin ?? null,
      description: v.blurb,
      specs: SPECS[v.car] ?? [],
      features,
      images,
      videos: [],
      showroomId: v.room,
      used: v.used ?? null,
      status: v.status,
      adminRemarks: v.remarks ?? null,
      views: 0,
      enquiries: 0,
      submittedAt: v.status === "draft" ? null : submitted,
      approvedAt: isLive ? reviewedAt : null,
      publishedAt: v.status === "published" ? reviewedAt : null,
      createdAt: listed,
      updatedAt: vehicleUpdated(v, submitted, reviewedAt),
    });
    const id = res.insertId;
    vehicleIds[v.key] = id;
    vehicleLabels[v.key] = `${cat.brandName(car.brand)} ${car.name} ${variant.name}${v.kind === "used" ? ` (${v.year})` : ""}`;
    vehicleRows.push({ id, spec: v });
    touched.set(id, vehicleUpdated(v, submitted, reviewedAt));
    if (v.status !== "draft") approvals.push({ target: "vehicle", targetId: id, action: "submitted", fromStatus: "draft", toStatus: "pending_approval", actorUserId: members.owner.userId, actorSide: "dealer", createdAt: submitted });
    if (v.status === "published") approvals.push({ target: "vehicle", targetId: id, action: "approved_published", fromStatus: "pending_approval", toStatus: "published", actorUserId: staffId, actorSide: "admin", createdAt: reviewedAt });
    if (v.status === "changes_requested")
      approvals.push({ target: "vehicle", targetId: id, action: "changes_requested", fromStatus: "pending_approval", toStatus: "changes_requested", remarks: v.remarks ?? null, actorUserId: staffId, actorSide: "admin", createdAt: at(-v.days + 2, 16, 40) });
  }
  log(`✓ ${VEHICLES.length} vehicles (${VEHICLES.filter((v) => v.kind === "new").length} new, ${VEHICLES.filter((v) => v.kind === "used").length} used)`);

  /* Offers */
  const emptyDiscount: OfferDiscount = { flat: null, percentage: null, cash: null, exchangeBonus: null, corporateBonus: null, loyaltyBonus: null, freeAccessories: "", freeInsurance: false, financeBenefit: "", maxDiscount: null, minPurchase: "" };
  const allBranches: OfferLocations = { mode: "all", showroomIds: [], cities: [], states: [] };
  const TERMS = [
    "Valid on retail purchases booked and invoiced during the offer period at participating showrooms.",
    "Benefits vary by model, variant and fuel type, and are subject to stock availability.",
    "Cannot be combined with any other offer unless stated.",
    "Benefits are not redeemable for cash.",
    "The dealership may modify or withdraw the offer; its decision on eligibility is final.",
  ];
  const terms = (...extra: string[]) => [...extra, ...TERMS].map((t) => `• ${t}`).join("\n");
  type OfferSpec = {
    key: string;
    title: string;
    campaign: string;
    category: string;
    tagline: string;
    description: string;
    terms: string;
    scope: OfferScope;
    discount: OfferDiscount;
    starts: Date;
    ends: Date;
    status: OfferStatus;
    image: string;
    views: number;
    remarks?: string;
    limitedStock?: number;
    createdDays: number;
  };
  const year = Number(istDay().slice(0, 4));
  const OFFERS: OfferSpec[] = [
    {
      key: "diwali",
      title: "Diwali Dhamaka — festive benefits on the Hyundai Creta",
      campaign: `Diwali ${year}`,
      category: "diwali",
      tagline: "Up to ₹60,000 in festive benefits, free accessories and priority delivery for Dhanteras.",
      description: "Bring home a Creta this Diwali with a cash discount, exchange bonus and free accessories pack. Book during the festival window to lock in priority delivery.",
      terms: terms("Delivery on a specific auspicious date depends on stock and documentation being complete."),
      scope: { vehicleType: "new", allModels: false, brands: ["hyundai"], models: ["hyundai-creta"], variants: [] },
      discount: { ...emptyDiscount, cash: 35000, exchangeBonus: 25000, freeAccessories: "Floor mats, mud flaps and a dash camera", maxDiscount: 60000 },
      starts: at(-41, 0, 0),
      ends: at(-5, 23, 59),
      status: "approved",
      image: IMG.headlightRed,
      views: 0,
      createdDays: 44,
    },
    {
      key: "exchange",
      title: "Exchange Bonanza — up to ₹50,000 for your old car",
      campaign: "Winter Exchange Drive",
      category: "exchange",
      tagline: "Free evaluation at home, best price for your old car, any brand.",
      description: "Trade in your current car — any make, any condition — and get an extra exchange bonus on a new Hyundai, Tata or Mahindra. Free doorstep evaluation across Visakhapatnam.",
      terms: terms("The exchange vehicle must be registered in the buyer's or an immediate family member's name."),
      scope: { vehicleType: "new", allModels: true, brands: [], models: [], variants: [] },
      discount: { ...emptyDiscount, exchangeBonus: 50000, maxDiscount: 50000 },
      starts: at(-10, 0, 0),
      ends: at(21, 23, 59),
      status: "approved",
      image: IMG.showroomDoors,
      views: 0,
      createdDays: 13,
    },
    {
      key: "finance",
      title: "Year-End Finance Fest — rates from 7.99%",
      campaign: `Year-End ${year}`,
      category: "finance",
      tagline: "Low-interest finance, zero foreclosure charges and same-day approval.",
      description: "Partner-bank finance from 7.99% p.a. with up to 100% on-road funding on select models, processing-fee waiver and same-day loan approval at both showrooms.",
      terms: terms("Interest rates and loan approval are at the sole discretion of the financing bank."),
      scope: { vehicleType: "new", allModels: true, brands: [], models: [], variants: [] },
      discount: { ...emptyDiscount, financeBenefit: "Interest from 7.99% p.a., processing fee waived" },
      starts: at(11, 0, 0),
      ends: at(41, 23, 59),
      status: "approved",
      image: IMG.signing,
      views: 0,
      createdDays: 6,
    },
    {
      key: "ev",
      title: "Nexon EV launch offer — free home charger installation",
      campaign: "EV Week",
      category: "launch",
      tagline: "Go electric with a free 7.2 kW wallbox and installation.",
      description: "Switch to the Nexon EV this month and we'll install a 7.2 kW home charger free, plus a ₹20,000 cash benefit on the Empowered+ variants.",
      terms: terms("Charger installation is subject to a site survey of the customer's parking."),
      scope: { vehicleType: "new", allModels: false, brands: ["tata"], models: ["tata-nexon-ev"], variants: [] },
      discount: { ...emptyDiscount, cash: 20000, freeAccessories: "7.2 kW home charger with installation", maxDiscount: 65000 },
      starts: at(2, 0, 0),
      ends: at(32, 23, 59),
      status: "pending_approval",
      image: IMG.chargeStation,
      views: 0,
      createdDays: 1,
    },
    {
      key: "corporate",
      title: "XUV700 corporate benefit for salaried professionals",
      campaign: "Corporate Connect",
      category: "corporate",
      tagline: "Extra ₹15,000 for employees of listed companies, PSUs and the government.",
      description: "Show your employee ID and get a corporate bonus on every XUV700 variant, on top of running exchange offers.",
      terms: terms("A valid employee ID and latest salary slip are required at booking."),
      scope: { vehicleType: "new", allModels: false, brands: ["mahindra"], models: ["mahindra-xuv700"], variants: [] },
      discount: { ...emptyDiscount, corporateBonus: 15000, maxDiscount: 15000 },
      starts: at(-20, 0, 0),
      ends: at(25, 23, 59),
      status: "paused",
      image: IMG.desertSuv,
      views: 0,
      createdDays: 22,
    },
    {
      key: "sankranti",
      title: "Sankranti Savings — a fresh start on the road",
      campaign: `Sankranti ${year + 1}`,
      category: "sankranti",
      tagline: "Harvest-season benefits on your next car.",
      description: "Celebrate Makar Sankranti with a new car. Festive benefits across the range, free first service and a gold coin with every booking.",
      terms: terms(),
      scope: { vehicleType: "both", allModels: true, brands: [], models: [], variants: [] },
      discount: { ...emptyDiscount, flat: 10000, freeAccessories: "Gold coin (1 g) with every booking" },
      starts: new Date(`${year + 1}-01-05T00:00:00+05:30`),
      ends: new Date(`${year + 1}-01-20T23:59:00+05:30`),
      status: "draft",
      image: IMG.roadSunset,
      views: 0,
      createdDays: 0,
    },
  ];
  const offerIds: Record<string, number> = {};
  const offerTouched = new Map<number, Date>();
  const offerRefs: Record<string, string> = {};
  for (const o of OFFERS) {
    const banner = await mediaFor.image(o.image, `offer-${o.key}`, o.title);
    const media: OfferMedia = { desktopBanner: banner, mobileBanner: "", thumbnail: banner, gallery: [], videoUrl: "", brochure: null };
    const created = past(at(-o.createdDays, 10, 15));
    const submitted = plusMin(created, 40);
    const approvedOn = plusMin(submitted, 26 * 60);
    const ref = await freshRef("OFF", "partner_offers");
    const reviewed = o.status === "approved" || o.status === "paused";
    const [res] = await db.insert(s.partnerOffers).values({
      partnerId: pid,
      reference: ref,
      title: o.title,
      campaignName: o.campaign,
      category: o.category,
      description: o.description,
      tagline: o.tagline,
      terms: o.terms,
      scope: o.scope,
      discount: o.discount,
      startsAt: o.starts,
      endsAt: o.ends,
      limitedStock: o.limitedStock ?? null,
      maxRedemptions: null,
      redemptions: 0,
      media,
      locations: allBranches,
      status: o.status,
      adminRemarks: reviewed ? "Approved — looks great." : null,
      submittedAt: o.status === "draft" ? null : submitted,
      approvedAt: reviewed ? past(approvedOn) : null,
      createdAt: created,
      updatedAt: o.status === "paused" ? at(-2, 18, 0) : created,
    });
    offerIds[o.key] = res.insertId;
    offerTouched.set(res.insertId, o.status === "paused" ? at(-2, 18, 0) : created);
    offerRefs[o.key] = ref;
    if (o.status !== "draft") approvals.push({ target: "offer", targetId: res.insertId, action: "submitted", fromStatus: "draft", toStatus: "pending_approval", actorUserId: members.harika.userId, actorSide: "dealer", createdAt: submitted });
    if (reviewed) approvals.push({ target: "offer", targetId: res.insertId, action: "approved", fromStatus: "pending_approval", toStatus: "approved", remarks: "Approved — looks great.", actorUserId: staffId, actorSide: "admin", createdAt: past(approvedOn) });
    if (o.status === "paused")
      approvals.push({ target: "offer", targetId: res.insertId, action: "paused", fromStatus: "approved", toStatus: "paused", remarks: "Paused while we wait for Mahindra's updated corporate list.", actorUserId: members.harika.userId, actorSide: "dealer", createdAt: at(-2, 18, 0) });
  }
  log(`✓ ${OFFERS.length} offers (active, scheduled, expired, pending, paused, draft)`);

  /* Public listing + used-car mirrors */
  await syncPartnerEverywhere(pid);
  const [{ publicDealerId }] = await db.select({ publicDealerId: s.partners.publicDealerId }).from(s.partners).where(eq(s.partners.id, pid));
  const mirrors = await db.select({ id: s.partnerVehicles.id, mirror: s.partnerVehicles.publicUsedCarId }).from(s.partnerVehicles).where(and(eq(s.partnerVehicles.partnerId, pid), isNotNull(s.partnerVehicles.publicUsedCarId)));
  const mirrorOf = (key: string) => mirrors.find((m) => m.id === vehicleIds[key])?.mirror ?? null;
  log(`✓ public page /dealers/${publicDealerId} + ${mirrors.length} used-car listings`);

  /* Enquiries (CRM) */
  const PATHS: Record<CrmStatus, CrmStatus[]> = {
    new: [],
    contacted: ["contacted"],
    follow_up: ["contacted", "follow_up"],
    interested: ["contacted", "interested"],
    test_drive_scheduled: ["contacted", "interested", "test_drive_scheduled"],
    negotiation: ["contacted", "interested", "test_drive_scheduled", "negotiation"],
    booking_completed: ["contacted", "interested", "test_drive_scheduled", "negotiation", "booking_completed"],
    converted: ["contacted", "interested", "test_drive_scheduled", "negotiation", "booking_completed", "converted"],
    lost: ["contacted", "interested", "lost"],
    closed: ["contacted", "closed"],
  };
  type LeadSpec = { status: CrmStatus; source: LeadSource; days: number; car: string; who?: string; offer?: string; budget?: string; lost?: string };
  const LEADS: LeadSpec[] = [
    { status: "new", source: "website", days: 0, car: "creta" },
    { status: "new", source: "offer", days: 0, car: "nexon", offer: "exchange" },
    { status: "new", source: "listing", days: 1, car: "u-swift" },
    { status: "new", source: "phone", days: 1, car: "xuv700", who: "saiteja" },
    { status: "new", source: "social", days: 2, car: "i20", who: "lakshmi" },
    { status: "new", source: "website", days: 3, car: "verna", who: "lakshmi" },
    { status: "contacted", source: "walk_in", days: 2, car: "nexon", who: "lakshmi", budget: "₹10–12 lakh" },
    { status: "contacted", source: "website", days: 4, car: "creta", who: "saiteja" },
    { status: "contacted", source: "referral", days: 5, car: "xuv700", who: "kiran", budget: "₹20–23 lakh" },
    { status: "contacted", source: "listing", days: 6, car: "u-creta", who: "saiteja" },
    { status: "contacted", source: "event", days: 8, car: "i20", who: "lakshmi" },
    { status: "follow_up", source: "website", days: 5, car: "verna", who: "lakshmi" },
    { status: "follow_up", source: "offer", days: 7, car: "creta", who: "saiteja", offer: "exchange", budget: "₹18–21 lakh" },
    { status: "follow_up", source: "phone", days: 9, car: "nexon", who: "lakshmi" },
    { status: "follow_up", source: "walk_in", days: 12, car: "xuv700", who: "saiteja", budget: "Up to ₹23 lakh" },
    { status: "follow_up", source: "social", days: 15, car: "i20", who: "lakshmi" },
    { status: "interested", source: "website", days: 6, car: "nexonev", who: "saiteja", budget: "₹16–18 lakh" },
    { status: "interested", source: "listing", days: 10, car: "u-swift", who: "lakshmi" },
    { status: "interested", source: "referral", days: 13, car: "creta", who: "kiran" },
    { status: "interested", source: "offer", days: 16, car: "verna", who: "saiteja", offer: "exchange" },
    { status: "test_drive_scheduled", source: "website", days: 4, car: "creta", who: "lakshmi" },
    { status: "test_drive_scheduled", source: "walk_in", days: 7, car: "xuv700", who: "saiteja" },
    { status: "test_drive_scheduled", source: "phone", days: 11, car: "nexon", who: "lakshmi" },
    { status: "test_drive_scheduled", source: "listing", days: 14, car: "u-creta", who: "saiteja" },
    { status: "negotiation", source: "offer", days: 18, car: "creta", who: "lakshmi", offer: "diwali", budget: "₹19–20 lakh" },
    { status: "negotiation", source: "walk_in", days: 20, car: "verna", who: "saiteja" },
    { status: "negotiation", source: "event", days: 23, car: "xuv700", who: "kiran" },
    { status: "negotiation", source: "website", days: 25, car: "i20", who: "lakshmi" },
    { status: "booking_completed", source: "offer", days: 27, car: "creta", who: "saiteja", offer: "diwali" },
    { status: "booking_completed", source: "referral", days: 30, car: "nexon", who: "lakshmi" },
    { status: "booking_completed", source: "walk_in", days: 33, car: "i20", who: "saiteja" },
    { status: "converted", source: "offer", days: 36, car: "creta", who: "lakshmi", offer: "diwali" },
    { status: "converted", source: "website", days: 39, car: "xuv700", who: "kiran" },
    { status: "converted", source: "phone", days: 42, car: "verna", who: "saiteja" },
    { status: "lost", source: "website", days: 21, car: "nexon", who: "lakshmi", lost: "Bought from another dealer" },
    { status: "lost", source: "social", days: 28, car: "creta", who: "saiteja", lost: "Price too high" },
    { status: "lost", source: "other", days: 35, car: "xuv700", who: "lakshmi", lost: "Financing not approved" },
    { status: "lost", source: "listing", days: 44, car: "u-swift", who: "saiteja", lost: "Chose another model" },
    { status: "closed", source: "phone", days: 31, car: "i20", who: "kiran" },
    { status: "closed", source: "event", days: 45, car: "nexon", who: "lakshmi" },
  ];
  const NOTES = [
    "Wants the top variant but is comparing on-road prices with another dealer — share our best quote today.",
    "Has an old Grand i10 to exchange; asked for a doorstep evaluation on Saturday.",
    "Prefers a white or silver car; delivery needed before the family function next month.",
    "Looking for 90% finance with a 5-year tenure — sent the SBI and HDFC options.",
    "Asked about waiting period and the extended warranty package.",
    "Spouse will join for the test drive; prefers an evening slot after 6 PM.",
  ];
  const PITCH = [
    "Shared the on-road price breakup and current exchange benefits on WhatsApp.",
    "Customer asked for the insurance quote with zero depreciation and engine protection.",
    "Explained the finance options; customer will share salary slips tomorrow.",
  ];
  const leadIds: { id: number; spec: LeadSpec; name: string; mobile: string; created: Date }[] = [];
  let siteLeadCount = 0;
  let eventCount = 0;
  for (const [i, l] of LEADS.entries()) {
    const name = CUSTOMERS[i];
    const mobile = `${pick(["9", "9", "8", "7", "6"])}${int(100_000_000, 999_999_999)}`;
    const mail = rand() < 0.55 ? `${name.split(" ")[0].toLowerCase()}.${name.split(" ").slice(-1)[0].toLowerCase()}@example.com` : null;
    const created = past(at(-l.days, int(9, 19), int(0, 59)));
    const v = VEHICLES.find((x) => x.key === l.car)!;
    const label = vehicleLabels[l.car];
    const car = cat.car(v.car);
    const online = l.source === "website" || l.source === "listing" || l.source === "offer";
    const location = pick(LOCALITIES);

    // Website enquiries also exist as site-wide leads (the admin's /admin/leads), like the real routing.
    let siteLeadId: number | null = null;
    if (online) {
      const siteRef = await freshRef("MG", "leads");
      const type = l.source === "listing" ? "used_car" : l.status === "test_drive_scheduled" ? "test_drive" : l.source === "offer" ? "best_price" : pick(["best_price", "contact_dealer", "callback"] as const);
      const message = l.source === "offer" ? `I'm interested in your offer ${offerRefs[l.offer ?? "exchange"]}. Please share the on-road price.` : l.source === "listing" ? "Is this car still available? I'd like to see it this weekend." : `Please share the best on-road price for the ${car.name} in Visakhapatnam.`;
      const [r] = await db.insert(s.leads).values({
        reference: siteRef,
        type,
        status: l.status === "new" ? "new" : ["converted", "booking_completed"].includes(l.status) ? "converted" : ["lost", "closed"].includes(l.status) ? "closed" : "contacted",
        name,
        email: mail,
        phone: mobile,
        city: CITY,
        subject: l.source === "listing" ? label : `${cat.brandName(car.brand)} ${car.name}`,
        carSlug: v.kind === "new" ? car.slug : null,
        usedCarId: l.source === "listing" ? mirrorOf(l.car) : null,
        dealerId: publicDealerId,
        message,
        source: l.source === "listing" ? `/used-cars/${mirrorOf(l.car) ?? ""}` : l.source === "offer" ? `/offers/${offerRefs[l.offer ?? "exchange"]}` : `/dealers/${publicDealerId}`,
        createdAt: created,
        updatedAt: created,
      });
      siteLeadId = r.insertId;
      siteLeadCount++;
    }

    const assigned = l.who ? members[l.who] : null;
    const lastStatus = PATHS[l.status];
    const followUpAt =
      l.status === "follow_up" ? (i === 14 ? at(-1, 11, 0) : at(int(1, 4), pick([10, 11, 15, 17]), 0)) : l.status === "interested" || l.status === "negotiation" ? at(int(1, 6), pick([11, 16, 18]), 30) : null;
    const ref = await freshRef("LD", "partner_leads");
    const [res] = await db.insert(s.partnerLeads).values({
      partnerId: pid,
      reference: ref,
      name,
      mobile,
      email: mail,
      carLabel: label,
      carSlug: car.slug,
      variant: cat.variant(v.car, v.variant).name,
      vehicleId: vehicleIds[l.car],
      offerId: l.offer ? offerIds[l.offer] : null,
      budget: l.budget ?? null,
      location,
      source: l.source,
      status: l.status,
      assignedMemberId: assigned?.memberId ?? null,
      followUpAt,
      lostReason: l.lost ?? null,
      siteLeadId,
      createdAt: created,
      updatedAt: created,
    });
    const leadId = res.insertId;
    leadIds.push({ id: leadId, spec: l, name, mobile, created });

    // Timeline
    const events: (typeof s.partnerLeadEvents.$inferInsert)[] = [];
    const ev = (kind: LeadEventKind, body: string, when: Date, memberId: number | null, meta: Record<string, string | number | boolean | null> | null = null) => events.push({ leadId, memberId, kind, body, meta, createdAt: past(when) });
    const manager = members.kiran;
    if (online) {
      const via = l.source === "listing" ? "your listing" : l.source === "offer" ? `your offer ${offerRefs[l.offer ?? "exchange"]}` : "your MarchGear page";
      ev("created", `Enquiry received from the website via ${via}.`, created, null, { source: l.source });
    } else {
      ev("created", `Added by ${manager.name} · ${LEAD_SOURCE_LABEL[l.source]}.`, created, manager.memberId, { source: l.source });
    }
    const span = Math.max(0.2, l.days - 0.2) * DAY_MS; // spread the work over the life of the enquiry
    const step = (n: number, of: number) => new Date(created.getTime() + (span * n) / (of + 1));
    if (assigned) ev("assign", `Assigned to ${assigned.name}.`, plusMin(created, 35), manager.memberId, { memberId: assigned.memberId });
    let from: CrmStatus = "new";
    const actor = assigned?.memberId ?? manager.memberId;
    lastStatus.forEach((to, n) => {
      const when = step(n + 1, lastStatus.length + 1);
      if (to === "contacted") ev("call", `Call · Connected · ${int(3, 12)} min\n${pick(PITCH)}`, plusMin(when, -2), actor, { outcome: "connected", durationMin: int(3, 12) });
      if (to === "test_drive_scheduled") ev("test_drive", `Test drive booked for ${formatIstDateTime(plusMin(when, 60 * 24))}.`, plusMin(when, -1), actor, null);
      if (to === "follow_up") ev("reminder", `Follow-up set for ${formatIstDateTime(followUpAt ?? plusMin(when, 60 * 24))}.`, plusMin(when, -1), actor, { at: (followUpAt ?? plusMin(when, 60 * 24)).toISOString() });
      ev("status", `${CRM_STATUS_LABEL[from]} → ${CRM_STATUS_LABEL[to]}${to === "lost" && l.lost ? ` · ${l.lost}` : ""}`, when, actor, { from, to, reason: to === "lost" ? (l.lost ?? null) : null });
      if (n === 0 && rand() < 0.7) ev("note", pick(NOTES), plusMin(when, 20), actor);
      if (to === "negotiation") ev("whatsapp", "WhatsApp conversation\nSent the revised quote with the exchange value and a free accessories pack.", plusMin(when, 45), actor, { outcome: null, durationMin: null });
      from = to;
    });
    if (l.status === "new" && l.source === "phone") ev("call", "Call · No answer", plusMin(created, 90), actor, { outcome: "no_answer", durationMin: null });
    if (events.length) await db.insert(s.partnerLeadEvents).values(events);
    eventCount += events.length;
    const last = events.reduce((m, e) => Math.max(m, (e.createdAt as Date).getTime()), created.getTime());
    await db.update(s.partnerLeads).set({ updatedAt: new Date(last) }).where(eq(s.partnerLeads.id, leadId));
  }
  log(`✓ ${LEADS.length} enquiries with ${eventCount} timeline events (${siteLeadCount} also as website leads)`);

  /* Test drives */
  const leadAt = (status: CrmStatus, n = 0) => leadIds.filter((x) => x.spec.status === status)[n];
  type DriveSpec = { lead: (typeof leadIds)[number]; status: TestDriveStatus; when: Date; requested?: Date; feedback?: string; rating?: number };
  const DRIVES: DriveSpec[] = [
    { lead: leadAt("new", 0), status: "requested", when: at(2, 10, 0) },
    { lead: leadAt("new", 2), status: "requested", when: at(3, 17, 30) },
    { lead: leadAt("interested", 0), status: "requested", when: at(4, 14, 0) },
    { lead: leadAt("test_drive_scheduled", 0), status: "scheduled", when: at(1, 11, 0) },
    { lead: leadAt("test_drive_scheduled", 1), status: "scheduled", when: at(2, 16, 30) },
    { lead: leadAt("test_drive_scheduled", 2), status: "rescheduled", when: at(3, 12, 0) },
    { lead: leadAt("test_drive_scheduled", 3), status: "scheduled", when: at(0, 18, 0) },
    { lead: leadAt("negotiation", 0), status: "completed", when: at(-12, 11, 30), feedback: "Loved the turbo's pick-up and the ventilated seats; wants a better exchange price for the old car.", rating: 5 },
    { lead: leadAt("negotiation", 1), status: "completed", when: at(-15, 17, 0), feedback: "Felt the clutch is light and the cabin quiet. Comparing with the City before deciding.", rating: 4 },
    { lead: leadAt("booking_completed", 1), status: "completed", when: at(-24, 10, 30), feedback: "Smooth DCA, liked the 360° camera. Booked the same evening.", rating: 5 },
    { lead: leadAt("lost", 0), status: "no_show", when: at(-18, 15, 0) },
    { lead: leadAt("closed", 0), status: "cancelled", when: at(-28, 12, 0) },
  ];
  for (const d of DRIVES) {
    const l = d.lead;
    const v = VEHICLES.find((x) => x.key === l.spec.car)!;
    const exec = l.spec.who ? members[l.spec.who] : null;
    const scheduled = d.status !== "requested";
    const ref = await freshRef("TD", "partner_test_drives");
    const created = past(plusMin(l.created, 30));
    await db.insert(s.partnerTestDrives).values({
      partnerId: pid,
      reference: ref,
      leadId: l.id,
      customerName: l.name,
      mobile: l.mobile,
      email: null,
      carLabel: vehicleLabels[l.spec.car],
      vehicleId: vehicleIds[l.spec.car],
      showroomId: v.room,
      requestedFor: d.when,
      scheduledAt: scheduled ? d.when : null,
      status: d.status,
      assignedMemberId: scheduled ? (exec?.memberId ?? null) : null,
      feedback: d.feedback ?? null,
      rating: d.rating ?? null,
      createdAt: created,
      updatedAt: past(d.status === "completed" ? plusMin(d.when, 70) : created),
    });
  }
  log(`✓ ${DRIVES.length} test drives (requested, scheduled, rescheduled, completed with feedback, no-show, cancelled)`);

  /* Counters that the public site normally keeps: enquiries, conversions */
  for (const [key, id] of Object.entries(vehicleIds)) {
    const n = leadIds.filter((l) => l.spec.car === key).length;
    if (n) await db.update(s.partnerVehicles).set({ enquiries: n }).where(eq(s.partnerVehicles.id, id));
  }
  for (const [key, id] of Object.entries(offerIds)) {
    const mine = leadIds.filter((l) => l.spec.offer === key);
    const won = mine.filter((l) => ["booking_completed", "converted"].includes(l.spec.status)).length;
    if (mine.length) await db.update(s.partnerOffers).set({ enquiries: mine.length, conversions: won, redemptions: won }).where(eq(s.partnerOffers.id, id));
  }

  /* Public-site analytics events (last 30 days) */
  const liveVehicles = vehicleRows.filter((v) => v.spec.status === "published");
  const viewedOffers = ["diwali", "exchange", "corporate"].map((k) => offerIds[k]);
  const eventsRows: (typeof s.partnerEvents.$inferInsert)[] = [];
  const views = new Map<number, number>();
  const offerViews = new Map<number, number>();
  for (let d = 29; d >= 0; d--) {
    const weekend = [0, 6].includes(new Date(at(-d, 12).getTime() + IST_MS).getUTCDay());
    const grow = 1 + (29 - d) / 40;
    const n = Math.round((weekend ? 13 : 8) * grow * (0.75 + rand() * 0.5));
    for (let k = 0; k < n; k++) {
      const when = past(at(-d, int(8, 22), int(0, 59)));
      const r = rand();
      if (r < 0.45) eventsRows.push({ partnerId: pid, kind: "profile_view", refId: null, createdAt: when });
      else if (r < 0.8) {
        const v = pick(liveVehicles);
        eventsRows.push({ partnerId: pid, kind: "vehicle_view", refId: v.id, createdAt: when });
        views.set(v.id, (views.get(v.id) ?? 0) + 1);
      } else if (r < 0.9) {
        const id = d > 5 ? pick(viewedOffers) : pick(viewedOffers.slice(1));
        eventsRows.push({ partnerId: pid, kind: "offer_view", refId: id, createdAt: when });
        offerViews.set(id, (offerViews.get(id) ?? 0) + 1);
      } else eventsRows.push({ partnerId: pid, kind: pick(["phone_click", "phone_click", "whatsapp_click", "direction_click"] as const), refId: null, createdAt: when });
    }
  }
  for (let i = 0; i < eventsRows.length; i += 200) await db.insert(s.partnerEvents).values(eventsRows.slice(i, i + 200));
  for (const [id, n] of views) await db.update(s.partnerVehicles).set({ views: n + int(20, 60) }).where(eq(s.partnerVehicles.id, id));
  for (const [id, n] of offerViews) await db.update(s.partnerOffers).set({ views: n + int(30, 90) }).where(eq(s.partnerOffers.id, id));
  log(`✓ ${eventsRows.length} analytics events over 30 days`);
  // Counter updates and mirroring bump updated_at (ON UPDATE) — put the real dates back.
  for (const [id, when] of touched) await db.update(s.partnerVehicles).set({ updatedAt: when }).where(eq(s.partnerVehicles.id, id));
  for (const [id, when] of offerTouched) await db.update(s.partnerOffers).set({ updatedAt: when }).where(eq(s.partnerOffers.id, id));

  /* Public reviews of the showroom */
  if (publicDealerId) {
    const REVIEWS = [
      { name: "Venkata Ramana", visit: "Purchase", days: 6, rating: 5, title: "Delivery done exactly as promised", body: "Booked a Creta during Diwali and the car was delivered on Dhanteras with all paperwork ready. Kiran and his team were patient with every question.", reply: "Thank you, Ramana garu! Enjoy the Creta — see you at the first free service." },
      { name: "Sneha Patnaik", visit: "Test drive", days: 11, rating: 4, title: "Easy home test drive", body: "They brought the Nexon to our apartment in Madhurawada on a Sunday. Helpful executive, though the price quote took a day to arrive." },
      { name: "Abdul Rahim", visit: "Service", days: 19, rating: 4, title: "Quick service at Gajuwaka", body: "Periodic service in under four hours with a clear bill. The waiting lounge could use more seating on weekends." },
      { name: "Lalitha Devi", visit: "Pre-owned purchase", days: 27, rating: 5, title: "Honest about the used car's history", body: "Bought a used Swift. They showed the full service record and even pointed out the small scratches before I asked." },
      { name: "Karthik Somayajula", visit: "Purchase", days: 38, rating: 3, title: "Good car, slow registration", body: "Happy with the XUV700 but the registration took nearly two weeks. The sales team kept me updated though." },
    ];
    await db.insert(s.dealerReviews).values(
      REVIEWS.map((r, i) => ({
        id: `demo-${publicDealerId}-${i + 1}`.slice(0, 64),
        dealerId: publicDealerId,
        name: r.name,
        visit: r.visit,
        date: istDay(-r.days),
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: "approved" as const,
        reply: r.reply ?? null,
        repliedAt: r.reply ? at(-r.days + 1, 10, 0) : null,
        createdAt: at(-r.days, 20, 0),
      })),
    );
    log(`✓ ${REVIEWS.length} public reviews`);
  }

  /* Billing: a paid month and the renewal that's due */
  const fy = (iso: string) => {
    const y = Number(iso.slice(0, 4));
    const start = Number(iso.slice(5, 7)) >= 4 ? y : y - 1;
    return `MG/${String(start % 100).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}/`;
  };
  const nextNumber = async (issued: string) => {
    const prefix = fy(issued);
    const [rows] = await pool().query(`SELECT number FROM partner_invoices WHERE number LIKE ? ORDER BY number DESC LIMIT 1`, [`${prefix}%`]);
    const last = (rows as { number: string }[])[0]?.number;
    return `${prefix}${String((last ? Number(last.slice(prefix.length)) || 0 : 0) + 1).padStart(5, "0")}`;
  };
  const growth = 12999;
  const gst = Math.round(growth * 0.18);
  const paidIssued = addDays(paidStart, -7);
  const paidNumber = await nextNumber(paidIssued);
  const [paidInv] = await db.insert(s.partnerInvoices).values({
    partnerId: pid,
    number: paidNumber,
    plan: "growth",
    periodStart: paidStart,
    periodEnd: addDays(renewsAt, -1),
    amount: growth,
    gst,
    total: growth + gst,
    status: "paid",
    dueOn: addDays(paidIssued, 7),
    paidAt: new Date(`${addDays(paidIssued, 3)}T15:20:00+05:30`),
    createdAt: new Date(`${paidIssued}T09:00:00+05:30`),
  });
  const dueIssued = addDays(renewsAt, -7);
  await db.insert(s.partnerInvoices).values({
    partnerId: pid,
    number: await nextNumber(dueIssued),
    plan: "growth",
    periodStart: renewsAt,
    periodEnd: addDays(addMonths(renewsAt, 1), -1),
    amount: growth,
    gst,
    total: growth + gst,
    status: "due",
    dueOn: renewsAt,
    paidAt: null,
    createdAt: new Date(`${dueIssued}T09:00:00+05:30`),
  });
  const [payment] = await db.insert(s.partnerPayments).values({
    partnerId: pid,
    invoiceId: paidInv.insertId,
    amount: growth + gst,
    method: "bank_transfer",
    utr: "HDFCR52026102345678",
    paidOn: addDays(paidIssued, 2),
    proof: null,
    status: "verified",
    remarks: "Received in MarchGear's account — thank you.",
    createdAt: new Date(`${addDays(paidIssued, 2)}T18:05:00+05:30`),
  });
  approvals.push({ target: "payment", targetId: payment.insertId, action: "verified", fromStatus: "submitted", toStatus: "verified", remarks: "Received in MarchGear's account — thank you.", actorUserId: staffId, actorSide: "admin", createdAt: new Date(`${addDays(paidIssued, 3)}T15:20:00+05:30`) });
  log(`✓ invoices ${paidNumber} (paid) and the renewal (due ${renewsAt})`);

  /* Support ticket with a staff reply */
  const ticketRef = await freshRef("TKT", "partner_tickets");
  const ticketAt = at(-4, 12, 40);
  const [ticket] = await db.insert(s.partnerTickets).values({
    partnerId: pid,
    reference: ticketRef,
    subject: "Can we import new-car stock from our DMS?",
    category: "inventory",
    priority: "normal",
    status: "awaiting_dealer",
    createdBy: members.owner.userId,
    createdAt: ticketAt,
    updatedAt: at(-3, 11, 5),
  });
  await db.insert(s.partnerTicketMessages).values([
    {
      ticketId: ticket.insertId,
      userId: members.owner.userId,
      fromStaff: false,
      body: "We manage stock in our dealer management system. Is there a way to upload new-car stock in bulk (CSV or Excel) instead of adding each variant by hand? We have around 60 units across both showrooms.",
      attachments: [],
      createdAt: ticketAt,
    },
    {
      ticketId: ticket.insertId,
      userId: staffId,
      fromStaff: true,
      body: "Thanks for asking! Bulk import isn't available yet — it's on our roadmap. In the meantime, one listing per variant with the stock count works well (you don't need one per unit). Could you share which DMS you use, so we can check the export format for the import we're building?",
      attachments: [],
      createdAt: at(-3, 11, 5),
    },
  ]);
  log(`✓ support ticket ${ticketRef} (awaiting your reply)`);

  /* Notifications */
  type Note = { kind: string; title: string; body?: string; href?: string; days: number; hh: number; read: boolean; user?: string };
  const firstNew = leadIds.find((l) => l.spec.status === "new")!;
  const NOTES_LIST: Note[] = [
    { kind: "application", title: "Welcome to MarchGear — your dealership is approved", body: "Your partner portal is fully unlocked and your public showroom page is live.", href: "/dealer/dashboard", days: approvedOffset, hh: 16, read: true },
    { kind: "billing", title: `Payment verified: ${paidNumber}`, body: "Thank you — your Growth plan is active.", href: "/dealer/invoices", days: Math.round((Date.parse(addDays(paidIssued, 3)) - Date.parse(istDay())) / DAY_MS), hh: 15, read: true },
    { kind: "offer", title: "Offer approved: Exchange Bonanza — up to ₹50,000 for your old car", body: "It's live on MarchGear now.", href: `/dealer/offers/${offerIds.exchange}/edit`, days: -12, hh: 13, read: true },
    { kind: "vehicle", title: "Changes requested on your Tata Altroz listing", body: VEHICLES.find((v) => v.key === "altroz")!.remarks, href: `/dealer/inventory/${vehicleIds.altroz}`, days: -7, hh: 16, read: false },
    { kind: "billing", title: "Renewal invoice issued", body: `Growth plan renews on ${new Date(`${renewsAt}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}. Pay by bank transfer or UPI and record the UTR.`, href: "/dealer/invoices", days: -4, hh: 9, read: false },
    { kind: "ticket", title: `MarchGear replied to ${ticketRef}`, body: "Bulk import isn't available yet — it's on our roadmap…", href: `/dealer/support/${ticket.insertId}`, days: -3, hh: 11, read: false },
    { kind: "vehicle", title: "Mahindra XUV700 AX5 sent for approval", body: `${OWNER.name} submitted the listing — MarchGear will review it shortly.`, href: `/dealer/inventory/${vehicleIds["u-xuv700"]}`, days: -3, hh: 12, read: true },
    { kind: "lead_assigned", title: "2 enquiries assigned to you", body: `Assigned by ${STAFF[0].name}.`, href: "/dealer/enquiries?assigned=me", days: -2, hh: 10, read: false, user: "lakshmi" },
    // Website enquiries are unassigned, so (like the real routing) only people who see every enquiry are told.
    ...(["owner", "kiran"] as const).flatMap((user): Note[] => [
      { kind: "test_drive", title: `New test-drive request from ${leadAt("new", 2).name}`, body: vehicleLabels["u-swift"], href: "/dealer/test-drives", days: -1, hh: 18, read: false, user },
      { kind: "lead", title: `New enquiry from ${firstNew.name}`, body: `Best price · ${vehicleLabels.creta}`, href: `/dealer/enquiries/${firstNew.id}`, days: 0, hh: 9, read: false, user },
    ]),
    { kind: "review", title: "New review: “Delivery done exactly as promised”", body: "★★★★★ from Venkata Ramana", href: "/dealer/reviews", days: -6, hh: 20, read: true },
  ];
  await db.insert(s.partnerNotifications).values(
    NOTES_LIST.map((n) => {
      const when = past(at(n.days, n.hh, 5));
      return { partnerId: pid, userId: n.user ? members[n.user].userId : null, kind: n.kind, title: n.title, body: n.body ?? null, href: n.href ?? null, readAt: n.read ? plusMin(when, 30) : null, createdAt: when };
    }),
  );
  log(`✓ ${NOTES_LIST.length} notifications`);

  /* Approval history + activity log */
  for (let i = 0; i < approvals.length; i += 100) await db.insert(s.partnerApprovals).values(approvals.slice(i, i + 100).map((a) => ({ ...a, partnerId: pid })));
  const ACTIVITY: { who: string; action: string; entity: string; id: number | string | null; summary: string; when: Date }[] = [
    { who: "owner", action: "create", entity: "application", id: null, summary: "Started the dealer partner application", when: createdAt },
    { who: "owner", action: "submit", entity: "application", id: pid, summary: `Submitted application ${reference}`, when: firstSubmit },
    { who: "owner", action: "submit", entity: "application", id: pid, summary: `Resubmitted application ${reference} with the requested changes`, when: resubmit },
    ...STAFF.map((m, i) => ({ who: "owner", action: "invite", entity: "staff", id: members[m.key].memberId, summary: `Added ${m.name} as ${m.role.replace(/_/g, " ")}`, when: at(approvedOffset + 1 + i, 11, 30) })),
    { who: "owner", action: "update", entity: "profile", id: pid, summary: "Updated the public dealership profile", when: at(approvedOffset + 1, 17, 0) },
    ...vehicleRows.filter((v) => v.spec.status !== "draft").map((v) => ({ who: "owner", action: "submit", entity: "vehicle", id: v.id, summary: `Submitted ${vehicleLabels[v.spec.key]} for approval`, when: plusMin(at(-v.spec.days, 11, 30), 25) })),
    ...OFFERS.filter((o) => o.status !== "draft").map((o) => ({ who: "harika", action: "submit", entity: "offer", id: offerIds[o.key], summary: `Submitted offer ${offerRefs[o.key]} “${o.title}” for approval`, when: past(plusMin(at(-o.createdDays, 10, 15), 40)) })),
    { who: "harika", action: "pause", entity: "offer", id: offerIds.corporate, summary: `Paused offer ${offerRefs.corporate}`, when: at(-2, 18, 0) },
    { who: "kiran", action: "assign", entity: "lead", id: null, summary: "Assigned 2 enquiries to Lakshmi Prasanna", when: at(-2, 10, 0) },
    { who: "owner", action: "payment", entity: "invoice", id: paidInv.insertId, summary: `Recorded a bank transfer for ${paidNumber}`, when: new Date(`${addDays(paidIssued, 2)}T18:05:00+05:30`) },
    { who: "owner", action: "create", entity: "ticket", id: ticket.insertId, summary: `Opened support ticket ${ticketRef}`, when: ticketAt },
    { who: "owner", action: "reply", entity: "review", id: null, summary: "Replied to Venkata Ramana's review", when: at(-5, 10, 0) },
  ];
  await db.insert(s.partnerActivity).values(
    ACTIVITY.map((a) => ({ partnerId: pid, userId: members[a.who].userId, action: a.action, entity: a.entity, entityId: a.id === null ? null : String(a.id), summary: a.summary.slice(0, 300), createdAt: past(a.when) })),
  );
  log(`✓ ${approvals.length} approval-history rows, ${ACTIVITY.length} activity-log rows`);

  // The reviews changed the public rating — sync once more.
  await syncPartnerEverywhere(pid);
  return { pid, reference, publicDealerId, imageFailures: mediaFor.failures };
}

/* ── Main ───────────────────────────────────────────────────── */

async function main() {
  if (RESET && REMOVE) throw new Error("Use either --reset or --remove, not both.");
  const creds = credentials();
  const existing = await findDemo(creds.email);

  if (REMOVE) {
    if (!existing.length) console.log(`No demo dealership found (${TRADE_NAME} / ${creds.email}). Nothing to remove.`);
    for (const p of existing) await removePartner(p);
    if (existing.length) console.log("\nNote: the running site caches its listings for up to an hour. The demo showroom disappears from public pages on the next admin save or within the hour.");
    return;
  }
  if (existing.length && !RESET) {
    console.log(`The demo dealership already exists: ${existing.map((p) => `${p.reference}${p.publicDealerId ? ` (/dealers/${p.publicDealerId})` : ""}`).join(", ")}.`);
    console.log("Nothing changed. Run with -- --reset to recreate it, or -- --remove to delete it.");
    return;
  }
  if (existing.length) {
    console.log("Removing the existing demo dealership…");
    for (const p of existing) await removePartner(p);
  }
  console.log(`Creating ${TRADE_NAME}…`);
  const r = await createDemo(creds.email, creds.password);
  console.log(`\n✓ Done. ${TRADE_NAME} is ${r.reference} (partner #${r.pid}).`);
  console.log(`  Sign in at /dealer/login as ${creds.email}`);
  console.log(`  Password: ${creds.generated ? "generated and saved to .env.local as DEMO_DEALER_PASSWORD" : "DEMO_DEALER_PASSWORD from .env.local"}`);
  if (r.publicDealerId) console.log(`  Public page: /dealers/${r.publicDealerId}`);
  if (r.imageFailures) console.log(`  ! ${r.imageFailures} photo(s) couldn't be downloaded and point at the remote URL instead.`);
  console.log("\nNote: a running dev server caches public listings for up to an hour. The showroom, offers and used cars appear on public pages after the next admin or dealer save (e.g. saving the profile in the portal), or within the hour.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());

