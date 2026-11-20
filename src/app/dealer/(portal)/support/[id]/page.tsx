import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerTicketMessages, partnerTickets, users } from "@/db/schema";
import { TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL, TICKET_STATUS_TONE } from "@/partner/labels";
import { requirePartner } from "@/server/partner/context";
import { Badge, Panel, PortalHeader, formatDateTime } from "@/components/portal/ui";
import { TicketThread } from "@/components/portal/support/thread";
import { TicketReply } from "@/components/portal/support/compose";
import { PRIORITY_TONE, categoryLabel } from "@/components/portal/support/shared";

export const metadata: Metadata = { title: "Support ticket" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePartner({ perm: "support.use", approved: false });
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const db = getDb();
  const [t] = await db.select().from(partnerTickets).where(and(eq(partnerTickets.id, Number(id)), eq(partnerTickets.partnerId, ctx.partner.id)));
  if (!t) notFound();
  const messages = await db
    .select({ id: partnerTicketMessages.id, fromStaff: partnerTicketMessages.fromStaff, body: partnerTicketMessages.body, attachments: partnerTicketMessages.attachments, createdAt: partnerTicketMessages.createdAt, author: users.name })
    .from(partnerTicketMessages)
    .leftJoin(users, eq(users.id, partnerTicketMessages.userId))
    .where(eq(partnerTicketMessages.ticketId, t.id))
    .orderBy(asc(partnerTicketMessages.createdAt), asc(partnerTicketMessages.id));
  const [opener] = t.createdBy ? await db.select({ name: users.name }).from(users).where(eq(users.id, t.createdBy)) : [];
  // Staff names stay with the team: dealers see "MarchGear support" plus a first name.
  const thread = messages.map((m) => ({ ...m, author: m.fromStaff ? (m.author?.split(" ")[0] ?? null) : m.author }));

  return (
    <>
      <PortalHeader
        back={{ href: "/dealer/support", label: "All tickets" }}
        title={t.subject}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="num">{t.reference}</span>
            <span>·</span>
            <span>{categoryLabel(t.category)}</span>
            <span>·</span>
            <span>Opened {formatDateTime(t.createdAt)}</span>
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <TicketThread messages={thread} viewer="dealer" dealerName="" />
          <TicketReply ticketId={t.id} closed={t.status === "closed"} />
        </div>
        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Panel title="Ticket">
            <dl className="space-y-3.5 text-[13.5px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Status</dt>
                <dd>
                  <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Priority</dt>
                <dd>
                  <Badge tone={PRIORITY_TONE[t.priority]}>{TICKET_PRIORITY_LABEL[t.priority]}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Category</dt>
                <dd className="text-right font-medium">{categoryLabel(t.category)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Raised by</dt>
                <dd className="text-right font-medium">{opener?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Last update</dt>
                <dd className="text-right">{formatDateTime(t.updatedAt)}</dd>
              </div>
            </dl>
          </Panel>
          <p className="px-1 text-[12.5px] leading-relaxed text-muted">
            Replies from MarchGear also appear in your notifications. Mark the ticket closed once you&apos;re sorted — you can reopen it any time.
          </p>
        </aside>
      </div>
    </>
  );
}
