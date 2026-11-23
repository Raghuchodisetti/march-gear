import "server-only";
import type { SessionUser } from "@/lib/action-result";
import { countGarage, getGarageReminders, notifyGarageReminders } from "@/server/customer/garage";
import { getCustomerInsuranceSummary } from "@/server/customer/insurance";
import { countUnreadCustomerNotifications, getCustomerNotifications } from "@/server/customer/notifications";
import { getCustomerEnquiries, getCustomerTestDrives } from "@/server/customer/requests";
import { getPreferences } from "./account";
import { getSavedCars, offersOnSaved } from "./saved";

/* ──────────────────────────────────────────────────────────────
   The account overview (/account): one call that gathers the
   customer's figures and latest activity from every section.
   Built on the section helpers (garage, requests, insurance,
   notifications), so the overview always agrees with them.
   ────────────────────────────────────────────────────────────── */

export interface NextStep {
  key: string;
  label: string;
  note: string;
  done: boolean;
  href: string;
}

export async function getOverview(user: SessionUser) {
  // Garage reminders become notifications when the customer visits (idempotent), so do that before reading them.
  const reminders = await getGarageReminders(user.id);
  await notifyGarageReminders(user.id, reminders);

  const [saved, garage, enquiries, drives, updates, unread, insurance, prefs] = await Promise.all([
    getSavedCars(user.id),
    countGarage(user.id),
    getCustomerEnquiries(user.id),
    getCustomerTestDrives(user.id),
    getCustomerNotifications(user.id, { limit: 5 }),
    countUnreadCustomerNotifications(user.id),
    getCustomerInsuranceSummary(user.id),
    getPreferences(user.id),
  ]);

  const upcoming = drives.filter((d) => d.upcoming);
  const steps: NextStep[] = [
    { key: "mobile", label: "Add your mobile number", note: "So dealers can call you back", done: Boolean(user.phone), href: "/account/profile" },
    { key: "garage", label: "Add the car you own", note: "Insurance, PUC and service reminders", done: garage > 0, href: "/account/garage/new" },
    { key: "saved", label: "Save a car you like", note: "Prices and offers in one place", done: saved.length > 0, href: "/new-cars" },
    { key: "prefs", label: "Set your preferences", note: "Alerts and how to reach you", done: prefs.chosen, href: "/account/preferences" },
  ];

  return {
    kpi: {
      saved: saved.length,
      garage,
      openEnquiries: enquiries.filter((e) => e.open).length,
      upcomingDrives: upcoming.length,
      quotesReady: insurance.quotesReady,
      unread,
    },
    steps,
    reminders: reminders.slice(0, 4),
    remindersTotal: reminders.length,
    nextDrive: upcoming[0] ?? null,
    updates,
    enquiries: enquiries.slice(0, 4),
    enquiriesTotal: enquiries.length,
    insurance,
    offers: offersOnSaved(saved).slice(0, 3),
    savedPreview: saved.filter((s) => s.state === "live").slice(0, 4),
  };
}

export type Overview = Awaited<ReturnType<typeof getOverview>>;
