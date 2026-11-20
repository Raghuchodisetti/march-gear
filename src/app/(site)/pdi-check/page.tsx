import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { IMG } from "@/data/images";
import { formatINR } from "@/lib/format";
import { checklistCount, startingPrice } from "@/lib/pdi";
import { getCatalog } from "@/server/catalog";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { ScoreBar } from "@/components/ui/rating";
import { Eyebrow, SectionHeading } from "@/components/ui/section-heading";
import { PdiBooking } from "@/components/pdi/pdi-booking";
import { PdiChecklist } from "@/components/pdi/pdi-checklist";
import { PdiPlans } from "@/components/pdi/pdi-plans";
import { ChecklistCtaButton, ChecklistGateModal } from "@/components/pdi/checklist-gate";
import { PDI_ICON } from "@/components/pdi/icons";

export const metadata: Metadata = {
  title: "PDI Check — new car pre-delivery inspection",
  description:
    "Get your new car inspected before you take delivery. A March Gear expert checks 200+ points at the dealership, or use our free PDI checklist.",
};

export default async function PdiCheckPage() {
  const { content } = await getCatalog();
  const page = content.pdiPage;
  const report = page.report;
  // The last stat is always the cheapest plan's price.
  const stats = [...page.heroStats, { value: formatINR(startingPrice(content.pdiPlans.plans)), label: page.startingPriceLabel }];
  const problems = page.problems.map((p) => ({ ...p, Icon: PDI_ICON[p.icon] }));
  return (
    <>
      <PageHeader
        image={IMG.showroomDoors}
        eyebrow="PDI Check · Pre-delivery inspection"
        title="Check your new car before you take delivery."
        description="A PDI is a final inspection of your new car at the dealership — before you sign and pay. Our expert checks 200+ points so you don't drive home with dents, old stock or missing items."
        crumbs={[{ label: "PDI Check" }]}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button href="#book" size="lg" arrow>
            Book a PDI expert
          </Button>
          <ChecklistCtaButton />
        </div>
        <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
          {stats.map(({ value, label }, i) => (
            <div key={i} className="bg-ink/60 px-4 py-4 backdrop-blur-sm">
              <dt className="sr-only">{label}</dt>
              <dd className="font-display text-xl font-semibold tracking-[-0.02em] num md:text-2xl">{value}</dd>
              <dd className="mt-0.5 text-[12.5px] text-white/60">{label}</dd>
            </div>
          ))}
        </dl>
      </PageHeader>

      {/* Why */}
      {problems.length > 0 && (
        <section aria-labelledby="why-title" className="py-14 md:py-20">
          <div className="container-x">
            <SectionHeading
              eyebrow="Why a PDI matters"
              title={<span id="why-title">Once you sign, it&apos;s your problem.</span>}
              description="New cars travel hundreds of kilometres and sit in stockyards before they reach you. These are the issues we find most often."
            />
            <RevealGroup className="mt-12 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4" gap={0.08}>
              {problems.map(({ Icon, title, text }, i) => (
                <RevealItem key={i} className="bg-white p-7 md:p-8">
                  <span className="inline-flex size-12 items-center justify-center rounded-full bg-red-50 text-red">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="type-h4 mt-6 text-lg">{title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{text}</p>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>
      )}

      {/* How */}
      <section aria-labelledby="how-title" className="bg-mist py-14 md:py-20">
        <div className="container-x">
          <Eyebrow>How it works</Eyebrow>
          <h2 id="how-title" className="type-h2 mt-5 max-w-2xl text-balance">
            {page.stepsTitle}
          </h2>
          <ol className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-6">
            {page.steps.map((s, i) => (
              <li key={i} className="relative border-t-2 border-ink pt-6">
                <span className="font-display text-5xl font-semibold leading-none tracking-[-0.04em] text-red num">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="type-h4 mt-5 text-lg">{s.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Plans */}
      <section aria-labelledby="plans-title" className="py-14 md:py-20">
        <div className="container-x">
          <SectionHeading
            eyebrow="Plans"
            title={<span id="plans-title">Choose your inspection.</span>}
            description="Pay after the inspection is done. Prices are indicative demo figures and include GST."
          />
          <div className="mt-12">
            <PdiPlans />
          </div>
        </div>
      </section>

      {/* Book + sample report */}
      <section id="book" aria-labelledby="book-title" className="scroll-mt-24 border-t border-line bg-mist py-14 md:py-20">
        <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <Eyebrow>Book a PDI</Eyebrow>
            <h2 id="book-title" className="type-h2 mt-5 text-balance">
              Book an expert for your delivery.
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">Book at least one day before delivery. We&apos;ll confirm the time with you and the dealership.</p>
            <div className="mt-10">
              <PdiBooking />
            </div>
          </div>

          <Reveal className="lg:col-span-5">
            <p className="type-eyebrow text-muted">What you get · sample report</p>
            <div className="mt-5 border border-line bg-white">
              <div className="flex items-start justify-between gap-4 border-b border-line p-6">
                <div>
                  <p className="text-[12px] text-muted">{report.date} · {report.dealer}</p>
                  <p className="mt-1 text-[16px] font-semibold">{report.car}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-4xl font-semibold leading-none tracking-[-0.03em] num">{report.score}</p>
                  <p className="mt-1 text-[11.5px] text-muted">out of 100</p>
                </div>
              </div>
              <div className="space-y-4 border-b border-line p-6">
                {report.categories.map((c, i) => (
                  <ScoreBar key={i} label={c.label} value={c.value} max={100} />
                ))}
              </div>
              <div className="p-6">
                <p className="text-[13px] font-semibold">{report.findings.length} issues found — all fixed before delivery</p>
                <ul className="mt-4 space-y-4">
                  {report.findings.map((f, i) => (
                    <li key={i} className="flex gap-3">
                      {f.level === "attention" ? (
                        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
                      ) : (
                        <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                      )}
                      <span>
                        <span className="block text-[14px] font-medium">{f.text}</span>
                        <span className="block text-[13px] text-muted">{f.action}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-muted">Sample report for illustration. Real reports include photos of every finding.</p>
          </Reveal>
        </div>
      </section>

      {/* DIY checklist */}
      <section id="checklist" aria-labelledby="checklist-title" className="scroll-mt-24 py-14 md:py-20">
        <div className="container-x">
          <SectionHeading
            eyebrow="Free DIY checklist"
            title={<span id="checklist-title">Doing it yourself? Tick these off.</span>}
            description={`${checklistCount(content.pdiChecklist.groups)} simple checks in the order you'd do them at the dealership. Get them all as a free PDF in your inbox.`}
          />
          <div className="mt-12">
            <PdiChecklist />
          </div>
        </div>
      </section>

      {/* FAQ */}
      {page.faqs.length > 0 && (
        <section aria-labelledby="pdi-faq-title" className="bg-mist py-14 md:py-20">
          <div className="container-x grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <Eyebrow>FAQ</Eyebrow>
              <h2 id="pdi-faq-title" className="type-h2 mt-5">
                PDI questions, answered.
              </h2>
            </div>
            <div className="lg:col-span-8">
              <Accordion items={page.faqs.map((f, i) => ({ id: `pdi-faq-${i}`, title: f.q, content: f.a }))} defaultOpen={["pdi-faq-0"]} />
            </div>
          </div>
        </section>
      )}

      {/* Closing CTA */}
      <section className="bg-ink py-16 text-white md:py-20">
        <div className="container-x flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <p className="type-h2 max-w-2xl text-balance">
            Taking delivery soon? <span className="type-editorial font-normal text-white/85">Let an expert check it first.</span>
          </p>
          <Button href="#book" size="lg" arrow>
            Book a PDI expert
          </Button>
        </div>
      </section>

      <ChecklistGateModal />
    </>
  );
}
