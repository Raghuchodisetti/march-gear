import Link from "@/components/admin/desk";
import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { hrefWith } from "@/components/admin/ui";
import { InlineBar } from "@/components/portal/analytics/charts";

/* Server-safe building blocks for /admin/insurance/reports. */

export const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

/** A titled report block with its CSV export link. */
export function ReportSection({ id, title, note, exportKey, params, children, className }: { id: string; title: string; note?: ReactNode; exportKey?: string; params: Record<string, string | undefined>; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn("min-w-0 scroll-mt-20 border border-line bg-white", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="min-w-0">
          <h2 id={`${id}-h`} className="text-[14px] font-semibold">
            {title}
          </h2>
          {note && <p className="mt-0.5 text-[12.5px] text-muted">{note}</p>}
        </div>
        {exportKey && (
          // A plain download link: a client-side <Link> would fetch the route twice.
          <a href={hrefWith("/admin/insurance/reports/export", params, { report: exportKey })} download className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[3px] border border-line px-2.5 text-[12.5px] font-medium transition-colors hover:border-ink">
            <Download aria-hidden className="size-3.5" /> CSV
          </a>
        )}
      </header>
      {children}
    </section>
  );
}

export interface CountRow {
  key: string;
  label: string;
  sub?: string;
  href?: string;
  total: number;
  renewals: number;
  quoted: number;
  reported: number;
  verified: number;
}

/** Enquiries grouped by something, with quoted / reported / verified counts. */
export function CountTable({ rows, first, empty, limit = 12 }: { rows: CountRow[]; first: string; empty: string; limit?: number }) {
  if (!rows.length) return <p className="px-5 py-10 text-center text-[13.5px] text-muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const shown = rows.slice(0, limit);
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[440px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="text-[12px] text-muted">
            <th className="border-b border-line bg-mist/60 px-4 py-2.5 font-semibold">{first}</th>
            <th className="w-[32%] border-b border-line bg-mist/60 px-3 py-2.5 font-semibold">Enquiries</th>
            <th className="border-b border-line bg-mist/60 px-3 py-2.5 text-right font-semibold">Quoted</th>
            <th className="border-b border-line bg-mist/60 px-3 py-2.5 text-right font-semibold" title="Policies reported by the vendor">Reported</th>
            <th className="border-b border-line bg-mist/60 px-4 py-2.5 text-right font-semibold" title="Verified by MarchGear">Verified</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key}>
              <td className="max-w-[180px] border-b border-line px-4 py-2.5">
                {r.href ? (
                  <Link href={r.href} className="block truncate font-medium hover:text-red">
                    {r.label}
                  </Link>
                ) : (
                  <span className="block truncate font-medium">{r.label}</span>
                )}
                {r.sub && <span className="block truncate text-[11.5px] text-muted">{r.sub}</span>}
              </td>
              <td className="border-b border-line px-3 py-2.5">
                <InlineBar value={r.total} max={max} />
              </td>
              <td className="border-b border-line px-3 py-2.5 text-right num">
                {r.quoted}
                <span className="block text-[11px] text-muted">{pct(r.quoted, r.total)}</span>
              </td>
              <td className="border-b border-line px-3 py-2.5 text-right num">{r.reported}</td>
              <td className="border-b border-line px-4 py-2.5 text-right font-semibold num">{r.verified}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && <p className="px-4 py-2.5 text-[12px] text-muted">And {rows.length - limit} more in the CSV.</p>}
    </div>
  );
}

/** Plain table shell matching the report style. */
export function ReportTable({ head, children, minWidth = 640 }: { head: { label: string; right?: boolean; title?: string }[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13px]" style={{ minWidth }}>
        <thead>
          <tr className="text-[12px] text-muted">
            {head.map((h) => (
              <th key={h.label} title={h.title} className={cn("border-b border-line bg-mist/60 px-4 py-2.5 font-semibold", h.right && "text-right")}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const cell = "border-b border-line px-4 py-2.5";
