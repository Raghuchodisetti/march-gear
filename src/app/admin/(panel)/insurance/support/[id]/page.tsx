import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { INS_VENDOR_STATUS_LABEL, INS_VENDOR_STATUS_TONE } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { getInsTicket } from "@/server/admin/insurance-ops";
import { vendorName } from "@/server/insurance/context";
import { AdminHeader, Panel, formatDateTime } from "@/components/admin/ui";
import { StatusPill } from "@/components/admin/partner-ui";
import { PriorityPill, TicketPill, TitlePills } from "@/components/admin/insurance/ops/kit";
import { VENDOR_TICKET_STATUS_LABEL, ticketCategoryLabel } from "@/components/admin/insurance/ops/labels";
import { InsTicketThread } from "@/components/admin/insurance/support/thread";
import { InsTicketNotes, InsTicketReply, InsTicketSettings } from "@/components/admin/insurance/support/manage";

export const metadata: Metadata = { title: "Vendor ticket" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const data = /^\d{1,9}$/.test(id) ? await getInsTicket(Number(id)) : null;
  if (!data) notFound();
  const { t, v, messages, opener, notes, others } = data;
  const vendor = vendorName(v);

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/insurance/support", label: "Vendor support" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t.subject}
            <TitlePills>
              <TicketPill status={t.status} />
            </TitlePills>
          </span>
        }
        description={`${t.reference} · ${ticketCategoryLabel(t.category)} · ${vendor} · opened ${formatDateTime(t.createdAt)} · the vendor sees “${VENDOR_TICKET_STATUS_LABEL[t.status]}”`}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <InsTicketThread messages={messages} vendorName={vendor} />
          <InsTicketReply ticketId={t.id} vendorName={vendor} />
        </div>
        <aside className="min-w-0 space-y-6">
          <InsTicketSettings key={`${t.status}-${t.priority}`} ticketId={t.id} status={t.status} priority={t.priority} />
          <InsTicketNotes ticketId={t.id} notes={notes.map((n) => ({ id: n.id, summary: n.summary, by: n.by, at: formatDateTime(n.createdAt) }))} />
          <Panel title="Vendor">
            <dl className="space-y-3 text-[13.5px]">
              <div>
                <dt className="text-[12px] text-muted">Company</dt>
                <dd>
                  <Link href={`/admin/insurance/vendors/${v.id}`} className="font-medium hover:text-red">
                    {vendor}
                  </Link>
                  <span className="ml-2 text-[12px] text-muted num">{v.reference}</span>
                </dd>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={INS_VENDOR_STATUS_TONE[v.status]}>{INS_VENDOR_STATUS_LABEL[v.status]}</StatusPill>
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
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Priority</dt>
                <dd>
                  <PriorityPill priority={t.priority} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Tickets from this vendor</dt>
                <dd>
                  <Link href={`/admin/insurance/support?vendor=${v.id}`} className="font-medium hover:text-red num">
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
