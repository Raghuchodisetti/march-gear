import type { Metadata } from "next";
import { CalendarCheck, CalendarClock, CalendarX2, FileText, Repeat2, ShieldCheck } from "lucide-react";
import { IMG } from "@/data/images";
import { cn } from "@/lib/utils";
import { getCatalog } from "@/server/catalog";
import { Button } from "@/components/ui/button";
import { CategoryAd, CtaBand, HeroFacts, LandingHero, QuoteSection, RelatedGuides, Section, Steps, pickGuides } from "@/components/insurance/public/landing";
import { INSURANCE_OG_IMAGE, pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Car Insurance Renewal: Keep Your No-Claim Bonus",
  description: "Renew your car insurance on time: how the no-claim bonus grows to 50%, what happens when a policy lapses past 90 days, and how to switch insurers.",
  path: "/insurance/renewal",
  images: [INSURANCE_OG_IMAGE],
});

const SLABS = [
  { years: "1 claim-free year", pct: 20 },
  { years: "2 consecutive years", pct: 25 },
  { years: "3 consecutive years", pct: 35 },
  { years: "4 consecutive years", pct: 45 },
  { years: "5 or more years", pct: 50 },
];

const LAPSE = [
  {
    when: "Before the expiry date",
    Icon: CalendarCheck,
    tone: "ok",
    points: ["Cover continues without a break", "Your NCB moves up a slab if you didn't claim", "No vehicle inspection needed", "Switch insurers freely"],
  },
  {
    when: "Up to 90 days after expiry",
    Icon: CalendarClock,
    tone: "warn",
    points: ["The car is uninsured — don't drive it", "Your NCB is usually still carried forward", "Expect an inspection for own-damage cover", "Cover starts only when the new policy is issued"],
  },
  {
    when: "More than 90 days after",
    Icon: CalendarX2,
    tone: "bad",
    points: ["The no-claim bonus is lost — back to 0%", "Inspection before own-damage cover starts", "Some add-ons may not be offered again", "Third-party-only cover needs no inspection"],
  },
] as const;

export default async function RenewalPage() {
  const { content } = await getCatalog();
  const page = content.insurancePage.pages.renewal;
  const guides = pickGuides(content.insuranceGuides.guides, ["how-ncb-works", "renewing-a-lapsed-policy", "zero-depreciation-explained"]);

  return (
    <>
      <LandingHero hero={page} image={IMG.porscheSunset} imageFocus="50% 70%" crumb="Renewal">
        <HeroFacts
          facts={[
            { value: "Up to 50%", label: "off own damage with five claim-free years" },
            { value: "90 days", label: "after expiry, the no-claim bonus is usually lost" },
            { value: "0 days", label: "of grace — cover stops on the expiry date" },
          ]}
        />
      </LandingHero>
      <CategoryAd />

      <QuoteSection
        title="Compare renewal premiums with your NCB."
        text="Enter your expiry date, current no-claim bonus and whether you claimed last year. The indicative premiums take all three into account."
        defaultIntent="renewal"
        initial={{ intent: "renewal" }}
        source="insurance-renewal"
        tone="white"
      />

      {/* NCB */}
      <Section
        id="ncb"
        tone="ink"
        eyebrow="No-claim bonus"
        title="Every claim-free year is worth more."
        layout="aside"
        intro={
          <>
            <p>The NCB is a discount on the own-damage premium — not the third-party part, which is fixed by regulation. It belongs to you, not the car, so it moves with you to a new insurer or a new car.</p>
            <p>A claim normally resets it to zero at the next renewal, unless your policy had NCB protection.</p>
          </>
        }
      >
        <div className="border border-white/15">
          <div className="grid grid-cols-[1fr_auto] border-b border-white/15 px-5 py-3 text-[12px] text-white/50 sm:px-7">
            <span>Consecutive claim-free policy years</span>
            <span>NCB on own damage</span>
          </div>
          {SLABS.map((s, i) => (
            <div key={s.years} className="grid grid-cols-[1fr_auto] items-center gap-6 border-b border-white/10 px-5 py-4 last:border-b-0 sm:px-7">
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{s.years}</p>
                <div className="mt-2 h-1.5 bg-white/10">
                  <div className={cn("h-full", i === SLABS.length - 1 ? "bg-red" : "bg-white/60")} style={{ width: `${(s.pct / 50) * 100}%` }} />
                </div>
              </div>
              <p className="font-display text-[28px] font-semibold tracking-[-0.03em] num">{s.pct}%</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12.5px] text-white/50">The slabs most insurers use. After a claim year the bonus usually returns to 0%.</p>
      </Section>

      {/* Lapse rules */}
      <Section
        id="lapsed"
        eyebrow="If your policy lapses"
        title="What changes after the expiry date."
        intro={<p>There&apos;s no grace period for cover — but the 90-day mark decides whether you keep your bonus.</p>}
      >
        <div className="grid grid-cols-1 border-y border-ink md:grid-cols-3">
          {LAPSE.map(({ when, Icon, tone, points }, i) => (
            <div key={when} className={cn("py-8 md:px-8", i > 0 && "border-t border-line md:border-l md:border-t-0", i === 0 && "md:pl-0", i === 2 && "md:pr-0")}>
              <span
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-full",
                  tone === "ok" ? "bg-ink text-white" : tone === "warn" ? "bg-mist text-ink" : "bg-red text-white",
                )}
              >
                <Icon aria-hidden className="size-5" />
              </span>
              <h3 className="type-h3 mt-5">{when}</h3>
              <ul className="mt-5 space-y-3 text-[14.5px] leading-relaxed text-muted">
                {points.map((p) => (
                  <li key={p} className="flex gap-3">
                    <span aria-hidden className={cn("mt-2 size-1.5 shrink-0 rounded-full", tone === "bad" ? "bg-red" : "bg-ink/40")} />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 bg-mist p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center">
          <ShieldCheck aria-hidden className="size-8 text-red" />
          <p className="text-[14.5px] leading-relaxed text-ink/85">
            <strong className="font-semibold">About inspections.</strong> For a lapsed comprehensive or own-damage policy, insurers usually inspect the car before cover starts — by a surveyor or through photos and a video taken in their app. Cover isn&apos;t backdated to the old expiry date, and damage from the gap isn&apos;t covered.
          </p>
        </div>
      </Section>

      {/* Switching */}
      <Section
        id="switch"
        tone="mist"
        eyebrow="Switching insurers"
        title="Your renewal notice is one quote, not the only one."
        layout="aside"
        intro={<p>You can change insurer at every renewal and take your no-claim bonus with you. Start about a month before the expiry date so nothing is rushed.</p>}
      >
        <Steps
          steps={[
            { title: "Find last year's policy", text: "The schedule shows your IDV, add-ons and current NCB. The new insurer will ask for a copy as proof of your bonus." },
            { title: "Compare on equal terms", text: "Same IDV band, same add-ons, same deductibles. A cheaper quote that drops zero depreciation isn't cheaper." },
            { title: "Declare honestly", text: "Give your real NCB and say if you claimed. Insurers check with your previous insurer, and a wrong declaration can void a claim." },
            { title: "Buy before the old policy ends", text: "Set the new policy to start when the old one expires, so there's no gap and no inspection." },
          ]}
        />
        <div className="mt-8 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2">
          <div className="flex gap-4 bg-white p-5">
            <FileText aria-hidden className="mt-0.5 size-5 shrink-0 text-red" />
            <p className="text-[14px] leading-relaxed text-muted">
              <span className="font-semibold text-ink">Keep handy:</span> previous policy, registration certificate, and any NCB retention letter from an earlier car.
            </p>
          </div>
          <div className="flex gap-4 bg-white p-5">
            <Repeat2 aria-hidden className="mt-0.5 size-5 shrink-0 text-red" />
            <p className="text-[14px] leading-relaxed text-muted">
              <span className="font-semibold text-ink">New car, year two?</span> You renew only the own-damage part — the three-year third-party cover keeps running.
            </p>
          </div>
        </div>
        <Button href="#quote" className="mt-8" arrow>
          Compare renewal premiums
        </Button>
      </Section>

      <RelatedGuides guides={guides} />
      <CtaBand title="Policy expiring soon?" accent="Renew before the date." action={{ label: "Compare renewals", href: "#quote" }} topic="renewal" />
    </>
  );
}
