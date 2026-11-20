import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Mail, Phone } from "lucide-react";
import { getDb } from "@/db";
import { insTicketMessages, insTickets, users } from "@/db/schema";
import { getCatalog } from "@/server/catalog";
import { requireInsurer } from "@/server/insurance/context";
import { Badge, Panel, PortalHeader, formatDateTime } from "@/components/portal/ui";
import { InsTicketThread } from "@/components/insurance/vendor/support/thread";
import { InsTicketReply } from "@/components/insurance/vendor/support/compose";
import { INS_PRIORITY_TONE, INS_TICKET_PRIORITY_LABEL, INS_TICKET_STATUS_LABEL, INS_TICKET_STATUS_TONE, insCategoryLabel } from "@/components/insurance/vendor/support/shared";

export const metadata: Metadata = { title: "Support ticket" };

const STATUS_NOTE: Record<string, string> = {
  open: "MarchGear's vendor team will pick this up shortly.",
  awaiting_support: "With MarchGear — you'll get a notification when they reply.",
  awaiting_dealer: "MarchGear is waiting for your reply.",
  resolved: "Marked resolved. Reply or reopen if you need more help.",
  closed: "Closed. Reopen it to continue the conversation.",
};

export default async function Page({ params }: PageProps<"/insurance-vendor/support/[id]">) {
  const ctx = await requireInsurer({ perm: "support.use", approved: false });
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const db = getDb();
  const [t] = await db
    .select()
    .from(insTickets)
    .where(and(eq(insTickets.id, Number(id)), eq(insTickets.vendorId, ctx.vendor.id)));
  if (!t) notFound();
  const [messages, opener, { insuranceSettings }] = await Promise.all([
    db
      .select({ id: insTicketMessages.id, fromStaff: insTicketMessages.fromStaff, body: insTicketMessages.body, attachments: insTicketMessages.attachments, createdAt: insTicketMessages.createdAt, author: users.name })
      .from(insTicketMessages)
      .leftJoin(users, eq(users.id, insTicketMessages.userId))
      .where(eq(insTicketMessages.ticketId, t.id))
      .orderBy(asc(insTicketMessages.createdAt), asc(insTicketMessages.id)),
    t.createdBy ? db.select({ name: users.name }).from(users).where(eq(users.id, t.createdBy)) : Promise.resolve([]),
    getCatalog().then((c) => c.content),
  ]);
  // Staff names stay with the team: vendors see "MarchGear support" plus a first name.
  const thread = messages.map((m) => ({ ...m, attachments: m.attachments ?? [], author: m.fromStaff ? (m.author?.split(" ")[0] ?? null) : m.author }));
  const email = insuranceSettings.vendorSupportEmail;
  const phone = insuranceSettings.vendorSupportPhone;

  return (
    <>
      <PortalHeader
        back={{ href: "/insurance-vendor/support", label: "All tickets" }}
        title={<span className="break-words">{t.subject}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="num">{t.reference}</span>
            <span>·</span>
            <span>{insCategoryLabel(t.category)}</span>
            <span>·</span>
            <span>Opened {formatDateTime(t.createdAt)}</span>
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <InsTicketThread messages={thread} />
          <InsTicketReply ticketId={t.id} status={t.status} />
        </div>
        <aside className="min-w-0 space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Panel title="Ticket">
            <dl className="space-y-3.5 text-[13.5px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Status</dt>
                <dd>
                  <Badge tone={INS_TICKET_STATUS_TONE[t.status]}>{INS_TICKET_STATUS_LABEL[t.status]}</Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Priority</dt>
                <dd>
                  <Badge tone={INS_PRIORITY_TONE[t.priority]}>{INS_TICKET_PRIORITY_LABEL[t.priority]}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Category</dt>
                <dd className="text-right font-medium">{insCategoryLabel(t.category)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Raised by</dt>
                <dd className="text-right font-medium">{opener[0]?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Last update</dt>
                <dd className="text-right">{formatDateTime(t.updatedAt)}</dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">{STATUS_NOTE[t.status]}</p>
          </Panel>
          {(email || phone) && (
            <Panel title="Vendor support">
              <div className="space-y-2 text-[13.5px]">
                {phone && (
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 font-medium hover:text-red">
                    <Phone className="size-4 text-red" aria-hidden /> {phone}
                  </a>
                )}
                {email && (
                  <a href={`mailto:${email}`} className="flex min-w-0 items-center gap-2 break-all font-medium hover:text-red">
                    <Mail className="size-4 shrink-0 text-red" aria-hidden /> {email}
                  </a>
                )}
              </div>
            </Panel>
          )}
          <p className="px-1 text-[12.5px] leading-relaxed text-muted">Replies from MarchGear also appear in your notifications. Mark the ticket resolved once you&apos;re sorted — you can reopen it any time.</p>
        </aside>
      </div>
    </>
  );
}
