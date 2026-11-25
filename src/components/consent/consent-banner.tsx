"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, Cookie, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CONSENT_OPEN_EVENT,
  consentServerSnapshot,
  consentSnapshot,
  subscribeConsent,
  writeConsent,
  type ConsentChoice,
} from "./consent";
import { GoogleAnalytics, disableAnalytics } from "./google-analytics";

/**
 * Cookie consent: a non-blocking card (bottom-left on desktop, a bottom sheet on phones) that asks once,
 * remembers the answer for 12 months, and reopens from the footer's "Cookie settings". Essential cookies
 * only until the visitor accepts analytics; GA4 (gtag.js) is loaded only after that, and only when a
 * measurement ID is configured. Without one the banner never auto-opens — there is nothing to consent to —
 * and "Cookie settings" says analytics is off.
 */
export function ConsentManager({ gaId }: { gaId: string | null }) {
  const choice = useSyncExternalStore(subscribeConsent, consentSnapshot, consentServerSnapshot);
  const [reopened, setReopened] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onOpen = () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setReopened(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
  }, []);

  const close = () => {
    setReopened(false);
    // Back to the "Cookie settings" button (or wherever focus was) after a reopened banner closes.
    const back = opener.current;
    opener.current = null;
    if (back?.isConnected) requestAnimationFrame(() => back.focus());
  };

  const decide = (next: ConsentChoice) => {
    if (next === "essential" && gaId) disableAnalytics(gaId);
    writeConsent(next);
    close();
  };

  // `undefined` = not hydrated yet: render nothing on the server so the banner never flashes for returning visitors.
  const open = choice !== undefined && (reopened || (choice === "unset" && gaId !== null));

  return (
    <>
      {gaId && choice === "analytics" && <GoogleAnalytics id={gaId} />}
      {open && <Banner choice={choice} analyticsAvailable={gaId !== null} reopened={reopened} onDecide={decide} onClose={close} />}
    </>
  );
}

function Banner({
  choice,
  analyticsAvailable,
  reopened,
  onDecide,
  onClose,
}: {
  choice: ConsentChoice | "unset";
  analyticsAvailable: boolean;
  reopened: boolean;
  onDecide: (c: ConsentChoice) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const root = useRef<HTMLDivElement>(null);

  // Reopened from "Cookie settings": move focus into the banner. A first-visit banner doesn't steal focus.
  useEffect(() => {
    if (reopened) root.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [reopened]);

  // Escape closes a reopened banner without changing anything (a first-visit banner needs an answer).
  useEffect(() => {
    if (!reopened) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reopened, onClose]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6 md:justify-start">
      <div
        ref={root}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="pointer-events-auto relative w-full max-w-[440px] animate-rise rounded-[4px] border border-line bg-white p-5 text-ink shadow-[0_18px_48px_-20px_rgba(17,17,17,0.35)] motion-reduce:animate-none sm:p-6"
      >
        {reopened && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cookie settings"
            className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-[250ms] hover:bg-mist hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}

        <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          <span aria-hidden className="h-px w-6 bg-red" />
          Cookies
        </p>
        <p id={titleId} className="mt-3 flex items-center gap-2.5 pr-8 font-display text-[1.2rem] font-semibold leading-snug tracking-[-0.02em]">
          <Cookie aria-hidden className="size-[18px] shrink-0 text-red" />
          Your privacy, your call.
        </p>
        <div id={bodyId} className="mt-3 space-y-2.5 text-[13.5px] leading-relaxed text-muted">
          <p>
            Essential cookies keep MarchGear working — sign-in, your saved cars and this choice. With your permission we&apos;d also use Google
            Analytics to see which pages help. We don&apos;t use advertising cookies.
          </p>
          {!analyticsAvailable && <p className="text-ink">Analytics isn&apos;t switched on right now, so only essential cookies are used. Your choice applies if that changes.</p>}
          {choice !== "unset" && (
            <p className="flex items-center gap-2 text-[12.5px] text-ink">
              <Check aria-hidden className="size-3.5 text-red" />
              Current choice: {choice === "analytics" ? "analytics allowed" : "essential cookies only"}
            </p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Button variant="dark" size="md" onClick={() => onDecide("analytics")} data-autofocus className={cn("w-full", choice === "analytics" && "ring-2 ring-red/30")}>
            Accept analytics
          </Button>
          <Button variant="outline" size="md" onClick={() => onDecide("essential")} className="w-full">
            Reject
          </Button>
        </div>
        <p className="mt-4 text-[12.5px] text-muted">
          Details in our{" "}
          <Link href="/cookies" className="font-medium text-ink underline underline-offset-4 transition-colors hover:text-red">
            cookie policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
