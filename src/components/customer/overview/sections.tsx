import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  CalendarClock,
  CarFront,
  Check,
  ChevronRight,
  ClipboardCheck,
  GitCompareArrows,
  Inbox,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NextStep, Overview } from "@/server/customer/overview";
import { Badge, formatDay } from "@/components/portal/ui";
import { Card, CardLink, Quiet, relTime } from "@/components/portal/dashboard/sections";
import { Button } from "@/components/ui/button";

/* Server-rendered building blocks for the account overview (/account). */

const IST = { timeZone: "Asia/Kolkata" } as const;

/** "Good evening" in IST. */
export function greeting(now: Date) {
  const h = Number(now.toLocaleString("en-IN", { ...IST, hour: "numeric", hour12: false }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/* ── Next steps ─────────────────────────────────────────────── */

export function NextSteps({ steps }: { steps: NextStep[] }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <section aria-labelledby="next-steps" className="border border-line bg-white">
      <div className="grid grid-cols-1 gap-6 p-5 md:p-7 xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-10">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red">Next steps</p>
          <h2 id="next-steps" className="mt-2 font-display text-[21px] font-semibold leading-tight tracking-[-0.02em]">
            Make your account work for you
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">A few details and we can remind you about renewals, show offers on cars you like and pre-fill your requests.</p>
          <div className="mt-5 flex items-center gap-3">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-mist">
              <span className="block h-full rounded-full bg-red transition-[width] duration-1000" style={{ width: `${(done / Math.max(1, steps.length)) * 100}%` }} />
            </span>
            <span className="text-[12px] font-medium text-muted num">
              {done} of {steps.length}
            </span>
          </div>
        </div>
        <ol className="grid grid-cols-1 gap-px self-start border border-line bg-line sm:grid-cols-2">
          {steps.map((s, i) => (
            // Phones list only what's left to do.
            <li key={s.key} className={cn("bg-white", s.done && "max-sm:hidden")}>
              <Link href={s.href} className={cn("group flex h-full items-center gap-3 px-4 py-3.5 transition-colors duration-300 hover:bg-mist/60", s.done && "text-muted")}>
                <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[11.5px] font-semibold num", s.done ? "border-ink bg-ink text-white" : "border-line text-ink")}>
                  {s.done ? <Check aria-label="Done" className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[13px] font-medium", s.done && "line-through decoration-ink/20")}>{s.label}</span>
                  <span className="block truncate text-[12px] text-muted">{s.note}</span>
                </span>
                {!s.done && <ChevronRight aria-hidden className="size-4 shrink-0 text-muted transition-transform duration-300 group-hover:translate-x-0.5" />}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Figures ────────────────────────────────────────────────── */

export function KpiTile({ label, value, note, href, icon: Icon, accent }: { label: string; value: number; note: string; href: string; icon: LucideIcon; accent?: boolean }) {
  return (
    <Link href={href} className="group relative flex min-w-0 flex-[1_1_150px] flex-col bg-white p-4 transition-colors duration-500 hover:bg-[#fcfcfc] sm:flex-[1_1_180px] md:p-5">
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[12.5px] font-medium text-muted">{label}</span>
        <Icon aria-hidden className={cn("size-4 shrink-0", accent && value > 0 ? "text-red" : "text-ink/30")} strokeWidth={1.8} />
      </span>
      <span className={cn("mt-3 font-display text-[30px] font-semibold leading-none tracking-[-0.035em] num md:text-[34px]", accent && value > 0 && "text-red")}>{value}</span>
      <span className="mt-2.5 flex items-center gap-1 text-[12px] text-muted">
        <span className="truncate">{note}</span>
        <ArrowUpRight aria-hidden className="size-3.5 shrink-0 opacity-0 transition-all duration-500 group-hover:translate-x-0.5 group-hover:opacity-100" />
      </span>
    </Link>
  );
}

/* ── Next test drive ────────────────────────────────────────── */

export function NextDrive({ drive, total }: { drive: Overview["nextDrive"]; total: number }) {
  if (!drive)
    return (
      <Card title="Next test drive" action={<CardLink href="/account/test-drives">Test drives</CardLink>}>
        <Quiet icon={<CalendarClock className="size-4" />} title="No test drive booked" action={<Button href="/new-cars" variant="outline" size="sm">Find a car to drive</Button>}>
          Book one from any car page — the dealership confirms the time and it shows up here.
        </Quiet>
      </Card>
    );
  const when = drive.when ? new Date(drive.when) : null;
  return (
    <Card title="Next test drive" subtitle={total > 1 ? `${total} upcoming` : undefined} action={<CardLink href="/account/test-drives">All test drives</CardLink>}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch">
        <div className="flex shrink-0 flex-row items-center gap-3 bg-ink px-4 py-3 text-white sm:w-[104px] sm:flex-col sm:items-start sm:justify-between sm:gap-0 sm:py-4">
          {when ? (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">{when.toLocaleDateString("en-IN", { ...IST, month: "short" })}</span>
              <span className="font-display text-[34px] font-semibold leading-none tracking-[-0.03em] num">{when.toLocaleDateString("en-IN", { ...IST, day: "numeric" })}</span>
              <span className="text-[12px] text-white/70">{when.toLocaleDateString("en-IN", { ...IST, weekday: "short" })}</span>
            </>
          ) : (
            <CalendarClock aria-hidden className="size-6 text-white/70" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={drive.status.tone}>{drive.status.label}</Badge>
            {!drive.confirmed && <span className="text-[12px] text-muted">Waiting for the dealer to confirm</span>}
          </div>
          <p className="mt-2 text-[16px] font-semibold leading-snug tracking-[-0.01em]">{drive.car}</p>
          <p className="mt-1 text-[13px] text-muted">{drive.whenLabel ?? "Time to be confirmed"}</p>
          <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-muted">
            <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-red" />
            <span className="min-w-0">
              <span className="font-medium text-ink">{drive.dealerName}</span>
              {drive.showroom ? ` · ${drive.showroom}` : ""}
            </span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button href={drive.href} variant="dark" size="sm">
              Details
            </Button>
            {drive.mapUrl && (
              <Button href={drive.mapUrl} target="_blank" rel="noopener noreferrer" variant="ghost" size="sm">
                Directions
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── Updates & enquiries ────────────────────────────────────── */

const KIND_ICON: Record<string, LucideIcon> = {
  enquiry: Inbox,
  test_drive: CalendarClock,
  insurance: ShieldCheck,
  review: Star,
  account: UserRound,
  reminder: Wrench,
};

function Row({ href, children }: { href: string | null; children: ReactNode }) {
  const cls = "flex items-start gap-3 px-5 py-3.5 md:px-6";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors duration-300 hover:bg-mist/50")}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

export function LatestUpdates({ updates, unread, now }: { updates: Overview["updates"]; unread: number; now: Date }) {
  return (
    <Card
      title="Latest updates"
      subtitle={unread ? `${unread} unread` : "You're all caught up"}
      action={<CardLink href="/account/notifications">All notifications</CardLink>}
      bodyClass={updates.length ? "px-0 pb-2 md:px-0" : undefined}
    >
      {updates.length ? (
        <ul className="divide-y divide-line border-t border-line">
          {updates.map((n) => {
            const Icon = KIND_ICON[n.kind] ?? Bell;
            return (
              <li key={n.id}>
                <Row href={n.href ?? "/account/notifications"}>
                  <span className="relative mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-mist text-ink/70">
                    <Icon aria-hidden className="size-3.5" />
                    {!n.read && <span aria-label="Unread" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white bg-red" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[13.5px] leading-snug", n.read ? "text-ink/80" : "font-semibold text-ink")}>{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{n.body}</span>}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[11.5px] text-muted">{relTime(new Date(n.createdAt), now)}</span>
                </Row>
              </li>
            );
          })}
        </ul>
      ) : (
        <Quiet icon={<Bell className="size-4" />} title="Nothing new yet">
          Dealer replies, test-drive confirmations, insurance quotes and car reminders will show up here.
        </Quiet>
      )}
    </Card>
  );
}

export function RecentEnquiries({ enquiries, total, now }: { enquiries: Overview["enquiries"]; total: number; now: Date }) {
  return (
    <Card
      title="Recent enquiries"
      subtitle={total ? `${total} in all` : undefined}
      action={<CardLink href="/account/enquiries">All enquiries</CardLink>}
      bodyClass={enquiries.length ? "px-0 pb-2 md:px-0" : undefined}
    >
      {enquiries.length ? (
        <ul className="divide-y divide-line border-t border-line">
          {enquiries.map((e) => (
            <li key={e.reference}>
              <Link href={e.href} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3.5 transition-colors duration-300 hover:bg-mist/50 md:px-6">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium">{e.title}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {e.typeLabel} · <span className="num">{e.reference}</span>
                    {e.dealerName ? ` · ${e.dealerName}` : ""}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge tone={e.status.tone}>{e.status.label}</Badge>
                  <span className="text-[11.5px] text-muted">{relTime(new Date(e.updatedAt), now)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Quiet icon={<Inbox className="size-4" />} title="No enquiries yet" action={<Button href="/new-cars" variant="outline" size="sm">Get a price or test drive</Button>}>
          Price quotes, test drives and dealer questions you send while signed in are tracked here, with the dealer&apos;s progress.
        </Quiet>
      )}
    </Card>
  );
}

/* ── Side column ────────────────────────────────────────────── */

const DOT: Record<string, string> = { red: "bg-red", amber: "bg-[#d48a00]", blue: "bg-[#2456a6]", green: "bg-[#1e7a3c]", neutral: "bg-ink/30", dark: "bg-ink" };

export function Reminders({ reminders, total, garage }: { reminders: Overview["reminders"]; total: number; garage: number }) {
  return (
    <Card title="Reminders" subtitle={total ? `${total} due soon` : "From your garage"} action={<CardLink href="/account/garage">My garage</CardLink>}>
      {reminders.length ? (
        <ul className="-mx-2 space-y-0.5">
          {reminders.map((r) => (
            <li key={`${r.vehicleId}-${r.kind}-${r.dueOn}`} className="flex items-start gap-3 rounded-[3px] px-2 py-2.5">
              <span aria-hidden className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", DOT[r.tone] ?? "bg-ink/30")} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{r.label}</span>
                <span className="block text-[12.5px] text-muted">
                  {r.vehicle} · {formatDay(r.dueOn)}
                </span>
                {r.action && (
                  <Link href={r.action.href} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink transition-colors hover:text-red">
                    {r.action.label} <ChevronRight aria-hidden className="size-3.5" />
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : garage ? (
        <Quiet icon={<Check className="size-4" />} title="Nothing due">
          Insurance, PUC, service and warranty dates you&apos;ve saved are all comfortably ahead.
        </Quiet>
      ) : (
        <Quiet icon={<CarFront className="size-4" />} title="Add your car for reminders" action={<Button href="/account/garage/new" variant="dark" size="sm">Add your car</Button>}>
          We&apos;ll remind you here before your insurance, PUC or warranty runs out.
        </Quiet>
      )}
    </Card>
  );
}

export function SavedOffers({ offers, saved }: { offers: Overview["offers"]; saved: number }) {
  return (
    <Card title="Offers on your saved cars" subtitle="Live dealer offers, approved by MarchGear" action={<CardLink href="/account/saved">Saved cars</CardLink>}>
      {offers.length ? (
        <ul className="-mx-1 space-y-3">
          {offers.map((o) => (
            <li key={o.id}>
              <Link href={o.href} className="group flex gap-3 rounded-[3px] p-1 transition-colors hover:bg-mist/60">
                <span className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden bg-mist">
                  {o.image ? (
                    <Image src={o.image} alt="" fill sizes="80px" className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center">
                      <Tag aria-hidden className="size-4 text-ink/30" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-red">{o.headline || "Dealer offer"}</span>
                  <span className="block truncate text-[13px] font-medium">{o.title}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {o.dealer} · ends {formatDay(o.endsAt)}
                  </span>
                  <span className="block truncate text-[11.5px] text-muted">On {o.covers.join(", ")}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Quiet icon={<Sparkles className="size-4" />} title={saved ? "No live offers on your saved cars" : "Save cars to see their offers"} action={<Button href="/offers" variant="outline" size="sm">Browse all offers</Button>}>
          {saved ? "When a dealer runs an approved offer on a car you've saved, it appears here." : "Heart a car and any dealer offer running on it shows up here."}
        </Quiet>
      )}
    </Card>
  );
}

export function InsuranceSnapshot({ insurance }: { insurance: Overview["insurance"] }) {
  if (!insurance.requests) return null;
  return (
    <Card title="Insurance" subtitle={`${insurance.requests} ${insurance.requests === 1 ? "request" : "requests"}${insurance.policies ? ` · ${insurance.policies} ${insurance.policies === 1 ? "policy" : "policies"}` : ""}`} action={<CardLink href="/account/insurance">Insurance</CardLink>}>
      <ul className="-mx-2 space-y-0.5">
        {insurance.latest.map((r) => (
          <li key={r.reference}>
            <Link href={r.href} className="flex items-start justify-between gap-3 rounded-[3px] px-2 py-2.5 transition-colors hover:bg-mist/60">
              <span className="min-w-0">
                <span className="line-clamp-2 text-[13px] font-medium">{r.title}</span>
                <span className="block text-[12px] text-muted num">{r.reference}</span>
              </span>
              <Badge tone={r.status.tone}>{r.status.label}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ── Quick actions ──────────────────────────────────────────── */

const ACTIONS: { href: string; label: string; note: string; icon: LucideIcon }[] = [
  { href: "/new-cars", label: "Find a car", note: "New cars by budget, body and fuel", icon: Search },
  { href: "/compare", label: "Compare cars", note: "Up to four, spec for spec", icon: GitCompareArrows },
  { href: "/insurance/quotes", label: "Insurance quotes", note: "Indicative premiums from listed insurers", icon: ShieldCheck },
  { href: "/pdi-check", label: "PDI check", note: "Inspect your new car before delivery", icon: ClipboardCheck },
  { href: "/sell-car", label: "Sell your car", note: "A price estimate and verified buyers", icon: CarFront },
];

export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions">
      <h2 id="quick-actions" className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        Quick actions
      </h2>
      <ul className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line md:grid-cols-3 xl:grid-cols-5">
        {ACTIONS.map(({ href, label, note, icon: Icon }, i) => (
          <li key={href} className={cn("bg-white", i === ACTIONS.length - 1 && "col-span-2 xl:col-span-1")}>
            <Link href={href} className="group flex h-full flex-col gap-3 p-4 transition-colors duration-300 hover:bg-[#fcfcfc] md:p-5">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-mist text-ink/70 transition-colors duration-300 group-hover:bg-ink group-hover:text-white">
                <Icon aria-hidden className="size-4" />
              </span>
              <span>
                <span className="flex items-center gap-1 text-[13.5px] font-semibold">
                  {label}
                  <ArrowUpRight aria-hidden className="size-3.5 text-muted opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted">{note}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
