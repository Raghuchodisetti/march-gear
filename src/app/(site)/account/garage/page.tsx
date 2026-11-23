import type { Metadata } from "next";
import { BellRing, CarFront, Plus } from "lucide-react";
import { requireUser } from "@/server/auth";
import { todayISO } from "@/server/validation";
import { garageImages, getGarage, insuranceReminderWindow, notifyGarageReminders } from "@/server/customer/garage";
import { Panel, PortalHeader } from "@/components/portal/ui";
import { EmptyState } from "@/components/admin/partner-ui";
import { Button } from "@/components/ui/button";
import { GARAGE_LIMIT, isNotDelivered, remindersFor, renewalQuotesHref, sortReminders } from "@/components/customer/garage/shared";
import { ReminderList, VehicleCard } from "@/components/customer/garage/ui";

export const metadata: Metadata = { title: "My garage" };

export default async function GaragePage() {
  const user = await requireUser("/account/garage");
  const today = todayISO();
  const [cars, window] = await Promise.all([getGarage(user.id), insuranceReminderWindow()]);
  const images = await garageImages(cars);
  const reminders = sortReminders(cars.flatMap((c) => remindersFor(c, today, window)));
  await notifyGarageReminders(user.id, reminders);
  const full = cars.length >= GARAGE_LIMIT;

  const add = full ? (
    <span title={`Your garage holds up to ${GARAGE_LIMIT} cars. Remove one to add another.`} className="inline-flex h-11 items-center gap-2 rounded-[3px] border border-dashed border-line px-5 text-[13.5px] font-medium text-muted">
      Garage full · {GARAGE_LIMIT} cars
    </span>
  ) : (
    <Button href="/account/garage/new" variant="dark" icon={<Plus aria-hidden className="size-4" />}>
      Add a car
    </Button>
  );

  return (
    <>
      <PortalHeader
        title="My garage"
        description="The cars you own, with their insurance, PUC, service and warranty dates in one place — and reminders before each one is due."
        actions={cars.length > 0 ? add : undefined}
      />

      {cars.length === 0 ? (
        <section className="border border-line bg-white">
          <EmptyState icon={<CarFront aria-hidden className="size-5" />} title="Your garage is empty">
            Add the cars you own to keep their policy, PUC, service and warranty dates together. We&apos;ll remind you here before they&apos;re due and prefill renewal quotes for you.
          </EmptyState>
          <div className="-mt-6 flex justify-center pb-12">
            <Button href="/account/garage/new" variant="dark" icon={<Plus aria-hidden className="size-4" />}>
              Add your first car
            </Button>
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          {reminders.length > 0 ? (
            <Panel
              title={
                <span className="inline-flex items-center gap-2">
                  <BellRing aria-hidden className="size-4 text-red" /> Coming up
                </span>
              }
              action={<span className="text-[12.5px] text-muted num">{reminders.length} due</span>}
              padded={false}
            >
              <ReminderList reminders={reminders.slice(0, 8)} />
              {reminders.length > 8 && <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">{reminders.length - 8} more — open each car to see all of its dates.</p>}
            </Panel>
          ) : (
            <p className="flex items-center gap-3 border border-line bg-white px-5 py-4 text-[13.5px] text-muted">
              <BellRing aria-hidden className="size-4 shrink-0 text-ink/40" />
              Nothing due soon. Insurance reminders start {window} days before expiry; PUC and service 30 days before; warranty 60 days before.
            </p>
          )}

          <section aria-label="Your cars">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-[14px] font-semibold">Your cars</h2>
              <p className="text-[12.5px] text-muted num">
                {cars.length} of {GARAGE_LIMIT}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {cars.map((c) => (
                <VehicleCard key={c.id} car={c} image={images[c.id]} today={today} insuranceWindow={window} quotesHref={renewalQuotesHref(c, today)} notDelivered={isNotDelivered(c, today)} />
              ))}
            </div>
          </section>

          <p className="text-[12px] leading-relaxed text-muted">
            Reminders are based on the dates you enter. They show here and in your notifications — MarchGear doesn&apos;t send SMS or email reminders yet.
          </p>
        </div>
      )}
    </>
  );
}
