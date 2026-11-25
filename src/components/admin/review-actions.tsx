"use client";

import { useState } from "react";
import { useDeskRouter as useRouter } from "@/components/admin/desk";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import type { ReviewStatus } from "@/db/enums";
import { deleteReviewAction, setReviewStatusAction } from "@/server/actions/admin";
import { useUI } from "@/components/providers/app-provider";
import { ReviewEditDialog, type EditableReview } from "./review-editor";

/** Approve / reject / edit / delete buttons for one review row. */
export function ReviewActions({ kind, id, status, review }: { kind: "owner" | "dealer"; id: string; status: ReviewStatus; review: EditableReview }) {
  const router = useRouter();
  const { toast } = useUI();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(key);
    const res = await fn().catch(() => ({ ok: false, error: "Couldn't reach the server." }));
    setBusy(null);
    if (!res.ok) return toast(res.error ?? "Something went wrong", { tone: "error" });
    toast(done, { tone: "success" });
    router.refresh();
  };

  const btn = "inline-flex h-8 items-center gap-1.5 rounded-[3px] border px-2.5 text-[12.5px] font-medium transition-colors disabled:opacity-40";
  return (
    <div className="flex flex-wrap gap-1.5">
      {status !== "approved" && (
        <button type="button" disabled={busy !== null} onClick={() => run("approve", () => setReviewStatusAction(kind, id, "approved"), "Review published")} className={`${btn} border-ink bg-ink text-white hover:bg-ink-3`}>
          {busy === "approve" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />} Approve
        </button>
      )}
      {status !== "rejected" && (
        <button type="button" disabled={busy !== null} onClick={() => run("reject", () => setReviewStatusAction(kind, id, "rejected"), "Review hidden")} className={`${btn} border-line hover:border-ink`}>
          {busy === "reject" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <X className="size-3.5" aria-hidden />} {status === "approved" ? "Hide" : "Reject"}
        </button>
      )}
      <button type="button" disabled={busy !== null} onClick={() => setEditing(true)} className={`${btn} border-line hover:border-ink`}>
        <Pencil className="size-3.5" aria-hidden /> Edit
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => window.confirm("Delete this review permanently?") && run("delete", () => deleteReviewAction(kind, id), "Review deleted")}
        className={`${btn} border-line text-muted hover:border-red hover:text-red`}
        aria-label="Delete review"
      >
        {busy === "delete" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />}
      </button>
      <ReviewEditDialog kind={kind} id={id} review={review} open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}
