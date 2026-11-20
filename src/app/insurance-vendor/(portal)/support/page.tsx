import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, inArray, max } from "drizzle-orm";
import { ChevronRight, Mail, MessageSquare, Phone, Plus } from "lucide-react";
import { getDb } from "@/db";
import { insTicketMessages, insTickets } from "@/db/schema";
import { TICKET_PRIORITY, TICKET_STATUS, type TicketPriority, type TicketStatus } from "@/db/enums";
import { getCatalog } from "@/server/catalog";
import { requireInsurer } from "@/server/insurance/context";
import { Badge, FilterForm, FilterSelect, Pagination, PortalHeader, StatCard, formatDateTime, pageParam, strParam } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import {
  INS_PRIORITY_TONE,
  INS_TICKET_ACTIVE,
  INS_TICKET_CATEGORIES,
  INS_TICKET_PRIORITY_LABEL,
  INS_TICKET_STATUS_LABEL,
  INS_TICKET_STATUS_TONE,
  insCategoryLabel,
} from "@/components/insurance/vendor/support/shared";

export const metadata: Metadata = { title: "Support" };

const PAGE_SIZE = 25;

export default async function Page({ searchParams }: PageProps<"/insurance-vendor/support">) {
  const ctx = await requireInsurer({ perm: "support.use", approved: false });
  const sp = await searchParams;
  const status = strParam(sp.status);
  const priority = strParam(sp.priority);
  const category = strParam(sp.category);
  const validStatus = status === "active" || (status && (TICKET_STATUS as readonly string[]).includes(status)) ? (status as TicketStatus | "active") : undefined;
  const validPriority = priority && (TICKET_PRIORITY as readonly string[]).includes(priority) ? (priority as TicketPriority) : undefined;
  const validCategory = category && INS_TICKET_CATEGORIES.some((c) => c.value === category) ? category : undefined;
  const page = pageParam(sp.page);

  const db = getDb();
  const mine = eq(insTickets.vendorId, ctx.vendor.id);
  const where = and(
    mine,
    validStatus === "active" ? inArray(insTickets.status, INS_TICKET_ACTIVE) : validStatus ? eq(insTickets.status, validStatus) : undefined,
    validPriority ? eq(insTickets.priority, validPriority) : undefined,
    validCategory ? eq(insTickets.category, validCategory) : undefined,
  );
  const [tickets, [{ total }], byStatus, { insuranceSettings }] = await Promise.all([
    db
      .select({ t: insTickets, messages: count(insTicketMessages.id), last: max(insTicketMessages.createdAt) })
      .from(insTickets)
      .leftJoin(insTicketMessages, eq(insTicketMessages.ticketId, insTickets.id))
      .where(where)
      .groupBy(insTickets.id)
      .orderBy(desc(insTickets.updatedAt), desc(insTickets.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(insTickets).where(where),
    db.select({ status: insTickets.status, n: count() }).from(insTickets).where(mine).groupBy(insTickets.status),
    getCatalog().then((c) => c.content),
  ]);
  const n = (s: TicketStatus[]) => byStatus.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.n, 0);
  const all = n([...TICKET_STATUS]);
  const filtered = Boolean(validStatus || validPriority || validCategory);
  const email = insuranceSettings.vendorSupportEmail;
  const phone = insuranceSettings.vendorSupportPhone;

  return (
    <>
      <PortalHeader
        title="Support"
        description="Questions about onboarding, products, enquiries, billing or advertising — MarchGear's vendor team replies here."
        actions={
          <Button href="/insurance-vendor/support/new" size="sm" icon={<Plus className="size-4" aria-hidden />}>
            New ticket
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="In progress" value={n(INS_TICKET_ACTIVE)} href="/insurance-vendor/support?status=active" />
        <StatCard label="Awaiting your reply" value={n(["awaiting_dealer"])} tone={n(["awaiting_dealer"]) ? "red" : undefined} href="/insurance-vendor/support?status=awaiting_dealer" />
        <StatCard label="Resolved" value={n(["resolved"])} href="/insurance-vendor/support?status=resolved" />
        <StatCard label="All tickets" value={all} href="/insurance-vendor/support" />
      </div>

      <div className="mt-8">
        <FilterForm resetHref="/insurance-vendor/support" hasFilters={filtered}>
          <FilterSelect
            name="status"
            label="All statuses"
            value={validStatus}
            options={[{ value: "active", label: "In progress" }, ...TICKET_STATUS.map((s) => ({ value: s, label: INS_TICKET_STATUS_LABEL[s] }))]}
          />
          <FilterSelect name="category" label="All categories" value={validCategory} options={INS_TICKET_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
          <FilterSelect name="priority" label="All priorities" value={validPriority} options={TICKET_PRIORITY.map((p) => ({ value: p, label: INS_TICKET_PRIORITY_LABEL[p] }))} />
        </FilterForm>

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center border border-line bg-white px-6 py-16 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-[#F6F6F6]">
              <MessageSquare className="size-5 text-muted" aria-hidden />
            </span>
            <p className="mt-4 text-[15px] font-semibold">{filtered ? "No tickets match these filters" : "No support tickets yet"}</p>
            <p className="mt-1 max-w-sm text-[13.5px] text-muted">{filtered ? "Try another status, category or priority." : "Raise a ticket and MarchGear's vendor team will get back to you here."}</p>
            {!filtered && (
              <div className="mt-5">
                <Button href="/insurance-vendor/support/new" size="sm" icon={<Plus className="size-4" aria-hidden />}>
                  Raise your first ticket
                </Button>
              </div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-line border border-line bg-white">
            {tickets.map(({ t, messages, last }) => (
              <li key={t.id}>
                <Link href={`/insurance-vendor/support/${t.id}`} className="group grid gap-3 px-5 py-4 transition-colors hover:bg-[#FAFAFA] md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                      <span className="font-medium text-ink num">{t.reference}</span>
                      <span>·</span>
                      <span>{insCategoryLabel(t.category)}</span>
                      <span>·</span>
                      <span>
                        {messages} message{messages === 1 ? "" : "s"}
                      </span>
                    </p>
                    <p className="mt-1 truncate text-[15px] font-semibold group-hover:text-red">{t.subject}</p>
                    <p className="mt-0.5 text-[12px] text-muted">Updated {formatDateTime(last ?? t.updatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={INS_PRIORITY_TONE[t.priority]}>{INS_TICKET_PRIORITY_LABEL[t.priority]}</Badge>
                    <Badge tone={INS_TICKET_STATUS_TONE[t.status]}>{INS_TICKET_STATUS_LABEL[t.status]}</Badge>
                    <ChevronRight className="ml-auto size-4 text-muted md:ml-2" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {total > PAGE_SIZE && (
          <Pagination base="/insurance-vendor/support" params={{ status: validStatus, priority: validPriority, category: validCategory }} page={page} pageSize={PAGE_SIZE} total={total} />
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3 border border-line bg-white p-5 text-[13.5px] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted">{email || phone ? "Prefer to talk to someone?" : "Tickets are the fastest way to reach MarchGear's vendor team — replies also appear in your notifications."}</p>
        {(email || phone) && (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 font-medium hover:text-red">
                <Phone className="size-4 text-red" aria-hidden /> {phone}
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="inline-flex min-w-0 items-center gap-2 break-all font-medium hover:text-red">
                <Mail className="size-4 shrink-0 text-red" aria-hidden /> {email}
              </a>
            )}
          </div>
        )}
      </div>
    </>
  );
}
