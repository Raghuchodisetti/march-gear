/* ──────────────────────────────────────────────────────────────
   Two back offices share one set of pages:
   - the admin desk (/admin, /admin/login): admins, full access;
   - the staff desk (/staff, /staff/login): staff accounts, limited to
     the sections an admin ticked for them.
   Each has its own sign-in and session, so an admin and a staff member
   can be signed in side by side in one browser. The proxy (src/proxy.ts)
   serves /staff/… from the /admin/… pages and says which desk asked.

   Shared by server and browser code — no server imports.
   ────────────────────────────────────────────────────────────── */

export type Desk = "admin" | "staff";

export const STAFF_SECTIONS = [
  { key: "leads", label: "Leads", hint: "Enquiries, test drives and bookings from the website." },
  { key: "dealers", label: "Dealer partners", hint: "Dealers and their logins, vehicle and offer approvals, campaigns, dealer support." },
  { key: "insurance", label: "Insurance", hint: "Insurance vendors and their logins, products, covers, enquiries, quotes, vendor support." },
  { key: "advertising", label: "Advertising", hint: "Ad campaigns, schedule and placements." },
  { key: "catalogue", label: "Catalogue", hint: "Brands, new cars, upcoming launches, used cars, showroom listings." },
  { key: "content", label: "Content & guides", hint: "News & reviews, guides, authors, review moderation." },
  { key: "customers", label: "Customers", hint: "Customer accounts and newsletter subscribers." },
  { key: "site", label: "Site settings", hint: "Site content blocks and the media library." },
] as const;

export type Section = (typeof STAFF_SECTIONS)[number]["key"];
/** What a page or action needs: a section, any of several, or "admin" (admins only: staff, billing, activity log). */
export type Access = Section | readonly Section[] | "admin";

export const SECTION_KEYS: readonly Section[] = STAFF_SECTIONS.map((s) => s.key);
export const isSection = (v: unknown): v is Section => typeof v === "string" && (SECTION_KEYS as readonly string[]).includes(v);

/** Admin paths (after /admin) → what they need. Longest prefix wins; anything not listed is open to all staff (dashboard, own account). */
const PATHS: [string, Access][] = [
  ["/leads", "leads"],
  // Dealer partners
  ["/dashboard", "dealers"],
  ["/dealers", "dealers"],
  ["/dealer-accounts", "dealers"],
  ["/vehicle-approvals", "dealers"],
  ["/offer-approvals", "dealers"],
  ["/campaign-management", "dealers"],
  ["/approval-history", "dealers"],
  ["/partner-support", "dealers"],
  ["/partner-billing", "admin"],
  // Insurance (billing is admins only)
  ["/insurance", "insurance"],
  ["/insurance/revenue", "admin"],
  ["/insurance/payments", "admin"],
  ["/insurance/invoices", "admin"],
  ["/insurance/refunds", "admin"],
  ["/advertising", "advertising"],
  // Catalogue
  ["/brands", "catalogue"],
  ["/cars", "catalogue"],
  ["/upcoming", "catalogue"],
  ["/used-cars", "catalogue"],
  ["/showrooms", "catalogue"],
  // Content
  ["/news", "content"],
  ["/guides", "content"],
  ["/authors", "content"],
  ["/reviews", "content"],
  // People
  ["/customers", "customers"],
  ["/subscribers", "customers"],
  ["/users", "customers"],
  ["/team", "admin"],
  ["/activity", "admin"],
  // Site
  ["/content", "site"],
  // The media library page is a site setting; picking and uploading images works from any section's forms.
  ["/media/upload", ["catalogue", "content", "site", "dealers", "advertising", "insurance"]],
  ["/media", "site"],
];

/** What an /admin/… path needs, or null when every staff member may open it. */
export function accessForPath(path: string): Access | null {
  const rest = path.replace(/^\/(?:admin|staff)(?=\/|$)/, "") || "/";
  let best: [string, Access] | null = null;
  for (const entry of PATHS) {
    const [prefix] = entry;
    if ((rest === prefix || rest.startsWith(`${prefix}/`)) && (!best || prefix.length > best[0].length)) best = entry;
  }
  return best ? best[1] : null;
}

/** Whether an account may use something. Admins may use everything; staff what they were given. */
export function allows(desk: Desk, permissions: readonly string[] | null | undefined, access: Access | null) {
  if (desk === "admin") return true;
  if (access === null) return true;
  if (access === "admin") return false;
  const needed: readonly Section[] = typeof access === "string" ? [access] : access;
  return needed.some((s) => permissions?.includes(s));
}

/** The same page on a desk: /admin/… links become /staff/… on the staff desk. Other links are left alone. */
export function deskPath(desk: Desk, href: string) {
  return desk === "staff" ? href.replace(/^\/admin(?=[/?#]|$)/, "/staff") : href;
}

export const DESK_LABEL: Record<Desk, string> = { admin: "Admin", staff: "Staff" };
