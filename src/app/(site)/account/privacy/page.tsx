import type { Metadata } from "next";
import Link from "next/link";
import { Check, Download, FileJson, Link2Off } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getCatalogData } from "@/server/catalog";
import { getDataSummary } from "@/server/customer/account";
import { PortalHeader } from "@/components/portal/ui";
import { buttonClasses } from "@/components/ui/button";
import { DeleteAccount } from "@/components/customer/privacy/delete-account";

export const metadata: Metadata = { title: "Privacy & data" };

export default async function PrivacyPage() {
  const user = await requireUser("/account/privacy");
  const [counts, { content }] = await Promise.all([getDataSummary(user.id), getCatalogData()]);
  const contact = content.site.email;

  const included: [string, number | null][] = [
    ["Profile and preferences", null],
    ["Saved cars", counts.saved],
    ["Cars in your garage", counts.garage],
    ["Enquiries", counts.enquiries],
    ["Test drives", counts.testDrives],
    ["Insurance requests and quotes", counts.insurance],
    ["Owner reviews", counts.reviews],
    ["Notifications", counts.notifications],
  ];

  return (
    <>
      <PortalHeader title="Privacy & data" description="See what your account holds, take a copy of it, or close your account." />

      <div className="space-y-6">
        <section aria-labelledby="export-title" className="grid grid-cols-1 border border-line bg-white lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-5 md:p-7">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-mist">
              <FileJson aria-hidden className="size-[18px] text-ink/70" />
            </span>
            <h2 id="export-title" className="mt-4 text-[17px] font-semibold tracking-[-0.01em]">
              Download your data
            </h2>
            <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted">
              A copy of everything in your account as a JSON file — readable in any text editor, and easy to import elsewhere. Internal notes made by MarchGear staff, dealerships and
              insurers aren&apos;t part of it.
            </p>
            <a href="/account/privacy/export" download className={buttonClasses({ variant: "dark", size: "sm", className: "mt-5" })}>
              <Download aria-hidden className="size-4" /> Download my data
            </a>
            <p className="mt-3 text-[12px] text-muted">Your compare list and chosen city are kept only in this browser, so they aren&apos;t in the file.</p>
          </div>
          <ul className="border-t border-line bg-mist/40 px-5 py-4 text-[13px] md:px-7 lg:border-l lg:border-t-0">
            {included.map(([label, n]) => (
              <li key={label} className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
                <span className="flex items-center gap-2">
                  <Check aria-hidden className="size-3.5 text-[#1e7a3c]" strokeWidth={2.5} />
                  {label}
                </span>
                {n !== null && <span className="font-medium text-muted num">{n}</span>}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="delete-title" className="border border-line bg-white">
          <div className="border-b border-line p-5 md:p-7">
            <h2 id="delete-title" className="text-[17px] font-semibold tracking-[-0.01em]">
              Delete your account
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
              Closing your account is permanent. Here&apos;s exactly what happens — you may want to download your data first.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-px bg-line md:grid-cols-2">
            <div className="bg-white p-5 md:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red">Deleted straight away</p>
              <ul className="mt-3 space-y-2 text-[13.5px]">
                {["Your profile: name, email, mobile and city", "Your preferences", "Saved cars", "Cars in your garage and their reminders", "Your notifications", "Every signed-in session, on all devices"].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span aria-hidden className="mt-[8px] size-1.5 shrink-0 rounded-full bg-red" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white p-5 md:p-7">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                <Link2Off aria-hidden className="size-3.5" /> Kept, but no longer linked to you
              </p>
              <ul className="mt-3 space-y-2 text-[13.5px]">
                {[
                  "Enquiries and test drives — the dealership keeps its record of what you asked for",
                  "Insurance requests and quotes — kept by the insurer that handled them",
                  "Owner reviews — published ones stay on the site under the name you gave",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span aria-hidden className="mt-[8px] size-1.5 shrink-0 rounded-full bg-ink/30" />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12px] leading-relaxed text-muted">
                Those records still contain the contact details you typed into each request. To have them erased as well, write to{" "}
                <Link href={`mailto:${contact}?subject=Erase%20my%20enquiry%20records`} className="font-medium text-ink underline underline-offset-4 hover:text-red">
                  {contact}
                </Link>{" "}
                from your sign-in email before you delete your account.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-line p-5 sm:flex-row sm:items-center sm:justify-between md:px-7">
            <p className="text-[12.5px] text-muted">You&apos;ll be asked to type DELETE and your password.</p>
            <DeleteAccount email={user.email} />
          </div>
        </section>
      </div>
    </>
  );
}
