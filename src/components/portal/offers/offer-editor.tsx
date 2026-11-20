"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  Copy,
  Eye,
  Loader2,
  MessageSquareWarning,
  Plus,
  Send,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { useUI } from "@/components/providers/app-provider";
import { PortalHeader } from "@/components/portal/ui";
import { OfferCard } from "@/components/offers/offer-card";
import { formatIst, fromIstParts } from "@/components/offers/offer-utils";
import type { OfferStatus } from "@/db/enums";
import type { OfferDisplayStatus } from "@/partner/labels";
import { checkOfferAction, duplicateOfferAction, saveOfferDraftAction, submitOfferAction, withdrawOfferAction } from "@/server/actions/partner-offers";
import { OFFER_LIVE_STATUSES, OFFER_STEPS, stepOfField, type EditorOptions, type OfferInput, type OfferStepKey, type OfferTemplateView } from "./offer-input";
import { BasicsSection, DiscountSection, LocationSection, MediaSection, ValiditySection, VehiclesSection } from "./offer-sections";
import { BannerPreview, ReviewSection, previewData } from "./offer-review";
import { Callout, Meter, StatusPill } from "./offer-ui";

type Issues = Record<string, string>;
type Failure = { ok: false; error?: string; fieldErrors?: Issues };

export interface EditorOffer {
  id: number;
  reference: string;
  status: OfferStatus;
  display: OfferDisplayStatus;
  adminRemarks: string | null;
}

const AUTOSAVE_MS = 1200;

export function OfferEditor({
  offer,
  initial,
  template,
  options,
  initialStep,
  standardTerms,
  renderedAt,
}: {
  offer: EditorOffer | null;
  initial: OfferInput;
  template: OfferTemplateView | null;
  options: EditorOptions;
  initialStep?: OfferStepKey;
  standardTerms: string;
  renderedAt: number;
}) {
  const live = Boolean(offer && OFFER_LIVE_STATUSES.includes(offer.status));
  const { toast } = useUI();
  const [input, setInput] = useState(initial);
  const [step, setStep] = useState<OfferStepKey>(initialStep ?? "basics");
  const [issues, setIssues] = useState<Issues>({});
  const [serverErrors, setServerErrors] = useState<Issues>({});
  const [checked, setChecked] = useState(false);
  const [shown, setShown] = useState<Set<OfferStepKey>>(() => new Set(initialStep || offer?.status === "changes_requested" ? OFFER_STEPS.map((s) => s.key) : []));
  const [save, setSave] = useState<{ state: "idle" | "dirty" | "saving" | "saved" | "error"; at?: string; error?: string }>({ state: "idle" });
  const [reference, setReference] = useState(offer?.reference ?? null);
  const [confirm, setConfirm] = useState(false);
  const [confirmError, setConfirmError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: number; reference: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const idRef = useRef<number | null>(offer?.id ?? null);
  const rev = useRef(0);
  const latest = useRef(input);
  /** Every save/check runs strictly after the previous one, so a new draft is only ever inserted once. */
  const chain = useRef<Promise<Issues | null>>(Promise.resolve(null));
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    latest.current = input;
  }, [input]);

  const update = useCallback((fn: (d: OfferInput) => OfferInput) => {
    setInput((d) => fn(d));
    rev.current += 1;
    setTick((t) => t + 1);
    setSave((s) => (s.state === "saving" ? s : { ...s, state: "dirty" }));
  }, []);

  const applyFailure = useCallback((f: Failure) => {
    if (f.fieldErrors && Object.keys(f.fieldErrors).length) {
      setServerErrors(f.fieldErrors);
      setShown((s) => new Set([...s, ...Object.keys(f.fieldErrors!).map(stepOfField)]));
    }
  }, []);

  /** Saves the draft (or, for an approved offer, only re-checks it). Resolves with the fresh issues. */
  const sync = useCallback((): Promise<Issues | null> => {
    const run = async (): Promise<Issues | null> => {
      const at = rev.current;
      const data = latest.current;
      const checkOnly = live || (!idRef.current && at === 0);
      if (!checkOnly) setSave((s) => ({ ...s, state: "saving" }));
      try {
        if (checkOnly) {
          const r = await checkOfferAction({ ...data, id: idRef.current ?? undefined });
          if (!r.ok) {
            applyFailure(r as Failure);
            return null;
          }
          setIssues(r.issues);
          setChecked(true);
          return r.issues;
        }
        const r = await saveOfferDraftAction({ ...data, id: idRef.current ?? undefined });
        if (!r.ok) {
          applyFailure(r as Failure);
          setSave({ state: "error", error: (r as Failure).error ?? "Couldn't save." });
          return null;
        }
        if (!idRef.current) {
          idRef.current = r.id;
          setReference(r.reference);
          window.history.replaceState(null, "", `/dealer/offers/${r.id}/edit`);
        }
        setIssues(r.issues);
        setServerErrors({});
        setChecked(true);
        setSave({ state: rev.current === at ? "saved" : "dirty", at: r.savedAt });
        return r.issues;
      } catch {
        if (!checkOnly) setSave({ state: "error", error: "Couldn't reach the server — your latest changes aren't saved yet." });
        return null;
      }
    };
    const next = chain.current.then(run, run);
    chain.current = next;
    return next;
  }, [live, applyFailure]);

  // Readiness on first load, then autosave (or re-check) a moment after each change.
  useEffect(() => {
    if (tick === 0) {
      void sync();
      return;
    }
    const t = setTimeout(() => void sync(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [tick, sync]);

  // Don't lose work: warn before leaving with unsaved changes.
  useEffect(() => {
    const dirty = !done && (save.state === "dirty" || save.state === "saving" || save.state === "error" || (live && tick > 0));
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [save.state, live, tick, done]);

  const merged = { ...issues, ...serverErrors };
  const err = (path: string) => serverErrors[path] ?? (shown.has(stepOfField(path)) ? issues[path] : undefined);
  const countFor = (k: OfferStepKey) => Object.keys(merged).filter((p) => p !== "confirmTerms" && stepOfField(p) === k).length;
  const formSteps = OFFER_STEPS.filter((s) => s.key !== "review");
  const ready = formSteps.filter((s) => checked && !countFor(s.key)).length;
  const index = OFFER_STEPS.findIndex((s) => s.key === step);

  const goTo = (k: OfferStepKey) => {
    setStep(k);
    requestAnimationFrame(() => {
      const y = (top.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 88;
      if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    });
  };

  const next = async () => {
    setShown((s) => new Set(s).add(step));
    const fresh = await sync();
    const mine = Object.keys(fresh ?? merged).filter((p) => p !== "confirmTerms" && stepOfField(p) === step);
    if (mine.length) {
      toast(mine.length === 1 ? "Fix the highlighted field to continue." : `Fix the ${mine.length} highlighted fields to continue.`, { tone: "error" });
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true'], .offer-step-error")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    goTo(OFFER_STEPS[Math.min(index + 1, OFFER_STEPS.length - 1)].key);
  };

  const saveNow = async () => {
    const fresh = await sync();
    if (fresh) toast("Draft saved", { tone: "success" });
  };

  const submit = async () => {
    setShown(new Set(OFFER_STEPS.map((s) => s.key)));
    if (!confirm) setConfirmError("Please confirm the offer details and terms before submitting");
    setSubmitting(true);
    await chain.current;
    try {
      const r = await submitOfferAction({ ...latest.current, id: idRef.current ?? undefined, confirmTerms: confirm });
      if (!r.ok) {
        const f = r as Failure;
        if (f.fieldErrors) {
          const { confirmTerms, ...rest } = f.fieldErrors;
          setIssues(rest);
          setServerErrors({});
          setConfirmError(confirmTerms);
        }
        toast(f.error ?? "Couldn't submit the offer.", { tone: "error" });
        return;
      }
      idRef.current = r.id;
      rev.current = 0;
      setSave({ state: "saved", at: new Date().toISOString() });
      window.history.replaceState(null, "", `/dealer/offers/${r.id}/edit`);
      setDone({ id: r.id, reference: r.reference });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      toast("Couldn't reach the server. Check your connection and try again.", { tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return <Submitted done={done} input={input} live={live} />;

  const props = { input, update, err, options };
  const current = OFFER_STEPS[index];
  const card = previewData(input, options);

  return (
    <div ref={top}>
      <PortalHeader
        title={offer ? (live ? "Edit approved offer" : "Edit offer") : "Create offer"}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {reference ? <span className="font-mono text-[12.5px] text-ink/70">{reference}</span> : <span>New offer</span>}
            {offer && <StatusPill status={offer.display} />}
            {template && !offer && <span className="text-muted">· from the {template.name} template</span>}
          </span>
        }
        back={{ href: "/dealer/offers", label: "Offers" }}
        actions={
          <>
            <SaveState save={save} live={live} dirty={tick > 0} />
            <Button variant="outline" size="sm" className="2xl:hidden" onClick={() => setPreviewOpen(true)} icon={<Eye className="size-4" aria-hidden />}>
              Preview
            </Button>
            {!live && (
              <Button variant="outline" size="sm" onClick={saveNow} disabled={save.state === "saving"}>
                Save draft
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 space-y-3">
        {offer?.status === "changes_requested" && offer.adminRemarks && (
          <Callout tone="amber" icon={<MessageSquareWarning />} title="MarchGear asked for changes">
            <p className="whitespace-pre-line">{offer.adminRemarks}</p>
          </Callout>
        )}
        {live && (
          <Callout tone="amber" icon={<AlertTriangle />} title="Changes to an approved offer go back for approval">
            Nothing is saved until you resubmit in section G. Until then the approved version {offer?.display === "active" ? "stays live" : "is unchanged"}; after resubmitting, the offer is off the website until MarchGear approves it again.
          </Callout>
        )}
      </div>

      {/* Mobile / tablet stepper */}
      <nav aria-label="Offer sections" className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 lg:hidden">
        {OFFER_STEPS.map((s) => {
          const n = countFor(s.key);
          const bad = n > 0 && shown.has(s.key);
          const ok = s.key !== "review" && checked && !n;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => goTo(s.key)}
              aria-current={step === s.key ? "step" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                step === s.key ? "border-ink bg-ink text-white" : bad ? "border-red/40 bg-red-50 text-red" : "border-line bg-white text-ink/80",
              )}
            >
              <span className="font-mono text-[11px] opacity-70">{s.letter}</span>
              {s.title.split(" ")[0]}
              {ok && step !== s.key && <Check aria-hidden className="size-3.5 text-[#1e7a3c]" />}
            </button>
          );
        })}
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[228px_minmax(0,1fr)] 2xl:grid-cols-[228px_minmax(0,1fr)_320px]">
        {/* Desktop stepper */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <ol className="relative">
              <span aria-hidden className="absolute bottom-5 left-[15px] top-5 w-px bg-line" />
              {OFFER_STEPS.map((s) => {
                const n = countFor(s.key);
                const bad = n > 0 && shown.has(s.key);
                const ok = s.key === "review" ? ready === formSteps.length : checked && !n;
                const active = step === s.key;
                return (
                  <li key={s.key} className="relative">
                    <button type="button" onClick={() => goTo(s.key)} aria-current={active ? "step" : undefined} className="group/s flex w-full items-start gap-3 py-2.5 text-left">
                      <span
                        className={cn(
                          "relative z-[1] inline-flex size-[31px] shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors duration-300",
                          active ? "border-red bg-red text-white" : bad ? "border-red/40 bg-red-50 text-red" : ok ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/70 group-hover/s:border-ink/40",
                        )}
                      >
                        {ok && !active ? <Check aria-hidden className="size-3.5" /> : s.letter}
                      </span>
                      <span className="min-w-0 pt-1">
                        <span className={cn("block text-[13.5px] leading-tight", active ? "font-semibold text-ink" : "font-medium text-ink/80")}>{s.title}</span>
                        <span className={cn("mt-0.5 block text-[11.5px] leading-snug", bad ? "text-red" : "text-muted")}>{bad ? `${n} to fix` : s.hint}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-5 border-t border-line pt-4">
              <p className="flex items-baseline justify-between text-[12px] text-muted">
                <span>Ready to submit</span>
                <span className="font-semibold text-ink num">
                  {ready}/{formSteps.length}
                </span>
              </p>
              <Meter value={ready / formSteps.length} tone={ready === formSteps.length ? "green" : "red"} className="mt-2" />
            </div>
          </div>
        </aside>

        {/* Section */}
        <div className="min-w-0">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="type-eyebrow text-red">Section {current.letter}</p>
              <h2 className="mt-2 font-display text-[24px] font-semibold leading-tight tracking-[-0.02em]">{current.title}</h2>
            </div>
            <p className="hidden shrink-0 text-[12.5px] text-muted sm:block num">
              {index + 1} of {OFFER_STEPS.length}
            </p>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE }}>
              {step === "basics" && <BasicsSection {...props} standardTerms={standardTerms} />}
              {step === "vehicles" && <VehiclesSection {...props} />}
              {step === "discount" && <DiscountSection {...props} />}
              {step === "validity" && <ValiditySection {...props} template={template} renderedAt={renderedAt} />}
              {step === "media" && <MediaSection {...props} />}
              {step === "location" && <LocationSection {...props} />}
              {step === "review" && (
                <ReviewSection
                  input={input}
                  options={options}
                  issues={checked ? merged : {}}
                  goTo={goTo}
                  confirm={confirm}
                  setConfirm={(v) => {
                    setConfirm(v);
                    if (v) setConfirmError(undefined);
                  }}
                  confirmError={confirmError}
                  renderedAt={renderedAt}
                  live={live}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            {index > 0 ? (
              <Button variant="ghost" onClick={() => goTo(OFFER_STEPS[index - 1].key)} icon={<ArrowLeft className="size-4" aria-hidden />}>
                {OFFER_STEPS[index - 1].title}
              </Button>
            ) : (
              <span />
            )}
            {step === "review" ? (
              <Button size="lg" onClick={submit} disabled={submitting} icon={submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}>
                {submitting ? "Submitting…" : live ? "Resubmit for approval" : "Submit for approval"}
              </Button>
            ) : (
              <Button variant="dark" onClick={next} disabled={save.state === "saving" && !live}>
                Continue to {OFFER_STEPS[index + 1].title.toLowerCase()} <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>

        {/* Live preview (wide screens) */}
        <aside className="hidden 2xl:block">
          <div className="sticky top-24 space-y-4">
            <p className="type-eyebrow text-muted">Live preview</p>
            <OfferCard offer={card} renderedAt={renderedAt} />
            <p className="text-[12px] leading-relaxed text-muted">Updates as you type. The full banner preview is in section G.</p>
          </div>
        </aside>
      </div>

      <Drawer open={previewOpen} onClose={() => setPreviewOpen(false)} title="Live preview" className="max-w-lg">
        <div className="space-y-6 p-5">
          <BannerPreview input={input} card={card} renderedAt={renderedAt} />
          <div>
            <p className="mb-3 text-[12.5px] font-medium">Offer card</p>
            <OfferCard offer={card} renderedAt={renderedAt} />
          </div>
        </div>
      </Drawer>
    </div>
  );
}

function SaveState({ save, live, dirty }: { save: { state: string; at?: string; error?: string }; live: boolean; dirty: boolean }) {
  let icon: ReactNode = <Cloud className="size-4" aria-hidden />;
  let text = "Autosaves as you type";
  let cls = "text-muted";
  if (live) {
    icon = <AlertTriangle className="size-4" aria-hidden />;
    text = dirty ? "Unsaved — resubmit to apply" : "Editing an approved offer";
    cls = dirty ? "text-[#9a5b00]" : "text-muted";
  } else if (save.state === "saving") {
    icon = <Loader2 className="size-4 animate-spin" aria-hidden />;
    text = "Saving…";
  } else if (save.state === "dirty") {
    icon = <Cloud className="size-4" aria-hidden />;
    text = "Unsaved changes";
  } else if (save.state === "saved" && save.at) {
    icon = <CheckCircle2 className="size-4 text-[#1e7a3c]" aria-hidden />;
    text = `Saved ${new Date(save.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}`;
  } else if (save.state === "error") {
    icon = <CloudOff className="size-4 text-red" aria-hidden />;
    text = save.error ?? "Not saved";
    cls = "text-red";
  }
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex h-9 max-w-[280px] items-center gap-1.5 truncate px-1 text-[12.5px]", cls)} title={text}>
      {icon}
      <span className="truncate">{text}</span>
    </span>
  );
}

function Submitted({ done, input, live }: { done: { id: number; reference: string }; input: OfferInput; live: boolean }) {
  const start = fromIstParts(input.startDate, input.startTime);
  const end = fromIstParts(input.endDate, input.endTime);
  const [now] = useState(() => Date.now());
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="mx-auto max-w-2xl border border-line bg-white px-6 py-14 text-center md:px-12">
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.15 }}
        className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-red text-white"
      >
        <Check className="size-7" strokeWidth={2.5} aria-hidden />
      </motion.span>
      <h2 className="type-h2 mt-6">{live ? "Resubmitted for approval" : "Sent for approval"}</h2>
      <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-muted">
        MarchGear reviews every offer before it goes live. You&apos;ll get a notification here when it&apos;s reviewed.
        {start && end ? ` Once approved it ${start.getTime() > now ? `goes live on ${formatIst(start)}` : "goes live straight away"} and expires automatically on ${formatIst(end)}.` : ""}
      </p>
      <div className="mx-auto mt-6 inline-flex items-center gap-3 border border-line px-4 py-2.5 text-[13px]">
        <span className="text-muted">Offer reference</span>
        <span className="font-mono font-semibold tracking-wider">{done.reference}</span>
      </div>
      <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
        <Button href="/dealer/offers?status=pending" variant="dark">
          Back to offers
        </Button>
        <Button href="/dealer/offers/create" variant="outline" icon={<Plus className="size-4" aria-hidden />}>
          Create another
        </Button>
        <Button href="/dealer/campaigns" variant="ghost" icon={<CalendarDays className="size-4" aria-hidden />}>
          Campaign calendar
        </Button>
      </div>
    </motion.div>
  );
}

/** Shown instead of the editor when the offer can't be edited right now (in review, rejected, cancelled). */
export function LockedOffer({ offer, input, options, renderedAt, canManage }: { offer: EditorOffer & { title: string }; input: OfferInput; options: EditorOptions; renderedAt: number; canManage: boolean }) {
  const router = useRouter();
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const review = offer.display === "pending_approval" || offer.display === "submitted";
  const kind = review ? "review" : offer.display === "rejected" ? "rejected" : offer.display === "cancelled" ? "cancelled" : "readonly";
  const card = previewData(input, options);

  const act = async () => {
    setBusy(true);
    try {
      if (review) {
        const r = await withdrawOfferAction({ id: offer.id });
        if (!r.ok) return toast((r as Failure).error ?? "Couldn't withdraw the offer.", { tone: "error" });
        toast("Withdrawn — you can edit the offer now", { tone: "success" });
        router.refresh();
      } else {
        const r = await duplicateOfferAction({ id: offer.id, mode: "duplicate" });
        if (!r.ok) return toast((r as Failure).error ?? "Couldn't duplicate the offer.", { tone: "error" });
        toast(`Duplicated as draft ${r.reference}`, { tone: "success" });
        router.push(`/dealer/offers/${r.id}/edit`);
      }
    } catch {
      toast("Couldn't reach the server. Check your connection.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PortalHeader
        title={offer.title || "Untitled offer"}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12.5px] text-ink/70">{offer.reference}</span>
            <StatusPill status={offer.display} />
          </span>
        }
        back={{ href: "/dealer/offers", label: "Offers" }}
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="border border-line bg-white p-6 md:p-8">
            <span className={cn("inline-flex size-11 items-center justify-center rounded-full", review ? "bg-[#eef3fc] text-[#2456a6]" : "bg-mist text-ink")}>
              {review ? <Loader2 className="size-5 animate-spin [animation-duration:3s]" aria-hidden /> : <Copy className="size-5" aria-hidden />}
            </span>
            <h2 className="type-h3 mt-4">{{ review: "With MarchGear for review", rejected: "This offer was rejected", cancelled: "This offer was cancelled", readonly: "View only" }[kind]}</h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted">
              {kind === "review"
                ? "Edits are locked while the offer is being reviewed, so what MarchGear approves is exactly what goes live. Withdraw it to make changes — you'll need to submit it again."
                : kind === "readonly"
                  ? "You can see this offer but not change it. Ask your dealership's owner, administrator or marketing manager for offer permissions."
                  : "Rejected and cancelled offers can't be edited or resubmitted. Duplicate it to start a fresh draft with the same details."}
            </p>
            {offer.adminRemarks && (
              <Callout tone={offer.display === "rejected" ? "red" : "amber"} icon={<MessageSquareWarning />} title="Remarks from MarchGear" className="mt-5">
                <p className="whitespace-pre-line">{offer.adminRemarks}</p>
              </Callout>
            )}
            {canManage && kind !== "readonly" && (
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Button onClick={act} disabled={busy} variant={review ? "dark" : "primary"} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : review ? <Undo2 className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}>
                  {review ? "Withdraw to edit" : "Duplicate as new draft"}
                </Button>
                <Button href="/dealer/offers" variant="ghost">
                  Back to offers
                </Button>
              </div>
            )}
          </section>
          <section className="border border-line bg-white p-6">
            <BannerPreview input={input} card={card} renderedAt={renderedAt} />
          </section>
        </div>
        <aside className="space-y-3">
          <p className="type-eyebrow text-muted">Offer card</p>
          <OfferCard offer={card} renderedAt={renderedAt} priority />
        </aside>
      </div>
    </div>
  );
}
