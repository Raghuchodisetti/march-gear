import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { notFound } from "next/navigation";
import { ExternalLink, Mail, Phone } from "lucide-react";
import { LEAD_STATUS_LABEL, LEAD_STATUS_TONE, LEAD_TYPE_LABEL, detailLabel, detailValue } from "@/lib/leads";
import { getLead } from "@/server/admin/leads";
import { getDeskUser } from "@/server/auth";
import { AdminHeader, Badge, Panel, formatDateTime } from "@/components/admin/ui";
import { LeadManager } from "@/components/admin/lead-manager";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: PageProps<"/admin/leads/[id]">) {
  const { id } = await params;
  const data = /^\d+$/.test(id) ? await getLead(Number(id)) : null;
  if (!data) notFound();
  const { lead, notes, staff, account } = data;
  const me = await getDeskUser();
  const details = Object.entries(lead.details ?? {});

  const rows: [string, React.ReactNode][] = [
    ["About", lead.subject],
    ["City", lead.city],
    [
      "New car",
      lead.carSlug && (
        <Link href={`/cars/${lead.carSlug}`} target="_blank" className="inline-flex items-center gap-1 hover:text-red">
          {lead.carSlug} <ExternalLink aria-hidden className="size-3.5" />
        </Link>
      ),
    ],
    [
      "Used car",
      lead.usedCarId && (
        <Link href={`/used-cars/${lead.usedCarId}`} target="_blank" className="inline-flex items-center gap-1 hover:text-red">
          {lead.usedCarId} <ExternalLink aria-hidden className="size-3.5" />
        </Link>
      ),
    ],
    [
      "Dealer",
      lead.dealerId && (
        <Link href={`/dealers/${lead.dealerId}`} target="_blank" className="inline-flex items-center gap-1 hover:text-red">
          {lead.dealerId} <ExternalLink aria-hidden className="size-3.5" />
        </Link>
      ),
    ],
    ...details.map(([k, v]): [string, React.ReactNode] => [detailLabel(k), detailValue(k, v)]),
    ["Sent from", lead.source],
  ];

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/leads", label: "All leads" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {lead.name ?? "Unnamed lead"}
            <Badge tone={LEAD_STATUS_TONE[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</Badge>
          </span>
        }
        description={`${LEAD_TYPE_LABEL[lead.type] ?? lead.type} · ${lead.reference} · received ${formatDateTime(lead.createdAt)}`}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Contact">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {lead.phone && (
                <a href={`tel:+91${lead.phone}`} className="inline-flex h-11 items-center gap-2 rounded-[3px] border border-line px-4 text-[14px] font-medium hover:border-ink">
                  <Phone aria-hidden className="size-4 text-red" /> +91 {lead.phone}
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}?subject=${encodeURIComponent(`Your MarchGear request ${lead.reference}`)}`} className="inline-flex h-11 min-w-0 items-center gap-2 rounded-[3px] border border-line px-4 text-[14px] font-medium hover:border-ink">
                  <Mail aria-hidden className="size-4 shrink-0 text-red" /> <span className="truncate">{lead.email}</span>
                </a>
              )}
              {!lead.phone && !lead.email && <p className="text-[14px] text-muted">No contact details.</p>}
            </div>
            {account && (
              <p className="mt-4 text-[13px] text-muted">
                Signed-in customer: <span className="text-ink">{account.name}</span> ({account.email})
              </p>
            )}
          </Panel>

          <Panel title="Request" padded={false}>
            <dl className="divide-y divide-line">
              {rows
                .filter(([, v]) => v !== null && v !== undefined && v !== "")
                .map(([k, v]) => (
                  <div key={k} className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
                    <dt className="text-[13px] text-muted">{k}</dt>
                    <dd className="min-w-0 break-words text-[14px]">{v}</dd>
                  </div>
                ))}
            </dl>
            {lead.message && (
              <div className="border-t border-line px-5 py-4">
                <p className="text-[13px] text-muted">Message</p>
                <p className="mt-1.5 whitespace-pre-line text-[14.5px] leading-relaxed">{lead.message}</p>
              </div>
            )}
          </Panel>
        </div>

        <LeadManager
          leadId={lead.id}
          status={lead.status}
          assignedTo={lead.assignedTo}
          staff={staff}
          canDelete={me?.role === "admin"}
          notes={notes.map((n) => ({ ...n, createdAt: formatDateTime(n.createdAt) }))}
        />
      </div>
    </>
  );
}
