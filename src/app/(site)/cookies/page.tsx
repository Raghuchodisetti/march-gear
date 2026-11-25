import type { Metadata } from "next";
import { getCatalog } from "@/server/catalog";
import { SESSION_COOKIES, SESSION_TTL, type SessionRealm } from "@/server/auth";
import { CONSENT_COOKIE, CONSENT_MAX_AGE } from "@/components/consent/consent";
import { pageMetadata } from "@/components/seo/metadata";
import { LegalDocument } from "@/components/editorial/legal-document";
import { legalVars } from "@/components/editorial/legal-text";
import { PolicyTable, type PolicyRow } from "@/components/editorial/policy-table";

export const metadata: Metadata = pageMetadata({
  title: "Cookie Policy",
  description: "The cookies and browser storage MarchGear uses, what each does and how long it lasts — and how to allow or refuse analytics cookies.",
  path: "/cookies",
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** 30 days / 12 hours, from the session lifetime in milliseconds. */
function lifetime(ms: number) {
  if (ms % DAY === 0) return `${ms / DAY} day${ms === DAY ? "" : "s"}`;
  return `${Math.round(ms / HOUR)} hours`;
}

const SIGN_IN: Record<SessionRealm, string> = {
  customer: "Keeps you signed in to your MarchGear account. Set only when you sign in; removed when you sign out.",
  staff: "Keeps MarchGear staff signed in to the admin panel.",
  dealer: "Keeps dealer partners signed in to the dealer portal.",
  insurer: "Keeps insurance vendors signed in to their portal.",
};

/*
 * Browser storage keys the site writes (src/lib/store.ts, the PDI components, the insurance compare list and
 * search form). Keep this list in step with the code when a key is added or removed.
 */
const STORAGE: PolicyRow[] = [
  { name: "mg.wishlist", by: "MarchGear", purpose: "The cars you've saved. Synced to your account while you're signed in.", duration: "Until you clear it" },
  { name: "mg.compare", by: "MarchGear", purpose: "The cars in your compare list.", duration: "Until you clear it" },
  { name: "mg.city", by: "MarchGear", purpose: "The city you chose, for local prices and dealers.", duration: "Until you clear it" },
  {
    name: "mg.account",
    by: "MarchGear",
    purpose: "Your name, email, mobile and city, so the page shows you're signed in straight away. The sign-in itself is the mg_session cookie. Cleared when you sign out.",
    duration: "Until you sign out",
  },
  { name: "mg.announcement.dismissed", by: "MarchGear", purpose: "That you've closed the announcement bar.", duration: "Until you clear it" },
  { name: "mg.insurance.compare", by: "MarchGear", purpose: "The insurance plans in your compare list.", duration: "Until you clear it" },
  { name: "mg.insurance.search", by: "MarchGear", purpose: "Your last car-insurance search, to fill in the form next time.", duration: "Until you clear it" },
  {
    name: "mg.pdi.lead",
    by: "MarchGear",
    purpose: "What you entered for the free PDI checklist (name, mobile, email if given, car and delivery date), so the checklist stays unlocked and the PDF can be downloaded again.",
    duration: "Until you clear it",
  },
  { name: "mg.pdi.checklist", by: "MarchGear", purpose: "The PDI checklist items you've ticked.", duration: "Until you clear it" },
  { name: "mg.pdi.plan", by: "MarchGear", purpose: "The PDI plan you chose.", duration: "Until you clear it" },
];

export default async function CookiesPage() {
  const { cookiePolicy, site } = (await getCatalog()).content;
  const { vars, plain } = legalVars(site);
  const gaId = site.gaMeasurementId;

  const essential: PolicyRow[] = [
    ...(Object.keys(SESSION_COOKIES) as SessionRealm[]).map((realm) => ({
      name: SESSION_COOKIES[realm],
      by: "MarchGear",
      purpose: SIGN_IN[realm],
      duration: lifetime(SESSION_TTL[realm]),
    })),
    {
      name: CONSENT_COOKIE,
      by: "MarchGear",
      purpose: "Remembers your cookie choice (analytics allowed, or essential cookies only), so we don't ask on every visit.",
      duration: `${Math.round(CONSENT_MAX_AGE / (30 * 86_400))} months`,
    },
  ];

  const analytics: PolicyRow[] = [
    { name: "_ga", by: "Google Analytics", purpose: "A random ID that tells visits from the same browser apart. It doesn't contain your name or contact details.", duration: "13 months" },
    {
      name: gaId ? `_ga_${gaId.slice(2)}` : "_ga_<ID>",
      by: "Google Analytics",
      purpose: "Keeps track of your current visit (session) for our analytics property.",
      duration: "13 months",
    },
  ];

  return (
    <LegalDocument
      eyebrow="Cookie Policy"
      title="Cookies, plainly explained"
      intro="Every cookie and piece of browser storage MarchGear uses, what it's for, how long it lasts — and how to change your mind."
      sections={cookiePolicy.sections}
      summary={cookiePolicy.summary}
      updated={cookiePolicy.updated}
      current="/cookies"
      site={site}
      vars={vars}
      plain={plain}
      attachments={{
        essential: <PolicyTable caption="Essential cookies" rows={essential} />,
        "browser-storage": <PolicyTable caption="Browser storage (local storage)" nameLabel="Key" rows={STORAGE} />,
        analytics: (
          <div className="space-y-3">
            <PolicyTable caption="Analytics cookies — set only after you choose “Allow analytics”" rows={analytics} />
            {!gaId && <p className="text-[13px] text-muted">Analytics is switched off at the moment, so these cookies aren&apos;t set for anyone.</p>}
          </div>
        ),
      }}
    />
  );
}
