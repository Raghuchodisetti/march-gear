"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Copy, CopyCheck, Download, FilePen, Loader2, Mail, MessageCircle, RefreshCcw, Send, Trash2 } from "lucide-react";
import { discardQuoteDraftAction, recordQuoteShareAction, reviseQuoteAction, submitQuoteAction, withdrawQuoteAction } from "@/server/actions/ins-quotes";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Textarea } from "@/components/portal/crm/controls";
import { useRun } from "@/components/portal/crm/use-run";
import { whatsappHref } from "@/components/portal/crm/pipeline";
import { rupees } from "@/components/portal/billing/shared";
import { formatDayShort } from "@/components/insurance/vendor/crm/badges";
import type { QuoteView } from "./types";

/* Share, download, send, withdraw, revise and discard — the quote detail page's actions. */

export function QuoteActions({ quote, origin, canManage }: { quote: QuoteView; origin: string; canManage: boolean }) {
  const router = useRouter();
  const { toast } = useUI();
  const { run, busy, errors } = useRun();
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [dialog, setDialog] = useState<"submit" | "withdraw" | "discard" | null>(null);
  const [reason, setReason] = useState("");

  const link = `${origin}/insurance/quote/${quote.shareToken}`;
  const sent = quote.status !== "draft";
  const shareable = quote.display === "submitted" || quote.display === "viewed" || quote.display === "accepted";
  const label = quote.authorization === "insurer_authorised" ? `an insurer-authorised quotation (insurer ref ${quote.insurerQuoteRef})` : "an indicative estimate (not an insurer quotation)";
  const message = `Hello ${quote.enquiry.name.split(" ")[0]}, here is ${label} from ${quote.vendor.name} for your ${quote.enquiry.vehicle || "car"}: ${rupees(quote.total)}, valid until ${formatDayShort(quote.validUntil)}. View it here: ${link}`;

  const log = (channel: "copy" | "whatsapp" | "pdf") => {
    if (canManage) void recordQuoteShareAction({ id: quote.id, channel }).catch(() => null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast("Customer link copied", { tone: "success" });
      log("copy");
    } catch {
      toast("Couldn't copy automatically — select the link and copy it.", { tone: "error" });
    }
  };

  const pdf = async () => {
    setPdfBusy(true);
    try {
      const mod = await import("./quote-pdf");
      await mod.downloadQuotePdf(quote, origin);
      toast("PDF downloaded", { tone: "success" });
      log("pdf");
    } catch (err) {
      console.error(err);
      toast("Couldn't build the PDF. Please try again.", { tone: "error" });
    } finally {
      setPdfBusy(false);
    }
  };

  const submit = async () => {
    const res = await run("submit", () => submitQuoteAction({ id: quote.id }), `${quote.reference} sent`);
    if (res) setDialog(null);
  };
  const withdraw = async () => {
    const res = await run("withdraw", () => withdrawQuoteAction({ id: quote.id, reason }), `${quote.reference} withdrawn`);
    if (res) setDialog(null);
  };
  const revise = async () => {
    const res = await run("revise", () => reviseQuoteAction({ id: quote.id }), (r) => `New draft ${r.reference} created`);
    if (res) router.push(`/insurance-vendor/quotes/${res.id}/edit`);
  };
  const discard = async () => {
    const res = await run("discard", () => discardQuoteDraftAction({ id: quote.id }), "Draft discarded");
    if (res) router.push(`/insurance-vendor/enquiries/${quote.enquiry.id}`);
  };

  const spin = (k: string) => (busy === k ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined);

  return (
    <div className="space-y-5">
      {/* Share */}
      <section className="border border-line bg-white p-5">
        <h2 className="text-[13px] font-semibold">Share with the customer</h2>
        {sent ? (
          <>
            <label className="mt-3 block text-[12px] text-muted" htmlFor="quote-link">
              Customer link
            </label>
            <div className="mt-1.5 flex gap-2">
              <input id="quote-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-[3px] border border-line bg-mist/50 px-3 font-mono text-[12px] text-ink/80 outline-none focus:border-ink" />
              <Button variant="dark" size="sm" className="h-10 shrink-0" onClick={copy} disabled={!shareable} icon={copied ? <CopyCheck className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="mt-2.5 grid grid-cols-1 gap-2">
              {shareable ? (
                <Button href={whatsappHref(quote.enquiry.mobile, message)} target="_blank" rel="noopener noreferrer" onClick={() => log("whatsapp")} variant="outline" size="sm" icon={<MessageCircle className="size-4" aria-hidden />}>
                  Share on WhatsApp
                </Button>
              ) : (
                <span className="inline-flex h-9 items-center justify-center gap-2 rounded-[3px] border border-dashed border-line px-3 text-[12.5px] text-muted">
                  <MessageCircle className="size-4" aria-hidden /> Not shareable now
                </span>
              )}
              <span title="Email sending isn't configured on MarchGear" className="inline-flex h-9 items-center justify-center gap-2 rounded-[3px] border border-dashed border-line px-3 text-[12.5px] text-muted">
                <Mail className="size-4" aria-hidden /> Email not configured
              </span>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              MarchGear doesn&apos;t send email or SMS yet. Copy the link or share it on WhatsApp from your own phone — the customer opens it, and you&apos;ll see when they view or respond.
              {!shareable && " This quote is no longer open, so the link shows its final status."}
            </p>
          </>
        ) : (
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">The customer link becomes available once you send this quote. Drafts are only visible to your team.</p>
        )}
      </section>

      {/* Actions */}
      <section className="border border-line bg-white p-5">
        <h2 className="text-[13px] font-semibold">Actions</h2>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <Button variant="outline" size="sm" onClick={pdf} disabled={pdfBusy} icon={pdfBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}>
            Download PDF
          </Button>
          {canManage && quote.status === "draft" && (
            <>
              <Button variant="primary" size="sm" onClick={() => setDialog("submit")} disabled={busy !== null} icon={spin("submit") ?? <Send className="size-4" aria-hidden />}>
                Submit to customer
              </Button>
              <Button href={`/insurance-vendor/quotes/${quote.id}/edit`} variant="outline" size="sm" icon={<FilePen className="size-4" aria-hidden />}>
                Edit draft
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDialog("discard")} disabled={busy !== null} icon={<Trash2 className="size-4" aria-hidden />} className="text-red hover:bg-red-50">
                Discard draft
              </Button>
            </>
          )}
          {canManage && sent && (
            <Button variant="outline" size="sm" onClick={revise} disabled={busy !== null} icon={spin("revise") ?? <RefreshCcw className="size-4" aria-hidden />}>
              Revise (new draft)
            </Button>
          )}
          {canManage && quote.status === "submitted" && (
            <Button variant="ghost" size="sm" onClick={() => setDialog("withdraw")} disabled={busy !== null} icon={<Ban className="size-4" aria-hidden />} className="text-red hover:bg-red-50">
              Withdraw quote
            </Button>
          )}
        </div>
      </section>

      <Modal open={dialog === "submit"} onClose={() => setDialog(null)} title="Send this quote?" size="sm">
        <div className="space-y-4 px-6 py-6 sm:px-8">
          <p className="text-[13.5px] leading-relaxed text-ink/80">
            {quote.enquiry.name} gets a private link to {label} of <strong className="font-semibold num">{rupees(quote.total)}</strong>, valid until {formatDayShort(quote.validUntil)}.
          </p>
          {errors.validUntil && <p className="text-[12.5px] text-red">{errors.validUntil} — edit the draft to change it.</p>}
          {errors.insurerQuoteRef && <p className="text-[12.5px] text-red">{errors.insurerQuoteRef} — edit the draft to add it.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={submit} disabled={busy !== null} data-autofocus icon={spin("submit") ?? <Send className="size-4" aria-hidden />}>
              Send quote
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === "withdraw"} onClose={() => setDialog(null)} title="Withdraw this quote?" description="The customer's link will show it as withdrawn. You can revise it into a new draft later." size="sm">
        <div className="space-y-4 px-6 py-6 sm:px-8">
          <Textarea label="Reason (internal, optional)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} error={errors.reason} data-autofocus />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDialog(null)}>
              Keep it
            </Button>
            <Button variant="dark" size="sm" onClick={withdraw} disabled={busy !== null} icon={spin("withdraw") ?? <Ban className="size-4" aria-hidden />}>
              Withdraw
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === "discard"} onClose={() => setDialog(null)} title="Discard this draft?" description="It was never sent, so the customer won't notice. This can't be undone." size="sm">
        <div className="flex justify-end gap-2 px-6 py-6 sm:px-8">
          <Button variant="ghost" size="sm" onClick={() => setDialog(null)} data-autofocus>
            Keep draft
          </Button>
          <Button variant="dark" size="sm" onClick={discard} disabled={busy !== null} icon={spin("discard") ?? <Trash2 className="size-4" aria-hidden />}>
            Discard
          </Button>
        </div>
      </Modal>
    </div>
  );
}
