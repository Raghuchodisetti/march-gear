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
- **Accounts** — email + password sign-up and sign-in. Every kind of login is separate, with its own session cookie: website customers (`/login`, `mg_session`), staff (`/admin/login`, `mg_admin`), dealer partners (`/dealer/login`, `mg_dealer`) and insurance vendors (`/insurance-vendor/login`, `mg_insurer`). Each sign-in accepts only its own kind of account and is used only in its own area, so signing in or out of one never affects the others — even in tabs of the same browser. Passwords are hashed with bcrypt; sessions are random tokens in an httpOnly cookie, stored hashed in the `sessions` table. Signed-in customers' saved cars sync to their account. Mobile OTP and social sign-in need an SMS provider / OAuth app and are not enabled.
- **Insurance marketplace** — public `/insurance` (indicative premiums, compare, providers, quote requests), the insurance vendor portal `/insurance-vendor` (7-step registration, products, coverage and add-ons, enquiries CRM, quotations, renewals, promotions, advertising, billing) and `/admin/insurance` (vendor verification, product/cover/campaign approvals, revenue). Premiums the site calculates are always labelled indicative; quotations are labelled indicative or insurer-authorised. See [docs/insurance-marketplace.md](docs/insurance-marketplace.md).
- **Advertising** — site-wide ad placements (`src/ads/placements.ts`) booked by insurance vendors and approved in `/admin/advertising` (campaigns and creatives separately); impressions and clicks are counted per day in `ad_stats`.
- **Admin panel** (`/admin`) — staff only (roles: `editor`, `admin`). Dashboard, leads (filter, assign, notes, status, CSV export), brands, new cars with variants, upcoming launches, used cars, dealers, news, authors, review moderation, subscribers and — for admins — customers & staff accounts. Every admin page and action re-checks the role on the server.

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

## Notes

- The launch catalogue (prices, specifications, listings, reviews, dealers) is demonstration data and can be edited in the admin panel.
- Photography is served from Unsplash via a custom `next/image` loader (`src/lib/image-loader.ts`). Admin image fields take URLs; uploading files needs object storage (e.g. Vercel Blob or S3) and isn't set up.
- Email (e.g. sending the PDI checklist PDF) needs an email service such as Resend and isn't connected — the PDF downloads in the browser instead.
- The compare list and selected city stay in `localStorage`; saved cars stay on the device until the visitor signs in, then sync to their account.
