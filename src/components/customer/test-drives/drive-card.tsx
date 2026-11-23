import Link from "next/link";
import { Clock3, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/portal/ui";
import { buttonClasses } from "@/components/ui/button";
import type { CustomerTestDrive } from "@/server/customer/requests";
import { DriveActions } from "./drive-actions";

/* One test drive: a date tile, the car and dealership, where to go, and what the customer can do. Server-safe. */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateParts(iso: string) {
  const t = new Date(new Date(iso).getTime() + 5.5 * 3_600_000);
  return { weekday: WEEKDAYS[t.getUTCDay()], day: t.getUTCDate(), month: `${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}` };
}

export function DriveCard({ drive: d, today }: { drive: CustomerTestDrive; today: string }) {
  const parts = d.when ? dateParts(d.when) : null;
  const tel = d.phone?.replace(/[^\d+]/g, "");
  const slot = d.whenLabel?.split(" · ")[1] ?? null;
  const time = slot ? slot.charAt(0).toUpperCase() + slot.slice(1) : null;
  const viaMarchGear = d.id.startsWith("lead-");
  const links = (
    <>
      {d.mapUrl && (
        <a href={d.mapUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "outline", size: "sm" })}>
          <MapPin aria-hidden className="size-4" /> Directions
        </a>
      )}
      {tel && d.upcoming && (
        <a href={`tel:${tel}`} className={buttonClasses({ variant: "outline", size: "sm" })}>
          <Phone aria-hidden className="size-4" /> Call
        </a>
      )}
    </>
  );
  const muted = !d.upcoming;

  return (
    <article id={d.reference} className="scroll-mt-28 border border-line bg-white target:border-ink/40">
      <div className="grid grid-cols-1 sm:grid-cols-[150px_minmax(0,1fr)]">
        <div className={cn("flex items-center gap-4 border-b border-line px-5 py-4 sm:flex-col sm:items-start sm:justify-center sm:gap-0 sm:border-b-0 sm:border-r sm:py-6", muted ? "bg-mist/40" : "bg-[#FAFAFA]")}>
          {parts ? (
            <>
              <p className={cn("font-display text-[40px] font-semibold leading-none tracking-[-0.04em] num sm:order-2 sm:mt-1", muted ? "text-ink/45" : "text-ink")}>{parts.day}</p>
              <div className="min-w-0 sm:contents">
                <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em] sm:order-1", d.upcoming ? "text-red" : "text-muted")}>{parts.weekday}</p>
                <p className="text-[13px] font-medium text-ink/80 sm:order-3 sm:mt-1">{parts.month}</p>
                {time && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted sm:order-4 sm:mt-3">
                    <Clock3 aria-hidden className="size-3.5" />
                    <span className="num">{time}</span>
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-[13px] font-medium text-muted">Date to be confirmed</p>
          )}
        </div>

        <div className="min-w-0 px-5 py-5 md:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-muted">{viaMarchGear && !d.showroomAddress ? "Arranged by MarchGear" : d.dealerName}</p>
              <h3 className="mt-0.5 font-display text-[19px] font-semibold leading-snug tracking-[-0.015em]">{d.car}</h3>
              <p className="mt-1 font-mono text-[12px] text-muted">{d.reference}</p>
            </div>
            <div className="shrink-0">
              <Badge tone={d.status.tone}>{d.status.label}</Badge>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-[13.5px] md:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-[12px] text-muted">{d.confirmed ? "Confirmed time" : "Your preferred time"}</dt>
              <dd className="mt-0.5 num">{d.whenLabel ?? "To be confirmed"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[12px] text-muted">Where</dt>
              <dd className="mt-0.5 break-words">
                {d.showroom ?? (d.showroomAddress ? d.dealerName : viaMarchGear ? "MarchGear will match you with a showroom" : "The dealership will confirm the showroom")}
                {d.showroomAddress && <span className="block text-[12.5px] text-muted">{d.showroomAddress}</span>}
              </dd>
            </div>
          </dl>

          {d.pendingAsk && (
            <p className="mt-4 border-l-2 border-[#9a5b00] bg-[#fdf3e1]/70 px-3.5 py-2.5 text-[13px] text-ink/85">
              You asked for <span className="font-medium">{d.pendingAsk.label}</span>. Waiting for {viaMarchGear ? "MarchGear's team" : "the dealer"} to confirm — your booking hasn&apos;t changed yet.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {d.canChange ? (
              <DriveActions drive={{ id: d.id, car: d.car, dealerName: d.dealerName, whenLabel: d.whenLabel, viaMarchGear }} today={today}>
                {links}
              </DriveActions>
            ) : (
              links
            )}
            <Link href={d.enquiryHref} className="ml-auto inline-flex h-9 items-center text-[13px] font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline">
              View enquiry
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
