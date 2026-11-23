import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarClock, Clock, Mail, MapPin, Phone, Store } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getCustomerEnquiry } from "@/server/customer/requests";
import { Badge, Panel, PortalHeader, formatDateTime } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { RequestTimeline } from "@/components/customer/enquiries/timeline";

export async function generateMetadata({ params }: PageProps<"/account/enquiries/[ref]">): Promise<Metadata> {
  const { ref } = await params;
  return { title: `Enquiry ${decodeURIComponent(ref).toUpperCase().slice(0, 16)}` };
}

export default async function EnquiryPage({ params }: PageProps<"/account/enquiries/[ref]">) {
  const { ref } = await params;
  const reference = decodeURIComponent(ref);
  const user = await requireUser(`/account/enquiries/${encodeURIComponent(reference)}`);
  // Scoped to this customer: someone else's reference is simply not found.
  const e = await getCustomerEnquiry(user.id, reference);
  if (!e) notFound();

  const d = e.dealer;
  const tel = d?.phone?.replace(/[^\d+]/g, "");
  const facts: [string, ReactNode][] = [
    ["Reference", <span key="r" className="font-mono text-[13px]">{e.reference}</span>],
    ["Request", e.typeLabel],
    [
      "About",
      e.aboutHref ? (
        <Link key="a" href={e.aboutHref} className="underline-offset-4 hover:underline">
          {e.title.split(" ").slice(0, -1).join(" ")}{" "}
          <span className="whitespace-nowrap">
            {e.title.split(" ").at(-1)}
            <ArrowUpRight aria-hidden className="ml-1 inline size-3.5 align-[-2px]" />
          </span>
        </Link>
      ) : (
        e.title
      ),
    ],
    ["Sent", <span key="s" className="num">{formatDateTime(e.createdAt)}</span>],
    ...e.answers.map((a) => [a.label, a.value] as [string, ReactNode]),
  ];
  const contact = [e.contact.name, e.contact.phone ? `+91\u00a0${e.contact.phone}` : null, e.contact.email, e.contact.city].filter(Boolean);

  return (
    <>
      <PortalHeader
        back={{ href: "/account/enquiries", label: "All enquiries" }}
        title={e.title}
        description={
          <>
            {e.typeLabel} · <span className="font-mono text-[13px]">{e.reference}</span> · sent {formatDateTime(e.createdAt)}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="border border-line bg-white">
            <div className="flex flex-col gap-3 border-l-2 border-red px-5 py-5 sm:flex-row sm:items-start sm:justify-between md:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Where it&apos;s at</p>
                <p className="mt-1.5 font-display text-[22px] font-semibold leading-tight tracking-[-0.02em]">{e.status.label}</p>
                <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink/75">{e.next}</p>
              </div>
              <div className="shrink-0">
                <Badge tone={e.open ? "blue" : "neutral"}>{e.open ? "Open" : "Closed"}</Badge>
              </div>
            </div>
          </section>

          <Panel title="Progress">
            <RequestTimeline steps={e.timeline} />
            <p className="mt-6 border-t border-line pt-4 text-[12px] leading-relaxed text-muted">
              {e.routed
                ? `This shows the steps ${d?.name ?? "the dealership"} records against your request. Their internal notes and call logs aren't shared.`
                : "This shows the steps MarchGear's team records against your request."}
            </p>
          </Panel>

          <Panel title="What you sent">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[12px] text-muted">{k}</dt>
                  <dd className="mt-0.5 break-words text-[14px]">{v}</dd>
                </div>
              ))}
            </dl>
            {e.message && (
              <div className="mt-5 border-l-2 border-ink bg-mist/60 px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Your message</p>
                <p className="mt-1.5 whitespace-pre-line break-words text-[13.5px] leading-relaxed text-ink/80">{e.message}</p>
              </div>
            )}
            {contact.length > 0 && (
              <p className="mt-5 text-[12.5px] text-muted">
                Contact details you gave: <span className="text-ink/80">{contact.join(" · ")}</span>
              </p>
            )}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6">
          {d ? (
            <Panel title={e.routed ? "Handled by" : "Dealer you asked about"}>
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-mist">
                  <Store aria-hidden className="size-[18px] text-ink/70" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-snug">{d.name}</p>
                  {!e.routed && <p className="mt-0.5 text-[12.5px] text-muted">MarchGear passes your request on.</p>}
                </div>
              </div>
              <ul className="mt-4 space-y-2.5 text-[13.5px]">
                {d.address && (
                  <li className="flex gap-2.5">
                    <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    <span className="min-w-0 break-words text-ink/80">{d.address}</span>
                  </li>
                )}
                {d.phone && (
                  <li className="flex gap-2.5">
                    <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    <a href={`tel:${tel}`} className="num underline-offset-4 hover:underline">
                      {d.phone}
                    </a>
                  </li>
                )}
                {d.email && (
                  <li className="flex gap-2.5">
                    <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    <a href={`mailto:${d.email}`} className="min-w-0 break-all underline-offset-4 hover:underline">
                      {d.email}
                    </a>
                  </li>
                )}
                {d.hours && (
                  <li className="flex gap-2.5">
                    <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    <span className="text-ink/80">{d.hours}</span>
                  </li>
                )}
              </ul>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {tel ? (
                  <Button href={`tel:${tel}`} variant="dark" size="sm" icon={<Phone className="size-4" aria-hidden />}>
                    Call
                  </Button>
                ) : null}
                {d.mapUrl ? (
                  <Button href={d.mapUrl} target="_blank" rel="noopener noreferrer" variant="outline" size="sm" icon={<MapPin className="size-4" aria-hidden />}>
                    Directions
                  </Button>
                ) : null}
                {d.href ? (
                  <Button href={d.href} variant="ghost" size="sm" className="col-span-2">
                    View dealer page
                  </Button>
                ) : null}
              </div>
            </Panel>
          ) : (
            <Panel title="Handled by">
              <p className="text-[15px] font-semibold">MarchGear team</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">Requests that aren&apos;t about a particular dealership go to MarchGear&apos;s own team, who follow them up with you.</p>
              <Button href="/contact" variant="outline" size="sm" className="mt-4">
                Contact MarchGear
              </Button>
            </Panel>
          )}

          {e.testDrives.length > 0 && (
            <Panel title={e.testDrives.length > 1 ? "Test drives" : "Test drive"} padded={false}>
              <ul className="divide-y divide-line">
                {e.testDrives.map((t) => (
                  <li key={t.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-[14px] font-semibold leading-snug">{t.car}</p>
                      <span className="whitespace-nowrap font-mono text-[11.5px] text-muted">{t.reference}</span>
                    </div>
                    <div className="mt-2">
                      <Badge tone={t.status.tone}>{t.status.label}</Badge>
                    </div>
                    {t.whenLabel && (
                      <p className="mt-2.5 flex items-center gap-2 text-[13px] text-ink/80">
                        <CalendarClock aria-hidden className="size-4 text-muted" />
                        <span className="num">{t.whenLabel}</span>
                        {!t.confirmed && <span className="text-muted">· your preferred time</span>}
                      </p>
                    )}
                    {t.showroom && <p className="mt-1 pl-6 text-[12.5px] text-muted">{t.showroom}</p>}
                    <Link href={t.href} className="mt-3 inline-flex text-[13px] font-medium text-ink underline-offset-4 hover:underline">
                      {t.canChange ? "Change or cancel" : "View in Test drives"}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
