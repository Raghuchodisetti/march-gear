"use client";

import { useCallback, useState } from "react";
import type { ActionFailure, ActionResult } from "@/lib/action-result";
import { useUI } from "@/components/providers/app-provider";

// A failed request must not leave buttons stuck on "busy".
const OFFLINE: ActionFailure = { ok: false, error: "Couldn't reach the server. Please check your connection and try again." };

/**
 * Runs a Server Action with a busy flag, field errors and toasts.
 * Resolves to the successful result, or null when it failed.
 */
export function useRun() {
  const { toast } = useUI();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = useCallback(
    async <T extends object>(key: string, fn: () => Promise<ActionResult<T>>, success?: string | ((r: { ok: true } & T) => string | null)) => {
      setBusy(key);
      setErrors({});
      const res: ActionResult<T> = await fn().catch(() => OFFLINE);
      setBusy(null);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        const fieldCount = Object.keys(res.fieldErrors ?? {}).length;
        toast(res.error ?? (fieldCount ? "Please check the highlighted fields." : "Something went wrong. Please try again."), { tone: "error" });
        return null;
      }
      const msg = typeof success === "function" ? success(res as { ok: true } & T) : success;
      if (msg) toast(msg, { tone: "success" });
      const warning = (res as { warning?: string }).warning;
      if (warning) toast(warning);
      return res as { ok: true } & T;
    },
    [toast],
  );

  return { run, busy, errors, setErrors };
}
