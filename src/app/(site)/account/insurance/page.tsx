import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CarFront, Search } from "lucide-react";
import { INDICATIVE_NOTE, NOT_AN_INSURER_NOTE } from "@/insurance/labels";
import { normaliseReg } from "@/insurance/search";
import { requireUser } from "@/server/auth";
import { todayISO } from "@/server/validation";
import { getCustomerInsurance } from "@/server/customer/insurance";
import { getGarage, insuranceReminderWindow, notifyGarageReminders } from "@/server/customer/garage";
import { Panel, PortalHeader, StatCard } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { GARAGE_LIMIT, carName, editHref, garageHref, remindersFor, sortReminders } from "@/components/customer/garage/shared";
import { ReminderList } from "@/components/customer/garage/ui";
import { PoliciesList, QuotesList, RequestsList, SectionTitle, type PolicyGarageState } from "@/components/customer/insurance/sections";

export const metadata: Metadata = { title: "Insurance" };

export default async function AccountInsurancePage() {
  const user = await requireUser("/account/insurance");
  const today = todayISO();
  const [ins, cars, window] = await Promise.all([getCustomerInsurance(user.id, today), getGarage(user.id), insuranceReminderWindow()]);

  const allReminders = sortReminders(cars.flatMap((c) => remindersFor(c, today, window)));
  await notifyGarageReminders(user.id, allReminders);
  const renewals = allReminders.filter((r) => r.kind === "insurance");
  const carsWithoutExpiry = cars.filter((c) => !c.insuranceExpiry);

  const quotesReady = ins.quotes.filter((q) => q.status === "submitted" || q.status === "viewed").length;

  // "Add to my garage" for each policy — or where it already is.
  const garage: Record<string, PolicyGarageState> = {};
  for (const p of ins.policies) {
    const reg = p.regNumber ? normaliseReg(p.regNumber) : "";
    const saved = cars.find((c) => p.policyNumber && c.policyNumber === p.policyNumber && (!reg || c.regNumber === reg));
    const sameCar = reg ? cars.find((c) => c.regNumber === reg) : undefined;
    if (saved) garage[p.enquiryReference] = { kind: "saved", href: garageHref(saved.id), car: carName(saved) };
    else if (sameCar) garage[p.enquiryReference] = { kind: "update", href: `${editHref(sameCar.id)}&from=${encodeURIComponent(p.enquiryReference)}`, car: carName(sameCar) };
    else if (cars.length >= GARAGE_LIMIT) garage[p.enquiryReference] = { kind: "full" };
    else garage[p.enquiryReference] = { kind: "add", href: `/account/garage/new?from=${encodeURIComponent(p.enquiryReference)}` };
  }

  const showIndicative = ins.requests.some((r) => r.indicativePremium) || ins.quotes.some((q) => q.authorization === "indicative");

  return (
    <>
      <PortalHeader
        title="Insurance"
        description="Your quote requests, the quotes insurers and intermediaries sent you, and the policies they've reported."
        actions={
          <Button href="/insurance/quotes" variant="dark" icon={<Search aria-hidden className="size-4" />}>
            Get new quotes
          </Button>
        }
      />

      <div className="space-y-8">
        <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Quote requests" value={ins.requests.length + (ins.truncated ? "+" : "")} note="sent while signed in" href="#requests" />
          <StatCard label="Quotes to review" value={quotesReady} note={quotesReady ? "still valid" : "none waiting"} href="#quotes" tone={quotesReady ? "red" : undefined} />
          <StatCard label="Policies" value={ins.policies.length} note="reported or confirmed" href="#policies" />
          <StatCard label="Renewals due" value={renewals.length} note={`within ${window} days or expired`} href="#renewals" tone={renewals.some((r) => r.daysLeft < 0) ? "red" : undefined} />
        </section>

        <section aria-labelledby="renewals" className="scroll-mt-28">
          <SectionTitle id="renewals" title="Renewal reminders" count={renewals.length || undefined} action={<Link href="/account/garage" className="text-[12.5px] font-medium text-ink/75 underline-offset-4 hover:text-ink hover:underline">My garage</Link>} />
          {renewals.length > 0 ? (
            <Panel padded={false}>
              <ReminderList reminders={renewals} />
            </Panel>
          ) : (
            <div className="flex flex-col gap-3 border border-line bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-3 text-[13.5px] text-muted">
                <BellRing aria-hidden className="mt-0.5 size-4 shrink-0 text-ink/40" />
                {cars.length === 0
                  ? "Add your car and its policy expiry to My garage — we'll remind you here before it's due and prefill renewal quotes."
                  : carsWithoutExpiry.length
                    ? `No renewals due in the next ${window} days. ${carsWithoutExpiry.length === 1 ? `${carName(carsWithoutExpiry[0])} has` : `${carsWithoutExpiry.length} of your cars have`} no policy expiry yet — add it to get reminders.`
                    : `No renewals due in the next ${window} days.`}
              </p>
              {(cars.length === 0 || carsWithoutExpiry.length > 0) && (
                <Button href={cars.length === 0 ? "/account/garage/new" : carsWithoutExpiry.length === 1 ? editHref(carsWithoutExpiry[0].id) : "/account/garage"} variant="outline" size="sm" icon={<CarFront aria-hidden className="size-4" />} className="shrink-0">
                  {cars.length === 0 ? "Add a car" : "Add policy expiry"}
                </Button>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="quotes" className="scroll-mt-28">
          <SectionTitle id="quotes" title="Quotes received" count={ins.quotes.length || undefined} />
          <QuotesList quotes={ins.quotes} today={today} />
        </section>

        <section aria-labelledby="policies" className="scroll-mt-28">
          <SectionTitle id="policies" title="Policies" count={ins.policies.length || undefined} />
          <PoliciesList policies={ins.policies} garage={garage} />
          {ins.policies.length > 0 && (
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Policies are reported by the insurer or intermediary that sold them; &ldquo;Policy confirmed&rdquo; means MarchGear has checked their evidence. Your policy document is the record — renewal dates here are
              estimated as one year from issue.
            </p>
          )}
        </section>

        <section aria-labelledby="requests" className="scroll-mt-28">
          <SectionTitle id="requests" title="Quote requests" count={ins.requests.length || undefined} action={ins.truncated ? <span className="text-[12.5px] text-muted">Latest 50</span> : undefined} />
          <RequestsList requests={ins.requests} />
          {ins.requests.length === 0 && (
            <div className="mt-3">
              <Button href="/insurance/quotes" variant="outline" size="sm" arrow>
                Compare car insurance
              </Button>
            </div>
          )}
        </section>

        <footer className="space-y-2 border-t border-line pt-5 text-[12px] leading-relaxed text-muted">
          {showIndicative && (
            <p>
              <sup>*</sup> {INDICATIVE_NOTE} Quotes marked &ldquo;Indicative&rdquo; are estimates from the insurer or intermediary, not insurer quotations; &ldquo;Insurer-authorised&rdquo; quotes carry the insurer&apos;s own
              quotation reference.
            </p>
          )}
          <p>{NOT_AN_INSURER_NOTE}</p>
        </footer>
      </div>
    </>
  );
}
