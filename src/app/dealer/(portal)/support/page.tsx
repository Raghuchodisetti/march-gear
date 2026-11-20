import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, inArray, max } from "drizzle-orm";
import { ChevronRight, Mail, MessageSquare, Phone } from "lucide-react";
import { getDb } from "@/db";
import { TICKET_PRIORITY, TICKET_STATUS, partnerTicketMessages, partnerTickets, type TicketPriority, type TicketStatus } from "@/db/schema";
import { TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL, TICKET_STATUS_TONE } from "@/partner/labels";
import { getCatalog } from "@/server/catalog";
import { requirePartner } from "@/server/partner/context";
import { Badge, FilterForm, FilterSelect, PortalHeader, StatCard, formatDateTime, strParam } from "@/components/portal/ui";
import { NewTicketButton } from "@/components/portal/support/compose";
import { PRIORITY_TONE, TICKET_ACTIVE, categoryLabel } from "@/components/portal/support/shared";

export const metadata: Metadata = { title: "Support" };

export default async function Page({ searchParams }: PageProps<"/dealer/support">) {
  const ctx = await requirePartner({ perm: "support.use", approved: false });
  const sp = await searchParams;
  const status = strParam(sp.status) as TicketStatus | "active" | undefined;
  const priority = strParam(sp.priority) as TicketPriority | undefined;
  const validStatus = status === "active" || (status && (TICKET_STATUS as readonly string[]).includes(status)) ? status : undefined;
  const validPriority = priority && (TICKET_PRIORITY as readonly string[]).includes(priority) ? priority : undefined;

  const db = getDb();
  const mine = eq(partnerTickets.partnerId, ctx.partner.id);
  const where = and(
    mine,
    validStatus === "active" ? inArray(partnerTickets.status, TICKET_ACTIVE) : validStatus ? eq(partnerTickets.status, validStatus) : undefined,
    validPriority ? eq(partnerTickets.priority, validPriority) : undefined,
  );
  const [tickets, byStatus, { site }] = await Promise.all([
    db
      .select({ t: partnerTickets, messages: count(partnerTicketMessages.id), last: max(partnerTicketMessages.createdAt) })
      .from(partnerTickets)
      .leftJoin(partnerTicketMessages, eq(partnerTicketMessages.ticketId, partnerTickets.id))
      .where(where)
      .groupBy(partnerTickets.id)
      .orderBy(desc(partnerTickets.updatedAt), desc(partnerTickets.id))
      .limit(200),
    db.select({ status: partnerTickets.status, n: count() }).from(partnerTickets).where(mine).groupBy(partnerTickets.status),
    getCatalog().then((c) => c.content),
  ]);
  const n = (s: TicketStatus[]) => byStatus.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.n, 0);
  const total = n([...TICKET_STATUS]);
  const filtered = Boolean(validStatus || validPriority);

  return (
    <>
      <PortalHeader title="Support" description="Questions about your account, listings, offers or billing — the MarchGear partner team replies here." actions={<NewTicketButton />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="In progress" value={n(TICKET_ACTIVE)} href="/dealer/support?status=active" />
        <StatCard label="Awaiting your reply" value={n(["awaiting_dealer"])} tone={n(["awaiting_dealer"]) ? "red" : undefined} href="/dealer/support?status=awaiting_dealer" />
        <StatCard label="Resolved" value={n(["resolved"])} href="/dealer/support?status=resolved" />
        <StatCard label="All tickets" value={total} href="/dealer/support" />
      </div>

      <div className="mt-8">
        <FilterForm resetHref="/dealer/support" hasFilters={filtered}>
          <FilterSelect
            name="status"
            label="All statuses"
            value={validStatus}
            options={[{ value: "active", label: "In progress" }, ...TICKET_STATUS.map((s) => ({ value: s, label: TICKET_STATUS_LABEL[s] }))]}
          />
          <FilterSelect name="priority" label="All priorities" value={validPriority} options={TICKET_PRIORITY.map((p) => ({ value: p, label: TICKET_PRIORITY_LABEL[p] }))} />
        </FilterForm>

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center border border-line bg-white px-6 py-16 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-[#F6F6F6]">
              <MessageSquare className="size-5 text-muted" aria-hidden />
            </span>
            <p className="mt-4 text-[15px] font-semibold">{filtered ? "No tickets match these filters" : "No support tickets yet"}</p>
            <p className="mt-1 max-w-sm text-[13.5px] text-muted">{filtered ? "Try another status or priority." : "Raise a ticket and the MarchGear partner team will get back to you here."}</p>
            {!filtered && (
              <div className="mt-5">
                <NewTicketButton label="Raise your first ticket" />
              </div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-line border border-line bg-white">
            {tickets.map(({ t, messages, last }) => (
              <li key={t.id}>
                <Link href={`/dealer/support/${t.id}`} className="group grid gap-3 px-5 py-4 transition-colors hover:bg-[#FAFAFA] md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                      <span className="font-medium text-ink num">{t.reference}</span>
                      <span>·</span>
                      <span>{categoryLabel(t.category)}</span>
                      <span>·</span>
                      <span>
                        {messages} message{messages === 1 ? "" : "s"}
                      </span>
                    </p>
                    <p className="mt-1 truncate text-[15px] font-semibold group-hover:text-red">{t.subject}</p>
                    <p className="mt-0.5 text-[12px] text-muted">Updated {formatDateTime(last ?? t.updatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={PRIORITY_TONE[t.priority]}>{TICKET_PRIORITY_LABEL[t.priority]}</Badge>
                    <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge>
                    <ChevronRight className="ml-auto size-4 text-muted md:ml-2" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3 border border-line bg-white p-5 text-[13.5px] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted">Prefer to talk to someone?</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 font-medium hover:text-red">
            <Phone className="size-4 text-red" aria-hidden /> {site.phone}
          </a>
          <a href={`mailto:${site.supportEmail}`} className="inline-flex items-center gap-2 font-medium hover:text-red">
            <Mail className="size-4 text-red" aria-hidden /> {site.supportEmail}
          </a>
        </div>
      </div>
    </>
  );
}
