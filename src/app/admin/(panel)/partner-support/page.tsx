import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { and, count, desc, eq, inArray, like, max, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { TICKET_PRIORITY, TICKET_STATUS, partnerTicketMessages, partnerTickets, partners, type TicketPriority, type TicketStatus } from "@/db/schema";
import { TICKET_PRIORITY_LABEL } from "@/partner/labels";
import { requireStaff } from "@/server/auth";
import { AdminHeader, Badge, FilterForm, FilterSelect, Pagination, SearchInput, StatCard, Table, Td, Th, formatDateTime, pageParam, strParam } from "@/components/admin/ui";
import { PRIORITY_TONE, STAFF_TICKET_STATUS_LABEL, STAFF_TICKET_STATUS_TONE, categoryLabel } from "@/components/portal/support/shared";
import { EmptyState } from "@/components/admin/partner-ui";

export const metadata: Metadata = { title: "Dealer support" };

const PAGE = 30;
const NEEDS_REPLY: TicketStatus[] = ["open", "awaiting_support"];

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const status = strParam(sp.status);
  const priority = strParam(sp.priority);
  const dealer = strParam(sp.dealer);
  const q = strParam(sp.q)?.slice(0, 80);
  const page = pageParam(sp.page);
  // Search text is matched literally (% and _ are not wildcards).
  const like_ = `%${(q ?? "").replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const validStatus = status === "needs_reply" || (status && (TICKET_STATUS as readonly string[]).includes(status)) ? status : undefined;
  const validPriority = priority && (TICKET_PRIORITY as readonly string[]).includes(priority) ? (priority as TicketPriority) : undefined;
  const dealerId = dealer && /^\d+$/.test(dealer) ? Number(dealer) : undefined;

  const conds: (SQL | undefined)[] = [
    validStatus === "needs_reply" ? inArray(partnerTickets.status, NEEDS_REPLY) : validStatus ? eq(partnerTickets.status, validStatus as TicketStatus) : undefined,
    validPriority ? eq(partnerTickets.priority, validPriority) : undefined,
    dealerId ? eq(partnerTickets.partnerId, dealerId) : undefined,
    q ? or(like(partnerTickets.subject, like_), like(partnerTickets.reference, like_), like(partners.tradeName, like_), like(partners.legalName, like_)) : undefined,
  ];
  const where = and(...conds);
  const db = getDb();
  const [rows, [{ total }], byStatus, dealers] = await Promise.all([
    db
      .select({ t: partnerTickets, trade: partners.tradeName, legal: partners.legalName, ref: partners.reference, messages: count(partnerTicketMessages.id), last: max(partnerTicketMessages.createdAt) })
      .from(partnerTickets)
      .innerJoin(partners, eq(partners.id, partnerTickets.partnerId))
      .leftJoin(partnerTicketMessages, eq(partnerTicketMessages.ticketId, partnerTickets.id))
      .where(where)
      .groupBy(partnerTickets.id)
      .orderBy(desc(partnerTickets.updatedAt), desc(partnerTickets.id))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db.select({ total: count() }).from(partnerTickets).innerJoin(partners, eq(partners.id, partnerTickets.partnerId)).where(where),
    db.select({ status: partnerTickets.status, priority: partnerTickets.priority, n: count() }).from(partnerTickets).groupBy(partnerTickets.status, partnerTickets.priority),
    db
      .selectDistinct({ id: partners.id, trade: partners.tradeName, legal: partners.legalName, ref: partners.reference })
      .from(partners)
      .innerJoin(partnerTickets, eq(partnerTickets.partnerId, partners.id)),
  ]);
  const n = (f: (r: (typeof byStatus)[number]) => boolean) => byStatus.filter(f).reduce((s, r) => s + r.n, 0);
  const params = { status: validStatus, priority: validPriority, dealer: dealerId ? String(dealerId) : undefined, q };
  const dealerName = (r: { trade: string | null; legal: string | null; ref: string }) => r.trade || r.legal || r.ref;

  return (
    <>
      <AdminHeader title="Dealer support" description="Support tickets from dealer partners. Replies notify the dealership in its portal." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Needs a reply" value={n((r) => NEEDS_REPLY.includes(r.status))} tone={n((r) => NEEDS_REPLY.includes(r.status)) ? "red" : undefined} href="/admin/partner-support?status=needs_reply" />
        <StatCard label="Urgent or high, open" value={n((r) => ["urgent", "high"].includes(r.priority) && !["resolved", "closed"].includes(r.status))} />
        <StatCard label="Awaiting dealer" value={n((r) => r.status === "awaiting_dealer")} href="/admin/partner-support?status=awaiting_dealer" />
        <StatCard label="Resolved or closed" value={n((r) => r.status === "resolved" || r.status === "closed")} />
      </div>

      <FilterForm resetHref="/admin/partner-support" hasFilters={Boolean(validStatus || validPriority || dealerId || q)}>
        <SearchInput value={q} placeholder="Subject, TKT-… or dealer" />
        <FilterSelect name="status" label="All statuses" value={validStatus} options={[{ value: "needs_reply", label: "Needs a reply" }, ...TICKET_STATUS.map((s) => ({ value: s, label: STAFF_TICKET_STATUS_LABEL[s] }))]} />
        <FilterSelect name="priority" label="All priorities" value={validPriority} options={TICKET_PRIORITY.map((p) => ({ value: p, label: TICKET_PRIORITY_LABEL[p] }))} />
        <FilterSelect name="dealer" label="All dealers" value={dealerId ? String(dealerId) : undefined} options={dealers.map((d) => ({ value: String(d.id), label: `${dealerName(d)} (${d.ref})` }))} />
      </FilterForm>

      {rows.length === 0 ? (
        <div className="border border-line bg-white">
          <EmptyState title={validStatus || validPriority || dealerId || q ? "No tickets match" : "No dealer tickets yet"}>
            {validStatus || validPriority || dealerId || q ? "Try another status, priority, dealer or search." : "Tickets dealers raise from their portal appear here."}
          </EmptyState>
        </div>
      ) : (
      <Table>
        <thead>
          <tr>
            <Th>Ticket</Th>
            <Th>Dealer</Th>
            <Th>Priority</Th>
            <Th>Status</Th>
            <Th className="text-right">Messages</Th>
            <Th>Last activity</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ t, trade, legal, ref, messages, last }) => (
            <tr key={t.id} className="transition-colors hover:bg-mist/40">
              <Td>
                <Link href={`/admin/partner-support/${t.id}`} className="block font-medium hover:text-red">
                  {t.subject}
                </Link>
                <p className="text-[12px] text-muted">
                  <span className="num">{t.reference}</span> · {categoryLabel(t.category)}
                </p>
              </Td>
              <Td>
                <Link href={`/admin/dealers/details?id=${t.partnerId}`} className="hover:text-red">
                  {trade || legal || ref}
                </Link>
                <p className="text-[12px] text-muted num">{ref}</p>
              </Td>
              <Td>
                <Badge tone={PRIORITY_TONE[t.priority]}>{TICKET_PRIORITY_LABEL[t.priority]}</Badge>
              </Td>
              <Td>
                <Badge tone={STAFF_TICKET_STATUS_TONE[t.status]}>{STAFF_TICKET_STATUS_LABEL[t.status]}</Badge>
              </Td>
              <Td className="text-right num">{messages}</Td>
              <Td className="whitespace-nowrap text-muted">{formatDateTime(last ?? t.updatedAt)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      )}
      <Pagination base="/admin/partner-support" params={params} page={page} pageSize={PAGE} total={total} />
    </>
  );
}
