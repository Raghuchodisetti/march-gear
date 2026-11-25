"use client";

import { useCallback, useState } from "react";

/* ──────────────────────────────────────────────────────────────
   Keyboard and screen-reader feedback for public forms.

   On a failed submit: announce how many fields need attention
   (aria-live) and move focus to the first invalid control in DOM
   order. Fields mark themselves with aria-invalid and link their
   message with aria-describedby, so the focused field reads out
   its own error.
   ────────────────────────────────────────────────────────────── */

const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focuses the first `[aria-invalid="true"]` control inside `root` (after the next paint, so new errors are rendered). */
export function focusFirstInvalid(root?: HTMLElement | null) {
  requestAnimationFrame(() => {
    const scope: ParentNode = root ?? document;
    const marked = scope.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!marked) return;
    const target = marked.matches(FOCUSABLE) ? marked : (marked.querySelector<HTMLElement>(FOCUSABLE) ?? marked);
    target.focus();
    target.scrollIntoView?.({ block: "nearest" });
  });
}

/**
 * Arrow-key behaviour for a custom radio group (`role="radiogroup"` with `role="radio"` buttons): ←/↑ and →/↓ move
 * to the previous/next option and select it, Home/End jump to the ends. Pair with a roving tabindex (only the
 * checked option — or the first, when none is — has tabIndex 0) so Tab enters and leaves the group in one stop.
 */
export function radioGroupKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
  if (!keys.includes(e.key)) return;
  const group = (e.target as HTMLElement).closest('[role="radiogroup"]');
  if (!group) return;
  const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])'));
  const index = radios.indexOf(e.target as HTMLElement);
  if (index === -1 || !radios.length) return;
  e.preventDefault();
  const next =
    e.key === "Home" ? 0 : e.key === "End" ? radios.length - 1 : (index + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + radios.length) % radios.length;
  radios[next].focus();
  radios[next].click();
}

/** tabIndex for option `i` of a roving-tabindex radio group. */
export const rovingTabIndex = (checked: boolean, i: number, anyChecked: boolean) => (checked || (!anyChecked && i === 0) ? 0 : -1);

/** A polite/assertive live region that is always mounted, so changes to it are announced. */
export function LiveRegion({ message, assertive = true }: { message: string; assertive?: boolean }) {
  return (
    <p className="sr-only" aria-live={assertive ? "assertive" : "polite"} aria-atomic="true">
      {message}
    </p>
  );
}

/**
 * `report(errors, root)` after client validation or a failed server response: announces the count and focuses the
 * first invalid field. Returns true when there were errors. Render `live` once inside the form.
 */
export function useFormFeedback() {
  const [message, setMessage] = useState("");
  const report = useCallback((errors: Record<string, string | undefined | null>, root?: HTMLElement | null, extra?: string) => {
    const count = Object.values(errors).filter(Boolean).length;
    if (!count && !extra) {
      setMessage("");
      return false;
    }
    const text = count ? `${count === 1 ? "One field needs" : `${count} fields need`} your attention.${extra ? ` ${extra}` : ""}` : (extra ?? "");
    // The same text twice wouldn't be re-announced; a trailing no-break space makes it a change.
    setMessage((prev) => (prev === text ? `${text}\u00a0` : text));
    if (count) focusFirstInvalid(root);
    return true;
  }, []);
  const announce = useCallback((text: string) => setMessage((prev) => (prev === text ? `${text}\u00a0` : text)), []);
  return { report, announce, live: <LiveRegion message={message} /> };
}
