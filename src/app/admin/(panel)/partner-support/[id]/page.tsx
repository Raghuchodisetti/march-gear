import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { notFound } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerTicketMessages, partnerTickets, partners, users } from "@/db/schema";
import { PARTNER_STATUS_LABEL, PARTNER_STATUS_TONE, PLAN_STATUS_LABEL, TICKET_PRIORITY_LABEL } from "@/partner/labels";
import { requireStaff } from "@/server/auth";
import { AdminHeader, Badge, Panel, formatDateTime } from "@/components/admin/ui";
import { StaffTicketReply, StaffTicketSettings } from "@/components/admin/partner-support-manage";
import { TicketThread } from "@/components/portal/support/thread";
import { PRIORITY_TONE, STAFF_TICKET_STATUS_LABEL, STAFF_TICKET_STATUS_TONE, categoryLabel } from "@/components/portal/support/shared";

export const metadata: Metadata = { title: "Dealer ticket" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const db = getDb();
  const [row] = await db.select({ t: partnerTickets, p: partners }).from(partnerTickets).innerJoin(partners, eq(partners.id, partnerTickets.partnerId)).where(eq(partnerTickets.id, Number(id)));
  if (!row) notFound();
  const { t, p } = row;
  const [messages, [opener], [{ others }]] = await Promise.all([
    db
      .select({ id: partnerTicketMessages.id, fromStaff: partnerTicketMessages.fromStaff, body: partnerTicketMessages.body, attachments: partnerTicketMessages.attachments, createdAt: partnerTicketMessages.createdAt, author: users.name })
      .from(partnerTicketMessages)
      .leftJoin(users, eq(users.id, partnerTicketMessages.userId))
      .where(eq(partnerTicketMessages.ticketId, t.id))
      .orderBy(asc(partnerTicketMessages.createdAt), asc(partnerTicketMessages.id)),
    t.createdBy ? db.select({ name: users.name, email: users.email, phone: users.phone }).from(users).where(eq(users.id, t.createdBy)) : Promise.resolve([]),
    db.select({ others: count() }).from(partnerTickets).where(eq(partnerTickets.partnerId, p.id)),
  ]);
  const dealer = p.tradeName || p.legalName || p.reference;

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/partner-support", label: "Dealer support" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t.subject}
            <Badge tone={STAFF_TICKET_STATUS_TONE[t.status]}>{STAFF_TICKET_STATUS_LABEL[t.status]}</Badge>
          </span>
        }
        description={`${t.reference} · ${categoryLabel(t.category)} · ${dealer} · opened ${formatDateTime(t.createdAt)}`}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <TicketThread messages={messages} viewer="staff" dealerName={dealer} />
          <StaffTicketReply ticketId={t.id} dealerName={dealer} />
        </div>
        <aside className="space-y-6">
          <StaffTicketSettings key={`${t.status}-${t.priority}`} ticketId={t.id} status={t.status} priority={t.priority} />
          <Panel title="Dealer">
            <dl className="space-y-3 text-[13.5px]">
              <div>
                <dt className="text-[12px] text-muted">Dealership</dt>
                <dd>
                  <Link href={`/admin/dealers/details?id=${p.id}`} className="font-medium hover:text-red">
                    {dealer}
                  </Link>
                  <span className="ml-2 text-[12px] text-muted num">{p.reference}</span>
                </dd>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={PARTNER_STATUS_TONE[p.status]}>{PARTNER_STATUS_LABEL[p.status]}</Badge>
                <Badge tone="neutral">
                  {p.plan.charAt(0).toUpperCase() + p.plan.slice(1)} · {PLAN_STATUS_LABEL[p.planStatus]}
                </Badge>
              </div>
              {opener && (
                <div>
                  <dt className="text-[12px] text-muted">Raised by</dt>
                  <dd className="font-medium">{opener.name}</dd>
                  <dd className="break-all text-[12.5px] text-muted">
                    <a href={`mailto:${opener.email}?subject=${encodeURIComponent(`${t.reference}: ${t.subject}`)}`} className="hover:text-red">
                      {opener.email}
                    </a>
                    {opener.phone ? ` · +91 ${opener.phone}` : ""}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Priority</dt>
                <dd>
                  <Badge tone={PRIORITY_TONE[t.priority]}>{TICKET_PRIORITY_LABEL[t.priority]}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Tickets from this dealer</dt>
                <dd>
                  <Link href={`/admin/partner-support?dealer=${p.id}`} className="font-medium hover:text-red num">
                    {others}
                  </Link>
                </dd>
              </div>
            </dl>
          </Panel>
        </aside>
      </div>
    </>
  );
}
