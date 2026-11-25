/* ──────────────────────────────────────────────────────────────
   Cookie consent state, shared by the banner, the footer's
   "Cookie settings" button and the analytics loader.

   The decision lives in the first-party cookie `mg_consent` for
   12 months: "1.analytics.<yyyymmdd>" or "1.essential.<yyyymmdd>".
   No cookie = no decision yet = essential cookies only. The leading
   version lets a future policy change ask everyone again.
   ────────────────────────────────────────────────────────────── */

export const CONSENT_COOKIE = "mg_consent";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;
/** Lifetime of the Google Analytics cookies (_ga, _ga_<ID>) once analytics is accepted: 395 days ≈ 13 months (GA's default is 2 years). */
export const GA_COOKIE_MAX_AGE = 34_128_000;
const VERSION = "1";

export type ConsentChoice = "analytics" | "essential";

/** Fired on window by openCookieSettings(); the banner listens and reopens. */
export const CONSENT_OPEN_EVENT = "mg:consent-open";
/** Fired on window after a decision is saved (detail: the choice). */
export const CONSENT_CHANGE_EVENT = "mg:consent-change";

/** A GA4 measurement ID ("G-XXXXXXX"), or null when unset or malformed. */
export function measurementId(value: unknown): string | null {
  return typeof value === "string" && /^G-[A-Z0-9]{4,16}$/.test(value.trim()) ? value.trim() : null;
}

function rawCookie(): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === CONSENT_COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** The saved decision, or null when the visitor hasn't chosen (or chose under an older policy version). */
export function readConsent(): ConsentChoice | null {
  const [version, choice] = (rawCookie() ?? "").split(".");
  return version === VERSION && (choice === "analytics" || choice === "essential") ? choice : null;
}

export function writeConsent(choice: ConsentChoice) {
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${VERSION}.${choice}.${stamp}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_CHANGE_EVENT, { detail: choice }));
}

/** Reopen the consent banner (the footer's "Cookie settings"). */
export function openCookieSettings() {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

/* useSyncExternalStore plumbing — the cookie is the store. */
export function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
}
/** "unset" until the visitor decides; undefined on the server (nothing is known before hydration). */
export const consentSnapshot = (): ConsentChoice | "unset" => readConsent() ?? "unset";
export const consentServerSnapshot = (): undefined => undefined;
