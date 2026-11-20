import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Mail, MessageCircle, Phone } from "lucide-react";
import { CRM_WON } from "@/partner/labels";
import { requirePartner } from "@/server/partner/context";
import { customerDetail } from "@/server/partner/crm";
import { PortalHeader } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Initials, LeadStatusBadge, SourceTag, TestDriveBadge } from "@/components/portal/crm/badges";
import { formatIstDateTime, formatIstDay, formatWhen, parseCustomerKey, whatsappHref } from "@/components/portal/crm/pipeline";

export const metadata: Metadata = { title: "Customer" };

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await requirePartner({ perm: "customers.view" });
  const who = parseCustomerKey((await params).key);
  if (!who) notFound();
  const data = await customerDetail(ctx, who);
  if (!data) notFound();
  const { leads, drives, events } = data;
  const latest = leads[0];
  const mobile = leads.find((l) => l.mobile)?.mobile ?? null;
  const email = leads.find((l) => l.email)?.email ?? null;
  const won = leads.filter((l) => CRM_WON.includes(l.status)).length;
  const first = leads[leads.length - 1];

  // One timeline across all their enquiries (test-drive changes are logged on the enquiry too).
  const timeline = [
    ...events.map((e) => ({ at: e.createdAt, key: `e${e.id}`, title: e.body.split("\n")[0], detail: e.body.split("\n").slice(1).join("\n"), by: e.memberName ?? "MarchGear", tag: e.leadRef, href: `/dealer/enquiries/${e.leadId}` })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <>
      <PortalHeader title={latest.name} description="Customer history across every enquiry and test drive." back={{ href: "/dealer/customers", label: "All customers" }} />

      <section className="mb-6 grid grid-cols-1 border border-line bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-5 border-b border-line p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-4">
            <Initials name={latest.name} className="size-12 text-[14px]" />
            <div className="min-w-0">
              <p className="truncate font-display text-[20px] font-semibold tracking-[-0.02em]">{latest.name}</p>
              <p className="mt-0.5 truncate text-[13px] text-muted num">{[mobile ? `+91 ${mobile}` : null, email].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {mobile && (
              <>
                <Button href={`tel:+91${mobile}`} variant="outline" size="sm" icon={<Phone className="size-4" aria-hidden />}>
                  Call
                </Button>
                <Button href={whatsappHref(mobile, `Hello ${latest.name.split(" ")[0]}, `)} target="_blank" rel="noopener noreferrer" variant="outline" size="sm" icon={<MessageCircle className="size-4" aria-hidden />}>
                  WhatsApp
                </Button>
              </>
            )}
            {email && (
              <Button href={`mailto:${email}`} variant="outline" size="sm" icon={<Mail className="size-4" aria-hidden />}>
                Email
              </Button>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4">
          {[
            ["Enquiries", leads.length],
            ["Test drives", drives.length],
            ["Converted", `${won} · ${Math.round((won / leads.length) * 100)}%`],
            ["Customer since", formatIstDay(first.createdAt)],
          ].map(([k, v], i) => (
            <div key={String(k)} className={`p-6 ${i % 2 === 1 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line sm:border-t-0" : ""} ${i > 0 ? "sm:border-l" : ""}`}>
              <dt className="text-[12px] text-muted">{k}</dt>
              <dd className={`mt-1.5 font-display font-semibold leading-tight tracking-[-0.02em] num ${i === 3 ? "text-[17px]" : "text-[22px]"}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="border border-line bg-white">
            <h2 className="border-b border-line px-5 py-3.5 text-[14px] font-semibold">Enquiries</h2>
            <ul className="divide-y divide-line">
              {leads.map((l) => (
                <li key={l.id}>
                  <Link href={`/dealer/enquiries/${l.id}`} className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-mist/50 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium">{l.carLabel ?? "Car not specified"}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted num">
                        <span className="font-mono">{l.reference}</span> · {formatIstDateTime(l.createdAt)} · {l.assigned?.name ?? "Unassigned"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <SourceTag source={l.source} />
                      <LeadStatusBadge status={l.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="border border-line bg-white">
            <h2 className="border-b border-line px-5 py-3.5 text-[14px] font-semibold">Test drives</h2>
            {drives.length ? (
              <ul className="divide-y divide-line">
                {drives.map((t) => (
                  <li key={t.id}>
                    <Link href={`/dealer/test-drives?tab=all&td=${t.id}`} className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-mist/50 sm:flex-row sm:items-center sm:justify-between">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium">{t.carLabel}</span>
                        <span className="mt-1 flex items-center gap-1.5 text-[12px] text-muted num">
                          <CalendarClock aria-hidden className="size-3.5" />
                          {t.scheduledAt ? formatWhen(t.scheduledAt, { weekday: true, year: true }) : t.requestedFor ? `Asked for ${formatWhen(t.requestedFor)}` : "Time to confirm"} · {t.reference}
                        </span>
                      </span>
                      <TestDriveBadge status={t.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-[13.5px] text-muted">No test drives yet.</p>
            )}
          </section>
        </div>

        <section className="border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3.5 text-[14px] font-semibold">Timeline</h2>
          <ol className="px-5 py-5">
            {timeline.map((t, i) => (
              <li key={t.key} className="relative flex gap-3.5 pb-5 last:pb-0">
                {i < timeline.length - 1 && <span aria-hidden className="absolute bottom-0 left-[4px] top-4 w-px bg-line" />}
                <span aria-hidden className={`relative z-10 mt-1.5 size-[9px] shrink-0 rounded-full ${i === 0 ? "bg-red" : "bg-ink"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium leading-snug">{t.title}</p>
                  {t.detail && <p className="mt-1 whitespace-pre-line break-words text-[13px] leading-relaxed text-ink/70">{t.detail}</p>}
                  <p className="mt-1 text-[11.5px] text-muted num">
                    {t.by} · {formatIstDateTime(t.at)} ·{" "}
                    <Link href={t.href} className="font-mono hover:text-ink hover:underline">
                      {t.tag}
                    </Link>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
