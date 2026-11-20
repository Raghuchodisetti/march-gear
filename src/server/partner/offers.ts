import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, asc, count, desc, eq, gt, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { dealers, leads, partnerApprovals, partnerBrands, partnerLeads, partnerOffers, partnerShowrooms, partners, users } from "@/db/schema";
import type { OfferCategory } from "@/db/enums";
import { CRM_WON, OFFER_CATEGORY_LABEL, offerDisplayStatus } from "@/partner/labels";
import type { OfferDiscount, OfferLocations } from "@/partner/types";
import { CATALOG_TAG, getCatalog } from "@/server/catalog";
import type { PartnerContext, PartnerRow } from "./context";
import {
  EMPTY_DISCOUNT,
  EMPTY_LOCATIONS,
  EMPTY_MEDIA,
  EMPTY_SCOPE,
  addDays,
  benefitList,
  discountHeadline,
  formatWindow,
  fromIstParts,
  istDay,
  locationLabel,
  offerImage,
  toIstParts,
  vehicleLabel,
  type PublicOffer,
} from "@/components/offers/offer-utils";
import type { ApprovalEntry, EditorBrand, EditorOptions, OfferInput, OfferListItem, OfferTemplateView } from "@/components/portal/offers/offer-input";

/* ──────────────────────────────────────────────────────────────
   Dealer offers & campaigns: portal queries (always scoped by the
   partner), festival templates, and the cached public offer feed.
   ────────────────────────────────────────────────────────────── */

export type OfferRow = typeof partnerOffers.$inferSelect;

export const offerCategoryLabel = (c: string) => OFFER_CATEGORY_LABEL[c as OfferCategory] ?? "Offer";

/* ── Templates ──────────────────────────────────────────────── */

const BASE_TERMS = [
  "Valid on retail purchases booked and invoiced during the offer period at participating showrooms.",
  "Benefits vary by model, variant and fuel type, and are subject to stock availability.",
  "Cannot be combined with any other offer unless stated.",
  "Benefits are not redeemable for cash.",
  "Prices, benefits and availability may change without notice as per manufacturer policy.",
  "The dealership may modify or withdraw the offer; its decision on eligibility is final.",
];
const terms = (...extra: string[]) => [...extra, ...BASE_TERMS].map((t) => `• ${t}`).join("\n");

type WindowSpec = { kind: "fixed"; start: [number, number]; end: [number, number] } | { kind: "rolling"; days: number };

interface TemplateDef {
  key: string;
  name: string;
  category: OfferCategory;
  tone: OfferTemplateView["tone"];
  blurb: string;
  title: string;
  campaign: (year: number) => string;
  tagline: string;
  description: string;
  terms: string;
  window: WindowSpec;
  /** Honest note about the dates we prefill. */
  dateNote: string;
  discount?: Partial<OfferDiscount>;
}

const LUNAR = (festival: string) =>
  `${festival} follows the lunar calendar, so its date changes every year. This window covers the season it usually falls in — tighten it to this year's dates.`;

/** Festival and campaign starting points. Lunar festivals get a season window plus a note — we never guess their exact dates. */
export const OFFER_TEMPLATES: TemplateDef[] = [
  {
    key: "diwali",
    name: "Diwali",
    category: "diwali",
    tone: "gold",
    blurb: "The year's biggest buying season — light up the showroom.",
    title: "Diwali Dhamaka — celebrate with a new car",
    campaign: (y) => `Diwali ${y}`,
    tagline: "Festive savings, priority delivery and a showroom full of lights.",
    description:
      "Bring home a new car this Diwali with festive benefits across the range. Book during the festival window to lock in savings and priority delivery for the auspicious days.",
    terms: terms("Delivery on a specific auspicious date depends on stock and documentation being complete."),
    window: { kind: "fixed", start: [10, 1], end: [11, 15] },
    dateNote: LUNAR("Diwali"),
  },
  {
    key: "dussehra",
    name: "Dussehra",
    category: "dussehra",
    tone: "red",
    blurb: "Navratri to Vijayadashami — the auspicious start to the festive season.",
    title: "Dussehra Celebrations — drive home a win",
    campaign: (y) => `Dussehra ${y}`,
    tagline: "Auspicious bookings, festive benefits on every model.",
    description: "Mark Vijayadashami with a new car. Festive benefits across the range, with bookings open through Navratri.",
    terms: terms(),
    window: { kind: "fixed", start: [9, 15], end: [10, 31] },
    dateNote: LUNAR("Dussehra"),
  },
  {
    key: "sankranti",
    name: "Sankranti",
    category: "sankranti",
    tone: "gold",
    blurb: "Harvest-festival savings for the new season.",
    title: "Sankranti Savings — a fresh start on the road",
    campaign: (y) => `Sankranti ${y}`,
    tagline: "Harvest-season benefits on your next car.",
    description: "Celebrate Makar Sankranti and Pongal with a new car. Festive benefits for the harvest season across the range.",
    terms: terms(),
    window: { kind: "fixed", start: [1, 5], end: [1, 20] },
    dateNote: "Makar Sankranti falls on 14 or 15 January. This window covers both — adjust it if you like.",
  },
  {
    key: "ugadi",
    name: "Ugadi",
    category: "ugadi",
    tone: "green",
    blurb: "New Year for Andhra Pradesh, Telangana and Karnataka.",
    title: "Ugadi New Beginnings",
    campaign: (y) => `Ugadi ${y}`,
    tagline: "Begin the new year with a new car.",
    description: "Start the Telugu and Kannada new year with a new car. Ugadi benefits across the range, with bookings open through the festival.",
    terms: terms(),
    window: { kind: "fixed", start: [3, 10], end: [4, 20] },
    dateNote: LUNAR("Ugadi"),
  },
  {
    key: "year_end",
    name: "Year-End Sale",
    category: "year_end",
    tone: "ink",
    blurb: "December clearance with the year's best benefits.",
    title: "Year-End Sale — the best prices of the year",
    campaign: (y) => `Year-End ${y}`,
    tagline: "December benefits before the calendar turns.",
    description: "Close the year with our biggest benefits on current-year stock. Limited units across models — book before 31 December.",
    terms: terms("Benefits apply to vehicles manufactured in the current calendar year unless stated."),
    window: { kind: "fixed", start: [12, 1], end: [12, 31] },
    dateNote: "Runs for December. Benefits on current-year stock are a common year-end condition — edit the terms if yours differ.",
  },
  {
    key: "new_year",
    name: "New Year",
    category: "new_year",
    tone: "violet",
    blurb: "Ring in the new year with a new set of keys.",
    title: "New Year, New Car",
    campaign: (y) => `New Year ${y + 1}`,
    tagline: "Start the year in something new.",
    description: "Welcome the new year with a new car. Special benefits for the first fortnight of January, with bookings open from Christmas week.",
    terms: terms(),
    window: { kind: "fixed", start: [12, 26], end: [1, 15] },
    dateNote: "Runs from 26 December to 15 January.",
  },
  {
    key: "exchange",
    name: "Exchange Carnival",
    category: "exchange",
    tone: "blue",
    blurb: "Extra value when customers trade in their current car.",
    title: "Exchange Carnival — upgrade for less",
    campaign: () => "Exchange Carnival",
    tagline: "A bonus on top of the best value for your old car.",
    description: "Trade in your current car and get an exchange bonus on top of a fair, transparent valuation. Any make, any model.",
    terms: terms(
      "Exchange bonus applies when a car registered in the buyer's or an immediate family member's name is exchanged at the showroom.",
      "The valuation of the exchanged car is separate from the exchange bonus.",
    ),
    window: { kind: "rolling", days: 30 },
    dateNote: "No fixed season — starts tomorrow and runs for 30 days.",
  },
  {
    key: "corporate",
    name: "Corporate",
    category: "corporate",
    tone: "ink",
    blurb: "Benefits for employees of listed and partner companies.",
    title: "Corporate Advantage",
    campaign: () => "Corporate programme",
    tagline: "Exclusive benefits for working professionals.",
    description: "Salaried professionals get an additional corporate bonus across the range. Bring your company ID to the showroom.",
    terms: terms("The corporate bonus requires a valid employee ID and a recent salary slip or company letter."),
    window: { kind: "rolling", days: 60 },
    dateNote: "No fixed season — starts tomorrow and runs for 60 days.",
  },
  {
    key: "finance",
    name: "Finance",
    category: "finance",
    tone: "blue",
    blurb: "Low-rate loans, low down payments, easy EMIs.",
    title: "Easy Finance Days",
    campaign: () => "Finance fortnight",
    tagline: "Drive home today with easy EMIs.",
    description: "Special finance schemes with partner banks and NBFCs — attractive interest rates, low down payments and quick approvals at the showroom.",
    terms: terms("Finance is at the sole discretion of the lender, subject to credit approval and documentation. Rates vary by tenure and profile."),
    window: { kind: "rolling", days: 30 },
    dateNote: "No fixed season — starts tomorrow and runs for 30 days.",
  },
  {
    key: "insurance",
    name: "Free Insurance",
    category: "insurance",
    tone: "green",
    blurb: "Insurance on the house for a limited period.",
    title: "Free Insurance Fortnight",
    campaign: () => "Insurance offer",
    tagline: "Your first-year insurance, on us.",
    description: "Buy during the offer period and the dealership covers your first-year insurance premium through its partner insurer.",
    terms: terms("Free insurance covers the base premium from the dealership's partner insurer; add-on covers are chargeable."),
    window: { kind: "rolling", days: 15 },
    dateNote: "No fixed season — starts tomorrow and runs for 15 days.",
    discount: { freeInsurance: true },
  },
  {
    key: "accessories",
    name: "Accessories",
    category: "accessories",
    tone: "violet",
    blurb: "Free accessory packs with every booking.",
    title: "Accessories on Us",
    campaign: () => "Accessories offer",
    tagline: "Make it yours — the accessory pack is free.",
    description: "Every booking during the offer period gets a complimentary accessory pack, fitted before delivery.",
    terms: terms("Accessory packs vary by model; they cannot be exchanged for cash or other accessories."),
    window: { kind: "rolling", days: 30 },
    dateNote: "No fixed season — starts tomorrow and runs for 30 days.",
  },
  {
    key: "clearance",
    name: "Clearance Sale",
    category: "clearance",
    tone: "red",
    blurb: "Move ageing stock with sharp, limited-unit pricing.",
    title: "Stock Clearance Sale",
    campaign: () => "Stock clearance",
    tagline: "Limited units. Unlimited value.",
    description: "Sharp prices on select in-stock cars. Limited units — first come, first served.",
    terms: terms("Applies only to the in-stock units listed at the showroom; colour and variant choice is limited to available stock."),
    window: { kind: "rolling", days: 15 },
    dateNote: "No fixed season — starts tomorrow and runs for 15 days. Set a limited stock under Validity.",
  },
  {
    key: "dealership_anniversary",
    name: "Showroom Anniversary",
    category: "dealership_anniversary",
    tone: "gold",
    blurb: "Celebrate your dealership's milestone with customers.",
    title: "Anniversary Celebration",
    campaign: () => "Showroom anniversary",
    tagline: "Thank you for driving with us — here's something special.",
    description: "We're celebrating another year in the city. To say thank you, enjoy anniversary benefits across the range.",
    terms: terms(),
    window: { kind: "rolling", days: 10 },
    dateNote: "Set the dates to your dealership's anniversary — it starts tomorrow for now.",
  },
];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The next usable window for a template, as IST dates. Never starts before tomorrow (approval takes time).
 * `season` is the year the window's season starts in (a 26 Dec – 15 Jan window joined on 5 Jan is still last year's season).
 */
function templateWindow(spec: WindowSpec, now: Date) {
  const tomorrow = addDays(istDay(now), 1);
  if (spec.kind === "rolling") return { startDate: tomorrow, endDate: addDays(tomorrow, spec.days - 1), season: Number(tomorrow.slice(0, 4)) };
  const year = Number(tomorrow.slice(0, 4));
  for (const y of [year - 1, year, year + 1]) {
    const start = `${y}-${pad(spec.start[0])}-${pad(spec.start[1])}`;
    const end = `${spec.end[0] < spec.start[0] ? y + 1 : y}-${pad(spec.end[0])}-${pad(spec.end[1])}`;
    if (end < tomorrow) continue;
    return { startDate: start < tomorrow ? tomorrow : start, endDate: end, season: y };
  }
  return { startDate: tomorrow, endDate: addDays(tomorrow, 29), season: year };
}

export function offerTemplates(now = new Date()): OfferTemplateView[] {
  return OFFER_TEMPLATES.map((t) => {
    const w = templateWindow(t.window, now);
    return {
      key: t.key,
      name: t.name,
      category: t.category,
      categoryLabel: offerCategoryLabel(t.category),
      blurb: t.blurb,
      windowLabel: formatWindow(fromIstParts(w.startDate, "00:00")!, fromIstParts(w.endDate, "23:59")!),
      dateNote: t.dateNote,
      tone: t.tone,
    };
  });
}

/** A fresh, blank offer (starts tomorrow, runs 30 days) or one prefilled from a template. */
export function newOfferInput(templateKey?: string | null, now = new Date()): { input: OfferInput; template: OfferTemplateView | null } {
  const t = OFFER_TEMPLATES.find((x) => x.key === templateKey);
  const w = templateWindow(t?.window ?? { kind: "rolling", days: 30 }, now);
  const input: OfferInput = {
    title: t?.title ?? "",
    campaignName: t?.campaign(w.season) ?? "",
    category: t?.category ?? "",
    description: t?.description ?? "",
    tagline: t?.tagline ?? "",
    terms: t?.terms ?? "",
    scope: { ...EMPTY_SCOPE },
    discount: { ...EMPTY_DISCOUNT, ...(t?.discount ?? {}) },
    startDate: w.startDate,
    startTime: "00:00",
    endDate: w.endDate,
    endTime: "23:59",
    limitedStock: null,
    maxRedemptions: null,
    media: { ...EMPTY_MEDIA, gallery: [] },
    locations: { ...EMPTY_LOCATIONS, showroomIds: [], cities: [], states: [] },
  };
  return { input, template: t ? (offerTemplates(now).find((v) => v.key === t.key) ?? null) : null };
}

export const standardTerms = () => terms();

/** A stored offer as the editor works with it. */
export function offerToInput(o: OfferRow): OfferInput {
  const s = toIstParts(o.startsAt);
  const e = toIstParts(o.endsAt);
  return {
    title: o.title,
    campaignName: o.campaignName,
    category: (o.category as OfferCategory) || "",
    description: o.description,
    tagline: o.tagline,
    terms: o.terms,
    scope: { ...EMPTY_SCOPE, ...o.scope },
    discount: { ...EMPTY_DISCOUNT, ...o.discount },
    startDate: s.date,
    startTime: s.time,
    endDate: e.date,
    endTime: e.time,
    limitedStock: o.limitedStock,
    maxRedemptions: o.maxRedemptions,
    media: { ...EMPTY_MEDIA, ...o.media },
    locations: { ...EMPTY_LOCATIONS, ...o.locations },
  };
}

/* ── Portal queries (scoped by partner) ─────────────────────── */

/** Brands/models/variants this dealer may target, showrooms and city suggestions. */
export const getEditorOptions = cache(async (partnerId: number): Promise<EditorOptions> => {
  const db = getDb();
  const [brandRows, rooms, [p], cat] = await Promise.all([
    db.select().from(partnerBrands).where(eq(partnerBrands.partnerId, partnerId)).orderBy(asc(partnerBrands.brand)),
    db
      .select()
      .from(partnerShowrooms)
      .where(and(eq(partnerShowrooms.partnerId, partnerId), eq(partnerShowrooms.isActive, true)))
      .orderBy(desc(partnerShowrooms.isPrimary), asc(partnerShowrooms.id)),
    db.select({ tradeName: partners.tradeName, legalName: partners.legalName, city: partners.city }).from(partners).where(eq(partners.id, partnerId)),
    getCatalog(),
  ]);

  const brandFor = (slug: string, authorised: boolean, status: string, allowModels: string[] = [], allowVariants: string[] = []): EditorBrand => ({
    slug,
    name: cat.brandName(slug),
    authorised,
    status,
    models: cat
      .carsByBrand(slug)
      .filter((c) => !allowModels.length || allowModels.includes(c.slug))
      .map((c) => {
        const own = allowVariants.filter((v) => v.startsWith(`${c.slug}/`));
        return { slug: c.slug, name: c.name, variants: c.variants.filter((v) => !own.length || own.includes(`${c.slug}/${v.slug}`)).map((v) => ({ slug: v.slug, name: v.name })) };
      }),
  });

  const brands = brandRows.filter((b) => b.status !== "rejected").map((b) => brandFor(b.brand, b.status === "approved", b.status, b.models, b.variants));
  const catalogueBrands = cat.brands.map((b) => brandFor(b.slug, true, "catalogue"));
  const showrooms = rooms.map((r) => ({ id: r.id, name: r.name, city: r.city, state: r.state, address: r.address }));
  const citySuggestions = [...new Set([...showrooms.map((s) => s.city), ...cat.cities.map((c) => c.name)])];
  return { brands, catalogueBrands, showrooms, citySuggestions, dealerName: p?.tradeName || p?.legalName || "Your dealership", dealerCity: showrooms[0]?.city || p?.city || "" };
});

export async function getOffer(partnerId: number, id: number) {
  const [row] = await getDb()
    .select()
    .from(partnerOffers)
    .where(and(eq(partnerOffers.id, id), eq(partnerOffers.partnerId, partnerId)));
  return row ?? null;
}

const OFFER_REF = /OFF-[A-Z0-9]{6}/;

/**
 * Enquiries and conversions per offer. CRM leads linked to an offer (partner_leads.offer_id) count directly
 * (conversions = those reaching a won status); public-site enquiries that name the offer but haven't been
 * linked to a CRM lead yet still count as enquiries.
 */
export async function offerLeadStats(partner: Pick<PartnerRow, "id" | "publicDealerId">, rows: Pick<OfferRow, "id" | "reference" | "enquiries" | "conversions">[]) {
  const out = new Map<number, { enquiries: number; conversions: number }>();
  if (!rows.length) return out;
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const won = sql.join(
    CRM_WON.map((s) => sql`${s}`),
    sql`, `,
  );
  const linked = await db
    .select({ offerId: partnerLeads.offerId, n: count(), won: sql<string | number>`sum(case when ${partnerLeads.status} in (${won}) then 1 else 0 end)` })
    .from(partnerLeads)
    .where(and(eq(partnerLeads.partnerId, partner.id), inArray(partnerLeads.offerId, ids)))
    .groupBy(partnerLeads.offerId);
  for (const l of linked) if (l.offerId) out.set(l.offerId, { enquiries: Number(l.n), conversions: Number(l.won) || 0 });

  if (partner.publicDealerId) {
    const site = await db
      .select({ id: leads.id, source: leads.source, message: leads.message })
      .from(leads)
      .where(and(eq(leads.dealerId, partner.publicDealerId), sql`(${leads.source} like '/offers/OFF-%' or ${leads.message} like '%OFF-%')`));
    if (site.length) {
      const done = await db
        .select({ siteLeadId: partnerLeads.siteLeadId })
        .from(partnerLeads)
        .where(and(eq(partnerLeads.partnerId, partner.id), inArray(partnerLeads.siteLeadId, site.map((s) => s.id)), isNotNull(partnerLeads.offerId)));
      const counted = new Set(done.map((d) => d.siteLeadId));
      const byRef = new Map(rows.map((r) => [r.reference, r.id]));
      for (const s of site) {
        if (counted.has(s.id)) continue;
        const ref = (s.source ?? "").match(OFFER_REF)?.[0] ?? (s.message ?? "").match(OFFER_REF)?.[0];
        const id = ref ? byRef.get(ref) : undefined;
        if (!id) continue;
        const cur = out.get(id) ?? { enquiries: 0, conversions: 0 };
        out.set(id, { ...cur, enquiries: cur.enquiries + 1 });
      }
    }
  }
  // Counters kept on the row (if another module maintains them) never make the numbers go down.
  for (const r of rows) {
    const cur = out.get(r.id) ?? { enquiries: 0, conversions: 0 };
    out.set(r.id, { enquiries: Math.max(cur.enquiries, r.enquiries), conversions: Math.max(cur.conversions, r.conversions) });
  }
  return out;
}

/** Every offer of the dealership, newest first, with labels and live performance numbers. */
export async function listOffers(ctx: Pick<PartnerContext, "partner">, now = new Date()): Promise<OfferListItem[]> {
  const rows = await getDb().select().from(partnerOffers).where(eq(partnerOffers.partnerId, ctx.partner.id)).orderBy(desc(partnerOffers.updatedAt), desc(partnerOffers.id));
  const [stats, opts, cat] = await Promise.all([offerLeadStats(ctx.partner, rows), getEditorOptions(ctx.partner.id), getCatalog()]);
  const authorised = opts.brands.filter((b) => b.authorised).map((b) => b.slug);
  const names = { brand: cat.brandName, model: (s: string) => cat.getCar(s)?.name ?? s, brandOf: (s: string) => cat.getCar(s)?.brand };
  return rows.map((o) => {
    const st = stats.get(o.id) ?? { enquiries: 0, conversions: 0 };
    return {
      id: o.id,
      reference: o.reference,
      title: o.title,
      campaignName: o.campaignName,
      category: o.category,
      categoryLabel: o.category ? offerCategoryLabel(o.category) : "No category",
      tagline: o.tagline,
      status: o.status,
      display: offerDisplayStatus(o, now),
      startsAt: o.startsAt.toISOString(),
      endsAt: o.endsAt.toISOString(),
      image: offerImage(o.media),
      headline: discountHeadline({ ...EMPTY_DISCOUNT, ...o.discount }),
      benefits: benefitList({ ...EMPTY_DISCOUNT, ...o.discount }).length,
      vehicleLabel: vehicleLabel({ ...EMPTY_SCOPE, ...o.scope }, names, authorised),
      locationLabel: locationLabel({ ...EMPTY_LOCATIONS, ...o.locations }, opts.showrooms),
      views: o.views,
      enquiries: st.enquiries,
      conversions: st.conversions,
      limitedStock: o.limitedStock,
      maxRedemptions: o.maxRedemptions,
      redemptions: o.redemptions,
      adminRemarks: o.adminRemarks,
      submittedAt: o.submittedAt?.toISOString() ?? null,
      approvedAt: o.approvedAt?.toISOString() ?? null,
      updatedAt: o.updatedAt.toISOString(),
    };
  });
}

/** The approval timeline of one offer, newest first. */
export async function offerHistory(partnerId: number, offerId: number): Promise<ApprovalEntry[]> {
  const rows = await getDb()
    .select({ a: partnerApprovals, actorName: users.name })
    .from(partnerApprovals)
    .leftJoin(users, eq(users.id, partnerApprovals.actorUserId))
    .where(and(eq(partnerApprovals.partnerId, partnerId), eq(partnerApprovals.target, "offer"), eq(partnerApprovals.targetId, offerId), ne(partnerApprovals.action, "internal_note")))
    .orderBy(desc(partnerApprovals.createdAt), desc(partnerApprovals.id))
    .limit(50);
  return rows.map(({ a, actorName }) => ({
    id: a.id,
    action: a.action,
    fromStatus: a.fromStatus,
    toStatus: a.toStatus,
    remarks: a.remarks,
    actorSide: a.actorSide,
    actorName: a.actorSide === "admin" ? "MarchGear" : (actorName ?? null),
    createdAt: a.createdAt.toISOString(),
  }));
}

/* ── Public feed (cached; filtered by the current time per request) ─ */

type CachedOffer = Omit<PublicOffer, "vehicleLabel" | "locationLabel" | "cities" | "states" | "branches" | "brands"> & {
  locations: OfferLocations;
  showrooms: { id: number; name: string; city: string; state: string; address: string }[];
  authorisedBrands: string[];
};

/**
 * Approved offers of approved dealers that haven't ended yet (scheduled ones included, so static pages can
 * reveal them on time). Tagged `catalog`: admin approvals and dealer pause/cancel expire it.
 */
const loadPublicOffers = unstable_cache(
  async (): Promise<CachedOffer[]> => {
    const db = getDb();
    const rows = await db
      .select({ o: partnerOffers, dealer: { id: dealers.id, name: dealers.name, city: dealers.city, area: dealers.area } })
      .from(partnerOffers)
      .innerJoin(partners, eq(partners.id, partnerOffers.partnerId))
      .innerJoin(dealers, eq(dealers.id, partners.publicDealerId))
      .where(and(eq(partnerOffers.status, "approved"), eq(partners.status, "approved"), eq(dealers.isActive, true), gt(partnerOffers.endsAt, new Date())))
      .orderBy(asc(partnerOffers.endsAt), asc(partnerOffers.id));
    const live = rows.filter(({ o }) => !(o.maxRedemptions && o.redemptions >= o.maxRedemptions));
    const pids = [...new Set(live.map((r) => r.o.partnerId))];
    if (!pids.length) return [];
    const [rooms, brands] = await Promise.all([
      db.select().from(partnerShowrooms).where(and(inArray(partnerShowrooms.partnerId, pids), eq(partnerShowrooms.isActive, true))).orderBy(desc(partnerShowrooms.isPrimary), asc(partnerShowrooms.id)),
      db.select({ partnerId: partnerBrands.partnerId, brand: partnerBrands.brand }).from(partnerBrands).where(and(inArray(partnerBrands.partnerId, pids), eq(partnerBrands.status, "approved"))),
    ]);
    return live.map(({ o, dealer }) => ({
      id: o.id,
      reference: o.reference,
      partnerId: o.partnerId,
      title: o.title,
      campaignName: o.campaignName,
      tagline: o.tagline,
      category: o.category,
      description: o.description,
      terms: o.terms,
      scope: { ...EMPTY_SCOPE, ...o.scope },
      discount: { ...EMPTY_DISCOUNT, ...o.discount },
      media: { ...EMPTY_MEDIA, ...o.media, brochure: o.media.brochure ? { filename: o.media.brochure.filename, size: o.media.brochure.size } : null },
      startsAt: o.startsAt.toISOString(),
      endsAt: o.endsAt.toISOString(),
      limitedStock: o.limitedStock,
      maxRedemptions: o.maxRedemptions,
      dealer,
      locations: { ...EMPTY_LOCATIONS, ...o.locations },
      showrooms: rooms.filter((r) => r.partnerId === o.partnerId).map((r) => ({ id: r.id, name: r.name, city: r.city, state: r.state, address: `${r.address}, ${r.city} ${r.pin}` })),
      authorisedBrands: brands.filter((b) => b.partnerId === o.partnerId).map((b) => b.brand),
    }));
  },
  ["public-partner-offers", "v1"],
  { tags: [CATALOG_TAG], revalidate: 3600 },
);

/** Every cached public offer (live, scheduled — and any that ended since the cache was built), with display labels. Per request. */
const getPublicOffers = cache(async (): Promise<PublicOffer[]> => {
  const [raw, cat] = await Promise.all([loadPublicOffers(), getCatalog()]);
  const names = { brand: cat.brandName, model: (s: string) => cat.getCar(s)?.name ?? s, brandOf: (s: string) => cat.getCar(s)?.brand };
  return raw.map(({ locations, showrooms, authorisedBrands, ...o }) => {
      const loc = locations;
      const picked = loc.mode === "branches" ? showrooms.filter((s) => loc.showroomIds.includes(s.id)) : showrooms;
      let cities: string[];
      let states: string[];
      if (loc.mode === "cities") {
        cities = loc.cities;
        states = [...new Set(cat.cities.filter((c) => loc.cities.includes(c.name)).map((c) => c.state))];
      } else if (loc.mode === "states") {
        states = loc.states;
        cities = [...new Set([...cat.cities.filter((c) => loc.states.includes(c.state)).map((c) => c.name), ...showrooms.filter((s) => loc.states.includes(s.state)).map((s) => s.city)])];
      } else {
        cities = [...new Set(picked.map((s) => s.city))];
        states = [...new Set(picked.map((s) => s.state))];
      }
      const brands = o.scope.allModels || !o.scope.models.length ? (o.scope.brands.length ? o.scope.brands : authorisedBrands) : o.scope.brands.length ? o.scope.brands : [...new Set(o.scope.models.map((m) => cat.getCar(m)?.brand ?? "").filter(Boolean))];
      return {
        ...o,
        brands,
        cities,
        states,
        branches: (loc.mode === "branches" || loc.mode === "all" ? picked : showrooms.filter((s) => cities.includes(s.city) || states.includes(s.state))).map((s) => ({ name: s.name, city: s.city, address: s.address })),
        vehicleLabel: vehicleLabel(o.scope, names, authorisedBrands),
        locationLabel: locationLabel(loc, showrooms),
      };
    });
});

/**
 * The cached feed re-checked against the database (one indexed query): status, dealer approval, window and
 * redemptions are always current, even if something changed without expiring the cache.
 */
async function fresh(offers: PublicOffer[], now: number) {
  if (!offers.length) return offers;
  const rows = await getDb()
    .select({ id: partnerOffers.id, status: partnerOffers.status, startsAt: partnerOffers.startsAt, endsAt: partnerOffers.endsAt, max: partnerOffers.maxRedemptions, used: partnerOffers.redemptions, partner: partners.status })
    .from(partnerOffers)
    .innerJoin(partners, eq(partners.id, partnerOffers.partnerId))
    .where(inArray(partnerOffers.id, offers.map((o) => o.id)));
  const live = new Map(
    rows
      .filter((r) => r.status === "approved" && r.partner === "approved" && !(r.max && r.used >= r.max) && r.startsAt.getTime() <= now && now <= r.endsAt.getTime())
      .map((r) => [r.id, r]),
  );
  return offers.filter((o) => live.has(o.id)).map((o) => ({ ...o, startsAt: live.get(o.id)!.startsAt.toISOString(), endsAt: live.get(o.id)!.endsAt.toISOString() }));
}

/** Offers live right now (approved, inside their window), checked at request time. For dynamic pages. */
export async function liveOffers(now = Date.now()) {
  return fresh(await getPublicOffers(), now);
}

/** One live offer by reference, checked at request time; null when it isn't live. */
export async function publicOfferByRef(ref: string, now = Date.now()) {
  const o = (await getPublicOffers()).find((x) => x.reference === ref);
  return o ? ((await fresh([o], now))[0] ?? null) : null;
}

/** Live and upcoming offers of one public showroom — for the (cached) dealer page, which also filters by time in the browser. */
export async function offersForDealer(dealerId: string) {
  const now = Date.now();
  return (await getPublicOffers()).filter((o) => o.dealer.id === dealerId && new Date(o.endsAt).getTime() >= now);
}

/** Does a (new-car) offer cover this catalogue car? */
export const offerCoversCar = (o: Pick<PublicOffer, "scope" | "brands">, car: { slug: string; brand: string }) =>
  o.scope.vehicleType !== "used" && (o.scope.allModels || !o.scope.models.length ? o.brands.includes(car.brand) : o.scope.models.includes(car.slug));

export async function offersForCar(car: { slug: string; brand: string }) {
  const now = Date.now();
  return (await getPublicOffers()).filter((o) => offerCoversCar(o, car) && new Date(o.endsAt).getTime() >= now);
}
