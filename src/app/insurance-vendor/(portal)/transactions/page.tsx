import type { Metadata } from "next";
import { CreditCard, FileText } from "lucide-react";
import { requireInsurer } from "@/server/insurance/context";
import { getInsPayments, getInsRefunds } from "@/server/insurance/subscription";
import { PortalHeader, StatCard } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { InsTransactions } from "@/components/insurance/vendor/billing/transactions";
import { rupees, type InsTransaction } from "@/components/insurance/vendor/billing/shared";

export const metadata: Metadata = { title: "Transactions" };

export default async function Page() {
  const ctx = await requireInsurer({ perm: "billing.manage" });
  const [payments, refunds] = await Promise.all([getInsPayments(ctx.vendor.id), getInsRefunds(ctx.vendor.id)]);

  const rows: InsTransaction[] = [
    ...payments.map(({ payment: p, number, kind }) => ({
      key: `p-${p.id}`,
      type: "payment" as const,
      id: p.id,
      invoiceId: p.invoiceId,
      invoiceNumber: number,
      invoiceKind: kind,
      amount: p.amount,
      method: p.method,
      reference: p.utr,
      on: p.paidOn,
      recordedAt: p.createdAt.toISOString(),
      status: p.status,
      remarks: p.remarks,
      proof: p.proof ? { id: p.proof.id, filename: p.proof.filename } : null,
    })),
    ...refunds.map(({ refund: r, number, kind }) => ({
      key: `r-${r.id}`,
      type: "refund" as const,
      id: r.id,
      invoiceId: r.invoiceId,
      invoiceNumber: number,
      invoiceKind: kind,
      amount: r.amount,
      method: null,
      reference: r.reference,
      on: r.refundedOn,
      recordedAt: r.createdAt.toISOString(),
      status: "refunded" as const,
      remarks: r.reason,
      proof: null,
    })),
  ].sort((a, b) => b.on.localeCompare(a.on) || b.recordedAt.localeCompare(a.recordedAt));

  const total = (f: (r: InsTransaction) => boolean) => rows.filter(f).reduce((s, r) => s + r.amount, 0);
  const paid = total((r) => r.type === "payment" && r.status === "verified");
  const pending = total((r) => r.type === "payment" && r.status === "submitted");
  const refunded = total((r) => r.type === "refund");
  const pendingCount = rows.filter((r) => r.type === "payment" && r.status === "submitted").length;
  const rejectedCount = rows.filter((r) => r.status === "rejected").length;

  return (
    <>
      <PortalHeader
        title="Transactions"
        description="Every payment you've recorded against a MarchGear invoice, how verification went, and any refunds."
        actions={
          <>
            <Button href="/insurance-vendor/billing" variant="ghost" size="sm" icon={<CreditCard className="size-4" aria-hidden />}>
              Billing
            </Button>
            <Button href="/insurance-vendor/invoices" variant="outline" size="sm" icon={<FileText className="size-4" aria-hidden />}>
              Invoices
            </Button>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Paid (verified)" value={rupees(paid)} note="Payments MarchGear has verified" />
        <StatCard label="Pending verification" value={rupees(pending)} note={`${pendingCount} payment${pendingCount === 1 ? "" : "s"} being checked`} />
        <StatCard label="Refunded" value={rupees(refunded)} note="Paid back by MarchGear" />
        <StatCard label="Net paid" value={rupees(paid - refunded)} note={rejectedCount ? `Verified less refunds · ${rejectedCount} rejected not counted` : "Verified payments less refunds"} />
      </div>

      <InsTransactions rows={rows} />

      <p className="mt-6 text-[12.5px] leading-relaxed text-muted">
        No payment gateway is connected: these are the bank transfer, UPI and cheque references you recorded. Amounts include GST. A rejected payment isn&apos;t counted — record it again from the invoice
        with the correct reference.
      </p>
    </>
  );
}
