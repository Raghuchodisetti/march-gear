import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AlertTriangle, ArrowUpRight, Ban, Camera, Check, Mail, Phone, ShieldAlert, Siren, Users } from "lucide-react";
import { IMG } from "@/data/images";
import { cn } from "@/lib/utils";
import { getCatalog } from "@/server/catalog";
import { getClaimContacts, type ClaimContact } from "@/server/insurance/public-content";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ClaimCallbackForm } from "@/components/insurance/public/callback-forms";
import { ClaimChecklist } from "@/components/insurance/public/claim-checklist";
import { CategoryAd, LandingHero, RelatedGuides, Section, Steps, pickGuides } from "@/components/insurance/public/landing";
import { ProviderMark } from "@/components/insurance/public/provider-mark";
import { INSURANCE_OG_IMAGE, pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Car Insurance Claims: Cashless or Reimbursement",
  description: "What to do after an accident, how cashless and reimbursement car insurance claims work, and the documents you need. Your insurer settles the claim.",
  path: "/insurance/claims",
  images: [INSURANCE_OG_IMAGE],
});

const AT_SPOT_DO = [
  { Icon: Siren, text: "Check everyone is safe. If anyone is hurt, call 112 first." },
  { Icon: Camera, text: "Photograph the scene, every vehicle's damage and number plate — before cars are moved, if it's safe." },
  { Icon: Users, text: "Note the other driver's name, phone, vehicle number and insurer, and any witnesses' numbers." },
  { Icon: Phone, text: "Call your insurer's claims number from your policy and write down the claim number." },
];
const AT_SPOT_DONT = ["Sign anything or agree to pay compensation on the spot", "Leave the scene if anyone is injured", "Start repairs before the insurer's surveyor has seen the car", "Restart a car that has stalled in water"];

const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;
const CONTACTS_SHOWN = 6;

export default async function ClaimsPage() {
  await connection();
  const [{ content }, contacts] = await Promise.all([getCatalog(), getClaimContacts()]);
  const page = content.insurancePage.pages.claims;
  const guides = pickGuides(content.insuranceGuides.guides, ["how-to-make-a-car-insurance-claim", "zero-depreciation-explained", "what-is-idv"]);

  return (
    <>
      <LandingHero hero={page} image={IMG.darkGarage} imageFocus="50% 50%" crumb="Claims">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button href="#at-the-spot" size="lg" arrow>
            What to do now
          </Button>
          <Button href="#callback" size="lg" variant="outline-light">
            Request a callback
          </Button>
        </div>
      </LandingHero>

      {/* The honest line */}
      <div className="border-b border-line bg-red-50">
        <div className="container-x flex flex-col gap-3 py-5 text-[14px] leading-relaxed sm:flex-row sm:items-center sm:gap-5">
          <ShieldAlert aria-hidden className="size-6 shrink-0 text-red" />
          <p className="text-ink">
            <strong className="font-semibold">MarchGear doesn&apos;t process, approve or settle claims.</strong> Report every claim directly to your insurer — the claims number is on your policy. We can explain the process and talk you through it.
          </p>
        </div>
      </div>
      <CategoryAd />

      {/* At the spot */}
      <Section id="at-the-spot" eyebrow="At the accident spot" title="The first fifteen minutes." layout="aside" intro={<p>What you do at the scene decides how smoothly the claim goes later. Safety first, evidence second, paperwork third.</p>}>
        <div className="grid grid-cols-1 gap-px border border-line bg-line md:grid-cols-5">
          <div className="bg-white p-6 md:col-span-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Do</p>
            <ul className="mt-5 space-y-5">
              {AT_SPOT_DO.map(({ Icon, text }) => (
                <li key={text} className="flex gap-4 text-[14.5px] leading-relaxed">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-mist">
                    <Icon aria-hidden className="size-4 text-ink" />
                  </span>
                  <span className="pt-1.5">{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white p-6 md:col-span-2">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-red">Don&apos;t</p>
            <ul className="mt-5 space-y-4">
              {AT_SPOT_DONT.map((t) => (
                <li key={t} className="flex gap-3 text-[14.5px] leading-relaxed">
                  <Ban aria-hidden className="mt-1 size-4 shrink-0 text-red" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-5 text-[13px] leading-relaxed text-muted">
          Report to the police and get an FIR or report number if anyone is injured, if there&apos;s a dispute, if someone else&apos;s property is damaged, or if the car is stolen.
        </p>
      </Section>

      {/* Cashless vs reimbursement */}
      <Section
        id="cashless"
        tone="mist"
        eyebrow="Two ways to claim"
        title="Cashless or reimbursement."
        intro={<p>Both start the same way: inform the insurer, then let its surveyor assess the damage before repairs begin. The difference is who pays the garage.</p>}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[
            {
              name: "Cashless",
              tag: "Simpler",
              steps: [
                { title: "Inform your insurer", text: "Get a claim number and ask for the nearest network garages." },
                { title: "Take the car to a network garage", text: "The garage sends its estimate to the insurer." },
                { title: "Survey and approval", text: "The surveyor inspects the car and approves the repair." },
                { title: "Repair and settle", text: "The insurer pays the garage. You pay the deductible and anything not covered." },
              ],
            },
            {
              name: "Reimbursement",
              tag: "Any garage",
              steps: [
                { title: "Inform your insurer", text: "Get a claim number before anything else." },
                { title: "Survey before repairs", text: "The surveyor inspects the car at your chosen garage and agrees the estimate." },
                { title: "Pay the garage", text: "You pay the bill and keep the original invoice and receipt." },
                { title: "Claim it back", text: "Send the documents; the insurer pays you the amount it assessed." },
              ],
            },
          ].map((m, i) => (
            <div key={m.name} className={cn("border p-6 sm:p-8", i === 0 ? "border-ink bg-white" : "border-line bg-white")}>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="type-h3">{m.name}</h3>
                <span className={cn("rounded-[2px] px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]", i === 0 ? "bg-ink text-white" : "bg-mist text-ink")}>{m.tag}</span>
              </div>
              <div className="mt-6">
                <Steps steps={m.steps} />
              </div>
            </div>
          ))}
        </div>
        <div className="relative mt-6 overflow-x-auto border border-line bg-white">
          <table className="w-full min-w-[620px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-ink text-[12px] text-muted">
                <th scope="col" className="px-5 py-3.5 font-medium">
                  &nbsp;
                </th>
                <th scope="col" className="px-5 py-3.5 font-semibold text-ink">
                  Cashless
                </th>
                <th scope="col" className="px-5 py-3.5 font-semibold text-ink">
                  Reimbursement
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Where you repair", "The insurer's network garages", "Any garage you choose"],
                ["Who pays the garage", "The insurer, directly", "You — then the insurer repays you"],
                ["What you pay", "Deductibles, depreciation (without zero dep), uncovered items", "The full bill up front; the same items aren't repaid"],
                ["Speed", "Usually quicker", "Usually slower — documents first, then payment"],
              ].map(([k, a, b]) => (
                <tr key={k} className="border-b border-line last:border-b-0">
                  <th scope="row" className="px-5 py-3.5 font-medium">
                    {k}
                  </th>
                  <td className="px-5 py-3.5 text-muted">{a}</td>
                  <td className="px-5 py-3.5 text-muted">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Documents */}
      <Section
        id="documents"
        eyebrow="Documents checklist"
        title="Tick off what you've got."
        layout="aside"
        intro={
          <>
            <p>Insurers ask for slightly different papers, but these cover almost every claim. Ticks stay on this screen only.</p>
            <p className="flex gap-2 text-[13px]">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
              Someone else claiming against you? Don&apos;t settle privately — pass any notice to your insurer. Injury claims are decided by the Motor Accident Claims Tribunal.
            </p>
          </>
        }
      >
        <ClaimChecklist />
      </Section>

      {/* Insurer contacts */}
      <Section
        id="contacts"
        tone="mist"
        eyebrow="Insurer claim contacts"
        title="Claims lines of listed insurers."
        intro={<p>Contacts as provided by each insurer on MarchGear. Your policy document is always the authoritative source — use the number printed on it.</p>}
      >
        {contacts.length ? (
          <>
            <ContactGrid contacts={contacts.slice(0, CONTACTS_SHOWN)} />
            {contacts.length > CONTACTS_SHOWN && (
              <details className="group mt-4">
                <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-[3px] border border-line bg-white px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:border-ink [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show {contacts.length - CONTACTS_SHOWN} more insurers</span>
                  <span className="hidden group-open:inline">Show fewer</span>
                </summary>
                <ContactGrid contacts={contacts.slice(CONTACTS_SHOWN)} className="mt-4" />
              </details>
            )}
          </>
        ) : (
          <div className="border border-dashed border-line bg-white p-8 text-center">
            <p className="type-h4">No insurers are listed yet</p>
            <p className="mx-auto mt-2 max-w-md text-[14.5px] text-muted">Use the claims number printed on your policy document. Listed insurers&apos; claim contacts will appear here once they&apos;re approved.</p>
          </div>
        )}
      </Section>

      {/* Callback */}
      <section id="callback" aria-labelledby="callback-title" className="scroll-mt-32 py-14 md:py-20">
        <div className="container-x grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <p className="type-eyebrow flex items-center gap-3">
              <span aria-hidden className="h-px w-6 bg-red" />
              Claim assistance
            </p>
            <h2 id="callback-title" className="type-h2 mt-5 text-balance">
              Talk it through with us.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">Confused by the surveyor&apos;s assessment, the deductions or the documents? Ask for a free callback and we&apos;ll explain what&apos;s happening and what to ask your insurer.</p>
            <ul className="mt-8 space-y-3 text-[14px]">
              {["Explaining the steps and timelines", "Understanding deductions and depreciation", "What to ask your insurer or garage"].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-red" /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-8 border-t border-line pt-5 text-[13px] leading-relaxed text-muted">We can&apos;t file, approve or speed up a claim, or speak to the insurer on your behalf.</p>
          </div>
          <div className="lg:col-span-8">
            <ClaimCallbackForm />
          </div>
        </div>
      </section>

      <RelatedGuides guides={guides} />
      <section className="bg-ink py-12 text-white">
        <div className="container-x flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="flex items-start gap-3 text-[15px]">
            <Siren aria-hidden className="mt-0.5 size-5 shrink-0 text-red" />
            <span>
              Emergency or injuries? Call{" "}
              <a href="tel:112" className="font-semibold underline underline-offset-4 num">
                112
              </a>{" "}
              before anything else.
            </span>
          </p>
          <Link href="/insurance/guides/how-to-make-a-car-insurance-claim" className="group inline-flex items-center gap-1.5 text-[14px] font-medium">
            Read the full claims guide
            <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </>
  );
}

/** Insurer claim contacts as a two-column grid of cards. */
function ContactGrid({ contacts, className }: { contacts: ClaimContact[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-px border border-line bg-line md:grid-cols-2", className)}>
      {contacts.map((c) => {
        const phone = c.claimsPhone || c.supportPhone;
        return (
          <div key={c.id} className="bg-white p-6">
            <div className="flex items-center gap-4">
              <ProviderMark name={c.name} logo={c.logo} className="size-12" />
              <div className="min-w-0">
                <h3 className="truncate text-[16px] font-semibold">{c.name}</h3>
                <Link href={`/insurance/providers/${c.slug}`} className="text-[12.5px] text-muted underline-offset-4 hover:text-ink hover:underline">
                  Provider profile
                </Link>
              </div>
            </div>
            {phone || c.claimsEmail ? (
              <dl className="mt-5 grid grid-cols-1 gap-3 text-[14px] sm:grid-cols-2">
                {phone && (
                  <div>
                    <dt className="text-[12px] text-muted">{c.claimsPhone ? "Claims phone" : "Support phone"}</dt>
                    <dd className="mt-0.5">
                      <a href={telHref(phone)} className="inline-flex items-center gap-1.5 font-medium hover:text-red num">
                        <Phone aria-hidden className="size-3.5 text-red" />
                        {phone}
                      </a>
                    </dd>
                  </div>
                )}
                {c.claimsEmail && (
                  <div className="min-w-0">
                    <dt className="text-[12px] text-muted">Claims email</dt>
                    <dd className="mt-0.5 truncate">
                      <a href={`mailto:${c.claimsEmail}`} className="inline-flex max-w-full items-center gap-1.5 font-medium hover:text-red">
                        <Mail aria-hidden className="size-3.5 shrink-0 text-red" />
                        <span className="truncate">{c.claimsEmail}</span>
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="mt-5 text-[13.5px] text-muted">No claims contact published yet — use the number on your policy document.</p>
            )}
            {c.process.length > 0 && (
              <Accordion
                className="mt-5"
                items={[
                  {
                    id: `proc-${c.id}`,
                    title: <span className="text-[14px]">How {c.name} handles claims</span>,
                    content: (
                      <ol className="space-y-2 text-[14px]">
                        {c.process.map((step, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="text-[12px] font-semibold text-red num">{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    ),
                  },
                ]}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
