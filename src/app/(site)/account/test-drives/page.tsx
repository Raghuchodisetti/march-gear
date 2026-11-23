import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getCustomerTestDrives } from "@/server/customer/requests";
import { todayISO } from "@/server/validation";
import { PortalHeader } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { DriveCard } from "@/components/customer/test-drives/drive-card";

export const metadata: Metadata = { title: "Test drives" };

const PAST_LIMIT = 20;

export default async function TestDrivesPage() {
  const user = await requireUser("/account/test-drives");
  const drives = await getCustomerTestDrives(user.id);
  const upcoming = drives.filter((d) => d.upcoming);
  const past = drives.filter((d) => !d.upcoming);
  const today = todayISO();

  return (
    <>
      <PortalHeader
        title="Test drives"
        description="Test drives you've requested and booked with dealers. Cancel one, or ask for a different time — the dealership sees it straight away."
        actions={
          <Button href="/new-cars" variant="outline" size="sm">
            Book another
          </Button>
        }
      />

      {drives.length === 0 ? (
        <div className="flex flex-col items-center border border-dashed border-ink/15 bg-white px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
            <CalendarClock aria-hidden className="size-5 text-ink/60" />
          </span>
          <p className="mt-4 text-[16px] font-semibold">No test drives yet</p>
          <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted">Pick a car and choose “Book a test drive” while you&apos;re signed in. The dealer&apos;s confirmation and the showroom details will appear here.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button href="/new-cars" variant="dark" size="sm">
              Browse new cars
            </Button>
            <Button href="/used-cars" variant="outline" size="sm">
              Browse used cars
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          <section aria-labelledby="td-upcoming">
            <div className="mb-3.5 flex items-baseline justify-between gap-4">
              <h2 id="td-upcoming" className="text-[15px] font-semibold">
                Upcoming <span className="ml-1 text-red num">{upcoming.length}</span>
              </h2>
              <p className="text-[12px] text-muted">Times are in IST</p>
            </div>
            {upcoming.length ? (
              <div className="space-y-4">
                {upcoming.map((d) => (
                  <DriveCard key={d.id} drive={d} today={today} />
                ))}
              </div>
            ) : (
              <p className="border border-line bg-white px-5 py-6 text-[13.5px] text-muted">Nothing booked right now. Your past and closed test drives are below.</p>
            )}
          </section>

          {past.length > 0 && (
            <section aria-labelledby="td-past">
              <h2 id="td-past" className="mb-3.5 text-[15px] font-semibold">
                Past and closed <span className="ml-1 text-muted num">{past.length}</span>
              </h2>
              <div className="space-y-4">
                {past.slice(0, PAST_LIMIT).map((d) => (
                  <DriveCard key={d.id} drive={d} today={today} />
                ))}
              </div>
              {past.length > PAST_LIMIT && <p className="mt-3 text-[12.5px] text-muted">Showing the latest {PAST_LIMIT}. Older test drives are on their enquiries.</p>}
            </section>
          )}

          <p className="max-w-2xl text-[12px] leading-relaxed text-muted">
            Changes reach the dealership in their MarchGear portal. We don&apos;t send SMS or email confirmations yet — the latest status is always here, and in your notifications.
          </p>
        </div>
      )}
    </>
  );
}
