import type { Metadata } from "next";
import Link from "next/link";
import { Headphones, Mail, Newspaper } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { PageHeader } from "@/components/ui/page-header";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion } from "@/components/ui/accordion";
import { ContactForm } from "@/components/editorial/contact-form";
import { CopyButton } from "@/components/editorial/copy-button";
import { businessFacts, grievanceContact } from "@/components/editorial/legal-text";
import { pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Contact MarchGear — Support, Partners & Press",
  description: "Get in touch with MarchGear: reader support, dealer and insurer partnerships, press enquiries and editorial corrections. Phone, email and office details.",
  path: "/contact",
  absoluteTitle: true,
});

export default async function ContactPage() {
  const { site } = (await getCatalog()).content;
  const { offices, contactFaqs } = site;
  const supportHours = [{ day: "Phone & email", hours: site.hours }];
  const channels = [
    { icon: Mail, label: "Reader support", value: site.supportEmail, copy: "Copy support email" },
    { icon: Headphones, label: "Helpline", value: site.phone, copy: "Copy helpline number" },
    { icon: Newspaper, label: "Press & media", value: site.pressEmail, copy: "Copy press email" },
  ];
  const homeCity = (offices.find((o) => o.hq) ?? offices[0]).city;
  const facts = businessFacts(site);
  const grievance = grievanceContact(site);
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title={
          <>
            We&apos;d love to <span className="type-editorial">hear from you.</span>
          </>
        }
        description="Questions about a car, a listing or something we published? Our team replies to every message within one working day."
        crumbs={[{ label: "Contact" }]}
      />

      <section aria-label="Contact form and support" className="container-x py-14 md:py-20">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-10">
          <div className="min-w-0 lg:col-span-7">
            <ContactForm />
          </div>

          <aside className="space-y-12 lg:col-span-4 lg:col-start-9" aria-label="Support details">
            <div>
              <p className="type-eyebrow text-muted">Support hours</p>
              <dl className="mt-5 border-t border-line">
                {supportHours.map((h) => (
                  <div key={h.day} className="flex items-baseline justify-between gap-4 border-b border-line py-3.5 text-[14px]">
                    <dt className="text-ink/80">{h.day}</dt>
                    <dd className={h.hours === "Closed" ? "text-muted" : "font-medium num"}>{h.hours}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[12px] text-muted">All times are IST.</p>
            </div>

            <div>
              <p className="type-eyebrow text-muted">Direct lines</p>
              <ul className="mt-5 space-y-6">
                {channels.map(({ icon: Icon, label, value, copy }) => (
                  <li key={label} className="flex items-start gap-4">
                    <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] text-muted">{label}</p>
                      <p className="mt-0.5 break-words text-[15px] font-medium num">{value}</p>
                    </div>
                    <CopyButton value={value} label={copy} message={`${label}: copied ${value}`} className="mt-3 shrink-0" />
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="type-eyebrow text-muted">Company &amp; grievances</p>
              <dl className="mt-5 border-t border-line text-[14px]">
                {facts.map((f) => (
                  <div key={f.label} className="border-b border-line py-3.5">
                    <dt className="text-[12.5px] text-muted">{f.label}</dt>
                    <dd className="mt-0.5 break-words font-medium num">{f.value}</dd>
                  </div>
                ))}
                <div className="border-b border-line py-3.5">
                  <dt className="text-[12.5px] text-muted">{grievance.named ? "Grievance Officer" : "Privacy & grievances"}</dt>
                  <dd className="mt-0.5 min-w-0">
                    {grievance.named && <span className="block font-medium">{site.grievanceOfficer.name}</span>}
                    <a href={`mailto:${grievance.email}`} className="break-words font-medium underline decoration-ink/30 underline-offset-4 hover:text-red">
                      {grievance.email}
                    </a>
                    {site.grievanceOfficer.email && site.grievanceOfficer.phone && <span className="block num">{site.grievanceOfficer.phone}</span>}
                    {!grievance.named && <span className="mt-1 block text-[12.5px] text-muted">A Grievance Officer will be named here shortly.</span>}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                Complaints about your personal data or content on the site are acknowledged within 24 hours. See our{" "}
                <Link href="/privacy#grievance" className="text-ink underline underline-offset-4 hover:text-red">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            <div className="bg-ink p-7 text-white md:p-8">
              <p className="type-eyebrow text-white/50">Buying or selling?</p>
              <p className="type-h3 mt-4 text-balance">Talk to a verified dealer near you.</p>
              <p className="mt-3 text-[14px] leading-relaxed text-white/60">For test drives, prices and offers, our partner dealers can help directly.</p>
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Button href="/dealers" variant="light" arrow>
                  Find a dealer
                </Button>
                <TextLink href="/sell-car" tone="light">
                  Sell your car
                </TextLink>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section aria-labelledby="offices-heading" className="border-t border-line py-14 md:py-20">
        <div className="container-x">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Eyebrow>Offices</Eyebrow>
              <h2 id="offices-heading" className="type-h2 mt-5">
                Based in <span className="type-editorial">{homeCity}</span>
              </h2>
            </div>
            <p className="max-w-md text-[14.5px] leading-relaxed text-muted lg:text-right">Visits are by appointment — call or email ahead and we&apos;ll be glad to meet you.</p>
          </div>

          <ul className="mt-12 border-t border-line md:mt-16">
            {offices.map((o, i) => (
              <li key={i} className="grid grid-cols-1 gap-8 border-b border-line py-10 md:grid-cols-3 md:gap-10 md:py-12">
                <div>
                <div className="flex min-h-6 items-center gap-3">
                  <p className="type-eyebrow text-muted">{o.label}</p>
                  {o.hq && <Badge tone="ink">HQ</Badge>}
                </div>
                <h3 className="type-h2 mt-5">{o.city}</h3>
                </div>
                <div>
                <address className="text-[15px] not-italic leading-relaxed text-ink/80">
                  {o.address.map((line, j) => (
                    <span key={j} className="block">
                      {line}
                    </span>
                  ))}
                </address>
                <CopyButton
                  value={[`March Gear — ${o.label}`, ...o.address].join(", ")}
                  label={`Copy ${o.city} address`}
                  message={`${o.city} address copied`}
                  className="mt-6"
                >
                  Copy address
                </CopyButton>
                </div>
                <dl className="space-y-2 text-[14px]">
                  <div className="flex gap-3">
                    <dt className="w-14 shrink-0 text-muted">Phone</dt>
                    <dd className="num">{o.phone}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-14 shrink-0 text-muted">Email</dt>
                    <dd className="min-w-0 break-words">{o.email}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-14 shrink-0 text-muted">Hours</dt>
                    <dd className="num">{o.hours}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {contactFaqs.length > 0 && (
        <section aria-labelledby="faq-heading" className="bg-mist py-14 md:py-20">
          <div className="container-x grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-4">
              <Eyebrow>FAQ</Eyebrow>
              <h2 id="faq-heading" className="type-h2 mt-5">
                Quick answers
              </h2>
              <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted">The questions our support team hears most often.</p>
              <TextLink href="/terms" className="mt-6">
                Terms of use
              </TextLink>
            </div>
            <div className="lg:col-span-7 lg:col-start-6">
              <Accordion items={contactFaqs.map((f, i) => ({ id: `faq-${i}`, title: f.q, content: f.a }))} defaultOpen={["faq-0"]} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
