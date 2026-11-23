import type { Metadata } from "next";
import { CalendarClock, CarFront, Heart, Inbox, ShieldCheck } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getOverview } from "@/server/customer/overview";
import { PortalHeader } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { greetingName } from "@/components/account/validation";
import {
  InsuranceSnapshot,
  KpiTile,
  LatestUpdates,
  NextDrive,
  NextSteps,
  QuickActions,
  RecentEnquiries,
  Reminders,
  SavedOffers,
  greeting,
} from "@/components/customer/overview/sections";

export const metadata: Metadata = { title: "Overview" };

export default async function AccountOverview() {
  const user = await requireUser("/account");
  const o = await getOverview(user);
  const now = new Date();
  const first = greetingName(user.name);
  const since = new Date(user.memberSince).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const stepsLeft = o.steps.some((s) => !s.done);
  const k = o.kpi;

  return (
    <>
      <PortalHeader
        title={`${greeting(now)}${first ? `, ${first}` : ""}`}
        description={
          <>
            Member since {since}
            {user.city ? ` · ${user.city}` : ""}. Everything you&apos;ve done on MarchGear, in one place.
          </>
        }
        actions={
          <Button href="/new-cars" variant="dark" size="sm" arrow>
            Find a car
          </Button>
        }
      />

      <div className="space-y-6">
        {stepsLeft && <NextSteps steps={o.steps} />}

        <section aria-label="Your figures" className="flex flex-wrap gap-px overflow-hidden border border-line bg-line">
          <KpiTile label="Saved cars" value={k.saved} note={k.saved ? "Prices and offers" : "Heart cars to keep them"} href="/account/saved" icon={Heart} />
          <KpiTile label="In your garage" value={k.garage} note={k.garage ? "Cars you own" : "Add your car"} href="/account/garage" icon={CarFront} />
          <KpiTile label="Open enquiries" value={k.openEnquiries} note={k.openEnquiries ? "In progress" : "None in progress"} href="/account/enquiries" icon={Inbox} />
          <KpiTile label="Test drives" value={k.upcomingDrives} note={k.upcomingDrives ? "Coming up" : "None coming up"} href="/account/test-drives" icon={CalendarClock} />
          <KpiTile label="Insurance quotes" value={k.quotesReady} note={k.quotesReady ? "Ready for your answer" : "No quotes waiting"} href="/account/insurance" icon={ShieldCheck} accent />
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <NextDrive drive={o.nextDrive} total={k.upcomingDrives} />
            <LatestUpdates updates={o.updates} unread={k.unread} now={now} />
            <RecentEnquiries enquiries={o.enquiries} total={o.enquiriesTotal} now={now} />
          </div>
          <div className="min-w-0 space-y-6">
            <Reminders reminders={o.reminders} total={o.remindersTotal} garage={k.garage} />
            <SavedOffers offers={o.offers} saved={k.saved} />
            <InsuranceSnapshot insurance={o.insurance} />
          </div>
        </div>

        <QuickActions />
      </div>
    </>
  );
}
