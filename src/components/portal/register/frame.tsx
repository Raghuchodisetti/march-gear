"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, LifeBuoy, Loader2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { dealerSignOutAction } from "@/server/actions/partner-auth";

/* ──────────────────────────────────────────────────────────────
   Chrome for /dealer/register/*: logo, save state, help, sign out.
   The wizard reports its autosave state here and registers a
   "flush" so signing out never loses the last few keystrokes.
   ────────────────────────────────────────────────────────────── */

export type SaveState = { kind: "hidden" } | { kind: "saving" } | { kind: "saved"; at: number } | { kind: "error"; message: string };

interface SaveContextValue {
  state: SaveState;
  setState: (s: SaveState) => void;
  /** Registered by the wizard: saves anything pending. */
  flushRef: React.RefObject<(() => Promise<void>) | null>;
  retryRef: React.RefObject<(() => void) | null>;
}

const SaveContext = createContext<SaveContextValue | null>(null);

export function useSaveStatus() {
  const ctx = useContext(SaveContext);
  if (!ctx) throw new Error("useSaveStatus must be used inside <RegisterFrame>");
  return ctx;
}

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function SaveIndicator() {
  const { state, retryRef } = useSaveStatus();
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (state.kind !== "saved") return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 5000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [state]);

  if (state.kind === "hidden") return null;
  return (
    <div aria-live="polite" className="flex min-w-0 items-center gap-2 text-[12.5px]">
      {state.kind === "saving" && (
        <span className="inline-flex items-center gap-1.5 text-muted">
          <Loader2 aria-hidden className="size-3.5 animate-spin" /> Saving…
        </span>
      )}
      {state.kind === "saved" && (
        <span className="inline-flex items-center gap-1.5 text-muted" title={new Date(state.at).toLocaleString("en-IN")}>
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#e8f5ec] text-[#1e7a3c]">
            <Check aria-hidden className="size-2.5" strokeWidth={3} />
          </span>
          <span className="whitespace-nowrap">
            Saved<span className="hidden sm:inline"> · {now ? ago(now - state.at) : "just now"}</span>
          </span>
        </span>
      )}
      {state.kind === "error" && (
        <span className="inline-flex min-w-0 items-center gap-1.5 text-red" title={state.message}>
          <AlertCircle aria-hidden className="size-3.5 shrink-0" />
          <span className="whitespace-nowrap">Couldn&apos;t save</span>
          <button type="button" onClick={() => retryRef.current?.()} className="whitespace-nowrap font-medium text-ink underline underline-offset-4 hover:text-red">
            Retry
          </button>
        </span>
      )}
    </div>
  );
}

export function RegisterFrame({ signedIn, support, children }: { signedIn: boolean; support: { phone: string; email: string }; children: ReactNode }) {
  const router = useRouter();
  const [state, setStateRaw] = useState<SaveState>({ kind: "hidden" });
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const [leaving, setLeaving] = useState(false);
  const setState = useCallback((s: SaveState) => setStateRaw(s), []);
  const value = useMemo(() => ({ state, setState, flushRef, retryRef }), [state, setState]);

  const signOut = async () => {
    setLeaving(true);
    try {
      await flushRef.current?.();
      await dealerSignOutAction();
      router.replace("/dealer/login");
      router.refresh();
    } catch {
      setLeaving(false);
    }
  };

  return (
    <SaveContext.Provider value={value}>
      <div className="flex min-h-dvh flex-col bg-[#F6F6F6]">
        <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-3 px-4 md:px-8">
            <Link href="/dealer/register" className="flex shrink-0 items-center gap-2 font-display text-[18px] tracking-[-0.02em] text-ink md:text-[19px]">
              <span>
                <span className="font-semibold">March</span>Gear
              </span>
              <span className="rounded-[3px] bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">Partner</span>
            </Link>
            <div className="flex min-w-0 items-center gap-1 sm:gap-3">
              <SaveIndicator />
              <span aria-hidden className={cn("hidden h-5 w-px bg-line sm:block", state.kind === "hidden" && "sm:hidden")} />
              <a
                href={`mailto:${support.email}`}
                className="hidden h-9 items-center gap-1.5 rounded-[3px] px-2.5 text-[13px] text-muted transition-colors hover:bg-mist hover:text-ink md:inline-flex"
                title={`Partner support · ${support.phone}`}
              >
                <LifeBuoy aria-hidden className="size-4" /> Help
              </a>
              {signedIn ? (
                <button
                  type="button"
                  onClick={signOut}
                  disabled={leaving}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[3px] px-2.5 text-[13px] font-medium text-ink/80 transition-colors hover:bg-mist hover:text-ink disabled:opacity-50"
                >
                  {leaving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <LogOut aria-hidden className="size-4" />}
                  <span className="hidden sm:inline">Sign out</span>
                  <span className="sr-only sm:hidden">Sign out</span>
                </button>
              ) : (
                <Link href="/dealer/login" className="inline-flex h-9 shrink-0 items-center rounded-[3px] border border-ink/15 px-3.5 text-[13px] font-medium transition-colors hover:border-ink">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
      </div>
    </SaveContext.Provider>
  );
}
