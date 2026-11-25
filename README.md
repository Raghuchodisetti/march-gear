# March Gear

A premium automotive discovery platform for the Indian market — research, compare and discover new and used cars — with a MySQL backend and an admin panel for leads, listings and stories.

## Run it locally

Requires Node.js 20.9+ and MySQL 8 or MariaDB 10.4+ (XAMPP works).

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
npm run db:setup             # create tables + load the launch catalogue + first admin
npm run dev                  # http://localhost:3000   ·   admin: http://localhost:3000/admin
```

| Script | What it does |
| --- | --- |
| `npm run db:migrate` | Applies SQL migrations in `drizzle/` |
| `npm run db:seed` | Fills empty tables with the launch catalogue and creates the admin from `.env.local` (safe to re-run) |
| `npm run db:seed -- --reset` | Reloads catalogue + editorial from seed data. Keeps users, leads and subscribers |
| `npm run db:admin` | Creates the admin from `.env.local`, or resets its password to `ADMIN_PASSWORD` (run it after changing the password there) |
| `npm run db:seed-demo` | Creates the sample dealership **Sample Motors (demo)** for exploring the dealer portal — approved, Growth plan, two Visakhapatnam showrooms, stock, offers, enquiries, test drives, invoices and analytics. Owner login: `DEMO_DEALER_EMAIL` (default `demo-dealer@marchgear.in`) / `DEMO_DEALER_PASSWORD` in `.env.local` (generated there if empty). Does nothing if it already exists. **⚠ Local/dev databases only — never run it against the live database** |
| `npm run db:seed-demo -- --reset` | Deletes the demo dealership and creates it again from scratch |
| `npm run db:seed-demo -- --remove` | Deletes the demo dealership and everything it created (its logins, photos, public page, mirrored used cars and website leads) |
| `npm run db:seed-insurance` | Creates the sample insurance marketplace — fictional insurers and vendors named “… (demo)”: approved insurers and a broker with published products, covers, promotions, enquiries, quotes, renewals, invoices and ad campaigns, plus one vendor pending approval and one with changes requested. Main vendor login: `DEMO_INSURER_EMAIL` (default `demo-insurer@marchgear.in`) / `DEMO_INSURER_PASSWORD` in `.env.local` (generated there if empty). No claim figures are seeded. **⚠ Local/dev databases only** |
| `npm run db:seed-insurance -- --reset` / `-- --remove` | Recreates / deletes the demo insurance data |
| `npm run db:generate` | Creates a new migration after editing `src/db/schema.ts` |
| `npm run db:studio` | Opens Drizzle Studio to browse the database |
| `npm run build` | Production build (needs the database — pages are prerendered from it) |

## Stack

Next.js 16 (App Router, Turbopack, Server Actions) · React 19 · TypeScript · Tailwind CSS v4 · Motion · lucide-react · Drizzle ORM · MySQL (mysql2) · Zod · bcrypt.

## How the backend works

- **Catalogue** — brands, cars and variants, upcoming launches, used cars, dealers, articles, authors and reviews live in MySQL. `src/server/catalog.ts` loads the published set once, caches it (`unstable_cache`, tag `catalog`), and every admin save expires that tag, so the site updates immediately. Server components use `getCatalog()`; client components use `useCatalog()`.
- **Leads** — every public form (test drive, best price, dealer contact, callback, inspection, PDI booking, PDI checklist, sell your car, used-car offer, contact) posts to `submitLeadAction`, which validates per form type and stores a lead with a reference such as `MG-7KQ2X9`.
- **Accounts** — email + password sign-up and sign-in. Every kind of login is separate, with its own session cookie: website customers (`/login`, `mg_session`), admins (`/admin/login`, `mg_admin`), staff (`/staff/login`, `mg_staff`), dealer partners (`/dealer/login`, `mg_dealer`) and insurance vendors (`/insurance-vendor/login`, `mg_insurer`). Each sign-in accepts only its own kind of account and is used only in its own area, so signing in or out of one never affects the others — even in tabs of the same browser. Passwords are hashed with bcrypt; sessions are random tokens in an httpOnly cookie, stored hashed in the `sessions` table. Signed-in customers' saved cars sync to their account. Mobile OTP and social sign-in need an SMS provider / OAuth app and are not enabled.
- **Insurance marketplace** — public `/insurance` (indicative premiums, compare, providers, quote requests), the insurance vendor portal `/insurance-vendor` (7-step registration, products, coverage and add-ons, enquiries CRM, quotations, renewals, promotions, advertising, billing) and `/admin/insurance` (vendor verification, product/cover/campaign approvals, revenue). Premiums the site calculates are always labelled indicative; quotations are labelled indicative or insurer-authorised. See [docs/insurance-marketplace.md](docs/insurance-marketplace.md).
- **Advertising** — site-wide ad placements (`src/ads/placements.ts`) booked by insurance vendors and approved in `/admin/advertising` (campaigns and creatives separately); impressions and clicks are counted per day in `ad_stats`.
- **Guides** (`/guides`, linked from the footer) — topic pages made from PDFs. In **Admin → Guides → New guide**, staff enter a subject and topic name and upload a PDF (up to 15 MB / 150 pages, with selectable text). `src/server/guides/extract.ts` reads its text with PDF.js (`unpdf`, pure JavaScript) and rebuilds headings, paragraphs, lists and tables, dropping running headers, footers and page numbers. Each topic gets its own page at `/guides/<slug>`, and `/guides` groups the topics by subject. The text can be edited afterwards in a simple format (`## heading`, `- bullet`, `1. item`, `| table | row |`), and the original PDF can be offered as a download. The PDF is stored in MySQL in 512 KB pieces (`guide_files`), so it fits the default 1 MB `max_allowed_packet`. Pictures inside a PDF aren't carried over to the page. Scanned PDFs (pictures of text) are refused, because there's no text to read.
- **Where photos live** — public photos (car photos, dealer and vendor uploads, banners) are kept as plain files in a "cloud folder", not in the database, so the database stays a few MB. Each photo is stored as two files:
  - `media/<id>/<filename>` — the photo;
  - `media/<id>/960/<filename>` — its 960 px card copy.

  Settings (see `src/server/media-store.ts`):
  - `MEDIA_CLOUD_URL` — the folder's public address, for example `https://cloud.marchgear.in`. `/media/<id>/<name>` redirects there, and browsers cache the redirect for a year.
  - `MEDIA_CLOUD_DIR` — the same folder on the server's disk, if the site can reach it. New uploads are written there, and without `MEDIA_CLOUD_URL` the site reads photos from it directly (local development uses `./media-export`). Without `MEDIA_CLOUD_DIR`, new uploads are kept in the database and served from there.

  To move photos out of the database, run `npm run media:export -- --offload`. It writes them to the folder, checks each file, and only then empties the photos from the database.

  Private files (dealer and vendor documents, guide PDFs) always stay in the database, behind their access checks.
- **Images and files** — everything is stored in compressed form.
  - **Photos** uploaded in the admin or the dealer and vendor portals, including photos of documents, are compressed in the browser before upload: converted to WebP, longest side at most 2,000 px, under 900 KB.
  - **Card copies:** each photo also gets a 960 px card copy, which the media route serves at `?w=960` and which listing cards and thumbnails load.
  - **PDFs:** guide PDFs and dealer and vendor documents are stored deflated when that saves 10% or more (`src/server/stored-files.ts`). Most PDFs are already compressed inside.
  - **Existing files:** `npm run db:compress-stored` (with `-- --dry-run` to preview) applies the same treatment to files already stored. It needs `sharp`, which comes with Next.
- **Admin and staff desks** — one set of back-office pages served at two addresses. Admins use `/admin` and can do everything. Staff use `/staff` and see only the sections an admin ticked for them under **Admin → Staff & access**: Leads, Dealer partners, Insurance, Advertising, Catalogue, Content & guides, Customers and Site settings. Staff accounts, billing and the activity log are for admins only. `src/proxy.ts` serves `/staff/…` from the `/admin/…` pages and tells them which desk the request is for. The sections are defined in `src/lib/staff-access.ts`. Every page checks them through its layout, and every Server Action names its own section in `requireStaff(...)`. Customer accounts, dealer logins, insurance vendor logins and staff each have their own list (`/admin/customers`, `/admin/dealer-accounts`, `/admin/insurance/accounts`, `/admin/team`).
- **Back-office tools** — dashboard, leads (filter, assign, notes, status, CSV export), brands, new cars with variants, upcoming launches, used cars, dealers, news, guides, authors, review moderation, customers and subscribers. Every page and action re-checks access on the server.

## Where things live

```
drizzle/               SQL migrations
src/
  db/                  Drizzle schema, connection, enums, seed + seed data
  server/              Server-only code: auth/sessions, catalogue loader,
                       admin queries, Server Actions (leads, auth, admin, catalogue)
  app/
    (site)/            Public routes (home, new/used cars, model & variant pages, compare,
                       reviews, news, EVs, tools, dealers, PDI check, account, legal)
    admin/             Admin panel (login + (panel) routes)
    api/auth/me        Current session for the browser
  components/
    ui/                Design-system primitives (buttons, fields, tabs, modals, carousel…)
    layout/            Site shell, header + mega menus, mobile nav, search, footer
    admin/             Admin shell, tables, config-driven resource forms
    providers/         App state (catalogue, wishlist, compare, city, account, toasts)
    …                  Feature folders for each page family
  data/                Static config: images, cities, navigation, tools, legal copy
  lib/                 Catalogue helpers, formatting, finance maths, stores
  types/               Domain types
```

The design system — tokens, type scale, motion timings, component inventory and conventions — is documented in [DESIGN.md](DESIGN.md).

## Deploying

Vercel can't reach a database on your own computer. Before deploying, create a hosted MySQL database (for example Aiven, TiDB Cloud, PlanetScale, AWS RDS or your hosting provider's MySQL with remote access), then:

1. Add `DATABASE_URL` (append `?ssl=true` if the host requires TLS), `ADMIN_EMAIL` and `ADMIN_PASSWORD` to the Vercel project's environment variables.
2. Run `npm run db:setup` once against that database (with the same `DATABASE_URL` in `.env.local`).
3. Deploy. The build reads the catalogue from the database.

## Legal & compliance

The policies and consent flows are built for India's **Digital Personal Data Protection Act, 2023** and the IT Rules. The launch wording hasn't been reviewed by a lawyer — have it reviewed before going live.

- **Policies** — `/privacy`, `/terms`, `/cookies`, `/refund-policy`, linked from each other and from the footer. Their wording is editable at **Admin → Content → Legal** (blocks `legal`, `cookiePolicy`, `refundPolicy`; defaults in `src/data/editorial-legal.ts`). Text can use `[label](/path)` links and `{tokens}` such as `{company}`, `{grievance}`, `{jurisdiction}`, `{supportEmail}`, so the policies always show the current business details. The cookie and browser-storage tables on `/cookies` are generated from the code (`SESSION_COOKIES`/`SESSION_TTL` in `src/server/auth.ts`, the consent cookie, the `mg.*` storage keys) — update the list in `src/app/(site)/cookies/page.tsx` when you add a key. Refund trial lengths and payment terms come from the billing rules; the refund timeline and PDI cancellation terms are fields in `refundPolicy`.
- **Business details** — **Admin → Content → Contact details, business details & analytics** (block `site`): registered legal name, CIN/LLPIN, GSTIN (format-checked), registered office, courts' city, Grievance Officer (name, email, phone) and the Google Analytics 4 measurement ID (`G-…`, empty = analytics off). All start empty and nothing is invented: filled-in items appear in the footer's legal line, on `/contact` and in the policies; until a Grievance Officer is set, the policies point to the support email.
- **Consent at collection** — every public form that collects personal data (enquiries, test drives, best price, callbacks, dealer and offer enquiries, used-car offers, sell your car, PDI booking and checklist, contact, insurance quote and callback requests, owner reviews, newsletter, sign-up) has an unticked, required checkbox naming who may contact the visitor and why, with a link to the Privacy Policy (`src/components/forms/consent.tsx`). The Server Actions refuse requests without it and record it: leads get `details.consent` + `details.consentAt` (shown in `/admin/leads`), insurance quote requests `ins_enquiries.consent_at`, sign-ups `users.preferences.consent` (with the policies' version date). The newsletter is always a separate opt-in; `unsubscribeAction` (form on `/privacy#your-choices`) withdraws it.
- **Data principal rights** — customers download their data and delete their account at `/account/privacy`, and change alerts at `/account/preferences`. Requests the site can't self-serve (erasing guest enquiries, nomination, a sharing summary) go to the support email and are handled by staff, who can delete leads, reviews, subscribers and users in the admin.
- **Cookies** — essential cookies only until the visitor chooses; Google Analytics loads only after “Allow analytics” and only when a measurement ID is set (`src/components/consent/*`). “Cookie settings” in the footer reopens the choice.

## Notes

- The launch catalogue (prices, specifications, listings, reviews, dealers) is demonstration data and can be edited in the admin panel.
- Photography is served from Unsplash via a custom `next/image` loader (`src/lib/image-loader.ts`). Admin image fields take URLs; uploading files needs object storage (e.g. Vercel Blob or S3) and isn't set up.
- Email (e.g. sending the PDI checklist PDF) needs an email service such as Resend and isn't connected — the PDF downloads in the browser instead.
- The compare list and selected city stay in `localStorage`; saved cars stay on the device until the visitor signs in, then sync to their account.
