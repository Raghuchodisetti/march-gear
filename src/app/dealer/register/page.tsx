import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, CarFront, Check, ClipboardList, Inbox, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WIZARD_STEPS } from "@/partner/application";
import { PARTNER_STATUS_LABEL, PARTNER_STATUS_TONE } from "@/partner/labels";
import { getSessionUser } from "@/server/auth";
import { getPartnerContext } from "@/server/partner/context";
import { furthestSlug, isEditable } from "@/server/partner/application";
import { Badge } from "@/components/portal/ui";
import { AccountForm } from "@/components/portal/register/account-form";
import { Note } from "@/components/portal/register/controls";

export const metadata: Metadata = { title: "Become a dealer partner" };

const BENEFITS = [
  { icon: BadgeCheck, title: "A verified partner listing", body: "Your showrooms, brands, hours and contact details on a public MarchGear dealer page." },
  { icon: CarFront, title: "New and used inventory", body: "List your stock. Every listing is reviewed by our team before it goes live." },
  { icon: Sparkles, title: "Offers with approval built in", body: "Festival, finance and exchange offers, shown on the models they apply to." },
  { icon: Inbox, title: "Enquiries to sales", body: "Leads, test-drive requests and follow-ups for your whole team in one place." },
];

const NEEDS = ["GSTIN and PAN", "Business registration certificate", "ID and address proof", "Brand authorisation certificates (authorised dealers)", "A cancelled cheque"];

export default async function RegisterLanding() {
  const ctx = await getPartnerContext();
  // Only people who can edit the application get the wizard (every step would bounce anyone else to the status page).
  if (ctx && (!isEditable(ctx.partner) || !ctx.can("profile.manage"))) redirect("/dealer/application-status");
  const other = ctx ? null : await getSessionUser();

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 md:px-8 md:py-12">
      <div className="grid overflow-hidden border border-line lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <section className="relative flex flex-col justify-between gap-12 bg-ink px-6 py-10 text-white md:px-12 md:py-14">
          <div className="animate-rise">
            <p className="type-eyebrow text-red">Dealer partner programme</p>
            <h1 className="mt-4 max-w-xl font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[46px]">Put your showroom in front of India&apos;s car buyers.</h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/65">For authorised and independent multi-brand dealers. Apply once — our partner team verifies your dealership and your portal unlocks.</p>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              {BENEFITS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-white/[0.07] text-white">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold">{title}</span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-white/55">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-8 border-t border-white/10 pt-8 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">How it works</p>
              <ol className="mt-4 space-y-3 text-[13.5px] text-white/75">
                {["Create your partner account", "Complete seven short steps — saved as you go", "Our team verifies your details and documents", "Your full portal unlocks"].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-white/25 text-[11px] font-semibold num">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Keep these ready</p>
              <ul className="mt-4 space-y-2.5 text-[13.5px] text-white/75">
                {NEEDS.map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* A returning dealer sees "Continue" first on small screens. */}
        <section className={cn("bg-white px-6 py-10 md:px-12 md:py-14", ctx && "order-first lg:order-none")}>
          <div className="mx-auto max-w-md animate-rise [animation-delay:120ms]">
            {ctx ? (
              <ContinueCard
                name={ctx.user.name}
                reference={ctx.partner.reference}
                status={ctx.partner.status}
                step={ctx.partner.step}
                remarks={ctx.partner.adminRemarks}
                next={furthestSlug(ctx.partner)}
              />
            ) : (
              <>
                <h2 className="font-display text-[28px] font-semibold tracking-[-0.02em]">Create your partner account</h2>
                <p className="mt-1.5 text-[14px] text-muted">Step 1 of your application. You&apos;ll use this login for the dealer portal.</p>
                {other && other.role !== "dealer" && (
                  <Note tone="info" className="mt-6">
                    You&apos;re signed in to MarchGear as {other.email}. Creating a dealer account signs you out of that account on this browser.
                  </Note>
                )}
                {other?.role === "dealer" && (
                  <Note tone="warn" className="mt-6">
                    Your dealer login ({other.email}) isn&apos;t linked to a dealership any more. Sign out and register with a different email, or contact your dealership&apos;s owner.
                  </Note>
                )}
                <div className="mt-8">
                  <AccountForm />
                </div>
                <p className="mt-8 border-t border-line pt-6 text-[14px] text-muted">
                  Already started an application?{" "}
                  <Link href="/dealer/login?next=/dealer/register" className="font-medium text-ink underline-offset-4 hover:text-red hover:underline">
                    Sign in to continue
                  </Link>
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ContinueCard({ name, reference, status, step, remarks, next }: { name: string; reference: string; status: keyof typeof PARTNER_STATUS_LABEL; step: number; remarks: string | null; next: string }) {
  const furthest = Math.min(7, Math.max(1, step));
  const target = WIZARD_STEPS.find((s) => s.slug === next) ?? WIZARD_STEPS[0];
  const reopened = status === "changes_requested" || status === "documents_required";
  return (
    <>
      <p className="type-eyebrow text-muted">Welcome back, {name.split(" ")[0]}</p>
      <h2 className="mt-3 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em]">{reopened ? "Update your application" : "Continue your application"}</h2>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
        <span className="num">{reference}</span>
        <Badge tone={PARTNER_STATUS_TONE[status]}>{PARTNER_STATUS_LABEL[status]}</Badge>
      </p>

      {reopened && (
        <Note tone="warn" className="mt-6" title={status === "documents_required" ? "MarchGear needs more documents" : "MarchGear asked for changes"}>
          {remarks ? <p className="line-clamp-3">“{remarks}”</p> : <p>See the details on your application status page.</p>}
          <Link href="/dealer/application-status" className="mt-1 inline-block font-medium underline underline-offset-4">
            See what&apos;s needed
          </Link>
        </Note>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="font-medium">{reopened ? "All steps open for changes" : `Step ${furthest} of ${WIZARD_STEPS.length}`}</span>
          <span className="text-muted num">{Math.round(((furthest - 1) / WIZARD_STEPS.length) * 100)}% complete</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-mist">
          <div className="h-full rounded-full bg-ink transition-[width] duration-700" style={{ width: `${((furthest - 1) / WIZARD_STEPS.length) * 100}%` }} />
        </div>
        <ol className="mt-6 space-y-1">
          {WIZARD_STEPS.map((s) => {
            const done = s.n < furthest;
            const locked = s.n > furthest;
            const row = (
              <>
                <span className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold num", done ? "border-ink bg-ink text-white" : locked ? "border-line text-muted" : "border-red text-red")}>
                  {done ? <Check aria-hidden className="size-3" strokeWidth={3} /> : locked ? <Lock aria-hidden className="size-2.5" /> : s.n}
                </span>
                <span className={cn("text-[13.5px]", locked ? "text-muted" : "text-ink")}>{s.title}</span>
              </>
            );
            return (
              <li key={s.slug}>
                {locked ? (
                  <span className="flex items-center gap-3 px-1 py-1.5">{row}</span>
                ) : (
                  <Link href={`/dealer/register/${s.slug}`} className="flex items-center gap-3 rounded-[3px] px-1 py-1.5 transition-colors hover:bg-mist">
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <Button href={`/dealer/register/${target.slug}`} size="lg" arrow className="mt-8 w-full">
        Continue — {target.title}
      </Button>
      <Link href="/dealer/application-status" className="mt-4 flex items-center justify-center gap-2 text-[13px] text-muted hover:text-ink">
        <ClipboardList aria-hidden className="size-4" /> Application status
      </Link>
    </>
  );
}
