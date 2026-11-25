import Link from "@/components/admin/desk";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, EyeOff, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* Server-safe building blocks for admin pages. */

export function AdminHeader({
  title,
  description,
  back,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-ink">
            <ChevronLeft aria-hidden className="size-4" /> {back.label}
          </Link>
        )}
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[32px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/**
 * "View on site" for an edit page. Records without a public page right now (drafts, hidden,
 * sold…) would only open a 404, so they get a note saying why instead of the link.
 */
export function ViewOnSite({ href, offline }: { href: string; offline?: string | false | null }) {
  if (offline)
    return (
      <span
        title="The website only shows published, visible records. Change the status or visibility below and save to put it live."
        className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-dashed border-line px-3.5 text-[13px] font-medium text-muted"
      >
        <EyeOff aria-hidden className="size-4" /> {offline}
      </span>
    );
  return (
    <Button href={href} target="_blank" variant="outline" size="sm" icon={<ExternalLink className="size-4" aria-hidden />}>
      View on site
    </Button>
  );
}

export function Panel({ title, action, children, className, padded = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn("border border-line bg-white", className)}>
      {title && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, note, href, tone }: { label: string; value: ReactNode; note?: ReactNode; href?: string; tone?: "red" }) {
  const body = (
    <>
      <p className="text-[12.5px] font-medium text-muted">{label}</p>
      <p className={cn("mt-2 font-display text-[30px] font-semibold leading-none tracking-[-0.03em] num", tone === "red" && "text-red")}>{value}</p>
      {note && <p className="mt-2 text-[12.5px] text-muted">{note}</p>}
    </>
  );
  const cls = "block border border-line bg-white p-5 transition-colors";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-ink/30")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const BADGE_TONES = {
  neutral: "bg-mist text-ink",
  red: "bg-red-50 text-red-600",
  green: "bg-[#e8f5ec] text-[#1e7a3c]",
  amber: "bg-[#fdf3e1] text-[#9a5b00]",
  blue: "bg-[#e9f0fb] text-[#2456a6]",
  dark: "bg-ink text-white",
} as const;
export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={cn("inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold", BADGE_TONES[tone])}>{children}</span>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    // relative: keeps sr-only header labels inside the scroll box (they'd otherwise widen the page on phones).
    <div className="relative overflow-x-auto border border-line bg-white">
      <table className="w-full min-w-[720px] border-collapse text-left text-[13.5px]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b border-line bg-mist/60 px-4 py-3 text-[12px] font-semibold text-muted", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-line px-4 py-3 align-top", className)}>{children}</td>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center text-[14px] text-muted">
        {children}
      </td>
    </tr>
  );
}

/** Keeps the current filters when building page links. */
export function hrefWith(base: string, params: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export function Pagination({ base, params, page, pageSize, total }: { base: string; params: Record<string, string | undefined>; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const link = "inline-flex h-9 items-center gap-1 rounded-[3px] border border-line bg-white px-3 text-[13px] font-medium transition-colors hover:border-ink";
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-4 text-[13px] text-muted">
      <p className="num">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className={link} href={hrefWith(base, params, { page: String(page - 1) })}>
            <ChevronLeft aria-hidden className="size-4" /> Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link className={link} href={hrefWith(base, params, { page: String(page + 1) })}>
            Next <ChevronRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** GET form for search + filters on list pages. */
export function FilterForm({ children, resetHref, hasFilters }: { children: ReactNode; resetHref: string; hasFilters: boolean }) {
  return (
    <form method="get" className="mb-4 flex flex-col gap-2 border border-line bg-white p-3 md:flex-row md:flex-wrap md:items-center">
      {children}
      <div className="flex gap-2 md:ml-auto">
        {hasFilters && (
          <Link href={resetHref} className="inline-flex h-10 items-center px-3 text-[13px] font-medium text-muted hover:text-ink">
            Reset
          </Link>
        )}
        <button type="submit" className="inline-flex h-10 items-center rounded-[3px] bg-ink px-4 text-[13px] font-medium text-white transition-colors hover:bg-ink-3">
          Apply
        </button>
      </div>
    </form>
  );
}

export const filterInput =
  "h-10 rounded-[3px] border border-line bg-white px-3 text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink";

export function FilterSelect({ name, value, options, label }: { name: string; value?: string; options: { value: string; label: string }[]; label: string }) {
  return (
    <select name={name} defaultValue={value ?? ""} aria-label={label} className={cn(filterInput, "cursor-pointer md:w-auto")}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SearchInput({ value, placeholder = "Search…" }: { value?: string; placeholder?: string }) {
  return <input type="search" name="q" defaultValue={value} placeholder={placeholder} aria-label="Search" className={cn(filterInput, "w-full md:w-72")} />;
}

const IST = { timeZone: "Asia/Kolkata" } as const;

export function formatDateTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", { ...IST, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatDay(d: Date | string) {
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00+05:30` : d) : d;
  return date.toLocaleDateString("en-IN", { ...IST, day: "numeric", month: "short", year: "numeric" });
}

/** Reads a numeric page param safely. */
export const pageParam = (v: string | string[] | undefined) => Math.max(1, Number.parseInt(String(v ?? "1"), 10) || 1);
export const strParam = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
