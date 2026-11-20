import type { Metadata } from "next";
import Link from "next/link";
import { inArray } from "drizzle-orm";
import { Lock, ScrollText } from "lucide-react";
import { getDb } from "@/db";
import { insCampaigns, insCompanies, insProducts, insQuotes, insVendors } from "@/db/schema";
import { INS_APPROVAL_TARGETS } from "@/db/enums";
import { requireStaff } from "@/server/auth";
import { auditEntities, dayRange, listInsAudit, PAGE_SIZE, staffOptions, vendorOptions, type AuditEntry } from "@/server/admin/insurance-ops";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, formatDateTime, pageParam, strParam } from "@/components/admin/ui";
import { ActionBadge } from "@/components/admin/activity";
import { DateRangeFields, EmptyBox, OpsActionPill, sideLabel } from "@/components/admin/insurance/ops/kit";
import { INS_TARGET_LABEL, humanize } from "@/components/admin/insurance/ops/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Insurance audit log" };

const BASE = "/admin/insurance/audit";

/** What staff call each audit_log entity. */
const ENTITY_LABEL: Record<string, string> = {
  ins_vendor: "Vendor",
  ins_company: "Insurance company",
  ins_product: "Product",
  ins_cover: "Coverage / add-on",
  ins_campaign: "Promotional campaign",
  ins_enquiry: "Enquiry",
  ins_quote: "Quote",
  ins_renewal: "Renewal",
  ins_invoice: "Invoice",
  ins_payment: "Payment",
  ins_refund: "Refund",
  ins_ticket: "Support ticket",
  ins_ticket_note: "Ticket internal note",
  ins_file: "Document",
  ins_change_request: "Change request",
  ad_campaign: "Ad campaign",
  ad_creative: "Ad creative",
  ad_placement: "Ad placement",
  content: "Insurance settings",
};
const entityLabel = (e: string) => ENTITY_LABEL[e] ?? humanize(e.replace(/^ins_/, "").replace(/^ad_/, "ad "));

/** Where staff look at the record an entry is about. */
function hrefFor(e: AuditEntry): string | null {
  const id = e.aboutId && /^\d+$/.test(e.aboutId) ? e.aboutId : null;
  if (e.source === "approval") {
    switch (e.about) {
      case "campaign":
        return id ? `/admin/insurance/campaigns/${id}` : null;
      case "conversion":
        return id ? `/admin/insurance/enquiries/${id}` : null;
      case "payment":
        return "/admin/insurance/payments";
      case "ad_campaign":
      case "ad_creative":
        return "/admin/advertising";
      case "product":
        return id ? `/admin/insurance/products/${id}` : null;
      case "cover":
        return id ? `/admin/insurance/coverage?review=${id}` : null;
      case "company":
        return id ? `/admin/insurance/companies/${id}` : "/admin/insurance/companies";
      case "document":
        return e.vendorId ? `/admin/insurance/vendors/${e.vendorId}?tab=documents` : null;
      case "profile_change":
        return e.vendorId ? `/admin/insurance/vendors/${e.vendorId}?tab=changes` : null;
      default:
        return e.vendorId ? `/admin/insurance/vendors/${e.vendorId}` : null;
    }
  }
  switch (e.about) {
    case "ins_enquiry":
      return id && `/admin/insurance/enquiries/${id}`;
    case "ins_quote":
      return id && `/admin/insurance/quotes/${id}`;
    case "ins_campaign":
      return id && `/admin/insurance/campaigns/${id}`;
    case "ins_invoice":
      return id && `/admin/insurance/invoices/${id}`;
    case "ins_payment":
      return "/admin/insurance/payments";
    case "ins_refund":
      return "/admin/insurance/refunds";
    case "ins_ticket":
    case "ins_ticket_note":
      return id && `/admin/insurance/support/${id}`;
    case "ins_vendor":
      return id && `/admin/insurance/vendors/${id}`;
    case "content":
      return e.aboutId ? `/admin/content/${e.aboutId}` : null;
    default:
      return e.about.startsWith("ad_") ? "/admin/advertising" : e.vendorId ? `/admin/insurance/vendors/${e.vendorId}` : null;
  }
}

/** Records that can be deleted (drafts, removed vendors…): the log keeps their entries, but a link to them would 404. */
const DELETABLE = [
  { re: /^\/admin\/insurance\/products\/(\d+)/, table: insProducts },
  { re: /^\/admin\/insurance\/vendors\/(\d+)/, table: insVendors },
  { re: /^\/admin\/insurance\/campaigns\/(\d+)/, table: insCampaigns },
  { re: /^\/admin\/insurance\/quotes\/(\d+)/, table: insQuotes },
  { re: /^\/admin\/insurance\/companies\/(\d+)/, table: insCompanies },
] as const;

/** The hrefs on this page that point at a record that no longer exists. */
async function goneHrefs(hrefs: (string | null)[]): Promise<Set<string>> {
  const gone = new Set<string>();
  const db = getDb();
  await Promise.all(
    DELETABLE.map(async ({ re, table }) => {
      const byId = new Map<number, string[]>();
      for (const h of hrefs) {
        const id = h?.match(re)?.[1];
        if (id) byId.set(Number(id), [...(byId.get(Number(id)) ?? []), h!]);
      }
      if (!byId.size) return;
      const live = new Set((await db.select({ id: table.id }).from(table).where(inArray(table.id, [...byId.keys()]))).map((r) => r.id));
      for (const [id, hs] of byId) if (!live.has(id)) hs.forEach((h) => gone.add(h));
    }),
  );
  return gone;
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const range = dayRange(strParam(sp.from), strParam(sp.to));
  const params = { q: strParam(sp.q)?.slice(0, 80), vendor: strParam(sp.vendor), about: strParam(sp.about), side: strParam(sp.side), staff: strParam(sp.staff), from: range.from, to: range.to };
  const [{ rows, total, page }, vendors, staff, entities] = await Promise.all([listInsAudit(params, pageParam(sp.page)), vendorOptions(), staffOptions(), auditEntities()]);
  const hasFilters = Object.values(params).some(Boolean);
  const gone = await goneHrefs(rows.map(hrefFor));

  return (
    <>
      <AdminHeader
        title="Audit log"
        description="One timeline of every insurance and advertising workflow step (submissions and decisions, including staff-only internal notes) and every staff change to insurance records, newest first."
      />

      <FilterForm resetHref={BASE} hasFilters={hasFilters}>
        <SearchInput value={params.q} placeholder="Remarks, summary, vendor…" />
        <FilterSelect name="vendor" label="All vendors" value={params.vendor} options={vendors} />
        <FilterSelect
          name="about"
          label="Everything"
          value={params.about}
          options={[
            ...INS_APPROVAL_TARGETS.map((t) => ({ value: `t:${t}`, label: `Workflow · ${INS_TARGET_LABEL[t]}` })),
            ...entities.map((e) => ({ value: `e:${e}`, label: `Record · ${entityLabel(e)}` })),
          ]}
        />
        <FilterSelect
          name="side"
          label="Anyone"
          value={params.side}
          options={[
            { value: "admin", label: "MarchGear staff" },
            { value: "vendor", label: "Vendors" },
            { value: "system", label: "System" },
          ]}
        />
        <FilterSelect name="staff" label="Any staff member" value={params.staff} options={staff} />
        <DateRangeFields from={params.from} to={params.to} label="Between (IST)" />
      </FilterForm>

      {rows.length === 0 ? (
        <EmptyBox icon={<ScrollText aria-hidden className="size-5" />} title={hasFilters ? "Nothing matches these filters" : "Nothing recorded yet"}>
          {hasFilters ? "Try a wider date range or fewer filters." : "Workflow steps and staff changes are recorded here as they happen."}
        </EmptyBox>
      ) : (
        <div className="relative overflow-x-auto border border-line bg-white">
          <table className="w-full min-w-[980px] border-collapse text-left text-[13.5px]">
            <thead>
              <tr className="text-[12px] text-muted">
                {["When (IST)", "Vendor", "About", "Action", "Details", "By"].map((h) => (
                  <th key={h} className="border-b border-line bg-mist/60 px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const internal = r.action === "internal_note" || r.about === "ins_ticket_note";
                const link = hrefFor(r);
                const deleted = link !== null && gone.has(link);
                const href = deleted ? null : link;
                const about = r.source === "approval" ? INS_TARGET_LABEL[r.about as keyof typeof INS_TARGET_LABEL] ?? humanize(r.about) : entityLabel(r.about);
                return (
                  <tr key={r.key} className={cn("align-top transition-colors hover:bg-mist/40", internal && "bg-mist/40")}>
                    <td className="min-w-[130px] border-b border-line px-4 py-3 text-[12.5px]">{formatDateTime(r.createdAt)}</td>
                    <td className="max-w-[200px] border-b border-line px-4 py-3">
                      {r.vendorId && r.vendorName ? (
                        <>
                          <Link href={`/admin/insurance/vendors/${r.vendorId}`} className="block truncate font-medium hover:text-red">
                            {r.vendorName}
                          </Link>
                          <span className="text-[12px] text-muted num">{r.vendorRef}</span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="min-w-[150px] border-b border-line px-4 py-3">
                      {href ? (
                        <Link href={href} className="hover:text-red">
                          {about}
                        </Link>
                      ) : (
                        about
                      )}
                      <span className="block text-[11.5px] text-muted">
                        {r.source === "approval" ? "Workflow step" : "Staff change"}
                        {r.aboutId && r.about !== "content" ? ` · #${r.aboutId}` : ""}
                        {deleted ? " · deleted" : ""}
                      </span>
                    </td>
                    <td className="border-b border-line px-4 py-3">
                      {r.source === "approval" ? <OpsActionPill action={r.action} /> : <ActionBadge action={r.action} />}
                      {internal && (
                        <span className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                          <Lock aria-hidden className="size-3" /> Staff only
                        </span>
                      )}
                    </td>
                    <td className="min-w-[260px] max-w-[380px] border-b border-line px-4 py-3">
                      {r.fromStatus && r.toStatus && r.fromStatus !== r.toStatus && (
                        <p className="mb-1 text-[12px] text-muted">
                          {humanize(r.fromStatus)} → <span className="font-medium text-ink">{humanize(r.toStatus)}</span>
                        </p>
                      )}
                      {r.text ? <p className="line-clamp-4 whitespace-pre-line break-words text-[13px]">{r.text}</p> : <span className="text-muted">—</span>}
                    </td>
                    <td className="whitespace-nowrap border-b border-line px-4 py-3 text-[12.5px]">
                      {r.actorName ?? "—"}
                      <span className="block text-muted">{sideLabel(r.actorSide)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}
