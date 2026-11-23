import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BellRing, Info, PencilLine } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { todayISO } from "@/server/validation";
import { garageImages, garagePrefillFromPolicy, getGarageVehicle, insuranceReminderWindow, notifyGarageReminders } from "@/server/customer/garage";
import { Panel, PortalHeader } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { carName, carSpecLine, carTitle, editHref, formValuesFor, garageHref, isNotDelivered, quickActions, remindersFor } from "@/components/customer/garage/shared";
import { CarFacts, CarVisual, DateRows, QuickActionList, RegPlate } from "@/components/customer/garage/ui";
import { VehicleForm } from "@/components/customer/garage/vehicle-form";
import { PolicyNotice } from "@/components/customer/garage/policy-notice";
import { DeleteVehicleButton } from "@/components/customer/garage/delete-vehicle";

export const metadata: Metadata = { title: "My garage" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function GarageCarPage(props: PageProps<"/account/garage/[id]">) {
  const { id: raw } = await props.params;
  const sp = await props.searchParams;
  const user = await requireUser(`/account/garage/${encodeURIComponent(raw)}`);
  const id = /^\d{1,10}$/.test(raw) ? Number(raw) : 0;
  const car = await getGarageVehicle(user.id, id);
  if (!car) notFound();

  const today = todayISO();
  const name = carName(car);
  const from = one(sp.from).trim().toUpperCase();

  /* ── Edit ─────────────────────────────────────────────────── */
  if (one(sp.edit) === "1" || from) {
    const base = formValuesFor(car);
    const prefill = from ? await garagePrefillFromPolicy(user.id, from, base) : null;
    return (
      <>
        <PortalHeader title={`Edit ${name}`} back={{ href: garageHref(car.id), label: name }} description="Update the details and dates. Reminders follow the dates you save." />
        <VehicleForm
          key={from || "edit"}
          initial={prefill?.values ?? base}
          vehicleId={car.id}
          today={today}
          cancelHref={garageHref(car.id)}
          notice={
            prefill ? (
              <PolicyNotice policy={prefill.policy} />
            ) : from ? (
              <p>We couldn&apos;t find an issued policy with that reference on your account, so nothing was changed in the form.</p>
            ) : undefined
          }
        />
      </>
    );
  }

  /* ── View ─────────────────────────────────────────────────── */
  const [window, images, catalog] = await Promise.all([insuranceReminderWindow(), garageImages([car]), getCatalog()]);
  const reminders = remindersFor(car, today, window);
  await notifyGarageReminders(user.id, reminders);
  const notDelivered = isNotDelivered(car, today);
  const actions = quickActions(car, today, Boolean(car.model && catalog.getCar(car.model)));
  const spec = carSpecLine(car);

  // A reminder link from a notification whose date has since changed.
  const asked = one(sp.reminder);
  const staleReminder = Boolean(asked) && !reminders.some((r) => `${r.kind}-${r.dueOn}` === asked);

  return (
    <>
      <PortalHeader
        title={name}
        back={{ href: "/account/garage", label: "My garage" }}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {car.nickname && <span className="text-ink/80">{carTitle(car)}</span>}
            {spec && <span>{spec}</span>}
            {car.regNumber && <RegPlate reg={car.regNumber} />}
          </span>
        }
        actions={
          <>
            <Button href={editHref(car.id)} variant="outline" size="sm" icon={<PencilLine aria-hidden className="size-4" />}>
              Edit details
            </Button>
            <DeleteVehicleButton id={car.id} name={name} />
          </>
        }
      />

      {staleReminder && (
        <p className="mb-5 flex gap-3 border border-line bg-white px-5 py-3.5 text-[13px] text-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          That reminder was for a date you&apos;ve since changed. The dates below are the current ones.
        </p>
      )}

      <div className="space-y-6">
        <section className="grid grid-cols-1 overflow-hidden border border-line bg-white md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <CarVisual car={car} image={images[car.id]} sizes="(min-width: 1024px) 40vw, 92vw" priority className="aspect-[16/10] md:aspect-auto md:min-h-[300px]" />
          <div className="flex flex-col border-t border-line md:border-l md:border-t-0">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <h2 className="text-[14px] font-semibold">About this car</h2>
              {notDelivered && car.purchasedOn && <span className="text-[12px] font-medium text-ink/70">Delivery {formatDate(car.purchasedOn)}</span>}
            </div>
            <CarFacts car={car} notDelivered={notDelivered} />
            {car.notes && (
              <div className="mt-auto border-t border-line px-5 py-4">
                <p className="text-[11.5px] text-muted">Notes</p>
                <p className="mt-1 whitespace-pre-line break-words text-[13.5px] leading-relaxed">{car.notes}</p>
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Panel
            title={
              <span className="inline-flex items-center gap-2">
                <BellRing aria-hidden className="size-4 text-red" /> Dates &amp; reminders
              </span>
            }
            action={<span className="text-[12.5px] text-muted num">{reminders.length ? `${reminders.length} due` : "Nothing due soon"}</span>}
            padded={false}
          >
            <DateRows car={car} today={today} insuranceWindow={window} reminders={reminders} highlight={asked || undefined} />
            <p className="border-t border-line px-5 py-3 text-[12px] leading-relaxed text-muted">
              Insurance reminders start {window} days before expiry, PUC and service 30 days before, warranty 60 days before. They show here and in your notifications — we don&apos;t send SMS or email.
            </p>
          </Panel>

          <Panel title="Quick actions" padded={false} className="self-start">
            <QuickActionList actions={actions} />
          </Panel>
        </div>
      </div>
    </>
  );
}
