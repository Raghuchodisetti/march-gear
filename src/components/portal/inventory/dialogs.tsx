"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CircleDot, Eye, Loader2, MessageSquareWarning } from "lucide-react";
import type { PartnerVehicleStatus } from "@/db/enums";
import { cn } from "@/lib/utils";
import { VEHICLE_STATUS_LABEL, VEHICLE_STATUS_TONE } from "@/partner/labels";
import { Button } from "@/components/ui/button";
import { Drawer, Modal } from "@/components/ui/overlay";
import { Badge, formatDateTime } from "@/components/portal/ui";
import { StockVehicleDetail } from "@/components/dealer/stock-detail";
import { vehicleHistoryAction, vehiclePreviewAction } from "@/server/actions/partner-inventory";
import { historyLabel, NEEDS_ATTENTION, type PublicVehicle, type VehicleHistoryEntry } from "./shared";

/* Confirmations, the approval-history drawer and the public preview for vehicles. */

export function StatusBadge({ status }: { status: PartnerVehicleStatus }) {
  return <Badge tone={VEHICLE_STATUS_TONE[status]}>{VEHICLE_STATUS_LABEL[status]}</Badge>;
}

/** MarchGear's message on a vehicle sent back or rejected — always shown prominently. */
export function RemarksCallout({ status, remarks, className }: { status: PartnerVehicleStatus; remarks: string | null; className?: string }) {
  if (!NEEDS_ATTENTION.includes(status)) return null;
  const rejected = status === "rejected";
  return (
    <div className={cn("flex gap-3 border-l-2 px-4 py-3", rejected ? "border-red bg-red-50" : "border-[#c98a1b] bg-[#fdf3e1]", className)} role="note">
      <MessageSquareWarning aria-hidden className={cn("mt-0.5 size-4 shrink-0", rejected ? "text-red" : "text-[#9a5b00]")} />
      <div className="min-w-0 text-[13.5px]">
        <p className={cn("font-semibold", rejected ? "text-red" : "text-[#9a5b00]")}>{rejected ? "Rejected by MarchGear" : "MarchGear asked for changes"}</p>
        <p className="mt-0.5 whitespace-pre-line text-ink/85">{remarks || "No remarks were left. Open the approval history or contact support for details."}</p>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  tone = "dark",
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "dark" | "danger";
  busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} title={title} size="sm">
      <div className="px-6 pb-6 pt-5 sm:px-8">
        <div className="flex gap-3 text-[14px] leading-relaxed text-ink/80">
          {tone === "danger" && <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-red" />}
          <div className="min-w-0 space-y-2">{children}</div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "primary" : "dark"} onClick={onConfirm} disabled={busy} icon={busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : undefined} data-autofocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const statusText = (s: string | null) => (s && s in VEHICLE_STATUS_LABEL ? VEHICLE_STATUS_LABEL[s as PartnerVehicleStatus] : s);

/** Every publish, submission and decision for one vehicle, with MarchGear's remarks. */
export function HistoryDrawer({ vehicleId, onClose }: { vehicleId: number | null; onClose: () => void }) {
  const [data, setData] = useState<{ id: number; entries: VehicleHistoryEntry[]; status: PartnerVehicleStatus; kind: "new" | "used"; remarks: string | null; reference: string; title: string } | null>(null);
  const [error, setError] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    if (!vehicleId) return;
    let live = true;
    vehicleHistoryAction(vehicleId).then((res) => {
      if (!live) return;
      if (res.ok) setData({ id: vehicleId, ...res });
      else setError({ id: vehicleId, message: res.error ?? "Couldn't load the history." });
    });
    return () => {
      live = false;
    };
  }, [vehicleId]);

  const current = data?.id === vehicleId ? data : null;
  const failed = error?.id === vehicleId ? error.message : null;

  return (
    <Drawer open={vehicleId !== null} onClose={onClose} title="Listing history" className="sm:max-w-lg">
      <div className="p-5">
        {!current && !failed && (
          <p className="flex items-center gap-2 text-[13.5px] text-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Loading…
          </p>
        )}
        {failed && <p className="text-[13.5px] text-red">{failed}</p>}
        {current && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={current.status} />
              <span className="text-[12.5px] text-muted num">{current.reference}</span>
            </div>
            <p className="mt-2 text-[15px] font-semibold">{current.title || "Untitled vehicle"}</p>
            <RemarksCallout status={current.status} remarks={current.remarks} className="mt-4" />
            {current.kind === "new" && current.status === "unpublished" && current.remarks && (
              <p className="mt-4 border-l-2 border-[#c98a1b] bg-[#fdf3e1] px-4 py-3 text-[13.5px]">
                <span className="font-semibold text-[#9a5b00]">Paused by MarchGear: </span>
                {current.remarks}
              </p>
            )}
            {current.entries.length === 0 ? (
              <p className="mt-8 border border-dashed border-line px-4 py-10 text-center text-[13.5px] text-muted">
                {current.kind === "new"
                  ? "Not published yet. When you publish or pause it — or MarchGear pauses it — each step appears here."
                  : "Not submitted yet. When you submit it for approval, every step and MarchGear\u2019s remarks appear here."}
              </p>
            ) : (
              <ol className="relative mt-8 space-y-6 before:absolute before:inset-y-1 before:left-[7px] before:w-px before:bg-line">
                {current.entries.map((e) => (
                  <li key={e.id} className="relative pl-8">
                    <CircleDot aria-hidden className={cn("absolute left-0 top-0.5 size-[15px] bg-white", e.actorSide === "admin" ? "text-red" : "text-ink/40")} />
                    <p className="text-[14px] font-medium">{historyLabel(e.action)}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {e.actorSide === "admin" ? "MarchGear team" : e.actorSide === "system" ? "System" : e.actorName || "Your team"} · {formatDateTime(e.createdAt)}
                    </p>
                    {(e.fromStatus || e.toStatus) && e.fromStatus !== e.toStatus && (
                      <p className="mt-1.5 text-[12px] text-muted">
                        {statusText(e.fromStatus) ?? "—"} <span aria-hidden>→</span>
                        <span className="sr-only">to</span> <span className="font-medium text-ink">{statusText(e.toStatus) ?? "—"}</span>
                      </p>
                    )}
                    {e.remarks && <p className={cn("mt-2 whitespace-pre-line border-l-2 py-1 pl-3 text-[13px]", e.actorSide === "admin" ? "border-red text-ink" : "border-line text-ink/75")}>{e.remarks}</p>}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}

function PreviewBody({ vehicle, brandName }: { vehicle: PublicVehicle; brandName: string }) {
  return (
    <div className="p-5 sm:p-8">
      <p className="mb-6 flex items-start gap-2 bg-mist px-4 py-3 text-[13px] text-ink/80">
        <Eye aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          {vehicle.kind === "used"
            ? "This is how buyers will see the car once MarchGear approves it — on /used-cars and your dealer page. Specifications come from the catalogue; the photos and history are yours."
            : "This is how buyers will see the listing once you publish it — on your dealer page and on the model's page. The car's photos, specifications and features come from the MarchGear catalogue."}{" "}
          Buyers also get enquiry buttons here.
        </span>
      </p>
      <StockVehicleDetail vehicle={vehicle} brandName={brandName} />
    </div>
  );
}

/** The public view of a saved vehicle (from the list) or of the unsaved form (`vehicle` given). */
export function PreviewModal({
  vehicleId,
  vehicle,
  brandName,
  onClose,
}: {
  vehicleId?: number | null;
  vehicle?: PublicVehicle | null;
  brandName?: string;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState<{ id: number; vehicle: PublicVehicle; brandName: string } | { id: number; error: string } | null>(null);
  useEffect(() => {
    if (!vehicleId) return;
    let live = true;
    vehiclePreviewAction(vehicleId).then((res) => {
      if (!live) return;
      setLoaded(res.ok ? { id: vehicleId, vehicle: res.vehicle, brandName: res.brandName } : { id: vehicleId, error: res.error ?? "Couldn't load the preview." });
    });
    return () => {
      live = false;
    };
  }, [vehicleId]);

  const open = Boolean(vehicleId) || Boolean(vehicle);
  const fetched = vehicleId && loaded?.id === vehicleId ? loaded : null;
  return (
    <Modal open={open} onClose={onClose} size="xl" title="Listing preview">
      {vehicle ? (
        <PreviewBody vehicle={vehicle} brandName={brandName ?? vehicle.brand} />
      ) : fetched && "vehicle" in fetched ? (
        <PreviewBody vehicle={fetched.vehicle} brandName={fetched.brandName} />
      ) : fetched && "error" in fetched ? (
        <p className="p-8 text-[14px] text-red">{fetched.error}</p>
      ) : (
        <p className="flex items-center gap-2 p-8 text-[14px] text-muted">
          <Loader2 aria-hidden className="size-4 animate-spin" /> Loading preview…
        </p>
      )}
    </Modal>
  );
}
