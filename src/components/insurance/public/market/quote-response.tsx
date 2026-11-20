"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Printer, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import { Honeypot } from "@/components/forms/honeypot";
import { useUI } from "@/components/providers/app-provider";
import { respondToQuoteAction } from "@/server/actions/insurance-public";
import { cn } from "@/lib/utils";

/** "I'm interested" / "Not interested" on the customer's quote page (only while the quote is open). */
export function QuoteResponse({ token, vendorName }: { token: string; vendorName: string }) {
  const { toast } = useUI();
  const router = useRouter();
  const [choice, setChoice] = useState<"accepted" | "declined" | null>(null);
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const send = () => {
    if (!choice) return;
    setError("");
    start(async () => {
      try {
        const res = await respondToQuoteAction(token, { response: choice, note: note.trim() || undefined, website });
        if (!res.ok) {
          setError(res.fieldErrors?.note ?? res.error ?? "Couldn't send your response.");
          return;
        }
        toast(res.status === "accepted" ? `${vendorName} will be in touch` : "Response sent", { tone: "success" });
        router.refresh();
      } catch {
        setError("Couldn't send — check your connection and try again.");
      }
    });
  };

  return (
    <div className="relative">
      <Honeypot value={website} onChange={setWebsite} />
      <p className="text-[13px] font-medium text-ink">Want to go ahead?</p>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Your response">
        {(
          [
            ["accepted", "I'm interested", ThumbsUp],
            ["declined", "Not interested", ThumbsDown],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={choice === value}
            onClick={() => setChoice(value)}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-2 rounded-[3px] border text-[13.5px] font-medium transition-colors",
              choice === value ? (value === "accepted" ? "border-red bg-red text-white" : "border-ink bg-ink text-white") : "border-line bg-white text-ink hover:border-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      {choice && (
        <div className="mt-4">
          <TextArea
            label={choice === "accepted" ? "Anything they should know? (optional)" : "Tell them why (optional)"}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            rows={3}
            placeholder={choice === "accepted" ? "e.g. best time to call" : "e.g. found a lower premium"}
          />
          {error && (
            <p role="alert" className="mt-2 text-[12.5px] text-red">
              {error}
            </p>
          )}
          <Button className="mt-3 w-full" variant={choice === "accepted" ? "primary" : "dark"} onClick={send} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            {pending ? "Sending…" : choice === "accepted" ? `Tell ${vendorName} I'm interested` : "Send response"}
          </Button>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
            {choice === "accepted" ? "This isn't a purchase — they'll contact you to complete the policy with the insurer. No payment is taken on MarchGear." : "They'll be told you're not going ahead."}
          </p>
        </div>
      )}
    </div>
  );
}

export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()} icon={<Printer className="size-3.5" aria-hidden />}>
      Print or save PDF
    </Button>
  );
}
