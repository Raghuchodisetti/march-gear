import type { Metadata } from "next";
import Link from "next/link";
import { CRM_STATUS, type CrmStatus } from "@/db/enums";
import { CRM_STATUS_LABEL } from "@/partner/labels";
import { requirePartner } from "@/server/partner/context";
import { leadAccess, queryCustomers, type CustomerRow } from "@/server/partner/crm";
import { Pagination, PortalHeader, filterInput, hrefWith, pageParam, strParam } from "@/components/portal/ui";
import { cn } from "@/lib/utils";
import { Initials, LeadStatusBadge } from "@/components/portal/crm/badges";
import { formatIstDay, relativeTime } from "@/components/portal/crm/pipeline";

export const metadata: Metadata = { title: "Customers" };

const PAGE_SIZE = 30;
const SORTS = { recent: "Recently active", enquiries: "Most enquiries", name: "Name A–Z", new: "Newest customers" } as const;
type Sort = keyof typeof SORTS;

export default async function Page({ searchParams }: PageProps<"/dealer/customers">) {
  const ctx = await requirePartner({ perm: "customers.view" });
  const sp = await searchParams;
  const q = strParam(sp.q)?.toLowerCase().slice(0, 80);
  const statusP = strParam(sp.status);
  const status = CRM_STATUS.includes(statusP as CrmStatus) ? (statusP as CrmStatus) : undefined;
  const segment = strParam(sp.segment);
  const sortP = strParam(sp.sort) as Sort | undefined;
  const sort: Sort = sortP && sortP in SORTS ? sortP : "recent";
  const page = pageParam(sp.page);

  const all = leadAccess(ctx) ? await queryCustomers(ctx) : [];
  const digits = q?.replace(/\D/g, "") ?? "";
  let rows = all.filter(
    (c) =>
      (!q || c.name.toLowerCase().includes(q) || (c.email ?? "").includes(q) || (digits.length >= 3 && (c.mobile ?? "").includes(digits)) || c.cars.some((car) => car.toLowerCase().includes(q))) &&
      (!status || c.latestStatus === status) &&
      (!segment || (segment === "converted" ? c.won > 0 : segment === "repeat" ? c.enquiries > 1 : segment === "test_drive" ? c.testDrives > 0 : true)),
  );
  rows = rows.sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name) : sort === "enquiries" ? b.enquiries - a.enquiries || (a.lastActivity < b.lastActivity ? 1 : -1) : sort === "new" ? (a.firstSeen < b.firstSeen ? 1 : -1) : a.lastActivity < b.lastActivity ? 1 : -1,
  );
  const total = rows.length;
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const params = { q: strParam(sp.q), status, segment, sort: sort === "recent" ? undefined : sort };

  const converted = all.filter((c) => c.won > 0).length;
  const repeat = all.filter((c) => c.enquiries > 1).length;
  const withDrive = all.filter((c) => c.testDrives > 0).length;
  const now = new Date().getTime();

  return (
    <>
      <PortalHeader
        title="Customers"
        description={leadAccess(ctx) === "all" ? "Everyone who has enquired with you, grouped by mobile number (or email)." : "Customers from the enquiries assigned to you."}
      />

      <section aria-label="Customer summary" className="mb-6 grid grid-cols-2 border border-line bg-white lg:grid-cols-4">
        {[
          { label: "Customers", value: all.length, note: "People with at least one enquiry", seg: undefined },
          { label: "Converted", value: converted, note: all.length ? `${Math.round((converted / all.length) * 100)}% lifetime conversion` : "—", seg: "converted" },
          { label: "Asked for a test drive", value: withDrive, note: "Requested, booked or driven", seg: "test_drive" },
          { label: "Repeat enquirers", value: repeat, note: "More than one enquiry", seg: "repeat" },
        ].map((s, i) => (
          <Link
            key={s.label}
            href={hrefWith("/dealer/customers", params, { segment: s.seg, page: undefined })}
            className={cn("block p-5 transition-colors hover:bg-mist/50", i % 2 === 1 && "border-l border-line", i >= 2 && "border-t border-line lg:border-t-0", i > 0 && "lg:border-l", segment === s.seg && "bg-mist/60")}
          >
            <p className="text-[12px] text-muted">{s.label}</p>
            <p className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.03em] num">{s.value}</p>
            <p className="mt-1.5 truncate text-[12px] text-muted">{s.note}</p>
          </Link>
        ))}
      </section>

      <form method="get" className="mb-4 flex flex-col gap-2 border border-line bg-white p-3 md:flex-row md:flex-wrap md:items-center">
        <input type="search" name="q" defaultValue={strParam(sp.q)} placeholder="Name, mobile, email or car" aria-label="Search customers" className={cn(filterInput, "w-full md:w-80")} />
        <select name="status" defaultValue={status ?? ""} aria-label="Latest enquiry status" className={cn(filterInput, "cursor-pointer")}>
          <option value="">Any latest status</option>
          {CRM_STATUS.map((s) => (
            <option key={s} value={s}>
              {CRM_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select name="segment" defaultValue={segment ?? ""} aria-label="Segment" className={cn(filterInput, "cursor-pointer")}>
          <option value="">All customers</option>
          <option value="converted">Converted</option>
          <option value="test_drive">Took a test drive</option>
          <option value="repeat">Repeat enquirers</option>
        </select>
        <select name="sort" defaultValue={sort} aria-label="Sort" className={cn(filterInput, "cursor-pointer")}>
          {Object.entries(SORTS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <div className="flex gap-2 md:ml-auto">
          {(q || status || segment || sort !== "recent") && (
            <Link href="/dealer/customers" className="inline-flex h-10 items-center px-3 text-[13px] font-medium text-muted hover:text-ink">
              Reset
            </Link>
          )}
          <button type="submit" className="inline-flex h-10 flex-1 items-center justify-center rounded-[3px] bg-ink px-5 text-[13px] font-medium text-white transition-colors hover:bg-ink-3 md:flex-none">
            Apply
          </button>
        </div>
      </form>

      {pageRows.length === 0 ? (
        <div className="border border-line bg-white px-6 py-14 text-center text-[14px] text-muted">{all.length ? "No customers match these filters." : "Customers appear here as enquiries come in."}</div>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {pageRows.map((c) => (
              <li key={c.key}>
                <Link href={`/dealer/customers/${c.key}`} className="block border border-line bg-white p-4 transition-colors hover:border-ink/30">
                  <div className="flex items-start gap-3">
                    <Initials name={c.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[14.5px] font-semibold">{c.name}</p>
                        <LeadStatusBadge status={c.latestStatus} />
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-muted num">{c.mobile ?? c.email}</p>
                      <p className="mt-2 truncate text-[12.5px] text-ink/75">{c.cars.join(" · ") || "No car specified"}</p>
                      <p className="mt-2 text-[12px] text-muted num">
                        {c.enquiries} enquir{c.enquiries === 1 ? "y" : "ies"} · {c.testDrives} test drive{c.testDrives === 1 ? "" : "s"} · active {relativeTime(c.lastActivity, now)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <CustomerTable rows={pageRows} now={now} />
        </>
      )}
      {total > PAGE_SIZE ? (
        <Pagination base="/dealer/customers" params={params} page={page} pageSize={PAGE_SIZE} total={total} />
      ) : total ? (
        <p className="mt-4 text-[13px] text-muted num">
          {total} customer{total === 1 ? "" : "s"}
        </p>
      ) : null}
    </>
  );
}

function CustomerTable({ rows, now }: { rows: CustomerRow[]; now: number }) {
  return (
    <div className="hidden overflow-x-auto border border-line bg-white md:block">
      <table className="w-full min-w-[960px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="bg-mist/60 text-[12px] text-muted">
            {["Customer", "Interested in", "Enquiries", "Test drives", "Conversion", "Latest status", "Last contact", "Last activity"].map((h) => (
              <th key={h} className="border-b border-line px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.key} className="group transition-colors duration-300 hover:bg-mist/50">
              <td className="border-b border-line px-4 py-3.5">
                <Link href={`/dealer/customers/${c.key}`} className="flex max-w-[230px] items-center gap-3">
                  <Initials name={c.name} className="size-8 text-[11px]" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold group-hover:underline group-hover:underline-offset-4">{c.name}</span>
                    <span className="block truncate text-[12px] text-muted num">{[c.mobile, c.email].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
              </td>
              <td className="border-b border-line px-4 py-3.5">
                {/* Auto table layout ignores a cell's max-width — cap the text instead so long car names truncate. */}
                <p className="max-w-[180px] truncate" title={c.cars.join(" · ")}>{c.cars.join(" · ") || <span className="text-muted">—</span>}</p>
              </td>
              <td className="border-b border-line px-4 py-3.5 num">{c.enquiries}</td>
              <td className="border-b border-line px-4 py-3.5 num">{c.testDrives}</td>
              <td className="border-b border-line px-4 py-3.5 num">
                {Math.round((c.won / c.enquiries) * 100)}%<span className="ml-1 text-[12px] text-muted">({c.won})</span>
              </td>
              <td className="border-b border-line px-4 py-3.5">
                <LeadStatusBadge status={c.latestStatus} />
              </td>
              <td className="whitespace-nowrap border-b border-line px-4 py-3.5 text-[12.5px] text-muted num">{c.lastContact ? relativeTime(c.lastContact, now) : "Not yet"}</td>
              <td className="whitespace-nowrap border-b border-line px-4 py-3.5 text-[12.5px] text-muted num" title={`First enquiry ${formatIstDay(c.firstSeen)}`}>
                {relativeTime(c.lastActivity, now)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
