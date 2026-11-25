"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { GA_COOKIE_MAX_AGE } from "./consent";

type Gtag = (...args: unknown[]) => void;
type GaWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag; __mgGaReady?: string } & Record<`ga-disable-${string}`, boolean | undefined>;

const w = () => window as unknown as GaWindow;

/** Queue-backed gtag(): commands wait in dataLayer until gtag.js arrives, so order is preserved. */
function gtag(...args: unknown[]) {
  const win = w();
  win.dataLayer = win.dataLayer || [];
  if (!win.gtag) {
    win.gtag = function () {
      // gtag.js reads the Arguments object itself, not an array copy.
      // eslint-disable-next-line prefer-rest-params
      win.dataLayer!.push(arguments);
    };
  }
  win.gtag(...args);
}

/**
 * Consent Mode defaults (everything denied), then analytics granted — this only ever runs after the visitor
 * accepted analytics. Advertising storage and signals stay denied. Idempotent per measurement ID.
 */
function initAnalytics(id: string) {
  const win = w();
  win[`ga-disable-${id}`] = false;
  if (win.__mgGaReady === id) {
    gtag("consent", "update", { analytics_storage: "granted" });
    return;
  }
  win.__mgGaReady = id;
  gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
  gtag("consent", "update", { analytics_storage: "granted" });
  gtag("js", new Date());
  gtag("config", id, {
    // GA4 never stores full IPs; the flag is kept for clarity and older tooling.
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    // _ga cookies last ~13 months instead of GA's default 2 years (stated on /cookies).
    cookie_expires: GA_COOKIE_MAX_AGE,
    // Page views are sent below, on first load and on every client-side navigation.
    send_page_view: false,
  });
}

/** Withdraw consent: stop GA sending anything this session and remove its cookies. */
export function disableAnalytics(id: string) {
  const win = w();
  win[`ga-disable-${id}`] = true;
  if (win.gtag) win.gtag("consent", "update", { analytics_storage: "denied" });
  const host = location.hostname;
  const domains = ["", host, ...host.split(".").map((_, i, parts) => parts.slice(i).join(".")).filter((d) => d.includes("."))];
  for (const name of document.cookie.split(";").map((c) => c.trim().split("=")[0])) {
    if (name !== "_ga" && !name.startsWith("_ga_") && name !== "_gid") continue;
    for (const d of new Set(domains)) document.cookie = `${name}=; Max-Age=0; Path=/${d ? `; Domain=.${d.replace(/^\./, "")}` : ""}`;
  }
}

/** GA4 via gtag.js. Rendered only once the visitor has accepted analytics and a measurement ID is set. */
export function GoogleAnalytics({ id }: { id: string }) {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics(id);
  }, [id]);

  // A page view per route — the first load included. Deferred a tick so document.title is the new page's.
  useEffect(() => {
    const t = window.setTimeout(() => {
      gtag("event", "page_view", { send_to: id, page_location: location.href, page_path: location.pathname + location.search, page_title: document.title });
    }, 50);
    return () => window.clearTimeout(t);
  }, [id, pathname]);

  return <Script id="mg-gtag" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`} strategy="afterInteractive" />;
}
