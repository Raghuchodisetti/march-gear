"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { and, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import { adCampaigns, insCampaigns, insEnquiries, insEnquiryEvents, insQuotes, insRenewals, insVendors } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import type { PremiumEstimate } from "@/insurance/types";
import { parseSearch } from "@/insurance/search";
import { getCatalog } from "@/server/catalog";
import { getSessionUser } from "@/server/auth";
import { HOUR, allowFromIp, take } from "@/server/rate-limit";
import { isDuplicate } from "@/server/db-errors";
import { email, invalid, isoDate, mobile, name, optionalText, todayISO } from "@/server/validation";
import { insReference, notifyInsurer } from "@/server/insurance/records";
import { getPublicProducts } from "@/server/insurance/public";
import { recordAdEnquiry } from "@/server/ads/serve";
import { addDays } from "@/components/portal/billing/shared";
import { estimateProduct, offersAddOn, pricingConfig, productProblems, resolveVehicle, vehicleAssumptions, type MarketProduct } from "@/components/insurance/public/market/engine";

/* ──────────────────────────────────────────────────────────────
   Public insurance Server Actions (docs/insurance-marketplace.md →
   "Public enquiry" and "Vendor quote").

   submitInsuranceEnquiryAction — one ins_enquiries row per chosen
   product (max insuranceSettings.maxQuoteRequests), re-validated and
   re-estimated here: the browser's numbers are never trusted.
   respondToQuoteAction — the customer's "I'm interested" / "Not
   interested" on /insurance/quote/<token>.
   ────────────────────────────────────────────────────────────── */

const TOO_MANY = "Too many requests. Please try again in a little while.";
const id = z.number().int().positive().max(2 ** 31 - 1);
const key = z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/);

const enquirySchema = z.object({
  productIds: z.array(id).min(1, "Choose at least one plan").max(5, "Choose up to 5 plans"),
  /** The vehicle search as URL params — parsed and sanitised with parseSearch(). */
  vehicle: z.record(z.string().max(20), z.string().max(140)).refine((o) => Object.keys(o).length <= 20, "Too many details"),
  addOns: z.array(key).max(20).default([]),
  /** Product id → the IDV the customer chose (clamped to the product's band). */
  idv: z
    .record(z.string().regex(/^\d{1,10}$/), z.number().int().min(0).max(1_000_000_000))
    .refine((o) => Object.keys(o).length <= 10, "Too many plans")
    .optional(),
  name,
  mobile,
  email: z
    .union([z.literal(""), email])
    .optional()
    .transform((v) => v || undefined),
  message: optionalText(1000),
  expiry: z
    .union([z.literal(""), isoDate])
    .optional()
    .transform((v) => v || undefined),
  previousInsurer: optionalText(160),
  consent: z.boolean().refine((v) => v, "Please agree so the insurer can contact you"),
  source: z
    .string()
    .regex(/^[a-z0-9_-]{2,40}$/)
    .optional(),
  campaignId: id.nullish(),
  adCampaignId: id.nullish(),
  /** Product id → the sponsored listing (ad campaign) it was picked from. */
  sponsored: z.record(z.string().regex(/^\d{1,10}$/), id).refine((o) => Object.keys(o).length <= 10, "Too many plans").optional(),
  /** Honeypot. */
  website: z.string().max(500).optional(),
});

export type InsuranceEnquiryInput = z.input<typeof enquirySchema>;
export interface EnquiryReceipt {
  reference: string;
  productName: string;
  companyName: string;
  /** A request for the same plan from this mobile in the last 24 hours was updated instead. */
  updated: boolean;
}

function expiryProblem(expiry: string | undefined, today: string): string | null {
  if (!expiry) return "Enter your current policy's expiry date";
  if (expiry < addDays(today, -3 * 365)) return "That expiry date is too far in the past";
  if (expiry > addDays(today, 3 * 365)) return "That expiry date is too far ahead";
  return null;
}

export async function submitInsuranceEnquiryAction(input: InsuranceEnquiryInput): Promise<ActionResult<{ requests: EnquiryReceipt[] }>> {
  if (!(await allowFromIp("ins-enquiry", 12, HOUR))) return { ok: false, error: TOO_MANY };
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const productIds = [...new Set(d.productIds)];

  const catalog = await getCatalog();
  const products = await getPublicProducts();
  // Bots get a convincing success and nothing is stored.
  if (d.website) {
    return {
      ok: true,
      requests: productIds.map((pid) => ({ reference: insReference("ENQ"), productName: products.find((p) => p.id === pid)?.name ?? "Plan", companyName: "", updated: false })),
    };
  }
  if (!take(`ins-enquiry:m:${d.mobile}`, 8, HOUR)) return { ok: false, error: TOO_MANY };

  const settings = catalog.content.insuranceSettings;
  const config = pricingConfig(catalog.content.insurancePricing);
  if (productIds.length > settings.maxQuoteRequests)
    return { ok: false, error: `You can ask up to ${settings.maxQuoteRequests} plan${settings.maxQuoteRequests === 1 ? "" : "s"} at once.` };

  // The car, re-validated against the catalogue.
  const today = todayISO();
  const search = parseSearch(d.vehicle);
  if (search.intent === "renewal") {
    const expiry = d.expiry ?? search.expiry;
    const problem = expiryProblem(expiry || undefined, today);
    if (problem) return { ok: false, error: problem, fieldErrors: { expiry: problem } };
    search.expiry = expiry;
  }
  const vehicle = resolveVehicle(search, catalog, config, today);
  if (!vehicle) return { ok: false, error: "Choose your car's brand and model.", fieldErrors: { vehicle: "Choose your car's brand and model" } };
  if (vehicle.tooOld) return { ok: false, error: `We can only estimate for cars up to ${config.maxVehicleAgeYears} years old.` };

  // Every plan must still be public and fit the car.
  const chosen: MarketProduct[] = [];
  for (const pid of productIds) {
    const p = products.find((x) => x.id === pid);
    if (!p) return { ok: false, error: "One of the plans you chose is no longer available. Refresh the page and try again." };
    const problems = productProblems(p, vehicle);
    if (problems.length) return { ok: false, error: `${p.name} isn't available for this car: ${problems[0].toLowerCase()}.` };
    chosen.push(p);
  }

  const db = getDb();
  const now = new Date();

  // Attribution: a running promotional campaign of the product's vendor, and the ad that brought the customer.
  let campaign: { id: number; vendorId: number } | null = null;
  if (d.campaignId) {
    const [c] = await db
      .select({ id: insCampaigns.id, vendorId: insCampaigns.vendorId })
      .from(insCampaigns)
      .innerJoin(insVendors, eq(insVendors.id, insCampaigns.vendorId))
      .where(and(eq(insCampaigns.id, d.campaignId), eq(insCampaigns.status, "approved"), lte(insCampaigns.startsAt, now), gte(insCampaigns.endsAt, now), eq(insVendors.status, "approved")))
      .limit(1);
    campaign = c ?? null;
  }
  const adIds = [...new Set([d.adCampaignId ?? 0, ...Object.values(d.sponsored ?? {})].filter((n) => n > 0))];
  const ads = adIds.length
    ? await db
        .select({ id: adCampaigns.id, insVendorId: adCampaigns.insVendorId, house: adCampaigns.house, productId: adCampaigns.productId })
        .from(adCampaigns)
        .where(and(inArray(adCampaigns.id, adIds), eq(adCampaigns.status, "approved")))
    : [];
  const adFor = (p: MarketProduct): number | null => {
    const sponsoredId = d.sponsored?.[String(p.id)];
    const s = sponsoredId ? ads.find((a) => a.id === sponsoredId && a.productId === p.id) : undefined;
    if (s) return s.id;
    const a = d.adCampaignId ? ads.find((x) => x.id === d.adCampaignId) : undefined;
    return a && (a.house || a.insVendorId === p.vendorId) ? a.id : null;
  };

  const user = await getSessionUser();
  const source = d.source ?? "quotes";
  const assumptions = vehicleAssumptions(vehicle);
  const receipts: EnquiryReceipt[] = [];
  const countedAds = new Set<number>();

  for (const p of chosen) {
    const { estimate: raw } = estimateProduct(p, vehicle, { addOns: d.addOns, idv: d.idv?.[String(p.id)] ?? null }, config);
    const estimate: PremiumEstimate = { ...raw, notes: [...raw.notes, ...assumptions] };
    const adCampaignId = adFor(p);
    const values = {
      userId: user?.id ?? null,
      intent: search.intent,
      name: d.name,
      mobile: d.mobile,
      email: d.email ?? null,
      regNumber: search.reg || null,
      vehicleIsNew: vehicle.isNew,
      brand: vehicle.brand,
      brandName: vehicle.brandName,
      model: vehicle.model,
      modelName: vehicle.modelName,
      variant: vehicle.variant || null,
      variantName: vehicle.variantName || null,
      year: vehicle.isNew ? null : search.year,
      fuel: vehicle.fuel || null,
      city: search.city || null,
      state: search.state || null,
      policyStatus: search.policy || (vehicle.isNew ? ("new_vehicle" as const) : null),
      policyExpiry: search.expiry || null,
      previousInsurer: d.previousInsurer ?? null,
      ncbPct: search.ncb,
      claimedLastYear: search.claimed,
      addOns: d.addOns.filter((k) => offersAddOn(p, k, vehicle)),
      idv: estimate.idv || null,
      indicativePremium: estimate.total,
      estimate,
      message: d.message ?? null,
      consentAt: now,
    };

    // A repeat request for the same plan from the same mobile within 24 hours updates that enquiry — but only the same
    // person's (an anonymous one, or this account's): never another signed-in customer's, which would hand it and its
    // quotes to whoever knows their mobile. An anonymous request is linked to an account only when its mobile matches.
    const [existing] = await db
      .select({ id: insEnquiries.id, reference: insEnquiries.reference, userId: insEnquiries.userId })
      .from(insEnquiries)
      .where(
        and(
          eq(insEnquiries.productId, p.id),
          eq(insEnquiries.mobile, d.mobile),
          gte(insEnquiries.createdAt, new Date(now.getTime() - 24 * HOUR)),
          user ? or(isNull(insEnquiries.userId), eq(insEnquiries.userId, user.id)) : isNull(insEnquiries.userId),
        ),
      )
      .orderBy(desc(insEnquiries.createdAt))
      .limit(1);
    const ownsMobile = Boolean(user?.phone && user.phone.replace(/\D/g, "").slice(-10) === d.mobile);
    let enquiryId: number;
    let reference: string;
    if (existing) {
      enquiryId = existing.id;
      reference = existing.reference;
      await db.transaction(async (tx) => {
        await tx
          .update(insEnquiries)
          .set({
            ...values,
            userId: existing.userId ?? (ownsMobile ? values.userId : null),
            ...(campaign && campaign.vendorId === p.vendorId ? { campaignId: campaign.id } : {}),
            ...(adCampaignId ? { adCampaignId } : {}),
          })
          .where(eq(insEnquiries.id, existing.id));
        await tx.insert(insEnquiryEvents).values({
          enquiryId: existing.id,
          vendorId: p.vendorId,
          userId: user?.id ?? null,
          kind: "note",
          body: "The customer sent this request again within 24 hours — their details and the indicative estimate were updated.",
          meta: { source, repeat: true },
        });
        if (search.intent === "renewal") await upsertRenewal(tx, existing.id, p.vendorId, values);
      });
      await notifyInsurer(p.vendorId, {
        kind: "enquiry",
        title: `Quote request updated — ${p.name}`,
        body: `${d.name} sent the request again (${vehicle.title}).`,
        href: `/insurance-vendor/enquiries/${existing.id}`,
      });
    } else {
      let created: { id: number; reference: string } | null = null;
      for (let attempt = 0; attempt < 4 && !created; attempt++) {
        const ref = insReference("ENQ");
        try {
          created = await db.transaction(async (tx) => {
            const [res] = await tx.insert(insEnquiries).values({
              ...values,
              reference: ref,
              vendorId: p.vendorId,
              productId: p.id,
              companyId: p.company.id,
              status: "new",
              source,
              campaignId: campaign && campaign.vendorId === p.vendorId ? campaign.id : null,
              adCampaignId,
            });
            await tx.insert(insEnquiryEvents).values({
              enquiryId: res.insertId,
              vendorId: p.vendorId,
              userId: user?.id ?? null,
              kind: "created",
              body: `Quote request from the website (${source}).`,
              meta: { source, product: p.reference, indicativePremium: estimate.total, campaignId: campaign?.vendorId === p.vendorId ? campaign.id : null, adCampaignId },
            });
            if (search.intent === "renewal") await upsertRenewal(tx, res.insertId, p.vendorId, values);
            return { id: res.insertId, reference: ref };
          });
        } catch (err) {
          if (!isDuplicate(err)) throw err;
        }
      }
      if (!created) return { ok: false, error: "We couldn't save your request. Please try again." };
      enquiryId = created.id;
      reference = created.reference;
      await notifyInsurer(p.vendorId, {
        kind: "enquiry",
        title: `New quote request — ${p.name}`,
        body: `${d.name} · ${vehicle.title}${vehicle.variantName ? ` ${vehicle.variantName}` : ""}${search.intent === "renewal" ? " · renewal" : ""}`,
        href: `/insurance-vendor/enquiries/${enquiryId}`,
      });
      if (adCampaignId && !countedAds.has(adCampaignId)) {
        countedAds.add(adCampaignId);
        await recordAdEnquiry(adCampaignId);
      }
    }
    receipts.push({ reference, productName: p.name, companyName: p.company.name, updated: Boolean(existing) });
  }

  return { ok: true, requests: receipts };
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** The renewal row of an enquiry (`source "enquiry"`, expiry = the customer's policy expiry). */
async function upsertRenewal(
  tx: Tx,
  enquiryId: number,
  vendorId: number,
  v: {
    name: string;
    mobile: string;
    email: string | null;
    regNumber: string | null;
    brandName: string;
    modelName: string;
    variantName: string | null;
    year: number | null;
    fuel: string | null;
    city: string | null;
    previousInsurer: string | null;
    policyExpiry: string | null;
    ncbPct: number;
  },
) {
  if (!v.policyExpiry) return;
  const row = {
    name: v.name,
    mobile: v.mobile,
    email: v.email,
    regNumber: v.regNumber,
    brandName: v.brandName,
    modelName: v.modelName,
    variantName: v.variantName,
    year: v.year,
    fuel: v.fuel,
    city: v.city,
    currentInsurer: v.previousInsurer,
    expiryDate: v.policyExpiry,
    ncbPct: v.ncbPct,
  };
  const [existing] = await tx.select({ id: insRenewals.id }).from(insRenewals).where(and(eq(insRenewals.enquiryId, enquiryId), eq(insRenewals.vendorId, vendorId))).limit(1);
  if (existing) {
    await tx.update(insRenewals).set(row).where(eq(insRenewals.id, existing.id));
    return;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await tx.insert(insRenewals).values({ ...row, reference: insReference("REN"), vendorId, enquiryId, status: "upcoming", source: "enquiry" });
      return;
    } catch (err) {
      if (!isDuplicate(err)) throw err;
    }
  }
  throw new Error("Couldn't allocate a renewal reference");
}

/* ── The customer's response to a quote ─────────────────────── */

const responseSchema = z.object({
  response: z.enum(["accepted", "declined"]),
  note: optionalText(500),
  website: z.string().max(500).optional(),
});

export type QuoteResponseInput = z.input<typeof responseSchema>;

export async function respondToQuoteAction(token: string, input: QuoteResponseInput): Promise<ActionResult<{ status: "accepted" | "declined" }>> {
  if (!(await allowFromIp("ins-quote-response", 20, HOUR))) return { ok: false, error: TOO_MANY };
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{16,48}$/.test(token)) return { ok: false, error: "This quote isn't available." };
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { response, note, website } = parsed.data;
  if (!take(`ins-quote-response:${token}`, 6, HOUR)) return { ok: false, error: TOO_MANY };
  if (website) return { ok: true, status: response };

  const db = getDb();
  const [row] = await db
    .select({ q: { id: insQuotes.id, reference: insQuotes.reference, status: insQuotes.status, validUntil: insQuotes.validUntil, vendorId: insQuotes.vendorId, enquiryId: insQuotes.enquiryId }, e: { status: insEnquiries.status, name: insEnquiries.name } })
    .from(insQuotes)
    .innerJoin(insEnquiries, eq(insEnquiries.id, insQuotes.enquiryId))
    .where(eq(insQuotes.shareToken, token))
    .limit(1);
  if (!row || row.q.status === "draft" || row.q.status === "withdrawn") return { ok: false, error: "This quote isn't available any more." };
  if (row.q.status !== "submitted") return { ok: false, error: "You've already responded to this quote." };
  if (row.q.validUntil < todayISO()) return { ok: false, error: "This quote has expired. Ask the insurer for a fresh one." };

  const now = new Date();
  const user = await getSessionUser();
  const updated = await db.transaction(async (tx) => {
    const [res] = await tx.update(insQuotes).set({ status: response, respondedAt: now }).where(and(eq(insQuotes.id, row.q.id), eq(insQuotes.status, "submitted")));
    if (!res.affectedRows) return false;
    if (response === "accepted" && row.e.status !== "policy_issued" && row.e.status !== "interested") {
      await tx.update(insEnquiries).set({ status: "interested" }).where(eq(insEnquiries.id, row.q.enquiryId));
    }
    await tx.insert(insEnquiryEvents).values({
      enquiryId: row.q.enquiryId,
      vendorId: row.q.vendorId,
      userId: user?.id ?? null,
      kind: "quote",
      body: `${response === "accepted" ? `The customer is interested in quote ${row.q.reference}.` : `The customer declined quote ${row.q.reference}.`}${note ? ` Note: “${note}”` : ""}`,
      meta: { quoteId: row.q.id, response, fromStatus: row.e.status, toStatus: response === "accepted" && row.e.status !== "policy_issued" ? "interested" : row.e.status },
    });
    return true;
  });
  if (!updated) return { ok: false, error: "You've already responded to this quote." };

  await notifyInsurer(row.q.vendorId, {
    kind: "quote",
    title: response === "accepted" ? `Customer interested — quote ${row.q.reference}` : `Quote declined — ${row.q.reference}`,
    body: `${row.e.name}${note ? `: “${note}”` : response === "accepted" ? " would like to go ahead." : " isn't going ahead."}`,
    href: `/insurance-vendor/enquiries/${row.q.enquiryId}`,
  });
  refresh();
  return { ok: true, status: response };
}
