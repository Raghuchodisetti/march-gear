import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type { SiteContent } from "@/content/registry";

/* ──────────────────────────────────────────────────────────────
   Admin-edited policy text → React. Supports [label](href) links
   and {token} placeholders filled from the business details, so
   the policies always show the current legal name, Grievance
   Officer and jurisdiction. Nothing is rendered as HTML.
   ────────────────────────────────────────────────────────────── */

export type LegalVars = Record<string, ReactNode>;

type Site = SiteContent["site"];

const linkClass = "font-medium text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:text-red hover:decoration-red";

/** Only same-site paths, anchors, https, mailto and tel links are made clickable. */
const SAFE_HREF = /^(\/(?![/\\])|#|https:\/\/|mailto:|tel:)/;

export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  if (/^https:\/\//.test(href))
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  if (/^(mailto:|tel:|#)/.test(href))
    return (
      <a href={href} className={linkClass}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={linkClass}>
      {children}
    </Link>
  );
}

const PATTERN = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)|\{([a-zA-Z]{2,40})\}/g;

/** Replaces {tokens} in plain text (for link labels and the page's metadata-free strings). */
export function fillTokens(text: string, plain: Record<string, string>) {
  return text.replace(/\{([a-zA-Z]{2,40})\}/g, (m, key: string) => plain[key] ?? m);
}

export function renderLegalText(text: string, vars: LegalVars, plain: Record<string, string> = {}): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(PATTERN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (m[1] !== undefined) {
      const label = fillTokens(m[1], plain);
      out.push(SAFE_HREF.test(m[2]) ? <LegalLink key={i++} href={m[2]}>{label}</LegalLink> : label);
    } else {
      const key = m[3];
      out.push(key in vars ? <Fragment key={i++}>{vars[key]}</Fragment> : m[0]);
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const mail = (email: string) => <LegalLink href={`mailto:${email}`}>{email}</LegalLink>;
const tel = (phone: string) => <LegalLink href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</LegalLink>;

/** The Grievance Officer as written in the policies, or the support-email fallback until one is named. */
export function grievanceContact(site: Site): { named: boolean; node: ReactNode; text: string; email: string } {
  const g = site.grievanceOfficer;
  const email = g.email || site.supportEmail;
  if (g.email) {
    const who = g.name ? `${g.name}, Grievance Officer` : "the Grievance Officer";
    return {
      named: Boolean(g.name),
      email,
      text: [who, g.email, g.phone].filter(Boolean).join(", "),
      node: (
        <>
          {who}, {mail(g.email)}
          {g.phone && <>, {tel(g.phone)}</>}
        </>
      ),
    };
  }
  return {
    named: false,
    email,
    text: `our support team at ${site.supportEmail} (a Grievance Officer will be named here shortly)`,
    node: <>our support team at {mail(site.supportEmail)} (a Grievance Officer will be named here shortly)</>,
  };
}

/** Values for the {tokens} every policy can use. `extra` adds page-specific ones (e.g. the refund timeline). */
export function legalVars(site: Site, extra: Record<string, string> = {}): { vars: LegalVars; plain: Record<string, string> } {
  const grievance = grievanceContact(site);
  const plain: Record<string, string> = {
    company: site.legalName || "MarchGear",
    address: site.registeredAddress || site.address,
    email: site.email,
    supportEmail: site.supportEmail,
    phone: site.phone,
    grievance: grievance.text,
    grievanceEmail: grievance.email,
    jurisdiction: site.jurisdictionCity ? `the courts at ${site.jurisdictionCity}` : "the courts having jurisdiction over our registered office",
    ...extra,
  };
  const vars: LegalVars = {
    ...plain,
    email: mail(site.email),
    supportEmail: mail(site.supportEmail),
    phone: tel(site.phone),
    grievance: grievance.node,
    grievanceEmail: mail(grievance.email),
  };
  return { vars, plain };
}

/** The business details that are filled in, in display order (nothing is invented when they're empty). */
export function businessFacts(site: Site): { label: string; value: string }[] {
  return [
    { label: "Legal name", value: site.legalName },
    { label: site.cin.includes("-") ? "LLPIN" : "CIN", value: site.cin },
    { label: "GSTIN", value: site.gstin },
    { label: "Registered office", value: site.registeredAddress },
  ].filter((f) => f.value);
}
