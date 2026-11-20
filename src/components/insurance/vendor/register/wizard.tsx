"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, ClipboardCheck, Loader2, Lock, Save, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useUI } from "@/components/providers/app-provider";
import { Note, focusFirstError } from "@/components/portal/register/controls";
import { INS_STEPS, type InsStepKey } from "@/insurance/application";
import {
  INS_STEP_SECTIONS,
  INS_STEP_SHORT,
  insCheckApplication,
  insCheckStep,
  insContextFor,
  insRejectedFileErrors,
  insStepNumber,
  type FieldErrors,
  type InsSection,
  type InsWizardApplication,
} from "@/insurance/schemas";
import type { InsWizardProps } from "@/app/insurance-vendor/register/_lib/wizard";
import { saveInsApplicationAction, submitInsApplicationAction, type InsSaveResult, type InsSubmitResult } from "@/server/actions/ins-application";
import { useInsSaveStatus } from "./frame";
import { ContactStep } from "./step-contact";
import { CompanyStep } from "./step-company";
import { RegistrationStep } from "./step-registration";
import { RegulatoryStep } from "./step-regulatory";
import { BranchesStep } from "./step-branches";
import { BankStep } from "./step-bank";
import { DocumentsStep } from "./step-documents";

/* ──────────────────────────────────────────────────────────────
   The vendor registration wizard: progress, staff feedback, the
   current step, Previous / Save draft / Next and debounced autosave
   into ins_vendors.application. State comes from the database on
   every page load.
   ────────────────────────────────────────────────────────────── */

const AUTOSAVE_MS = 1200;
const BASE = "/insurance-vendor/register";

const INTRO: Record<InsStepKey, string> = {
  contact: "Who MarchGear should talk to about this application. We verify the mobile number with a one-time code.",
  company: "Your company's legal identity and registered office, exactly as on your certificate of incorporation.",
  registration: "Tax and company registration numbers. We check the GSTIN against the PAN automatically.",
  regulatory: "Your category and the regulatory registration that allows you to sell motor insurance. It's verified before approval.",
  branches: "Offices customers and MarchGear can reach. Choose one primary branch — it's shown first on your public page.",
  bank: "Your company's bank account, used to verify you and for refunds. The account number is encrypted before it's stored.",
  documents: "Upload your documents, check every step once more, then sign and submit for verification.",
};

type Updater<T> = T | ((prev: T) => T);

export function InsWizard(props: InsWizardProps) {
  const { step, reference, statusLabel, status, resubmission, otp, remarks, corrections, reviews } = props;
  const router = useRouter();
  const { toast } = useUI();
  const { setState: setSave, flushRef, retryRef } = useInsSaveStatus();

  const sections = INS_STEP_SECTIONS[step];
  const n = insStepNumber(step);
  const [app, setApp] = useState(props.app);
  const [bank, setBank] = useState(props.bank);
  const [furthest, setFurthest] = useState(props.furthest);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<null | "next" | "prev" | "draft" | "submit" | "nav">(null);
  const [confirm, setConfirm] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);

  const appRef = useRef(app);
  const dirty = useRef(false);
  const inflight = useRef<Promise<InsSaveResult | null> | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const checkCtx = useMemo(() => insContextFor(app, { requireVerifiedMobile: otp === "screen", hasAccount: bank.hasAccount }), [app, otp, bank.hasAccount]);

  const clear = useCallback((...keys: string[]) => {
    if (!keys.length) return;
    setErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const k of Object.keys(next))
        if (keys.some((key) => k === key || k.startsWith(`${key}.`))) {
          delete next[k];
          changed = true;
        }
      return changed ? next : prev;
    });
  }, []);

  /** Saves the current step's sections (if changed, or always when advancing). Saves never overlap. */
  const runSave = useCallback(
    async (advance = false): Promise<InsSaveResult | null> => {
      window.clearTimeout(timer.current);
      while (inflight.current) await inflight.current;
      if (!advance && !dirty.current) return null;
      dirty.current = false;
      const sent = appRef.current;
      const data = Object.fromEntries(sections.map((s) => [s, sent[s]]));
      setSave({ kind: "saving" });
      const p = saveInsApplicationAction({ step, data, advance }).catch((): InsSaveResult => ({ ok: false, error: "Couldn't reach the server. Check your connection." }));
      inflight.current = p;
      const res = await p;
      inflight.current = null;

      if (res.ok || res.savedAt) {
        // Edits made while this save was in flight are still pending.
        setSave(dirty.current ? { kind: "saving" } : { kind: "saved", at: Date.parse(res.savedAt ?? new Date().toISOString()) });
        if (res.step) setFurthest((f) => Math.max(f, res.step!));
      } else {
        dirty.current = true;
        setSave({ kind: "error", message: res.error ?? "Couldn't save." });
      }
      if (res.ok) {
        const cur = appRef.current;
        let next: InsWizardApplication = cur;
        if (res.bank) setBank(res.bank);
        // The browser forgets a saved account number; only the masked form remains.
        if (res.accountSaved && cur.bank.accountNumber === sent.bank.accountNumber && cur.bank.accountNumberConfirm === sent.bank.accountNumberConfirm)
          next = { ...next, bank: { ...next.bank, accountNumber: "", accountNumberConfirm: "" } };
        if (res.verified && cur.contact.mobile === sent.contact.mobile && cur.contact.email === sent.contact.email)
          next = { ...next, contact: { ...next.contact, mobileVerified: res.verified.mobile, emailVerified: res.verified.email } };
        if (next !== cur) {
          appRef.current = next;
          setApp(next);
        }
      }
      return res;
    },
    [sections, step, setSave],
  );

  const schedule = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void runSave(false), AUTOSAVE_MS);
  }, [runSave]);

  const change = useCallback(
    <S extends InsSection>(s: S, v: Updater<InsWizardApplication[S]>) => {
      const prev = appRef.current[s];
      const value = typeof v === "function" ? (v as (p: InsWizardApplication[S]) => InsWizardApplication[S])(prev) : v;
      const next = { ...appRef.current, [s]: value } as InsWizardApplication;
      appRef.current = next;
      setApp(next);
      // Pending changes are announced once, not on every keystroke.
      if (!dirty.current) setSave({ kind: "saving" });
      dirty.current = true;
      schedule();
    },
    [schedule, setSave],
  );

  // Header save indicator, flush-before-sign-out, retry, and leaving the page with unsaved work.
  useEffect(() => {
    setSave({ kind: "saved", at: Date.parse(props.savedAt) });
    flushRef.current = async () => {
      await runSave(false);
    };
    retryRef.current = () => void runSave(false);
    const onHide = () => document.visibilityState === "hidden" && void runSave(false);
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current || inflight.current) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
      window.clearTimeout(timer.current);
      if (dirty.current) void runSave(false);
      flushRef.current = null;
      retryRef.current = null;
      setSave({ kind: "hidden" });
    };
  }, [props.savedAt, runSave, setSave, flushRef, retryRef]);

  const go = async (to: InsStepKey, kind: "prev" | "nav" = "nav") => {
    setBusy(kind);
    await runSave(false);
    router.push(`${BASE}/${to}`);
  };

  const clientErrors = () => {
    const cur = appRef.current;
    const ctx = insContextFor(cur, { requireVerifiedMobile: otp === "screen", hasAccount: bank.hasAccount });
    return { ...insCheckStep(step, cur, ctx), ...insRejectedFileErrors(step, cur, reviews) };
  };

  const next = async () => {
    const found = clientErrors();
    if (Object.keys(found).length) {
      setErrors(found);
      void runSave(false);
      toast("Please complete the highlighted fields.", { tone: "error" });
      focusFirstError();
      return;
    }
    setBusy("next");
    const res = await runSave(true);
    if (res?.ok && res.next) {
      router.push(`${BASE}/${res.next}`);
      return;
    }
    setBusy(null);
    if (res && !res.ok) {
      if (res.fieldErrors && Object.keys(res.fieldErrors).length) {
        setErrors(res.fieldErrors);
        focusFirstError();
      }
      toast(res.error ?? "Couldn't save this step.", { tone: "error" });
    }
  };

  const saveDraft = async () => {
    setBusy("draft");
    dirty.current = true;
    const res = await runSave(false);
    setBusy(null);
    if (res?.ok) toast("Draft saved. You can come back any time.", { tone: "success" });
    else if (res && !res.ok) toast(res.error ?? "Couldn't save.", { tone: "error" });
  };

  const review = useMemo(
    () => (step === "documents" ? insCheckApplication(app, checkCtx).map((s) => ({ ...s, errors: { ...s.errors, ...insRejectedFileErrors(s.key, app, reviews) } })) : []),
    [step, app, checkCtx, reviews],
  );
  const incomplete = review.filter((s) => Object.keys(s.errors).length > 0);

  const openSubmit = () => {
    const found = clientErrors();
    const declaration = Object.fromEntries(Object.entries(found).filter(([k]) => k.startsWith("declaration")));
    if (incomplete.length) {
      setErrors(found);
      toast(`Complete ${incomplete.map((s) => s.title).join(", ")} first.`, { tone: "error" });
      document.getElementById(`review-${incomplete[0].key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (Object.keys(declaration).length) {
      setErrors(found);
      focusFirstError();
      return;
    }
    setConfirm(true);
  };

  const submit = async () => {
    setBusy("submit");
    await runSave(false);
    const res: InsSubmitResult = await submitInsApplicationAction({ declaration: appRef.current.declaration }).catch((): InsSubmitResult => ({ ok: false, error: "Couldn't reach the server. Check your connection." }));
    if (res.ok) {
      setConfirm(false);
      dirty.current = false;
      toast(resubmission ? "Application resubmitted." : "Application submitted.", { tone: "success" });
      router.push(res.next);
      router.refresh();
      return;
    }
    setBusy(null);
    setConfirm(false);
    if (res.fieldErrors && Object.keys(res.fieldErrors).length) {
      setErrors(res.fieldErrors);
      focusFirstError();
    }
    toast(res.error ?? "Couldn't submit.", { tone: "error" });
  };

  const here = corrections.filter((c) => c.step === step);
  const elsewhere = corrections.filter((c) => c.step !== step);
  const nextStep = n < INS_STEPS.length ? INS_STEPS[n] : null;
  const prevStep = n > 1 ? INS_STEPS[n - 2] : null;

  const common = { app, errors, clear, reviews };
  let body: React.ReactNode;
  switch (step) {
    case "contact":
      body = (
        <ContactStep
          {...common}
          value={app.contact}
          onChange={(v) => change("contact", v)}
          otp={otp}
          onVerified={(channel, target) => {
            const c = appRef.current.contact;
            const nextApp = { ...appRef.current, contact: channel === "mobile" ? { ...c, mobile: target, mobileVerified: true } : { ...c, email: target, emailVerified: true } };
            appRef.current = nextApp;
            setApp(nextApp);
            clear(channel);
          }}
        />
      );
      break;
    case "company":
      body = <CompanyStep {...common} value={app.company} onChange={(v) => change("company", v)} />;
      break;
    case "registration":
      body = <RegistrationStep {...common} value={app.registration} onChange={(v) => change("registration", v)} />;
      break;
    case "regulatory":
      body = <RegulatoryStep {...common} value={app.regulatory} onChange={(v) => change("regulatory", v)} />;
      break;
    case "branches":
      body = <BranchesStep {...common} value={app.branches} onChange={(v) => change("branches", v)} />;
      break;
    case "bank":
      body = <BankStep {...common} value={app.bank} onChange={(v) => change("bank", v)} bank={bank} />;
      break;
    case "documents":
      body = (
        <DocumentsStep
          app={app}
          documents={app.documents}
          declaration={app.declaration}
          onDocuments={(fn) => change("documents", fn)}
          onDeclaration={(fn) => change("declaration", fn)}
          errors={errors}
          clear={clear}
          reviews={reviews}
          bank={bank}
          checks={review}
          onEdit={(to) => void go(to)}
          signedOn={props.today}
        />
      );
      break;
  }

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-0 pt-8 md:px-8 md:pt-12">
      <div className="grid gap-8 lg:grid-cols-[252px_minmax(0,1fr)] lg:gap-12">
        {/* Desktop progress rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <StepRail current={n} furthest={furthest} onGo={(s) => void go(s)} busy={busy !== null} />
            <div className="border border-line bg-white p-4 text-[12.5px] text-muted">
              <p className="flex items-center justify-between gap-2">
                <span>Application</span>
                <span className="font-medium text-ink num">{reference}</span>
              </p>
              <p className="mt-1.5 flex items-center justify-between gap-2">
                <span>Status</span>
                <span className="font-medium text-ink">{statusLabel}</span>
              </p>
              <p className="mt-3 border-t border-line pt-3 leading-relaxed">Everything you enter is saved automatically. You can sign out and continue later from any device.</p>
              <Link href="/insurance-vendor/application-status" className="mt-3 inline-block font-medium text-ink underline-offset-4 hover:text-red hover:underline">
                Application status →
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {/* Mobile progress */}
          <div className="mb-7 lg:hidden">
            <div className="flex items-center justify-between gap-3 text-[12.5px]">
              <span className="font-medium text-ink">
                Step {n} of {INS_STEPS.length}
                <span className="text-muted"> · {reference}</span>
              </span>
              <button type="button" onClick={() => setStepsOpen((o) => !o)} aria-expanded={stepsOpen} className="inline-flex items-center gap-1 font-medium text-muted hover:text-ink">
                All steps <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-300", stepsOpen && "rotate-180")} />
              </button>
            </div>
            <div className="mt-2.5 grid grid-cols-7 gap-1" aria-hidden>
              {INS_STEPS.map((s) => (
                <span key={s.key} className={cn("h-1 rounded-full transition-colors duration-500", s.n === n ? "bg-red" : s.n < furthest || s.n < n ? "bg-ink" : "bg-line")} />
              ))}
            </div>
            {stepsOpen && (
              <div className="mt-3 animate-rise border border-line bg-white p-2">
                <StepRail current={n} furthest={furthest} onGo={(s) => void go(s)} busy={busy !== null} compact />
              </div>
            )}
          </div>

          <header className="mb-7 md:mb-9">
            <p className="type-eyebrow text-red">
              Step {n} of {INS_STEPS.length}
            </p>
            <h1 className="mt-2 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[34px]">{step === "documents" && resubmission ? "Documents & resubmission" : INS_STEPS[n - 1].title}</h1>
            <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-muted">{INTRO[step]}</p>
          </header>

          {resubmission && (remarks || corrections.length > 0) && (
            <Note tone="warn" className="mb-6" title={status === "documents_required" ? "MarchGear needs more documents" : "MarchGear asked for changes"}>
              {remarks && <p className="whitespace-pre-line">“{remarks}”</p>}
              {here.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {here.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden>·</span>
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              {elsewhere.length > 0 && (
                <p className="mt-2">
                  {here.length ? "Also requested in: " : "Requested in: "}
                  {[...new Set(elsewhere.map((c) => c.step))].map((s, i) => (
                    <span key={s}>
                      {i > 0 && ", "}
                      <button type="button" onClick={() => void go(s)} className="font-medium underline underline-offset-4 hover:text-ink">
                        {INS_STEPS.find((x) => x.key === s)?.title} ({elsewhere.filter((c) => c.step === s).length})
                      </button>
                    </span>
                  ))}
                </p>
              )}
              <p className="mt-2 text-[12.5px]">When everything&apos;s fixed, resubmit from step 7.</p>
            </Note>
          )}

          <div key={step} className="animate-rise space-y-6">
            {body}
          </div>

          {/* Footer navigation */}
          <div className="sticky bottom-0 z-30 -mx-4 mt-10 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8 lg:mx-0 lg:mb-10 lg:border lg:px-5">
            <div className="flex items-center justify-between gap-2">
              {prevStep ? (
                <Button
                  variant="ghost"
                  onClick={() => void go(prevStep.key, "prev")}
                  disabled={busy !== null}
                  icon={busy === "prev" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowLeft aria-hidden className="size-4" />}
                  className="px-3 sm:px-5"
                >
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void saveDraft()}
                  disabled={busy !== null}
                  icon={busy === "draft" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />}
                  className="px-3 sm:px-5"
                >
                  <span className="hidden sm:inline">Save draft</span>
                  <span className="sm:hidden">Save</span>
                </Button>
                {nextStep ? (
                  <Button onClick={() => void next()} disabled={busy !== null} arrow={busy !== "next"} icon={busy === "next" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : undefined} className="px-4 sm:px-5">
                    <span>
                      Next<span className="hidden md:inline">: {INS_STEP_SHORT[nextStep.key]}</span>
                    </span>
                  </Button>
                ) : (
                  <Button onClick={openSubmit} disabled={busy !== null} icon={<Send aria-hidden className="size-4" />} className="px-4 sm:px-5">
                    <span>
                      {resubmission ? "Resubmit" : "Submit"}
                      <span className="hidden sm:inline"> application</span>
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={confirm} onClose={() => busy !== "submit" && setConfirm(false)} title={resubmission ? "Resubmit your application?" : "Submit your application?"} size="md">
        <div className="space-y-5 px-6 py-6 sm:px-8">
          <ol className="space-y-3 text-[14px]">
            {[
              "MarchGear's vendor team verifies your company, regulatory registration, branches, bank account and documents.",
              "You'll see every update on your application status page and in notifications.",
              "Once approved, the full portal opens — products, quote requests, renewals, campaigns and analytics.",
            ].map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-mist text-[12px] font-semibold num">{i + 1}</span>
                <span className="pt-0.5 leading-relaxed">{t}</span>
              </li>
            ))}
          </ol>
          <Note tone="info">Your application is locked while it&apos;s under review. If anything needs changing, we&apos;ll reopen it and tell you exactly what. Verified details can be changed later from your company profile.</Note>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={busy === "submit"}>
              Not yet
            </Button>
            <Button onClick={() => void submit()} disabled={busy === "submit"} data-autofocus icon={busy === "submit" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ClipboardCheck aria-hidden className="size-4" />}>
              {busy === "submit" ? "Submitting…" : resubmission ? "Resubmit application" : "Submit application"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StepRail({ current, furthest, onGo, busy, compact }: { current: number; furthest: number; onGo: (s: InsStepKey) => void; busy: boolean; compact?: boolean }) {
  return (
    <nav aria-label="Application steps">
      <ol className={cn(!compact && "relative")}>
        {INS_STEPS.map((s, i) => {
          const done = s.n < furthest && s.n !== current;
          const isCurrent = s.n === current;
          const locked = s.n > furthest;
          const content = (
            <>
              <span
                className={cn(
                  "relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors duration-500 num",
                  isCurrent && "border-red bg-white text-red shadow-[0_0_0_4px_rgba(227,30,36,0.08)]",
                  done && "border-ink bg-ink text-white",
                  !isCurrent && !done && !locked && "border-ink/30 bg-white text-ink",
                  locked && "border-line bg-white text-muted",
                )}
              >
                {done ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : locked ? <Lock aria-hidden className="size-3" /> : s.n}
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate text-[13.5px]", isCurrent ? "font-semibold text-ink" : locked ? "text-muted" : "text-ink/80")}>{s.title}</span>
                {!compact && <span className="block text-[11.5px] text-muted">{isCurrent ? "In progress" : done ? "Completed" : locked ? "Locked" : "Ready"}</span>}
              </span>
            </>
          );
          return (
            <li key={s.key} className="relative">
              {!compact && i < INS_STEPS.length - 1 && <span aria-hidden className={cn("absolute left-[13.5px] top-9 h-[calc(100%-28px)] w-px", s.n < furthest ? "bg-ink/70" : "bg-line")} />}
              {locked || isCurrent ? (
                <span aria-current={isCurrent ? "step" : undefined} className={cn("flex items-center gap-3 rounded-[3px] px-1 py-2", locked && "cursor-not-allowed", !compact && "pb-4")}>
                  {content}
                </span>
              ) : (
                <Link
                  href={`${BASE}/${s.key}`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!busy) onGo(s.key);
                  }}
                  className={cn("flex items-center gap-3 rounded-[3px] px-1 py-2 transition-colors hover:bg-white", !compact && "pb-4")}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
