import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  ChartColumn,
  Check,
  ClipboardCheck,
  FileSignature,
  Globe,
  Inbox,
  Landmark,
  LockKeyhole,
  Megaphone,
  Network,
  Presentation,
  RefreshCw,
  Rocket,
  Scale,
  Shield,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { INS_VENDOR_CATEGORIES, type InsVendorCategory } from "@/db/enums";
import { Button } from "@/components/ui/button";
import { Accordion } from "@/components/ui/accordion";
import { LogoMark } from "@/components/ui/logo";
import { INS_STEPS } from "@/insurance/application";
import { INDICATIVE_NOTE, INS_VENDOR_CATEGORY_LABEL, NOT_AN_INSURER_NOTE } from "@/insurance/labels";
import { INS_CATEGORY_BLURB } from "@/insurance/schemas";
import { GST_RATE } from "@/partner/plans";
import { rupees } from "@/components/portal/billing/shared";
import { getCatalog } from "@/server/catalog";
import { getInsurerContext } from "@/server/insurance/context";

export const metadata: Metadata = {
  title: { absolute: "MarchGear for insurers & intermediaries" },
  description: "List motor insurance products on MarchGear, answer quote requests from car owners and manage renewals — for registered insurers and insurance intermediaries in India.",
};

const OFFER: { icon: LucideIcon; title: string; body: string; points: string[] }[] = [
  {
    icon: Shield,
    title: "Product listings",
    body: "Comprehensive, third-party, own-damage, bundled and EV products, with the coverage and add-ons you choose.",
    points: ["Eligibility by body type, brand, model, fuel, age and region", "Each product reviewed before it's published"],
  },
  {
    icon: Inbox,
    title: "Quote requests",
    body: "Car owners compare indicative premiums for their exact car and ask you for a quote — new policies and renewals.",
    points: ["Vehicle, policy and no-claim details up front", "Assign to your team, add notes and reminders"],
  },
  {
    icon: RefreshCw,
    title: "Renewals CRM",
    body: "Every upcoming expiry in one pipeline, from the first reminder to renewed — so customers don't lapse.",
    points: ["Renewal window you can act on", "Policies you issue flow straight into renewals"],
  },
  {
    icon: Megaphone,
    title: "Promotions",
    body: "Product launches, renewal drives and EV campaigns shown on MarchGear's insurance pages once approved.",
    points: ["Scheduled start and end dates", "Approved by MarchGear before they appear"],
  },
  {
    icon: Presentation,
    title: "Advertising",
    body: "Banner and sponsored-listing placements across MarchGear, clearly labelled as sponsored.",
    points: ["Book dates and upload creatives in the portal", "Enquiries from your ads are attributed"],
  },
  {
    icon: ChartColumn,
    title: "Analytics",
    body: "Views, quote requests, quotations and conversions by product and campaign — reported and verified kept apart.",
    points: ["Funnel from listing view to policy issued", "Exports for your own reporting"],
  },
];

const CATEGORY_ICON: Record<InsVendorCategory, LucideIcon> = {
  insurer: Building2,
  broker: Briefcase,
  corporate_agent: Users,
  web_aggregator: Globe,
  imf: Megaphone,
  other_intermediary: Network,
};

const PRINCIPLES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Scale, title: "Premiums are indicative", body: "Every premium MarchGear calculates is labelled indicative. The final premium, IDV and terms are always yours." },
  { icon: FileSignature, title: "Quotations are labelled", body: "Each quotation you send is marked Indicative or Insurer-authorised — the latter carries your own quotation reference." },
  { icon: BadgeCheck, title: "Claims data is verified", body: "Claim-settlement figures appear publicly only after MarchGear's team has verified them, with the year and source." },
  { icon: LockKeyhole, title: "No policies or payments", body: "MarchGear doesn't issue policies, collect premiums or settle claims. Customers buy from you, directly." },
];

const FAQ = [
  {
    id: "time",
    title: "How long does approval take?",
    content: "Our vendor team reviews applications in the order they arrive. Every step — received, under review, documents or changes requested, approved — appears on your application status page and in your notifications, so you always know where you stand.",
  },
  {
    id: "intermediary",
    title: "We're a broker or corporate agent. Can we list insurers' products?",
    content: "Yes. Registered intermediaries list the products of insurers they're authorised to distribute. Each product you submit needs that insurer's authorisation or tie-up letter, which MarchGear checks before approving it.",
  },
  {
    id: "changes",
    title: "What if our details change after approval?",
    content: "Your public profile — logo, description, support contacts — can be edited any time. Verified details such as the legal name, GSTIN, PAN, licence and bank account change through a request that MarchGear approves, so customers can rely on them.",
  },
  {
    id: "bank",
    title: "Why do you need our bank account?",
    content: "To verify your company and for refunds of anything you've paid MarchGear. The account number is encrypted before it's stored and is never shown in full in the portal.",
  },
  {
    id: "pay",
    title: "How are plans billed?",
    content: "Applying is free. After approval you pick a plan; MarchGear raises a monthly invoice, which you pay by bank transfer, UPI or cheque and record in the portal. There's no card payment or gateway.",
  },
  {
    id: "team",
    title: "Can our whole team use the portal?",
    content: "Yes. The owner adds colleagues with roles — administrator, sales manager, sales executive, marketing or finance — and can fine-tune each person's permissions. Your plan sets how many team accounts you can have.",
  },
];

const anchor = "scroll-mt-20";

export default async function InsuranceVendorLanding() {
  const ctx = await getInsurerContext();
  if (ctx) redirect(ctx.approved ? "/insurance-vendor/dashboard" : "/insurance-vendor/application-status");
  const { content } = await getCatalog();
  const plans = content.insurerPlans.plans;
  const supportEmail = content.insuranceSettings.vendorSupportEmail || content.site.supportEmail;
  const gst = Math.round(GST_RATE * 100);

  return (
    <div className="min-h-dvh bg-white text-ink">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/insurance-vendor" className="flex shrink-0 items-center gap-2.5" aria-label="MarchGear for insurers">
            <LogoMark className="size-7" />
            <span className="hidden font-display text-[18px] font-semibold leading-none tracking-[-0.03em] min-[420px]:inline">
              March<span className="font-normal opacity-80">Gear</span>
            </span>
            <span className="rounded-[3px] bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">Insurance</span>
          </Link>
          <nav aria-label="On this page" className="hidden items-center gap-7 text-[13.5px] text-ink/70 lg:flex">
            {[
              ["#offering", "What you get"],
              ["#approval", "Approval"],
              ["#eligibility", "Who can apply"],
              ["#plans", "Plans"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="transition-colors hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button href="/insurance-vendor/login" variant="ghost" size="sm">
              Sign in
            </Button>
            <Button href="/insurance-vendor/register" size="sm" arrow>
              <span>
                Apply<span className="hidden sm:inline"> now</span>
              </span>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-ink text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="relative mx-auto grid max-w-[1320px] gap-12 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
            <div className="animate-rise">
              <p className="type-eyebrow text-red">MarchGear for insurers &amp; intermediaries</p>
              <h1 className="mt-5 max-w-3xl font-display text-[38px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[48px] md:text-[60px]">Motor insurance, offered where India buys its cars.</h1>
              <p className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-white/65 md:text-[16.5px]">
                List your motor products beside the cars people are researching, answer their quote requests and keep renewals on track — all from one verified vendor portal.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button href="/insurance-vendor/register" size="lg" arrow>
                  Apply now
                </Button>
                <Button href="/insurance-vendor/login" size="lg" variant="outline-light">
                  Sign in to the portal
                </Button>
              </div>
              <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/55">
                {["Applying is free", "Verified before you go live", "Saved as you go"].map((t) => (
                  <li key={t} className="inline-flex items-center gap-2">
                    <Check aria-hidden className="size-3.5 text-red" /> {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="animate-rise border border-white/10 bg-white/[0.03] [animation-delay:150ms]">
              <p className="border-b border-white/10 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">From application to live</p>
              <ol className="px-6 py-2">
                {[
                  { icon: ClipboardCheck, title: "Apply in seven steps", body: "Company, registration, regulatory, branches, banking and documents." },
                  { icon: ShieldCheck, title: "MarchGear verifies", body: "Your company, regulatory registration, bank account and documents." },
                  { icon: Rocket, title: "Go live", body: "Your portal opens. List products — each is approved before it's public." },
                ].map(({ icon: Icon, title, body }, i, all) => (
                  <li key={title} className="relative flex gap-4 py-4">
                    {i < all.length - 1 && <span aria-hidden className="absolute left-[17px] top-[52px] h-[calc(100%-44px)] w-px bg-white/15" />}
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-ink">
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className="block text-[14.5px] font-semibold">{title}</span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-white/55">{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section id="offering" className={anchor}>
          <div className="mx-auto max-w-[1320px] px-4 py-16 md:px-8 md:py-24">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-end">
              <div>
                <p className="type-eyebrow text-red">What MarchGear offers</p>
                <h2 className="mt-3 font-display text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] md:text-[40px]">One portal for your whole motor book.</h2>
              </div>
              <p className="max-w-2xl text-[15px] leading-relaxed text-muted lg:justify-self-end">
                Everything a distribution team needs to sell motor insurance online — from listing a product to renewing the policy a year later. Your team works in one place, with roles and permissions you control.
              </p>
            </div>
            <ul className="mt-12 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
              {OFFER.map(({ icon: Icon, title, body, points }) => (
                <li key={title} className="group border-b border-r border-line p-6 transition-colors duration-300 hover:bg-[#FAFAFA] md:p-8">
                  <span className="inline-flex size-10 items-center justify-center rounded-[3px] bg-mist text-ink transition-colors duration-300 group-hover:bg-ink group-hover:text-white">
                    <Icon aria-hidden className="size-[18px]" />
                  </span>
                  <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.01em]">{title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
                  <ul className="mt-4 space-y-1.5 text-[13px] text-ink/80">
                    {points.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-red" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Approval */}
        <section id="approval" className={`${anchor} bg-[#F6F6F6]`}>
          <div className="mx-auto grid max-w-[1320px] gap-12 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="type-eyebrow text-red">How approval works</p>
              <h2 className="mt-3 font-display text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] md:text-[40px]">Seven steps, one review, then you&apos;re live.</h2>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
                The application saves as you type, so you can stop and come back from any device. When you submit, it&apos;s locked while MarchGear&apos;s vendor team verifies it. If anything&apos;s missing, we reopen it and tell you exactly what.
              </p>
              <div className="mt-8 border border-line bg-white p-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">What the review checks</p>
                <ul className="mt-3 space-y-2 text-[13.5px]">
                  {["Company identity, GSTIN and PAN", "Regulatory registration, validity and authorised representative", "Registered office and branches", "Bank account ownership", "Every uploaded document"].map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <Button href="/insurance-vendor/register" arrow className="mt-8">
                Start your application
              </Button>
            </div>

            <ol className="relative">
              {[
                ...INS_STEPS.map((s) => ({ key: s.key, n: String(s.n).padStart(2, "0"), title: s.title, body: s.blurb, tone: "step" as const })),
                { key: "review", n: "✓", title: "MarchGear review", body: "We verify everything you've submitted. Track it on your application status page.", tone: "review" as const },
                { key: "live", n: "→", title: "Go live", body: "Your full portal opens: list products, receive quote requests, run campaigns.", tone: "live" as const },
              ].map((s, i, all) => (
                <li key={s.key} className="relative flex gap-5 pb-8 last:pb-0">
                  {i < all.length - 1 && <span aria-hidden className="absolute left-[21px] top-12 h-[calc(100%-40px)] w-px bg-line" />}
                  <span
                    className={
                      s.tone === "step"
                        ? "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-white text-[13px] font-semibold num"
                        : s.tone === "review"
                          ? "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white"
                          : "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-red text-[16px] font-semibold text-white"
                    }
                  >
                    {s.n}
                  </span>
                  <div className="min-w-0 flex-1 border border-line bg-white px-5 py-4">
                    <h3 className="text-[15px] font-semibold">{s.title}</h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Who can apply */}
        <section id="eligibility" className={anchor}>
          <div className="mx-auto max-w-[1320px] px-4 py-16 md:px-8 md:py-24">
            <div className="max-w-3xl">
              <p className="type-eyebrow text-red">Who can apply</p>
              <h2 className="mt-3 font-display text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] md:text-[40px]">Registered insurers and intermediaries.</h2>
              <p className="mt-5 text-[15px] leading-relaxed text-muted">Any entity with a current registration to sell motor insurance in India. Insurers underwrite their own products; intermediaries distribute the products of insurers they&apos;re authorised by.</p>
            </div>
            <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {INS_VENDOR_CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICON[c];
                return (
                  <li key={c} className="flex gap-4 border border-line p-5">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-mist">
                      <Icon aria-hidden className="size-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">{INS_VENDOR_CATEGORY_LABEL[c]}</span>
                      <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">{INS_CATEGORY_BLURB[c]}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 flex flex-col gap-4 border border-ink bg-ink px-6 py-5 text-white sm:flex-row sm:items-center">
              <Landmark aria-hidden className="size-6 shrink-0 text-red" />
              <p className="text-[14px] leading-relaxed text-white/80">
                <span className="font-semibold text-white">Your regulatory registration is verified.</span> Before approval, MarchGear checks your registration or licence number, its validity and your authorised representative against the regulator&apos;s public records and the documents you upload. Applications without a current registration aren&apos;t approved.
              </p>
            </div>
          </div>
        </section>

        {/* Principles */}
        <section className="border-y border-line bg-[#F6F6F6]">
          <div className="mx-auto max-w-[1320px] px-4 py-16 md:px-8 md:py-20">
            <p className="type-eyebrow text-red">How we work with you</p>
            <h2 className="mt-3 max-w-2xl font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[34px]">Built so customers can trust what they see.</h2>
            <ul className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {PRINCIPLES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="bg-white p-6">
                  <Icon aria-hidden className="size-5 text-red" />
                  <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ul>
            <p className="mt-5 max-w-3xl text-[12.5px] leading-relaxed text-muted">What customers see beside every estimate: “{INDICATIVE_NOTE}”</p>
          </div>
        </section>

        {/* Plans */}
        <section id="plans" className={anchor}>
          <div className="mx-auto max-w-[1320px] px-4 py-16 md:px-8 md:py-24">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
              <div>
                <p className="type-eyebrow text-red">Plans</p>
                <h2 className="mt-3 font-display text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] md:text-[40px]">Start free. Grow when you&apos;re ready.</h2>
              </div>
              <p className="max-w-xl text-[15px] leading-relaxed text-muted lg:justify-self-end">
                Applying is free — you choose a plan after approval. Prices are per month, before {gst}% GST, invoiced by MarchGear and paid by bank transfer, UPI or cheque. Advertising is booked separately.
              </p>
            </div>
            <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((p, i) => {
                const featured = plans.length > 2 && i === 1;
                const limits = [
                  [p.products, "published products"],
                  [p.activeCampaigns, "active campaigns"],
                  [p.members, "team members"],
                ] as const;
                return (
                  <li key={p.id} className={featured ? "relative flex flex-col border border-ink bg-white p-7 shadow-[inset_0_0_0_1px_#111]" : "relative flex flex-col border border-line bg-white p-7"}>
                    <h3 className="text-[17px] font-semibold">{p.name}</h3>
                    <p className="mt-1.5 min-h-[40px] text-[13.5px] leading-relaxed text-muted">{p.summary}</p>
                    <p className="mt-6 flex items-baseline gap-1.5">
                      <span className="font-display text-[38px] font-semibold leading-none tracking-[-0.03em] num">{p.monthly ? rupees(p.monthly) : "Free"}</span>
                      {p.monthly > 0 && <span className="text-[13px] text-muted">/ month + GST</span>}
                    </p>
                    <dl className="mt-6 grid grid-cols-3 border-y border-line py-4 text-center">
                      {limits.map(([v, label]) => (
                        <div key={label} className="min-w-0 px-1">
                          <dt className="sr-only">{label}</dt>
                          <dd className="font-display text-[20px] font-semibold num">{v === null ? "∞" : v}</dd>
                          <dd className="mt-0.5 text-[11.5px] leading-tight text-muted">{label}</dd>
                        </div>
                      ))}
                    </dl>
                    <ul className="mt-5 flex-1 space-y-2.5 text-[13.5px]">
                      {p.features.map((f) => (
                        <li key={f} className="flex gap-2.5">
                          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button href="/insurance-vendor/register" variant={featured ? "primary" : "outline"} className="mt-7 w-full" arrow>
                      Apply now
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className={`${anchor} border-t border-line`}>
          <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
            <div>
              <p className="type-eyebrow text-red">Questions</p>
              <h2 className="mt-3 font-display text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] md:text-[40px]">Before you apply.</h2>
              {supportEmail && (
                <p className="mt-5 text-[14.5px] leading-relaxed text-muted">
                  Anything else? Write to{" "}
                  <a href={`mailto:${supportEmail}?subject=${encodeURIComponent("Insurance vendor enquiry")}`} className="font-medium text-ink underline underline-offset-4 hover:text-red">
                    {supportEmail}
                  </a>
                  .
                </p>
              )}
            </div>
            <Accordion items={FAQ} defaultOpen={["time"]} />
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-ink text-white">
          <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-4 py-14 md:flex-row md:items-center md:justify-between md:px-8 md:py-16">
            <div>
              <h2 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] md:text-[36px]">Ready when you are.</h2>
              <p className="mt-2 max-w-xl text-[14.5px] text-white/60">Create your vendor account in a minute. Keep your certificates handy — the application saves as you go.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button href="/insurance-vendor/register" size="lg" arrow>
                Apply now
              </Button>
              <Button href="/insurance-vendor/login" size="lg" variant="outline-light">
                Sign in
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-4 py-8 text-[12.5px] text-muted md:flex-row md:items-center md:justify-between md:px-8">
          <p className="max-w-2xl leading-relaxed">{NOT_AN_INSURER_NOTE}</p>
          <nav aria-label="Legal" className="flex shrink-0 flex-wrap gap-x-5 gap-y-2">
            <Link href="/" className="inline-flex items-center gap-1 hover:text-ink">
              MarchGear home <ArrowRight aria-hidden className="size-3" />
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
