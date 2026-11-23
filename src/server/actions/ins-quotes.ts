"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { insEnquiries, insQuotes, insRenewals } from "@/db/schema";
import { INS_QUOTE_AUTHORIZATION } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import { INS_QUOTE_AUTH_SHORT, quoteDisplayStatus } from "@/insurance/labels";
import { insurerAction, isInsurerError, type InsurerContext } from "@/server/insurance/context";
import { insReference, logInsurerActivity, shareToken } from "@/server/insurance/records";
import { addEnquiryEvent, enquiryInScope, quoteScope, setEnquiryStatus } from "@/server/insurance/crm";
import { builderProducts, insuranceSettings, pricingConfig, resolveVehicle } from "@/server/insurance/quote-builder";
import { isDuplicate } from "@/server/db-errors";
import { invalid, isoDate, todayISO } from "@/server/validation";
import { notifyCustomerOfQuote } from "@/server/customer/notifications";
import { addDays } from "@/components/portal/billing/shared";
import { QUOTE_MOVES_FROM } from "@/components/insurance/vendor/crm/shared";
import { MAX_COVER_LINES, priceQuote, productProblems } from "@/components/insurance/vendor/quotes/pricing";

/* ──────────────────────────────────────────────────────────────
   Vendor quotations: save a draft, submit it to the customer,
   withdraw, revise (duplicate into a new draft), discard a draft
   and record that the customer's link was shared. Premiums are
   always recomputed here — the builder's figures are a preview.
   ────────────────────────────────────────────────────────────── */

const id = z.number().int().positive();
const NOT_FOUND = { ok: false as const, error: "That quote no longer exists or isn't on one of your enquiries." };
const MAX_VALIDITY_DAYS = 60;
const refresh = () => revalidatePath("/insurance-vendor", "layout");
const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;

async function quoteInScope(ctx: InsurerContext, quoteId: number) {
  const [row] = await getDb().select().from(insQuotes).where(and(quoteScope(ctx), eq(insQuotes.id, quoteId)));
  return row ?? null;
}

const text = (max: number) => z.string().trim().max(max).optional().default("");

const saveSchema = z.object({
  quoteId: id.optional(),
  enquiryId: id,
  vehicle: z.object({
    brand: z.string().trim().max(80),
    model: z.string().trim().max(120),
    variant: z.string().trim().max(120),
    year: z.number().int().min(1990).max(2100).nullable(),
    isNew: z.boolean(),
  }),
  productId: z.number({ error: "Choose a product" }).int().positive("Choose a product"),
  idv: z.number().int().min(0).max(100_000_000).nullable(),
  ncbPct: z.number().int().min(0).max(65),
  includePa: z.boolean(),
  addOnIds: z.array(id).max(30),
  voluntaryDeductible: z.number().int().min(0).max(1_000_000),
  adjustment: z.number({ error: "Enter an amount (or 0)" }).int("Use whole rupees").min(-10_000_000).max(10_000_000),
  coverage: z
    .array(z.object({ name: z.string().trim().min(2, "Name this cover").max(80), detail: z.string().trim().max(300) }))
    .min(1, "Add at least one coverage line")
    .max(MAX_COVER_LINES, `Keep it to ${MAX_COVER_LINES} lines`),
  validUntil: isoDate,
  authorization: z.enum(INS_QUOTE_AUTHORIZATION),
  insurerQuoteRef: text(80),
  declaration: z.boolean(),
  notes: text(2000),
  terms: text(4000),
  submit: z.boolean(),
});

/** Saves the builder (new draft or an existing draft); `submit` also sends it to the customer. */
export async function saveQuoteAction(input: unknown): Promise<ActionResult<{ id: number; reference: string; submitted: boolean }>> {
  const ctx = await insurerAction("quotes.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const db = getDb();

  const enquiry = await enquiryInScope(ctx, d.enquiryId);
  if (!enquiry) return { ok: false, error: "That enquiry no longer exists or isn't assigned to you." };
  if (enquiry.status === "policy_issued" || enquiry.status === "closed") return { ok: false, error: "This enquiry is closed — reopen it before quoting." };
  const existing = d.quoteId ? await quoteInScope(ctx, d.quoteId) : null;
  if (d.quoteId && (!existing || existing.enquiryId !== enquiry.id)) return NOT_FOUND;
  if (existing && existing.status !== "draft") return { ok: false, error: "Only drafts can be edited. Use “Revise” to start a new version." };

  const [products, config] = await Promise.all([builderProducts(ctx.vendor.id), pricingConfig()]);
  const product = products.find((p) => p.id === d.productId);
  if (!product) return { ok: false, fieldErrors: { productId: "Choose one of your approved or published products" } };
  const resolved = await resolveVehicle({ ...d.vehicle, city: enquiry.city ?? "", state: enquiry.state ?? "" });
  if (!resolved.ok) return { ok: false, error: resolved.error, fieldErrors: { [`vehicle.${resolved.field}`]: resolved.error } };
  if (!d.vehicle.isNew && !d.vehicle.year) return { ok: false, fieldErrors: { "vehicle.year": "Enter the manufacturing year" } };
  const vehicle = resolved.vehicle;
  const today = todayISO();
  const eligibility = productProblems(product, vehicle, config, today);
  if (eligibility.length) return { ok: false, error: `${product.name} can't be offered for this car: ${eligibility[0]}.`, fieldErrors: { productId: eligibility[0] } };

  const { breakdown, problems } = priceQuote(vehicle, product, d, config, today);
  if (Object.keys(problems).length) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: problems };

  const fieldErrors: Record<string, string> = {};
  if (d.validUntil < today) fieldErrors.validUntil = "Choose today or a later date";
  else if (d.validUntil > addDays(today, MAX_VALIDITY_DAYS)) fieldErrors.validUntil = `A quote can be valid for up to ${MAX_VALIDITY_DAYS} days`;
  const ref = d.insurerQuoteRef;
  if (d.authorization === "insurer_authorised") {
    if (ref && !/^[A-Za-z0-9][A-Za-z0-9/\-_. ]{2,79}$/.test(ref)) fieldErrors.insurerQuoteRef = "Use the insurer's reference as printed (letters, numbers, / - _ .)";
    if (d.submit && !ref) fieldErrors.insurerQuoteRef = "Enter the insurer's quotation reference";
    if (d.submit && !d.declaration) fieldErrors.declaration = "Confirm the insurer issued this quotation and you may share it";
  }
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please check the highlighted fields.", fieldErrors };

  // The builder may have corrected the car (e.g. picked the exact variant) — keep the enquiry in step.
  const vehicleChanged =
    enquiry.brand !== vehicle.brand || enquiry.model !== vehicle.model || enquiry.variant !== vehicle.variant || enquiry.vehicleIsNew !== vehicle.isNew || (enquiry.year ?? null) !== vehicle.year;
  if (vehicleChanged) {
    await db
      .update(insEnquiries)
      .set({
        brand: vehicle.brand,
        brandName: vehicle.brandName,
        model: vehicle.model,
        modelName: vehicle.modelName,
        variant: vehicle.variant,
        variantName: vehicle.variantName,
        year: vehicle.year,
        vehicleIsNew: vehicle.isNew,
        fuel: vehicle.fuel || enquiry.fuel,
      })
      .where(eq(insEnquiries.id, enquiry.id));
    await addEnquiryEvent(ctx, enquiry.id, "note", `Vehicle details updated while quoting\n${vehicle.brandName} ${vehicle.modelName} ${vehicle.variantName}${vehicle.isNew ? " · new car" : vehicle.year ? ` · ${vehicle.year}` : ""}`, { edit: true });
  }

  const values = {
    productId: product.id,
    authorization: d.authorization,
    insurerQuoteRef: d.authorization === "insurer_authorised" ? ref || null : null,
    idv: breakdown.idv,
    coverage: d.coverage.map((c) => ({ name: c.name, detail: c.detail })),
    breakdown,
    total: breakdown.total,
    validUntil: d.validUntil,
    notes: d.notes || null,
    terms: d.terms || null,
  };

  let quoteId = existing?.id ?? 0;
  let reference = existing?.reference ?? "";
  if (existing) {
    await db.update(insQuotes).set(values).where(eq(insQuotes.id, existing.id));
    await logInsurerActivity(ctx.vendor.id, ctx.user.id, "update", "quote", existing.id, `Updated draft ${existing.reference} (${rs(breakdown.total)})`);
  } else {
    for (let attempt = 0; attempt < 3 && !quoteId; attempt++) {
      reference = insReference("QTE");
      try {
        const [res] = await db.insert(insQuotes).values({ ...values, reference, vendorId: ctx.vendor.id, enquiryId: enquiry.id, status: "draft", shareToken: shareToken(), createdBy: ctx.user.id });
        quoteId = res.insertId;
      } catch (err) {
        if (!isDuplicate(err) || attempt === 2) throw err;
      }
    }
    await addEnquiryEvent(ctx, enquiry.id, "quote", `Quote ${reference} drafted · ${rs(breakdown.total)} · ${INS_QUOTE_AUTH_SHORT[d.authorization]}`, { quoteId, action: "draft" });
    await logInsurerActivity(ctx.vendor.id, ctx.user.id, "create", "quote", quoteId, `Drafted ${reference} for ${enquiry.reference} (${rs(breakdown.total)})`);
  }

  if (d.submit) {
    const [fresh] = await db.select().from(insQuotes).where(eq(insQuotes.id, quoteId));
    const res = await submit(ctx, fresh);
    if (!res.ok) {
      refresh();
      // The draft is saved; say why it couldn't be sent.
      return { ...res, error: res.error ?? `Saved as draft ${reference}, but it couldn't be sent yet.` };
    }
  }
  refresh();
  return { ok: true, id: quoteId, reference, submitted: d.submit };
}

/** Sends a draft: share token, submittedAt, enquiry → quote submitted, timeline row (and the renewal moves to "quote sent"). */
async function submit(ctx: InsurerContext, quote: typeof insQuotes.$inferSelect): Promise<ActionResult> {
  const db = getDb();
  const today = todayISO();
  if (quote.status !== "draft") return { ok: false, error: "This quote has already been sent." };
  if (quote.validUntil < today) return { ok: false, fieldErrors: { validUntil: "The validity date has passed — choose a new one" } };
  if (quote.authorization === "insurer_authorised" && !quote.insurerQuoteRef) return { ok: false, fieldErrors: { insurerQuoteRef: "Enter the insurer's quotation reference" } };
  const enquiry = await enquiryInScope(ctx, quote.enquiryId);
  if (!enquiry) return { ok: false, error: "That enquiry no longer exists or isn't assigned to you." };
  const products = await builderProducts(ctx.vendor.id);
  if (!quote.productId || !products.some((p) => p.id === quote.productId)) return { ok: false, error: "The product on this quote is no longer approved. Choose another product." };

  const token = shareToken();
  await db.update(insQuotes).set({ status: "submitted", submittedAt: new Date(), shareToken: token }).where(eq(insQuotes.id, quote.id));
  await addEnquiryEvent(
    ctx,
    enquiry.id,
    "quote",
    `Quote ${quote.reference} sent to the customer · ${rs(quote.total)}\n${quote.authorization === "insurer_authorised" ? `Insurer-authorised quotation · insurer ref ${quote.insurerQuoteRef}` : "Indicative estimate — not an insurer quotation"} · valid until ${quote.validUntil}`,
    { quoteId: quote.id, action: "submitted" },
  );
  if (QUOTE_MOVES_FROM.includes(enquiry.status) && enquiry.status !== "quote_submitted") await setEnquiryStatus(ctx, enquiry, "quote_submitted");
  else await db.update(insEnquiries).set({ updatedAt: new Date() }).where(eq(insEnquiries.id, enquiry.id));

  // A renewal waiting on this enquiry moves to "quote sent".
  const renewals = await db
    .select({ id: insRenewals.id, reference: insRenewals.reference })
    .from(insRenewals)
    .where(and(eq(insRenewals.vendorId, ctx.vendor.id), eq(insRenewals.enquiryId, enquiry.id), inArray(insRenewals.status, ["upcoming", "contacted", "follow_up"])));
  for (const r of renewals) {
    await db.update(insRenewals).set({ status: "quote_sent" }).where(eq(insRenewals.id, r.id));
    await logInsurerActivity(ctx.vendor.id, ctx.user.id, "status", "renewal", r.id, `Quote ${quote.reference} sent → Quote sent`);
  }
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "submit", "quote", quote.id, `Sent ${quote.reference} to ${enquiry.name} (${rs(quote.total)})`);
  // A signed-in customer also finds it in /account/notifications (no SMS or email is sent).
  await notifyCustomerOfQuote({
    userId: enquiry.userId,
    vendorName: ctx.vendor.brandName || ctx.vendor.legalName || "Your insurer",
    car: [enquiry.brandName, enquiry.modelName].filter(Boolean).join(" ") || null,
    quote: { reference: quote.reference, total: quote.total, authorization: quote.authorization, insurerQuoteRef: quote.insurerQuoteRef, validUntil: quote.validUntil },
    token,
  });
  return { ok: true };
}

export async function submitQuoteAction(input: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("quotes.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ id }).safeParse(input);
  if (!parsed.success) return NOT_FOUND;
  const quote = await quoteInScope(ctx, parsed.data.id);
  if (!quote) return NOT_FOUND;
  const res = await submit(ctx, quote);
  if (res.ok) refresh();
  return res;
}

const withdrawSchema = z.object({ id, reason: z.string().trim().max(300).optional().default("") });

export async function withdrawQuoteAction(input: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("quotes.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const quote = await quoteInScope(ctx, parsed.data.id);
  if (!quote) return NOT_FOUND;
  if (quote.status !== "submitted") return { ok: false, error: "Only quotes that have been sent (and not answered) can be withdrawn." };
  await getDb().update(insQuotes).set({ status: "withdrawn" }).where(eq(insQuotes.id, quote.id));
  await addEnquiryEvent(ctx, quote.enquiryId, "quote", `Quote ${quote.reference} withdrawn${parsed.data.reason ? `\n${parsed.data.reason}` : ""}`, { quoteId: quote.id, action: "withdrawn" });
  await getDb().update(insEnquiries).set({ updatedAt: new Date() }).where(eq(insEnquiries.id, quote.enquiryId));
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "withdraw", "quote", quote.id, `Withdrew ${quote.reference}`);
  refresh();
  return { ok: true };
}

/** Duplicates a quote into a new draft (fresh reference, link and validity) for editing. */
export async function reviseQuoteAction(input: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const ctx = await insurerAction("quotes.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ id }).safeParse(input);
  if (!parsed.success) return NOT_FOUND;
  const quote = await quoteInScope(ctx, parsed.data.id);
  if (!quote) return NOT_FOUND;
  if (quote.status === "draft") return { ok: false, error: "This is still a draft — edit it directly." };
  const enquiry = await enquiryInScope(ctx, quote.enquiryId);
  if (!enquiry) return { ok: false, error: "That enquiry no longer exists or isn't assigned to you." };
  if (enquiry.status === "policy_issued" || enquiry.status === "closed") return { ok: false, error: "This enquiry is closed — reopen it before quoting again." };
  const settings = await insuranceSettings();
  const db = getDb();
  let newId = 0;
  let reference = "";
  for (let attempt = 0; attempt < 3 && !newId; attempt++) {
    reference = insReference("QTE");
    try {
      const [res] = await db.insert(insQuotes).values({
        reference,
        vendorId: ctx.vendor.id,
        enquiryId: quote.enquiryId,
        productId: quote.productId,
        status: "draft",
        authorization: quote.authorization,
        // An insurer's reference belongs to one quotation — a revision needs its own.
        insurerQuoteRef: null,
        idv: quote.idv,
        coverage: quote.coverage,
        breakdown: quote.breakdown,
        total: quote.total,
        validUntil: addDays(todayISO(), settings.quoteValidityDays),
        notes: quote.notes,
        terms: quote.terms,
        shareToken: shareToken(),
        createdBy: ctx.user.id,
      });
      newId = res.insertId;
    } catch (err) {
      if (!isDuplicate(err) || attempt === 2) throw err;
    }
  }
  await addEnquiryEvent(ctx, quote.enquiryId, "quote", `Revising ${quote.reference} — new draft ${reference}`, { quoteId: newId, action: "revised", from: quote.id });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "revise", "quote", newId, `Revised ${quote.reference} into draft ${reference}`);
  refresh();
  return { ok: true, id: newId, reference };
}

export async function discardQuoteDraftAction(input: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("quotes.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ id }).safeParse(input);
  if (!parsed.success) return NOT_FOUND;
  const quote = await quoteInScope(ctx, parsed.data.id);
  if (!quote) return NOT_FOUND;
  if (quote.status !== "draft") return { ok: false, error: "Only drafts can be discarded. Withdraw a sent quote instead." };
  await getDb().delete(insQuotes).where(and(eq(insQuotes.id, quote.id), eq(insQuotes.status, "draft")));
  await addEnquiryEvent(ctx, quote.enquiryId, "quote", `Draft ${quote.reference} discarded`, { quoteId: quote.id, action: "discarded" });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "delete", "quote", quote.id, `Discarded draft ${quote.reference}`);
  refresh();
  return { ok: true };
}

/** Records that the customer link was copied or shared on WhatsApp (the share itself happens in the browser). */
export async function recordQuoteShareAction(input: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("quotes.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ id, channel: z.enum(["copy", "whatsapp", "pdf"]) }).safeParse(input);
  if (!parsed.success) return NOT_FOUND;
  const quote = await quoteInScope(ctx, parsed.data.id);
  if (!quote) return NOT_FOUND;
  const display = quoteDisplayStatus(quote, todayISO());
  if (parsed.data.channel !== "pdf" && display === "draft") return { ok: false, error: "Send the quote before sharing its link." };
  const body = { copy: `Customer link for ${quote.reference} copied`, whatsapp: `Quote ${quote.reference} shared on WhatsApp`, pdf: `PDF of ${quote.reference} downloaded` }[parsed.data.channel];
  await addEnquiryEvent(ctx, quote.enquiryId, "quote", body, { quoteId: quote.id, action: parsed.data.channel });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, parsed.data.channel === "pdf" ? "download" : "share", "quote", quote.id, body);
  refresh();
  return { ok: true };
}
