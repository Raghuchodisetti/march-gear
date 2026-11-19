"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { useUI } from "@/components/providers/app-provider";

/** Confirms, runs a delete Server Action, then goes back to the list. */
export function DeleteButton({ action, confirmText, redirectTo, label = "Delete" }: { action: () => Promise<ActionResult>; confirmText: string; redirectTo: string; label?: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    const res = await action().catch(() => ({ ok: false as const, error: "Couldn't reach the server." }));
    if (!res.ok) {
      setBusy(false);
      toast(res.error ?? "Couldn't delete", { tone: "error" });
      return;
    }
    toast("Deleted");
    router.replace(redirectTo);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-line bg-white px-3.5 text-[13px] font-medium text-muted transition-colors hover:border-red hover:text-red disabled:opacity-40"
    >
      {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Trash2 aria-hidden className="size-4" />}
      {label}
    </button>
  );
}
