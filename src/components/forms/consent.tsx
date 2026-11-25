"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────
   Consent at the point of collection (DPDP Act, 2023).

   Every public form that collects personal data shows one
   unticked, required checkbox whose text says who may contact the
   visitor and why, with a link to the Privacy Policy. The server
   action rejects the request without it and records when it was
   given. Keep the wording purpose-specific — never bundle the
   newsletter or marketing into a request's consent.
   ────────────────────────────────────────────────────────────── */

/** A policy link that opens in a new tab, so a half-filled form isn't lost. */
export function PolicyLink({ href, children, tone = "dark" }: { href: string; children: ReactNode; tone?: "dark" | "light" }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener"
      className={cn("font-medium underline underline-offset-4 transition-colors", tone === "light" ? "text-white hover:text-white/80" : "text-ink hover:text-red")}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  );
}

export const PrivacyLink = ({ tone }: { tone?: "dark" | "light" }) => (
  <PolicyLink href="/privacy" tone={tone}>
    Privacy Policy
  </PolicyLink>
);

/** Unticked, required consent checkbox with its error linked for screen readers. */
export function ConsentCheckbox({
  id,
  checked,
  onChange,
  error,
  children,
  tone = "dark",
  className,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  children: ReactNode;
  tone?: "dark" | "light";
  className?: string;
}) {
  const errorId = `${id}-error`;
  const light = tone === "light";
  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn("mt-[3px] size-4 shrink-0 cursor-pointer accent-[var(--color-red)]", error && "outline outline-1 outline-offset-2 outline-red")}
        />
        <label htmlFor={id} className={cn("cursor-pointer text-[12.5px] leading-relaxed", light ? "text-white/70" : "text-muted")}>
          {children}
        </label>
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 pl-7 text-xs text-red">
          {error}
        </p>
      )}
    </div>
  );
}

/* ── Purpose-specific wording ─────────────────────────────────── */

/** Who will contact the visitor about a website request. */
export type ConsentParty =
  | { kind: "dealer"; name?: string }
  | { kind: "dealers" }
  | { kind: "marchgear" }
  | { kind: "seller"; name?: string }
  | { kind: "insurers"; plural: boolean };

/** "I agree that MarchGear and the dealer I've chosen may contact me about this request…" */
export function RequestConsentText({ party, about = "this request", tone }: { party: ConsentParty; about?: string; tone?: "dark" | "light" }) {
  const who =
    party.kind === "dealer"
      ? party.name
        ? `MarchGear and ${party.name}`
        : "MarchGear and the dealer I've chosen"
      : party.kind === "dealers"
        ? "MarchGear and its partner dealers in my city"
        : party.kind === "seller"
          ? party.name
            ? `MarchGear and the seller (${party.name})`
            : "MarchGear and the seller of this car"
          : party.kind === "insurers"
            ? party.plural
              ? "the insurers and intermediaries I've selected"
              : "the insurer or intermediary I've selected"
            : "MarchGear";
  return (
    <>
      I agree that {who} may contact me by phone, WhatsApp or email about {about}, using the details I&apos;ve entered here. See the <PrivacyLink tone={tone} />.
    </>
  );
}

export const CONSENT_REQUIRED = "Please tick this box so we can act on your request";
