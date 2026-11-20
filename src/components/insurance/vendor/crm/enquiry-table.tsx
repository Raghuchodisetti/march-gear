import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from "lucide-react";
import { INS_POLICY_STATUS_LABEL } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { formatIstDay, formatTime } from "@/components/portal/crm/pipeline";
import { hrefWith } from "@/components/portal/ui";
import { EnquiryStatusBadge, ExpiryCell, FollowUp, Initials, IntentTag, SourceTag, formatDayShort, leadFinished } from "./badges";
import { daysFrom, formatMobile, type EnquiryListItem } from "./shared";

/* The enquiry list: cards on phones, a dense table from tablets up. Server component — rows are links. */

type SortKey = "newest" | "oldest" | "follow_up" | "expiry" | "updated" | "name";

function SortHeader({ label, sort, active, base, params, className }: { label: string; sort: SortKey | [SortKey, SortKey]; active: SortKey; base: string; params: Record<string, string | undefined>; className?: string }) {
  const [first, second] = Array.isArray(sort) ? sort : [sort, null];
  const on = active === first || active === second;
  const next = second && active === first ? second : first;
  const Icon = !on ? ArrowUpDown : second && active === second ? ArrowUp : first === "newest" ? ArrowDown : ArrowUp;
  return (
    <th className={cn("border-b border-line px-3 py-3 font-semibold", className)} aria-sort={on ? (Icon === ArrowUp ? "ascending" : "descending") : undefined}>
      <Link href={hrefWith(base, params, { sort: next === "newest" ? undefined : next, page: undefined })} className={cn("inline-flex items-center gap-1 transition-colors hover:text-ink", on && "text-ink")}>
        {label} <Icon aria-hidden className={cn("size-3.5", !on && "opacity-40")} />
      </Link>
    </th>
  );
}

export function EnquiryTable({
  rows,
  now,
  today,
  sort,
  params,
  emptyHint,
  emptyTitle = "No enquiries match",
}: {
  rows: EnquiryListItem[];
  now: number;
  today: string;
  sort: SortKey;
  params: Record<string, string | undefined>;
  emptyHint: string;
  emptyTitle?: string;
}) {
  const base = "/insurance-vendor/enquiries";
  if (!rows.length)
    return (
      <div className="flex flex-col items-center border border-line bg-white px-6 py-16 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
          <Inbox aria-hidden className="size-5 text-ink/60" />
        </span>
        <p className="mt-4 font-display text-[18px] font-semibold">{emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">{emptyHint}</p>
      </div>
    );

  const car = (r: EnquiryListItem) => [r.brandName, r.modelName && r.brandName && r.modelName.startsWith(r.brandName) ? r.modelName.slice(r.brandName.length).trim() : r.modelName].filter(Boolean).join(" ");

  return (
    <>
      {/* Phones: cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`${base}/${r.id}`} className="block border border-line bg-white p-4 transition-colors active:bg-mist/60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-semibold">{r.name}</p>
                  <p className="mt-0.5 truncate text-[12px] text-muted num">
                    {r.reference} · {formatMobile(r.mobile)}
                  </p>
                </div>
                <EnquiryStatusBadge status={r.status} />
              </div>
              <p className="mt-3 truncate text-[13.5px]">
                {car(r) || "Car not specified"}
                {r.variantName ? <span className="text-muted"> · {r.variantName}</span> : null}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] text-muted">
                {[r.regNumber ?? (r.vehicleIsNew ? "New car" : null), r.year, r.fuel, r.city].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <IntentTag intent={r.intent} />
                {r.product && <span className="truncate text-[12px] font-medium text-ink/80">{r.product.name}</span>}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[12px] text-muted">
                <span>
                  {r.policyStatus ? INS_POLICY_STATUS_LABEL[r.policyStatus] : "Policy status not given"}
                  {r.policyExpiry ? ` · expires ${formatDayShort(r.policyExpiry)}` : ""}
                </span>
                <span className="num">{formatIstDay(r.createdAt)}</span>
              </div>
              {r.followUpAt && <FollowUp at={r.followUpAt} finished={leadFinished(r.status)} now={now} className="mt-2 !flex-row !items-center !gap-2" />}
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablets and up: table */}
      <div className="relative hidden overflow-x-auto border border-line bg-white md:block">
        <table className="w-full min-w-[1000px] border-collapse text-left text-[13.5px]">
          <thead>
            <tr className="bg-mist/60 text-[12px] text-muted">
              <SortHeader label="Customer" sort="name" active={sort} base={base} params={params} className="pl-4" />
              <th className="border-b border-line px-3 py-3 font-semibold">Vehicle</th>
              <SortHeader label="Current policy" sort="expiry" active={sort} base={base} params={params} />
              <th className="border-b border-line px-3 py-3 font-semibold">Product</th>
              <SortHeader label="Status" sort="follow_up" active={sort} base={base} params={params} />
              <SortHeader label="Received" sort={["newest", "oldest"]} active={sort} base={base} params={params} className="pr-4" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = `${base}/${r.id}`;
              const days = r.policyExpiry ? daysFrom(today, r.policyExpiry) : null;
              return (
                <tr key={r.id} className="group relative transition-colors duration-300 hover:bg-mist/50">
                  <td className="border-b border-line py-3.5 pl-4 pr-3 align-top">
                    {/* The whole row is the link's hit area (stretched ::after). */}
                    <Link href={href} className="flex min-w-0 max-w-[215px] items-start gap-3 after:absolute after:inset-0 after:content-['']">
                      <Initials name={r.name} className="mt-0.5 size-8 text-[11px]" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink group-hover:underline group-hover:underline-offset-4">{r.name}</span>
                        <span className="mt-0.5 block truncate font-mono text-[11.5px] text-muted">{r.reference}</span>
                        <span className="mt-1 block truncate text-[12.5px] text-ink/75 num">+91 {formatMobile(r.mobile)}</span>
                        {r.email && <span className="block truncate text-[12px] text-muted">{r.email}</span>}
                        <span className="mt-1 block truncate text-[12px] text-ink/70">{[r.city, r.state].filter(Boolean).join(", ") || "City not given"}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="border-b border-line px-3 py-3.5 align-top">
                    <div className="max-w-[200px]">
                      <p className="font-mono text-[12.5px] font-semibold tracking-wide">{r.regNumber ?? (r.vehicleIsNew ? <span className="font-sans font-medium text-muted">New car</span> : <span className="font-sans font-normal text-muted">No registration</span>)}</p>
                      <p className="mt-0.5 truncate">{car(r) || <span className="text-muted">Car not specified</span>}</p>
                      <p className="truncate text-[12px] text-muted">{[r.variantName, r.year, r.fuel].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                  </td>
                  <td className="border-b border-line px-3 py-3.5 align-top">
                    <p className="max-w-[140px] text-[12.5px] leading-snug">{r.policyStatus ? INS_POLICY_STATUS_LABEL[r.policyStatus] : <span className="text-muted">Not given</span>}</p>
                    {r.policyExpiry && days !== null && (
                      <div className="mt-1">
                        <ExpiryCell date={r.policyExpiry} days={days} muted={leadFinished(r.status)} />
                      </div>
                    )}
                  </td>
                  <td className="border-b border-line px-3 py-3.5 align-top">
                    <div className="max-w-[170px]">
                      <p className="truncate text-[13px] font-medium">{r.product?.name ?? <span className="font-normal text-muted">No product</span>}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <IntentTag intent={r.intent} />
                        <SourceTag source={r.source} />
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-line px-3 py-3.5 align-top">
                    <EnquiryStatusBadge status={r.status} />
                    {r.status === "lost" && r.lostReason && <p className="mt-1 max-w-[150px] truncate text-[11.5px] text-muted">{r.lostReason}</p>}
                    <p className="mt-1.5 max-w-[150px] truncate text-[12px] text-muted">{r.assigned ? r.assigned.name : "Unassigned"}</p>
                    {r.followUpAt && <FollowUp at={r.followUpAt} finished={leadFinished(r.status)} now={now} className="mt-1.5" />}
                  </td>
                  <td className="whitespace-nowrap border-b border-line py-3.5 pl-3 pr-4 align-top text-[12.5px] text-muted num">
                    <span className="block text-ink/80">{formatIstDay(r.createdAt)}</span>
                    <span className="block">{formatTime(r.createdAt)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

