import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ClipboardList, FileSignature, Inbox, Lock, RefreshCw, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/portal/ui";
import { Note } from "@/components/portal/register/controls";
import { INS_STEPS } from "@/insurance/application";
import { INS_VENDOR_STATUS_LABEL, INS_VENDOR_STATUS_TONE } from "@/insurance/labels";
import { insCorrectionsFor } from "@/insurance/schemas";
import type { InsVendorStatus } from "@/db/enums";
import { getSessionUser } from "@/server/auth";
import { getInsurerContext } from "@/server/insurance/context";
import { clampStep, furthestKey, insEditable } from "./_lib/wizard";
import { InsAccountForm } from "@/components/insurance/vendor/auth/account-form";

export const metadata: Metadata = { title: "Apply as an insurance vendor" };

const BENEFITS = [
  { icon: Shield, title: "Your motor products, verified", body: "Comprehensive, third-party, own-damage and add-on covers — each reviewed before it goes live." },
  { icon: Inbox, title: "Quote requests from car owners", body: "Enquiries from people comparing cover for the exact car they own or are buying." },
  { icon: FileSignature, title: "Quotations, clearly labelled", body: "Send indicative or insurer-authorised quotations the customer opens on MarchGear." },
  { icon: RefreshCw, title: "Renewals, on time", body: "A renewals pipeline for your team, from expiry reminders to renewed." },
];

const NEEDS = [
  "Certificate of incorporation or registration",
  "GSTIN and company PAN",
  "Your current regulatory certificate of registration or licence",
  "Authorised representative's ID and authorisation letter",
  "Registered office address proof",
  "A cancelled cheque or recent bank statement",
];

export default async function InsuranceRegisterLanding() {
  const ctx = await getInsurerContext();
  // Only people who can edit the application get the wizard; everyone else sees its status.
  if (ctx && (!insEditable(ctx.vendor) || !ctx.can("profile.manage"))) redirect("/insurance-vendor/application-status");
  const other = ctx ? null : await getSessionUser();

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 md:px-8 md:py-12">
      <div className="grid overflow-hidden border border-line lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <section className="relative flex flex-col justify-between gap-12 bg-ink px-6 py-10 text-white md:px-12 md:py-14">
          <div className="animate-rise">
            <p className="type-eyebrow text-red">Insurance vendor programme</p>
            <h1 className="mt-4 max-w-xl font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[46px]">Offer motor insurance where India shops for cars.</h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/65">
              For registered insurers and insurance intermediaries. Apply once — MarchGear verifies your company and regulatory registration, then your portal opens.
            </p>
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
                {["Create your vendor account", "Complete seven steps — saved as you go", "MarchGear verifies your details, registration and documents", "Your portal opens and you list products"].map((t, i) => (
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

        {/* A returning applicant sees "Continue" first on small screens. */}
        <section className={cn("bg-white px-6 py-10 md:px-12 md:py-14", ctx && "order-first lg:order-none")}>
          <div className="mx-auto max-w-md animate-rise [animation-delay:120ms]">
            {ctx ? (
              <ContinueCard name={ctx.user.name} reference={ctx.vendor.reference} status={ctx.vendor.status} step={ctx.vendor.step} remarks={ctx.vendor.adminRemarks} next={ctx.vendor.status === "draft" ? furthestKey(ctx.vendor) : (insCorrectionsFor(ctx.vendor.requiredCorrections)[0]?.step ?? "documents")} />
            ) : (
              <>
                <h2 className="font-display text-[28px] font-semibold tracking-[-0.02em]">Create your vendor account</h2>
                <p className="mt-1.5 text-[14px] text-muted">You&apos;ll use this login for the insurance vendor portal. You become your company&apos;s owner account and can add your team later.</p>
                {other && other.role !== "insurer" && (
                  <Note tone="info" className="mt-6">
                    You&apos;re signed in to MarchGear as {other.email}. Creating a vendor account signs you out of that account on this browser — use a different, work email.
                  </Note>
                )}
                {other?.role === "insurer" && (
                  <Note tone="warn" className="mt-6">
                    Your vendor login ({other.email}) isn&apos;t linked to an active company any more. Sign out and register with a different email, or contact your company&apos;s owner.
                  </Note>
                )}
                <div className="mt-8">
                  <InsAccountForm />
                </div>
                <p className="mt-8 border-t border-line pt-6 text-[14px] text-muted">
                  Already started an application?{" "}
                  <Link href="/insurance-vendor/login?next=/insurance-vendor/register" className="font-medium text-ink underline-offset-4 hover:text-red hover:underline">
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

function ContinueCard({ name, reference, status, step, remarks, next }: { name: string; reference: string; status: InsVendorStatus; step: number; remarks: string | null; next: (typeof INS_STEPS)[number]["key"] }) {
  const furthest = clampStep(step);
  const target = INS_STEPS.find((s) => s.key === next) ?? INS_STEPS[0];
  const reopened = status === "changes_requested" || status === "documents_required";
  const pct = Math.round(((furthest - 1) / INS_STEPS.length) * 100);
  return (
    <>
      <p className="type-eyebrow text-muted">Welcome back, {name.split(" ")[0]}</p>
      <h2 className="mt-3 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em]">{reopened ? "Update your application" : "Continue your application"}</h2>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
        <span className="num">{reference}</span>
        <Badge tone={INS_VENDOR_STATUS_TONE[status]}>{INS_VENDOR_STATUS_LABEL[status]}</Badge>
      </p>

      {reopened && (
        <Note tone="warn" className="mt-6" title={status === "documents_required" ? "MarchGear needs more documents" : "MarchGear asked for changes"}>
          {remarks ? <p className="line-clamp-3">“{remarks}”</p> : <p>See the details on your application status page.</p>}
          <Link href="/insurance-vendor/application-status" className="mt-1 inline-block font-medium underline underline-offset-4">
            See what&apos;s needed
          </Link>
        </Note>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="font-medium">{reopened ? "All steps open for changes" : `Step ${furthest} of ${INS_STEPS.length}`}</span>
          <span className="text-muted num">{pct}% complete</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-mist">
          <div className="h-full rounded-full bg-ink transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        <ol className="mt-6 space-y-1">
          {INS_STEPS.map((s) => {
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
              <li key={s.key}>
                {locked ? (
                  <span className="flex items-center gap-3 px-1 py-1.5">{row}</span>
                ) : (
                  <Link href={`/insurance-vendor/register/${s.key}`} className="flex items-center gap-3 rounded-[3px] px-1 py-1.5 transition-colors hover:bg-mist">
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <Button href={`/insurance-vendor/register/${target.key}`} size="lg" arrow className="mt-8 w-full">
        Continue — {target.title}
      </Button>
      <Link href="/insurance-vendor/application-status" className="mt-4 flex items-center justify-center gap-2 text-[13px] text-muted hover:text-ink">
        <ClipboardList aria-hidden className="size-4" /> Application status
      </Link>
    </>
  );
}
