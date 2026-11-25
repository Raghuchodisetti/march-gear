import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { LifeBuoy } from "lucide-react";
import { TICKET_PRIORITY, TICKET_STATUS } from "@/db/enums";
import { TICKET_PRIORITY_LABEL } from "@/partner/labels";
import { requireStaff } from "@/server/auth";
import { listInsTickets, NEEDS_REPLY, PAGE_SIZE, vendorLabel } from "@/server/admin/insurance-ops";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, StatCard, Table, Td, Th, formatDateTime, pageParam, strParam } from "@/components/admin/ui";
import { EmptyBox, PriorityPill, TicketPill, VendorLink } from "@/components/admin/insurance/ops/kit";
import { INS_TICKET_STATUS_LABEL, ticketCategoryLabel } from "@/components/admin/insurance/ops/labels";

export const metadata: Metadata = { title: "Vendor support" };

const BASE = "/admin/insurance/support";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const params = { q: strParam(sp.q)?.slice(0, 80), status: strParam(sp.status), priority: strParam(sp.priority), category: strParam(sp.category), vendor: strParam(sp.vendor) };
  const { rows, total, page, byStatus, categories, vendors } = await listInsTickets(params, pageParam(sp.page));
  const n = (f: (r: (typeof byStatus)[number]) => boolean) => byStatus.filter(f).reduce((s, r) => s + r.n, 0);
  const hasFilters = Object.values(params).some(Boolean);
  const needsReply = n((r) => NEEDS_REPLY.includes(r.status));

  return (
    <>
      <AdminHeader title="Vendor support" description="Support tickets from insurance vendors. Replies notify the vendor in their portal; internal notes stay with MarchGear." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Needs a reply" value={needsReply} tone={needsReply ? "red" : undefined} href={`${BASE}?status=needs_reply`} />
        <StatCard label="Urgent or high, open" value={n((r) => ["urgent", "high"].includes(r.priority) && !["resolved", "closed"].includes(r.status))} />
        <StatCard label="Awaiting vendor" value={n((r) => r.status === "awaiting_dealer")} href={`${BASE}?status=awaiting_dealer`} />
        <StatCard label="Resolved or closed" value={n((r) => r.status === "resolved" || r.status === "closed")} />
      </div>

      <FilterForm resetHref={BASE} hasFilters={hasFilters}>
        <SearchInput value={params.q} placeholder="Subject, ITK-… or vendor" />
        <FilterSelect name="status" label="All statuses" value={params.status} options={[{ value: "needs_reply", label: "Needs a reply" }, ...TICKET_STATUS.map((s) => ({ value: s, label: INS_TICKET_STATUS_LABEL[s] }))]} />
        <FilterSelect name="priority" label="All priorities" value={params.priority} options={TICKET_PRIORITY.map((p) => ({ value: p, label: TICKET_PRIORITY_LABEL[p] }))} />
        {categories.length > 0 && <FilterSelect name="category" label="All categories" value={params.category} options={categories.map((c) => ({ value: c, label: ticketCategoryLabel(c) }))} />}
        <FilterSelect name="vendor" label="All vendors" value={params.vendor} options={vendors} />
      </FilterForm>

      {rows.length === 0 ? (
        <EmptyBox icon={<LifeBuoy aria-hidden className="size-5" />} title={hasFilters ? "No tickets match" : "No vendor tickets yet"}>
          {hasFilters ? "Try another status, priority, category or vendor." : "Tickets insurance vendors raise from their portal appear here."}
        </EmptyBox>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Ticket</Th>
              <Th>Vendor</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              <Th className="text-right">Messages</Th>
              <Th>Last activity</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, messages, last, lastFromStaff, ...v }) => (
              <tr key={t.id} className="transition-colors hover:bg-mist/40">
                <Td className="min-w-[220px]">
                  <Link href={`${BASE}/${t.id}`} className="block font-medium hover:text-red">
                    {t.subject}
                  </Link>
                  <p className="text-[12px] text-muted">
                    <span className="num">{t.reference}</span> · {ticketCategoryLabel(t.category)}
                  </p>
                </Td>
                <Td className="max-w-[220px]">
                  <VendorLink id={v.vendorId} name={vendorLabel(v)} reference={v.vendorRef} />
                </Td>
                <Td>
                  <PriorityPill priority={t.priority} />
                </Td>
                <Td>
                  <TicketPill status={t.status} />
                </Td>
                <Td className="text-right num">{messages}</Td>
                <Td className="whitespace-nowrap text-[12.5px] text-muted">
                  {formatDateTime(last ?? t.updatedAt)}
                  {messages > 0 && <span className="block text-[11.5px]">{lastFromStaff ? "MarchGear replied" : "Vendor wrote last"}</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}
