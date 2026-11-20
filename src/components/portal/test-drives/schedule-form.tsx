"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Loader2, TriangleAlert } from "lucide-react";
import { checkSlotAction, createTestDriveAction, scheduleTestDriveAction } from "@/server/actions/partner-test-drives";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/field";
import { Input, Select } from "@/components/portal/crm/controls";
import { useRun } from "@/components/portal/crm/use-run";
import { formatWhen, toISTInput } from "@/components/portal/crm/pipeline";
import type { MemberOption, ModelOption, ShowroomOption, TestDriveItem, VehicleOption } from "@/components/portal/crm/types";

export interface TestDriveOptions {
  vehicles: VehicleOption[];
  models: ModelOption[];
  showrooms: ShowroomOption[];
  members: MemberOption[];
  /** False for members who may only take bookings themselves. */
  canAssign: boolean;
  selfId: number;
}

type Mode =
  | { kind: "create"; lead?: { id: number; name: string; mobile: string | null; email: string | null; carSlug: string | null; variant: string | null; vehicleId: number | null } }
  | { kind: "schedule"; drive: TestDriveItem };

/** Book a new test drive, or accept / schedule / reschedule an existing one. */
export function TestDriveFormModal({ open, onClose, mode, options, onDone }: { open: boolean; onClose: () => void; mode: Mode; options: TestDriveOptions; onDone?: () => void }) {
  const title =
    mode.kind === "create"
      ? "Schedule a test drive"
      : mode.drive.status === "requested"
        ? "Accept request"
        : mode.drive.status === "accepted"
          ? "Schedule test drive"
          : "Reschedule test drive";
  return (
    <Modal open={open} onClose={onClose} title={title} description={mode.kind === "schedule" ? `${mode.drive.reference} · ${mode.drive.customerName}` : "Times are in IST."} size="lg">
      {open && <Form mode={mode} options={options} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function Form({ mode, options, onClose, onDone }: { mode: Mode; options: TestDriveOptions; onClose: () => void; onDone?: () => void }) {
  const { run, busy, errors } = useRun();
  const drive = mode.kind === "schedule" ? mode.drive : null;
  const lead = mode.kind === "create" ? mode.lead : undefined;
  const initialVehicle = drive?.vehicle?.id ?? lead?.vehicleId ?? null;

  const [customerName, setCustomerName] = useState(lead?.name ?? "");
  const [mobile, setMobile] = useState(lead?.mobile ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [source, setSource] = useState<"inventory" | "catalogue">(initialVehicle || (!lead?.carSlug && options.vehicles.length) ? "inventory" : "catalogue");
  const [vehicleId, setVehicleId] = useState(initialVehicle ? String(initialVehicle) : "");
  const [carSlug, setCarSlug] = useState(lead?.carSlug ?? "");
  const [variant, setVariant] = useState(lead?.variant ?? "");
  const [showroomId, setShowroomId] = useState(drive?.showroom ? String(drive.showroom.id) : options.showrooms[0] ? String(options.showrooms[0].id) : "");
  const [memberId, setMemberId] = useState(drive?.assigned ? String(drive.assigned.id) : options.canAssign ? "" : String(options.selfId));
  const [at, setAt] = useState(() => {
    const base = drive?.scheduledAt ?? drive?.requestedFor;
    return base && new Date(base).getTime() > Date.now() ? toISTInput(base) : "";
  });
  const [note, setNote] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const keepCar = mode.kind === "schedule" && !vehicleId && !carSlug;

  const model = useMemo(() => options.models.find((m) => m.value === carSlug), [options.models, carSlug]);
  const vehicleChoices = options.vehicles.map((v) => ({ value: String(v.id), label: `${v.label} · ${v.kind === "used" ? "Pre-owned" : "New"} · ${v.reference}` }));
  if (drive?.vehicle && !options.vehicles.some((v) => v.id === drive.vehicle!.id)) vehicleChoices.unshift({ value: String(drive.vehicle.id), label: `${drive.vehicle.label} · ${drive.vehicle.reference}` });

  // Clash warning per executive, checked as the time or person changes.
  useEffect(() => {
    if (!memberId || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) return;
    let live = true;
    const t = setTimeout(async () => {
      const res = await checkSlotAction({ memberId: Number(memberId), at, excludeId: drive?.id }).catch(() => null);
      if (live) setWarning(res && res.ok ? res.warning : null);
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [memberId, at, drive?.id]);

  const car = source === "inventory" ? { vehicleId: vehicleId || undefined } : { carSlug: carSlug || undefined, variant: variant || undefined };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res =
      mode.kind === "create"
        ? await run("save", () =>
            createTestDriveAction({
              leadId: lead?.id || undefined,
              customerName,
              mobile,
              email,
              ...car,
              showroomId: showroomId || undefined,
              assignedMemberId: memberId || undefined,
              scheduledAt: at,
              note: note || undefined,
            }),
            (r) => `Test drive ${r.reference} scheduled`,
          )
        : await run("save", () =>
            scheduleTestDriveAction({
              id: mode.drive.id,
              scheduledAt: at,
              ...(keepCar ? {} : car),
              showroomId: showroomId || undefined,
              assignedMemberId: memberId || undefined,
              note: note || undefined,
            }),
            at ? "Test drive scheduled" : "Request accepted",
          );
    if (res) {
      onDone?.();
      onClose();
    }
  };

  const minAt = toISTInput(new Date());
  return (
    <form onSubmit={submit} noValidate className="space-y-5 px-6 py-6 sm:px-8">
      {mode.kind === "create" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} error={errors.customerName} autoComplete="off" data-autofocus />
          <Input label="Mobile" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} error={errors.mobile} placeholder="10-digit mobile" />
          <Input label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        </div>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] font-medium text-ink/80">Car</p>
          <Segmented
            ariaLabel="Where the car comes from"
            value={source}
            onChange={setSource}
            options={[
              { value: "inventory", label: "Your inventory" },
              { value: "catalogue", label: "Catalogue model" },
            ]}
          />
        </div>
        {source === "inventory" ? (
          <Select
            aria-label="Vehicle from inventory"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            options={vehicleChoices}
            placeholder={mode.kind === "schedule" ? `Keep: ${mode.drive.carLabel}` : vehicleChoices.length ? "Choose a published vehicle" : "No published vehicles yet — use a catalogue model"}
            error={errors.vehicleId}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              aria-label="Catalogue model"
              value={carSlug}
              onChange={(e) => {
                setCarSlug(e.target.value);
                setVariant("");
              }}
              options={options.models.map((m) => ({ value: m.value, label: m.label }))}
              placeholder={mode.kind === "schedule" ? `Keep: ${mode.drive.carLabel}` : "Choose a model"}
              error={errors.carSlug}
            />
            <Select aria-label="Variant" value={variant} onChange={(e) => setVariant(e.target.value)} options={(model?.variants ?? []).map((v) => ({ value: v, label: v }))} placeholder="Any variant" disabled={!model} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={drive?.status === "requested" ? "Date & time (optional — accept now, confirm later)" : "Date & time (IST)"}
          type="datetime-local"
          min={minAt}
          value={at}
          onChange={(e) => setAt(e.target.value)}
          error={errors.scheduledAt}
          hint={drive?.requestedFor ? `Customer asked for ${formatWhen(drive.requestedFor, { weekday: true })}` : undefined}
        />
        <Select
          label="Sales executive"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          options={(options.canAssign ? options.members : options.members.filter((m) => m.id === options.selfId)).map((m) => ({ value: String(m.id), label: `${m.name} · ${m.roleLabel}` }))}
          placeholder={options.canAssign ? "Not assigned yet" : undefined}
          error={errors.assignedMemberId}
        />
        <Select
          label="Showroom"
          value={showroomId}
          onChange={(e) => setShowroomId(e.target.value)}
          options={options.showrooms.map((s) => ({ value: String(s.id), label: `${s.name} · ${s.city}` }))}
          placeholder={options.showrooms.length ? undefined : "No showrooms yet"}
          error={errors.showroomId}
        />
        <Input label="Note for the timeline (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </div>

      {warning && memberId && at && (
        <p role="status" className="flex items-start gap-2.5 border border-[#f3dfb8] bg-[#fdf3e1] px-4 py-3 text-[13px] text-[#7a4a00]">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {warning} You can still save.
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="dark" size="sm" disabled={busy !== null} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarCheck2 className="size-4" aria-hidden />}>
          {mode.kind === "create" ? "Schedule test drive" : drive?.status === "requested" ? (at ? "Accept & schedule" : "Accept request") : "Save new time"}
        </Button>
      </div>
    </form>
  );
}
