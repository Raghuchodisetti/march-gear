"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, FileText, Loader2, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/field";
import { Honeypot } from "@/components/forms/honeypot";
import { useUI, useUser } from "@/components/providers/app-provider";
import type { InsuranceSearch } from "@/insurance/types";
import { isSearchReady, searchQuery } from "@/insurance/search";
import { INDICATIVE_NOTE } from "@/insurance/labels";
import { submitInsuranceEnquiryAction, type EnquiryReceipt } from "@/server/actions/insurance-public";
import type { MarketProduct } from "./engine";
import { trackInsurance } from "./track";
import { CompanyLogo, inr } from "./ui";
import { VehiclePicker, blankSearch } from "./vehicle-picker";

export interface RequestItem {
  product: MarketProduct;
  /** The indicative premium the customer saw (incl. GST), if a car was chosen. */
  total: number | null;
  /** The sponsored listing (ad campaign) the plan was picked from. */
  sponsoredCampaignId?: number | null;
}

export interface RequestQuoteProps {
  open: boolean;
  onClose: () => void;
  items: RequestItem[];
  /** The customer's car; null (or not enough) → the form asks for it. */
  search: InsuranceSearch | null;
  addOns: string[];
  idv?: Record<number, number>;
  source: string;
  campaignId?: number | null;
  adCampaignId?: number | null;
  thisYear: number;
  maxAgeYears: number;
  onDone?: (receipts: EnquiryReceipt[]) => void;
}

const NETWORK_ERROR = "Couldn't send — check your connection and try again.";

/** The quote request (one enquiry per plan). The modal unmounts its content when closed, so each opening starts fresh. */
export function RequestQuoteModal(props: RequestQuoteProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} bare size="lg" labelledBy="rq-title">
      {props.items.length > 0 && <RequestForm key={props.items.map((i) => i.product.id).join(",")} {...props} />}
    </Modal>
  );
}

function RequestForm({ items, search, addOns, idv, source, campaignId, adCampaignId, thisYear, maxAgeYears, onClose, onDone }: RequestQuoteProps) {
  const { user } = useUser();
  const { toast } = useUI();
  const router = useRouter();
  const needsVehicle = !search || !isSearchReady(search);
  const [vehicle, setVehicle] = useState<InsuranceSearch>(() => (search && isSearchReady(search) ? search : (search ?? blankSearch())));
  const [name, setName] = useState(user?.name ?? "");
  const [mobile, setMobile] = useState((user?.phone ?? "").replace(/\D/g, "").slice(-10));
  const [email, setEmail] = useState(user?.email ?? "");
  const [message, setMessage] = useState("");
  const [expiry, setExpiry] = useState(search?.expiry ?? "");
  const [previousInsurer, setPreviousInsurer] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [receipts, setReceipts] = useState<EnquiryReceipt[] | null>(null);
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    for (const i of items) trackInsurance("enquiry_cta", i.product.vendorId, i.product.id);
  }, [items]);

  const renewal = vehicle.intent === "renewal";
  const plural = items.length > 1;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const next: Record<string, string> = {};
    if (needsVehicle && !isSearchReady(vehicle)) next.vehicle = "Choose your car's brand and model";
    if (name.trim().length < 2) next.name = "Enter your full name";
    if (!/^[6-9]\d{9}$/.test(mobile)) next.mobile = "Enter a valid 10-digit mobile number";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address";
    if (renewal && !expiry) next.expiry = "Enter your current policy's expiry date";
    if (!consent) next.consent = "Please agree so the insurer can contact you";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    const params = Object.fromEntries(new URLSearchParams(searchQuery({ ...vehicle, expiry: renewal ? expiry : "" })));
    const sponsored: Record<string, number> = {};
    for (const i of items) if (i.sponsoredCampaignId) sponsored[String(i.product.id)] = i.sponsoredCampaignId;
    setSending(true);
    try {
      const res = await submitInsuranceEnquiryAction({
        productIds: items.map((i) => i.product.id),
        vehicle: params,
        addOns,
        idv: idv ? Object.fromEntries(Object.entries(idv).map(([k, v]) => [k, Math.round(v)])) : undefined,
        name: name.trim(),
        mobile,
        email: email.trim(),
        message: message.trim() || undefined,
        expiry: renewal ? expiry : "",
        previousInsurer: renewal ? previousInsurer.trim() || undefined : undefined,
        consent,
        source,
        campaignId: campaignId ?? null,
        adCampaignId: adCampaignId ?? null,
        sponsored,
        website,
      });
      setSending(false);
      if (!res.ok) {
        const fe = res.fieldErrors ?? {};
        setErrors({
          name: fe.name,
          mobile: fe.mobile,
          email: fe.email,
          message: fe.message,
          expiry: fe.expiry,
          consent: fe.consent,
          vehicle: fe.vehicle,
        } as Record<string, string>);
        setFormError(res.error ?? "Please check the highlighted fields.");
        return;
      }
      setReceipts(res.requests);
      onDone?.(res.requests);
      toast(plural ? "Quote requests sent" : "Quote request sent", { tone: "success" });
      if (user) router.refresh();
    } catch {
      setSending(false);
      setFormError(NETWORK_ERROR);
    }
  };

  if (receipts) {
    return (
      <div className="px-6 py-8 sm:px-10 sm:py-10">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="flex size-14 items-center justify-center rounded-full bg-red text-white"
        >
          <Check className="size-6" strokeWidth={2.5} aria-hidden />
        </motion.div>
        <h2 id="rq-title" className="type-h2 mt-6">
          {receipts.length > 1 ? "Requests sent" : "Request sent"}
        </h2>
        <p className="mt-3 max-w-lg text-[15px] text-muted">
          {receipts.length > 1 ? "Each insurer has your request." : "The insurer has your request."} Keep {receipts.length > 1 ? "these references" : "this reference"} — MarchGear doesn&apos;t send SMS or email confirmations.
        </p>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {receipts.map((r) => (
            <li key={r.reference} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3.5">
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-ink">{r.productName}</span>
                <span className="block text-[12.5px] text-muted">
                  {r.companyName}
                  {r.updated ? " · updated your earlier request" : ""}
                </span>
              </span>
              <span className="font-mono text-[13px] font-semibold tracking-wider text-ink">{r.reference}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-[3px] bg-mist px-5 py-4">
          <p className="type-eyebrow text-muted">What happens next</p>
          <ol className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-ink">
            <li>1. The insurer will contact you on +91 {mobile} about {receipts.length > 1 ? "each plan" : "this plan"}.</li>
            <li>2. They confirm your car&apos;s details and send a quotation — the premium they quote may differ from the indicative estimate.</li>
            <li>
              3.{" "}
              {user ? (
                <>
                  Quotes appear under{" "}
                  <Link href="/insurance/quotes#your-requests" className="font-medium underline underline-offset-4" onClick={onClose}>
                    Your quote requests
                  </Link>{" "}
                  on the quotes page while you&apos;re signed in.
                </>
              ) : (
                <>The insurer shares the quote with you directly. If you&apos;re signed in when you ask, quotes also appear on the quotes page.</>
              )}
            </li>
          </ol>
        </div>
        <Button variant="dark" className="mt-8 w-full sm:w-auto sm:min-w-40" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="relative">
      <Honeypot value={website} onChange={setWebsite} />
      <div className="flex items-start justify-between gap-6 border-b border-line px-6 py-5 sm:px-8">
        <div className="min-w-0">
          <p className="type-eyebrow text-muted">{plural ? `${items.length} plans` : "Request a quote"}</p>
          <h2 id="rq-title" className="type-h3 mt-2">
            {plural ? "Ask these insurers for a quote" : "Ask the insurer for a quote"}
          </h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-mist">
          <span aria-hidden className="text-xl leading-none">×</span>
        </button>
      </div>

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <ul className="divide-y divide-line border border-line">
          {items.map(({ product: p, total }) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <CompanyLogo company={p.company} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ink">{p.name}</span>
                <span className="block truncate text-[12px] text-muted">
                  {p.company.name}
                  {p.soldBy ? ` · sold by ${p.soldBy}` : ""}
                </span>
              </span>
              {total !== null && (
                <span className="shrink-0 text-right">
                  <span className="block text-[14px] font-semibold text-ink num">{inr(total)}</span>
                  <span className="block text-[10.5px] text-muted">indicative</span>
                </span>
              )}
            </li>
          ))}
        </ul>

        {needsVehicle && (
          <fieldset>
            <legend className="mb-3 text-[13px] font-semibold text-ink">Your car</legend>
            <VehiclePicker value={vehicle} onChange={setVehicle} thisYear={thisYear} maxAgeYears={maxAgeYears} errors={{ vehicle: errors.vehicle ?? "" }} />
            {errors.vehicle && <p className="mt-2 text-xs text-red">{errors.vehicle}</p>}
          </fieldset>
        )}

        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-[13px] font-semibold text-ink">Your details</legend>
          <TextField data-autofocus label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" placeholder="Your name" />
          <TextField
            label="Mobile number"
            prefix="+91"
            inputMode="numeric"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            error={errors.mobile}
            autoComplete="tel-national"
            placeholder="98765 43210"
          />
          <TextField label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="email" placeholder="you@example.com" className="sm:col-span-2" />
          {renewal && (
            <>
              <TextField label="Current policy expires on" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} error={errors.expiry} hint={errors.expiry ? undefined : "Needed for renewals"} />
              <TextField label="Current insurer (optional)" value={previousInsurer} onChange={(e) => setPreviousInsurer(e.target.value.slice(0, 160))} placeholder="e.g. your insurer's name" />
            </>
          )}
          <div className="sm:col-span-2">
            <TextArea label="Message (optional)" value={message} onChange={(e) => setMessage(e.target.value.slice(0, 1000))} rows={3} placeholder="Anything the insurer should know — preferred time to call, accessories fitted…" />
            {errors.message && <p className="mt-1.5 text-xs text-red">{errors.message}</p>}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-ink">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--color-red)]" aria-invalid={errors.consent ? true : undefined} />
          <span>
            I agree that the selected insurer{plural ? "(s)" : ""} may contact me about this request.
            {errors.consent && <span className="mt-1 block text-[12px] text-red">{errors.consent}</span>}
          </span>
        </label>

        <p className="flex gap-2.5 text-[12px] leading-relaxed text-muted">
          <FileText className="mt-0.5 size-3.5 shrink-0 text-ink/60" aria-hidden />
          <span>{INDICATIVE_NOTE}</span>
        </p>

        {formError && (
          <p role="alert" className="border-l-2 border-red bg-red-50 px-4 py-3 text-[13px] text-ink">
            {formError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-line bg-mist/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="flex items-center gap-2 text-[12px] text-muted">
          <ShieldCheck className="size-4 shrink-0 text-ink" aria-hidden /> Only {plural ? "these insurers" : "this insurer"} receive{plural ? "" : "s"} your details.
        </p>
        <Button type="submit" variant="primary" disabled={sending} className="sm:min-w-48">
          {sending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {sending ? "Sending…" : plural ? `Request ${items.length} quotes` : "Request quote"}
        </Button>
      </div>
    </form>
  );
}
