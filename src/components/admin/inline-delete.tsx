"use client";

import { useState } from "react";
import { useDeskRouter as useRouter } from "@/components/admin/desk";
import { Loader2, Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { useUI } from "@/components/providers/app-provider";

/** Icon-only delete for table rows; refreshes the list in place. */
export function InlineDelete({ action, confirmText }: { action: () => Promise<ActionResult>; confirmText: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-label="Delete"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(confirmText)) return;
        setBusy(true);
        const res = await action().catch(() => ({ ok: false as const, error: "Couldn't reach the server." }));
        setBusy(false);
        if (!res.ok) return toast(res.error ?? "Couldn't delete", { tone: "error" });
        toast("Removed");
        router.refresh();
      }}
      className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red disabled:opacity-40"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
