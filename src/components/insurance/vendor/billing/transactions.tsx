"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Download, Paperclip, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { INS_INVOICE_KIND_LABEL } from "@/insurance/labels";
import { Badge, formatDateTime } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/providers/app-provider";
import { PAYMENT_METHOD_SHORT, type PaymentMethod } from "@/components/portal/billing/shared";
import { rupees, type InsTransaction } from "./shared";

/* Every payment the vendor recorded and every refund MarchGear made: filters, totals for the selection, CSV export. */

const STATUS: Record<InsTransaction["status"], { label: string; tone: "blue" | "green" | "red" | "neutral" }> = {
  submitted: { label: "Awaiting verification", tone: "blue" },
  verified: { label: "Verified", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  refunded: { label: "Refunded", tone: "neutral" },
};

const PAGE = 50;
const select = "h-10 min-w-0 cursor-pointer rounded-[3px] border border-line bg-white px-3 text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink";

/** One CSV cell: numbers as they are; text that a spreadsheet would run as a formula gets a leading apostrophe. */
function csvCell(v: string | number) {
  if (typeof v === "number") return String(v);
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function InsTransactions({ rows }: { rows: InsTransaction[] }) {
  const { toast } = useUI();
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!type || r.type === type) &&
        (!status || r.status === status) &&
        (!method || r.method === method) &&
        (!from || r.on >= from) &&
        (!to || r.on <= to) &&
        (!needle || `${r.reference} ${r.invoiceNumber} ${r.remarks ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [rows, type, status, method, from, to, q]);

  const sum = (f: (r: InsTransaction) => boolean) => shown.filter(f).reduce((s, r) => s + r.amount, 0);
  const verified = sum((r) => r.type === "payment" && r.status === "verified");
  const refunded = sum((r) => r.type === "refund");
  const filtered = Boolean(type || status || method || from || to || q.trim());

  const reset = () => {
    setType("");
    setStatus("");
    setMethod("");
    setFrom("");
    setTo("");
    setQ("");
    setLimit(PAGE);
  };

  const exportCsv = () => {
    if (!shown.length) return toast("Nothing to export with these filters.", { tone: "error" });
    const head = ["Date", "Type", "Status", "Amount (INR)", "Method", "Reference", "Invoice", "Invoice kind", "Recorded at (IST)", "Remarks"];
    const lines = shown.map((r) =>
      [
        r.on,
        r.type === "payment" ? "Payment" : "Refund",
        STATUS[r.status].label,
        r.type === "refund" ? -r.amount : r.amount,
        r.method ? PAYMENT_METHOD_SHORT[r.method as PaymentMethod] : "",
        r.reference,
        r.invoiceNumber,
        INS_INVOICE_KIND_LABEL[r.invoiceKind],
        formatDateTime(r.recordedAt),
        r.remarks ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([`﻿${[head.join(","), ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marchgear-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${shown.length} transaction${shown.length === 1 ? "" : "s"}`, { tone: "success" });
  };

  return (
    <div>
      <div className="mb-4 grid gap-2 border border-line bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] xl:flex xl:flex-wrap xl:items-center">
        <label className="relative block min-w-0 sm:col-span-2 lg:col-span-1 xl:w-64">
          <span className="sr-only">Search transactions</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="UTR, reference or invoice no."
            className="h-10 w-full rounded-[3px] border border-line bg-white pl-9 pr-3 text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink"
          />
        </label>
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className={select}>
          <option value="">Payments & refunds</option>
          <option value="payment">Payments</option>
          <option value="refund">Refunds</option>
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
          <option value="">All statuses</option>
          <option value="submitted">Awaiting verification</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="refunded">Refunded</option>
        </select>
        <select aria-label="Method" value={method} onChange={(e) => setMethod(e.target.value)} className={select}>
          <option value="">All methods</option>
          {(["bank_transfer", "upi", "cheque"] as const).map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_SHORT[m]}
            </option>
          ))}
        </select>
        <div className="flex min-w-0 items-center gap-2 sm:col-span-2 lg:col-span-2 xl:col-span-1">
          <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={cn(select, "w-full xl:w-[150px]")} />
          <span className="text-[12px] text-muted">to</span>
          <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={cn(select, "w-full xl:w-[150px]")} />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2 xl:ml-auto">
          {filtered && (
            <button type="button" onClick={reset} className="inline-flex h-10 items-center px-3 text-[13px] font-medium text-muted hover:text-ink">
              Reset
            </button>
          )}
          <Button variant="dark" size="sm" onClick={exportCsv} icon={<Download className="size-4" aria-hidden />} className="h-10 flex-1 sm:flex-none">
            Export CSV
          </Button>
        </div>
      </div>

      <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted num">
        <span>
          {shown.length} of {rows.length} transaction{rows.length === 1 ? "" : "s"}
        </span>
        {filtered && (
          <>
            <span>Verified {rupees(verified)}</span>
            <span>Refunded {rupees(refunded)}</span>
            <span className="font-medium text-ink">Net {rupees(verified - refunded)}</span>
          </>
        )}
      </p>

      {shown.length === 0 ? (
        <div className="border border-dashed border-line bg-white px-6 py-14 text-center">
          <p className="text-[15px] font-semibold">{rows.length ? "No transactions match these filters" : "No transactions yet"}</p>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] text-muted">
            {rows.length ? "Try another type, status or date range." : "Payments you record against invoices, and any refunds from MarchGear, will appear here."}
          </p>
          {!rows.length && (
            <div className="mt-5">
              <Button href="/insurance-vendor/invoices" variant="outline" size="sm">
                Go to invoices
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Phone: cards */}
          <ul className="space-y-3 md:hidden">
            {shown.slice(0, limit).map((r) => (
              <li key={r.key} className="border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className={cn("flex items-center gap-1.5 text-[16px] font-semibold num", r.type === "refund" && "text-[#1e7a3c]")}>
                    {r.type === "refund" ? <ArrowDownLeft className="size-4" aria-hidden /> : <ArrowUpRight className="size-4 text-muted" aria-hidden />}
                    {r.type === "refund" ? "−" : ""}
                    {rupees(r.amount)}
                  </p>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                </div>
                <p className="mt-1.5 break-words text-[12.5px] text-muted">
                  {r.type === "refund" ? "Refund" : r.method ? PAYMENT_METHOD_SHORT[r.method as PaymentMethod] : "Payment"} · ref <span className="break-all num">{r.reference}</span> · {formatDate(r.on)}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {INS_INVOICE_KIND_LABEL[r.invoiceKind]} invoice{" "}
                  <Link href={`/insurance-vendor/invoices/${r.invoiceId}`} className="font-medium text-ink hover:text-red num">
                    {r.invoiceNumber}
                  </Link>
                </p>
                {r.remarks && <p className={cn("mt-2 break-words text-[13px]", r.status === "rejected" ? "text-red" : "text-muted")}>{r.type === "refund" ? r.remarks : `MarchGear: ${r.remarks}`}</p>}
              </li>
            ))}
          </ul>
          <div className="relative hidden overflow-x-auto border border-line bg-white md:block">
            <table className="w-full min-w-[860px] border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-line bg-mist/60 text-[12px] text-muted">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Transaction</th>
                  <th className="px-4 py-3 font-semibold">Invoice</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, limit).map((r) => (
                  <tr key={r.key} className="border-b border-line align-top transition-colors last:border-b-0 hover:bg-[#FAFAFA]">
                    <td className="whitespace-nowrap px-4 py-3">
                      <p>{formatDate(r.on)}</p>
                      <p className="text-[11.5px] text-muted">Recorded {formatDateTime(r.recordedAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1.5 font-medium">
                        {r.type === "refund" ? <ArrowDownLeft className="size-3.5 text-[#1e7a3c]" aria-hidden /> : <ArrowUpRight className="size-3.5 text-muted" aria-hidden />}
                        {r.type === "refund" ? "Refund from MarchGear" : r.method ? PAYMENT_METHOD_SHORT[r.method as PaymentMethod] : "Payment"}
                      </p>
                      <p className="mt-0.5 max-w-[300px] break-all text-[12px] text-muted num">Ref {r.reference}</p>
                      {r.proof && (
                        <a href={`/insurance-vendor/files/${r.proof.id}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-[300px] items-center gap-1 text-[12px] font-medium hover:text-red">
                          <Paperclip className="size-3 shrink-0" aria-hidden /> <span className="truncate">{r.proof.filename}</span>
                        </a>
                      )}
                      {r.remarks && (
                        <p className={cn("mt-1 max-w-[360px] break-words text-[12.5px]", r.status === "rejected" ? "text-red" : "text-muted")}>{r.type === "refund" ? r.remarks : `MarchGear: ${r.remarks}`}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link href={`/insurance-vendor/invoices/${r.invoiceId}`} className="font-medium hover:text-red num">
                        {r.invoiceNumber}
                      </Link>
                      <p className="text-[12px] text-muted">{INS_INVOICE_KIND_LABEL[r.invoiceKind]}</p>
                    </td>
                    <td className={cn("whitespace-nowrap px-4 py-3 text-right font-semibold num", r.type === "refund" && "text-[#1e7a3c]")}>
                      {r.type === "refund" ? "−" : ""}
                      {rupees(r.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length > limit && (
            <div className="mt-4 flex items-center justify-between gap-3 text-[13px] text-muted">
              <p className="num">
                Showing {limit} of {shown.length}
              </p>
              <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
