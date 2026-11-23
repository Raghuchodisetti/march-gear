"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, XCircle } from "lucide-react";
import { cancelTestDriveAction, requestTestDriveTimeAction } from "@/server/actions/customer-requests";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Label, Segmented, SelectField, TextArea, TextField } from "@/components/ui/field";
import { useRun } from "@/components/portal/crm/use-run";

/* Cancel a test drive, or ask the dealer for another time. Ownership and state are re-checked on the server. */

export interface DriveActionTarget {
  id: string;
  car: string;
  dealerName: string;
  whenLabel: string | null;
  /** A request MarchGear is arranging (no dealer partner yet). */
  viaMarchGear: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The next `n` days from `today` (YYYY-MM-DD, IST), labelled without locale APIs so every browser agrees. */
function days(today: string, n: number) {
  const start = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start + i * 86_400_000);
    const value = d.toISOString().slice(0, 10);
    const label = `${i === 0 ? "Today" : i === 1 ? "Tomorrow" : WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
    return { value, label };
  });
}

const CANCEL_REASONS = ["My plans changed", "I've already bought a car", "I'm looking at a different car", "The time doesn't suit me", "Other"];

/** `children` (e.g. Directions, Call) sit between the main action and Cancel. */
export function DriveActions({ drive, today, children }: { drive: DriveActionTarget; today: string; children?: ReactNode }) {
  const [open, setOpen] = useState<"cancel" | "ask" | null>(null);
  return (
    <>
      <Button variant="dark" size="sm" onClick={() => setOpen("ask")} icon={<CalendarClock className="size-4" aria-hidden />}>
        Ask for another time
      </Button>
      {children}
      <Button variant="ghost" size="sm" onClick={() => setOpen("cancel")} icon={<XCircle className="size-4" aria-hidden />} className="text-ink/70 hover:text-red">
        Cancel
      </Button>
      <Modal
        open={open === "ask"}
        onClose={() => setOpen(null)}
        title="Ask for another time"
        description={drive.viaMarchGear ? "MarchGear's team will confirm the new time with you." : `Your current booking stays as it is until ${drive.dealerName} confirms a new time.`}
      >
        {open === "ask" && <AskForm drive={drive} today={today} onDone={() => setOpen(null)} />}
      </Modal>
      <Modal open={open === "cancel"} onClose={() => setOpen(null)} title="Cancel this test drive?" size="sm">
        {open === "cancel" && <CancelForm drive={drive} onDone={() => setOpen(null)} onAsk={() => setOpen("ask")} />}
      </Modal>
    </>
  );
}

function AskForm({ drive, today, onDone }: { drive: DriveActionTarget; today: string; onDone: () => void }) {
  const router = useRouter();
  const { run, busy, errors, setErrors } = useRun();
  const options = useState(() => days(today, 21))[0];
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<"morning" | "afternoon" | "evening">("morning");
  const [note, setNote] = useState("");
  const who = drive.viaMarchGear ? "MarchGear's team" : drive.dealerName;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await run("ask", () => requestTestDriveTimeAction({ id: drive.id, date, slot, note: note.trim() || undefined }), `Sent — ${who} will confirm a new time with you.`);
    if (res) {
      onDone();
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 px-6 py-6 sm:px-8" noValidate>
      <p className="text-[13.5px] text-muted">
        <span className="font-medium text-ink">{drive.car}</span>
        {drive.whenLabel ? <> · currently {drive.whenLabel}</> : null}
      </p>
      <SelectField label="Preferred day" value={date} onChange={(e) => {
          setDate(e.target.value);
          setErrors((prev) => {
            const next = { ...prev };
            delete next.date;
            return next;
          });
        }} placeholder="Choose a day" options={options} error={errors.date} data-autofocus />
      <div>
        <Label>Time of day</Label>
        <Segmented
          ariaLabel="Time of day"
          className="flex w-full"
          value={slot}
          onChange={setSlot}
          options={[
            { value: "morning", label: "Morning" },
            { value: "afternoon", label: "Afternoon" },
            { value: "evening", label: "Evening" },
          ]}
        />
        <p className="mt-1.5 text-xs text-muted">{slot === "morning" ? "10 am – 1 pm" : slot === "afternoon" ? "1 – 5 pm" : "5 – 8 pm"}</p>
        {errors.slot && <p className="mt-1.5 text-xs text-red">{errors.slot}</p>}
      </div>
      <div>
        <TextArea label="Anything they should know? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="e.g. I can only come after 6 pm on weekdays" />
        {errors.note && <p className="mt-1.5 text-xs text-red">{errors.note}</p>}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Not now
        </Button>
        <Button type="submit" variant="dark" size="sm" disabled={busy !== null} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
          Send request
        </Button>
      </div>
    </form>
  );
}

function CancelForm({ drive, onDone, onAsk }: { drive: DriveActionTarget; onDone: () => void; onAsk: () => void }) {
  const router = useRouter();
  const { run, busy, errors } = useRun();
  const [preset, setPreset] = useState("");
  const [other, setOther] = useState("");
  const who = drive.viaMarchGear ? "MarchGear's team" : drive.dealerName;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const reason = preset === "Other" ? other.trim() : preset;
    const res = await run("cancel", () => cancelTestDriveAction({ id: drive.id, reason: reason || undefined }), `Test drive cancelled — ${who} has been told.`);
    if (res) {
      onDone();
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 px-6 py-6 sm:px-8" noValidate>
      <p className="text-[14px] leading-relaxed text-ink/80">
        <span className="font-semibold text-ink">{drive.car}</span>
        {drive.viaMarchGear ? "" : ` with ${drive.dealerName}`}
        {drive.whenLabel ? ` · ${drive.whenLabel}` : ""}. {who} will see that you cancelled.
      </p>
      <SelectField
        label="Reason (optional)"
        value={preset}
        onChange={(e) => setPreset(e.target.value)}
        placeholder="Prefer not to say"
        options={CANCEL_REASONS.map((r) => ({ value: r, label: r }))}
        error={preset !== "Other" ? errors.reason : undefined}
      />
      {preset === "Other" && <TextField label="Tell them why" value={other} onChange={(e) => setOther(e.target.value)} maxLength={300} error={errors.reason} placeholder="A few words" />}
      {preset === "The time doesn't suit me" && (
        <p className="border-l-2 border-ink bg-mist/60 px-3.5 py-2.5 text-[13px] text-ink/80">
          You can keep the booking and{" "}
          <button type="button" onClick={onAsk} className="font-semibold text-ink underline underline-offset-4">
            ask for another time
          </button>{" "}
          instead.
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Keep it
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy !== null} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
          Cancel test drive
        </Button>
      </div>
    </form>
  );
}
