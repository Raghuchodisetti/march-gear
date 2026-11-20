"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { INS_LEAD_STATUS_LABEL } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { rupees } from "@/components/portal/billing/shared";
import { ExpiryCell, FollowUp, Initials, RenewalStatusBadge } from "@/components/insurance/vendor/crm/badges";
import { RENEWAL_SOURCE_LABEL, daysFrom, formatMobile, type MemberOption, type RenewalActivity, type RenewalItem } from "@/components/insurance/vendor/crm/shared";
import { INS_RENEWAL_OPEN } from "@/insurance/labels";
import { AddRenewalModal } from "./add-renewal-modal";
import { RenewalDrawer } from "./renewal-drawer";

export function RenewalsView({
  rows,
  selected,
  members,
  can,
  now,
  today,
  vendorName,
  emptyHint,
}: {
  rows: RenewalItem[];
  selected: { renewal: RenewalItem; activity: RenewalActivity[] } | null;
  members: MemberOption[];
  can: { assign: boolean; quotes: boolean };
  now: number;
  today: string;
  vendorName: string;
  emptyHint: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const go = (patch: Record<string, string | null>, mode: "push" | "replace" = "push") => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    startTransition(() => router[mode](s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };
  const open = (id: number) => {
    setClicked(id);
    go({ renewal: String(id) });
  };
  const opening = pending ? clicked : null;
  const car = (r: RenewalItem) => [r.brandName, r.modelName].filter(Boolean).join(" ");

  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">Click a renewal to see notes, change its status or prepare a quote.</p>
        <div className="flex items-center gap-2">
          {pending && <Loader2 aria-label="Loading" className="size-4 animate-spin text-muted" />}
          <Button variant="primary" size="sm" onClick={() => setAdding(true)} icon={<Plus className="size-4" aria-hidden />}>
            Add renewal
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center border border-line bg-white px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
            <RefreshCw aria-hidden className="size-5 text-ink/60" />
          </span>
          <p className="mt-4 font-display text-[18px] font-semibold">No renewals here</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">{emptyHint}</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {rows.map((r) => {
              const days = daysFrom(today, r.expiryDate);
              const isOpen = INS_RENEWAL_OPEN.includes(r.status);
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => open(r.id)} className="block w-full border border-line bg-white p-4 text-left active:bg-mist/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14.5px] font-semibold">{r.name}</p>
                        <p className="mt-0.5 truncate text-[12px] text-muted num">
                          {r.reference} · +91 {formatMobile(r.mobile)}
                        </p>
                      </div>
                      {opening === r.id ? <Loader2 aria-hidden className="size-4 animate-spin text-muted" /> : <RenewalStatusBadge status={r.status} />}
                    </div>
                    <p className="mt-3 truncate text-[13.5px]">
                      {car(r) || "Car not given"} {r.regNumber && <span className="font-mono text-[12.5px] text-muted">· {r.regNumber}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-[12.5px] text-muted">{[r.currentInsurer, r.policyType, `NCB ${r.ncbPct}%`].filter(Boolean).join(" · ")}</p>
                    <div className="mt-3 flex items-end justify-between gap-3 border-t border-line pt-3">
                      <ExpiryCell date={r.expiryDate} days={days} muted={!isOpen} />
                      <span className="text-right text-[12px] text-muted">{r.assigned?.name ?? "Unassigned"}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="relative hidden overflow-x-auto border border-line bg-white md:block">
            <table className="w-full min-w-[1000px] border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="bg-mist/60 text-[12px] text-muted">
                  <th className="border-b border-line py-3 pl-4 pr-3 font-semibold">Customer</th>
                  <th className="border-b border-line px-3 py-3 font-semibold">Vehicle</th>
                  <th className="border-b border-line px-3 py-3 font-semibold">Existing policy</th>
                  <th className="border-b border-line px-3 py-3 font-semibold">Expiry</th>
                  <th className="border-b border-line px-3 py-3 font-semibold">Status</th>
                  <th className="border-b border-line py-3 pl-3 pr-4 font-semibold">Executive · follow-up</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const days = daysFrom(today, r.expiryDate);
                  const isOpen = INS_RENEWAL_OPEN.includes(r.status);
                  return (
                    <tr
                      key={r.id}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("a,button")) return;
                        open(r.id);
                      }}
                      className={cn("group cursor-pointer transition-colors hover:bg-mist/50", selected?.renewal.id === r.id && "bg-mist/60")}
                    >
                      <td className="border-b border-line py-3.5 pl-4 pr-3 align-top">
                        <button type="button" onClick={() => open(r.id)} className="flex min-w-0 max-w-[230px] items-start gap-3 text-left">
                          <Initials name={r.name} className="mt-0.5 size-8 text-[11px]" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 truncate font-semibold group-hover:underline group-hover:underline-offset-4">
                              <span className="truncate">{r.name}</span> {opening === r.id && <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin text-muted" />}
                            </span>
                            <span className="mt-0.5 block font-mono text-[11.5px] text-muted">{r.reference}</span>
                            <span className="mt-1 block text-[12.5px] text-ink/75 num">+91 {formatMobile(r.mobile)}</span>
                            {r.email && <span className="block truncate text-[12px] text-muted">{r.email}</span>}
                          </span>
                        </button>
                      </td>
                      <td className="border-b border-line px-3 py-3.5 align-top">
                        <div className="max-w-[200px]">
                          <p className="font-mono text-[12.5px] font-semibold">{r.regNumber ?? <span className="font-sans font-normal text-muted">No registration</span>}</p>
                          <p className="mt-0.5 truncate">{car(r) || <span className="text-muted">—</span>}</p>
                          <p className="truncate text-[12px] text-muted">{[r.variantName, r.year, r.fuel].filter(Boolean).join(" · ") || "—"}</p>
                        </div>
                      </td>
                      <td className="border-b border-line px-3 py-3.5 align-top">
                        <div className="max-w-[210px]">
                          <p className="truncate font-medium">{r.currentInsurer ?? <span className="font-normal text-muted">Insurer not given</span>}</p>
                          <p className="truncate font-mono text-[11.5px] text-muted">{r.policyNumber ?? "No policy number"}</p>
                          <p className="truncate text-[12px] text-muted">
                            {[r.policyType, `NCB ${r.ncbPct}%`, r.premium ? rupees(r.premium) : null].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </td>
                      <td className="border-b border-line px-3 py-3.5 align-top">
                        <ExpiryCell date={r.expiryDate} days={days} muted={!isOpen} />
                      </td>
                      <td className="border-b border-line px-3 py-3.5 align-top">
                        <RenewalStatusBadge status={r.status} />
                        <p className="mt-1 text-[11.5px] text-muted">{RENEWAL_SOURCE_LABEL[r.source] ?? r.source}</p>
                        {r.enquiry && (
                          <Link href={`/insurance-vendor/enquiries/${r.enquiry.id}`} className="mt-1 block font-mono text-[11.5px] text-ink/70 hover:text-ink hover:underline" title={INS_LEAD_STATUS_LABEL[r.enquiry.status]}>
                            {r.enquiry.reference}
                          </Link>
                        )}
                      </td>
                      <td className="border-b border-line py-3.5 pl-3 pr-4 align-top">
                        <p className="max-w-[160px] truncate text-[13px]">{r.assigned?.name ?? <span className="text-muted">Unassigned</span>}</p>
                        {r.followUpAt && <FollowUp at={r.followUpAt} finished={!isOpen} now={now} className="mt-1.5" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Drawer open={Boolean(selected)} onClose={() => go({ renewal: null }, "replace")} title="Renewal" className="max-w-[600px]">
        {selected && (
          <RenewalDrawer
            key={`${selected.renewal.id}-${selected.renewal.updatedAt}-${selected.activity.length}`}
            renewal={selected.renewal}
            activity={selected.activity}
            members={members}
            can={can}
            now={now}
            today={today}
            vendorName={vendorName}
          />
        )}
      </Drawer>
      <AddRenewalModal open={adding} onClose={() => setAdding(false)} members={members} canAssign={can.assign} today={today} onCreated={(id) => go({ view: "all", renewal: String(id), page: null })} />
    </div>
  );
}
