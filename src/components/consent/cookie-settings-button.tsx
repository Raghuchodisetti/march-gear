"use client";

import { openCookieSettings } from "./consent";

/** Footer link-style button that reopens the cookie consent banner. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      Cookie settings
    </button>
  );
}
