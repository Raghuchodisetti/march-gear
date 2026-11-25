import type { ReactNode } from "react";

export interface PolicyRow {
  name: string;
  /** Who sets it, e.g. "MarchGear" or "Google". */
  by: string;
  purpose: ReactNode;
  duration: string;
}

/** A cookie / storage table: a real table from md up, stacked cards on phones (only one is ever displayed). */
export function PolicyTable({ caption, rows, nameLabel = "Name" }: { caption: string; rows: PolicyRow[]; nameLabel?: string }) {
  return (
    <div className="border border-line bg-white">
      <table className="hidden w-full border-collapse text-left text-[13.5px] md:table">
        <caption className="border-b border-line px-5 py-3.5 text-left text-[13px] font-semibold text-ink">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-mist/60 text-[11.5px] uppercase tracking-[0.1em] text-muted">
            <th scope="col" className="w-[26%] px-5 py-2.5 font-semibold">
              {nameLabel}
            </th>
            <th scope="col" className="px-5 py-2.5 font-semibold">
              Purpose
            </th>
            <th scope="col" className="w-[20%] px-5 py-2.5 font-semibold">
              Lasts
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-line align-top last:border-b-0">
              <th scope="row" className="px-5 py-3.5 font-normal">
                <code className="break-all font-mono text-[12.5px] font-semibold text-ink">{r.name}</code>
                <span className="mt-1 block text-[12px] text-muted">{r.by}</span>
              </th>
              <td className="px-5 py-3.5 leading-relaxed text-ink/80">{r.purpose}</td>
              <td className="px-5 py-3.5 text-ink/80">{r.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="md:hidden">
        <p className="border-b border-line px-4 py-3 text-[13px] font-semibold text-ink">{caption}</p>
        <ul>
          {rows.map((r) => (
            <li key={r.name} className="border-b border-line px-4 py-3.5 last:border-b-0">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <code className="break-all font-mono text-[12.5px] font-semibold text-ink">{r.name}</code>
                <span className="text-[12px] text-muted">{r.by}</span>
              </p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/80">{r.purpose}</p>
              <p className="mt-1.5 text-[12.5px] text-muted">
                Lasts: <span className="text-ink">{r.duration}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
