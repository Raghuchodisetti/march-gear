import "server-only";
import { desc, like } from "drizzle-orm";
import { getDb, type Database } from "@/db";
import { insInvoices } from "@/db/schema";
import type { InsInvoiceKind } from "@/db/enums";
import { isDuplicate } from "@/server/db-errors";
import { gstOn, istDate } from "@/components/portal/billing/shared";

/* ──────────────────────────────────────────────────────────────
   Insurance vendor invoices — one numbering series for every kind
   (subscription, advertising, lead fee): MGI/26-27/00001.
   No payment gateway: vendors pay by bank transfer / UPI / cheque
   and record the UTR; staff verify it in /admin/insurance/payments.
   ────────────────────────────────────────────────────────────── */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Db = Database | Tx;
export type InsInvoiceRow = typeof insInvoices.$inferSelect;

/** Indian financial year prefix, e.g. 20 Nov 2026 → "MGI/26-27/". */
function fyPrefix(today: string) {
  const y = Number(today.slice(0, 4));
  const start = Number(today.slice(5, 7)) >= 4 ? y : y - 1;
  return `MGI/${String(start % 100).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}/`;
}

/** Inserts an invoice with the next serial number of the financial year. Amount is ₹ before GST (18% added). */
export async function insertInsInvoice(
  inv: {
    vendorId: number;
    kind: InsInvoiceKind;
    description: string;
    plan?: string | null;
    adCampaignId?: number | null;
    periodStart: string;
    periodEnd: string;
    amount: number;
    dueOn: string;
    paid?: boolean;
  },
  db: Db = getDb(),
) {
  const prefix = fyPrefix(istDate());
  const [last] = await db
    .select({ number: insInvoices.number })
    .from(insInvoices)
    .where(like(insInvoices.number, `${prefix}%`))
    .orderBy(desc(insInvoices.number))
    .limit(1);
  const base = last ? Number(last.number.slice(prefix.length)) || 0 : 0;
  const gst = gstOn(inv.amount);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const number = `${prefix}${String(base + attempt).padStart(5, "0")}`;
    try {
      const [res] = await db.insert(insInvoices).values({
        vendorId: inv.vendorId,
        number,
        kind: inv.kind,
        description: inv.description.slice(0, 300),
        plan: inv.plan ?? null,
        adCampaignId: inv.adCampaignId ?? null,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        amount: inv.amount,
        gst,
        total: inv.amount + gst,
        status: inv.paid ? "paid" : "due",
        dueOn: inv.dueOn,
        paidAt: inv.paid ? new Date() : null,
      });
      return { id: res.insertId, number, gst, total: inv.amount + gst };
    } catch (err) {
      if (!isDuplicate(err) || attempt === 5) throw err;
    }
  }
  throw new Error("Couldn't number the invoice");
}

/** Due, overdue (past due date, unpaid) and so on, as of IST today. */
export function insInvoiceDisplayStatus(i: Pick<InsInvoiceRow, "status" | "dueOn">, today = istDate()): InsInvoiceRow["status"] {
  if (i.status === "due" && i.dueOn < today) return "overdue";
  return i.status;
}
