"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteGarageVehicleAction } from "@/server/actions/customer-garage";
import { useRun } from "@/components/portal/crm/use-run";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";

/* "Remove" on a garage car: confirms in a dialog, deletes it, then goes back to the garage. */
export function DeleteVehicleButton({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);

  const remove = async () => {
    const res = await run("delete", () => deleteGarageVehicleAction(id), `${name} removed from your garage`);
    if (!res) return;
    setGone(true);
    setOpen(false);
    router.replace("/account/garage");
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={gone}
        className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-line bg-white px-3.5 text-[13px] font-medium text-muted transition-colors hover:border-red hover:text-red disabled:opacity-40"
      >
        <Trash2 aria-hidden className="size-4" /> Remove
      </button>
      <Modal open={open} onClose={() => busy === null && setOpen(false)} title={`Remove ${name}?`} description="Its dates, notes and reminders are deleted. This can't be undone." size="sm">
        <div className="space-y-5 px-6 py-6 sm:px-8">
          <p className="text-[13.5px] leading-relaxed text-muted">Your insurance requests and quotes for this car aren&apos;t affected — they stay under Insurance.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy !== null}>
              Keep it
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={remove}
              disabled={busy !== null}
              data-autofocus
              icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
            >
              Remove car
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
