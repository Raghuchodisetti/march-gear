# Dealer partner portal — architecture & conventions

The dealer portal (`/dealer/*`) lets dealerships apply to become MarchGear partners, then manage inventory, offers, enquiries, test drives and staff. MarchGear staff review everything in the admin panel (`/admin/*`, "Dealer partners" section). Same Next.js app, same MySQL database, separate shell and login.

## The catalogue rule — cars come only from MarchGear's catalogue

**Cars are added only by MarchGear admin.** Brands, models, variants, colours, specs, features, descriptions, photos and videos live in the catalogue and are maintained in `/admin` (Brands, New cars with variants). Dealers never create or describe car models: they *select* brand → model → variant (→ colour) from the published catalogue (`getCatalog()` / `useCatalog()`) and manage only what's theirs.

| | New car | Used car |
| --- | --- | --- |
| Car | Catalogue brand → model → variant → factory colour. Brands limited to approved `partner_brands`; models/variants to the line-up ticked on `/dealer/models` (an empty line-up means the whole brand) | Catalogue brand → model → variant, any catalogue brand |
| Dealer sets | Selling price (must be 50–200% of the variant's catalogue ex-showroom price — `PRICE_BAND`), availability (in stock with units, or on order with a waiting period in weeks), showroom, private stock number / VIN | Manufacturing + registration year, km, owners, colour (factory list, or "another colour" for discontinued paints), registration number/state, accident, insurance, inspection report, condition grade + notes (≤ 500 chars), asking price, showroom, **photos of that car** |
| From the catalogue | Names, body type, fuel, gearbox, ex-showroom, specs, features, overview, photos | Names, body type, fuel, gearbox (from the variant), new price, specs, features |
| Workflow | **No approval.** Publishing puts it live; the dealer can pause and republish. Staff can pause (unpublish) any listing with remarks — the dealer is notified and can fix it and publish again | MarchGear approval as before |

Enforced in `src/server/actions/partner-inventory.ts` whatever the browser sends: Zod strips any specs, features, descriptions, videos, model names, body/fuel/gearbox or ex-showroom; the model and variant must be in the published catalogue (and, for new cars, the dealer's authorisations/line-up); the colour must be a factory colour; names and catalogue facts are written from the catalogue on every save. Bulk publish/submit runs the same checks.

Storage (no extra columns): `partner_vehicles.used` holds the kind's own facts — `UsedVehicleDetails` (+ `variantSlug`, `condition`) for used cars, `NewVehicleDetails` (`variantSlug`, `availability`, `waitingWeeks`) for new cars; a new car on order has `stock = 0`. `description` holds a used car's condition notes (empty for new cars); `specs`/`features`/`videos` are always empty, and `images` is empty for new cars. Public pages read the car itself from the live catalogue (`publicFromCatalogue()` in `src/components/portal/inventory/shared.ts`, `toPublicVehicle()` in `src/server/partner/inventory.ts`).

**Listings whose model or variant isn't in the catalogue** (old free-text listings, or a model staff later unpublished) are never deleted: the dealer sees "Needs a catalogue model — pick the model to keep this listing", and they're hidden from the public dealer page, model pages and `/used-cars` until fixed. `src/db/catalogue-listings.ts` (`npm run db:catalogue-listings [-- --dry-run]`) is an idempotent clean-up: it links rows whose brand + model name match a catalogue model exactly, refreshes catalogue fields, clears dealer-entered descriptive content on new cars and publishes new cars left in `pending_approval`/`approved`.

**Can't find a model?** The portal links to `/dealer/support?new=catalogue`, which opens a ticket prefilled with the "Request a new model" category. Staff add the model in `/admin` → New cars.

## Three independent approval workflows

| Workflow | Table | Dealer side | Admin side | Public effect |
| --- | --- | --- | --- | --- |
| Dealer account | `partners.status` | Wizard → submit → status page | `/admin/dealers/verification` | On approval: a `dealers` row (public `/dealers/<id>`) is created and linked via `partners.public_dealer_id`; the full portal unlocks |
| Vehicle listing — **used cars only** | `partner_vehicles.status` (`kind = used`) | draft → `pending_approval` | `/admin/vehicle-approvals` → "Used cars to review" | Only `published` vehicles are public, mirrored into `used_cars` (id `pv-<id>`, `partner_vehicles.public_used_car_id`) |
| *(no approval)* New-car stock | `partner_vehicles.status` (`kind = new`) | draft → `published` ⇄ `unpublished` (paused) | `/admin/vehicle-approvals` → "New-car stock": view, pause with remarks, publish again | `published` with stock > 0 or on order shows on the dealer's public page and the model page |
| Offer | `partner_offers.status` | draft → `pending_approval` | `/admin/offer-approvals` | Only `approved` offers inside their date window are public (`offerDisplayStatus()` = `active`) |

A dealer can be approved while its used cars/offers are pending. Every submission and decision is written with `recordApproval()` (→ `partner_approvals`) and shown to both sides; admin remarks/corrections go in `admin_remarks` (+ `partners.required_corrections`) and are always displayed to the dealer. Verified business details (legal name, GST, PAN, bank) changed after approval go through `partner_change_requests`.

## Statuses (src/db/enums.ts, labels in src/partner/labels.ts)
- Partner: draft, submitted, pending_approval, under_review, documents_required, changes_requested, approved, rejected, suspended, deactivated. Editable by the dealer in `PARTNER_EDITABLE`.
- Vehicle: draft, pending_approval, changes_requested, approved, published, rejected, unpublished, archived. New cars only use draft, published, unpublished ("paused" — by the dealer, or by staff with `admin_remarks`) and archived; the review statuses apply to used cars. History actions for new cars: `published`, `paused` (dealer), `unpublished` (staff).
- Offer (stored): draft, submitted, pending_approval, changes_requested, approved, rejected, cancelled, paused. Displayed adds scheduled/active/expired from dates — always use `offerDisplayStatus(offer)`.
- CRM: new … closed (`CRM_STATUS`); test drives, tickets, invoices, payments likewise.

## Access control — never trust the client
- Pages: `await requirePartner({ perm?, approved? })` from `@/server/partner/context` (redirects). `approved` defaults to **true**; pass `approved: false` only for pages a pending dealer may use (application status, notifications, support, settings, registration).
- Server Actions: `const ctx = await partnerAction(perm?, { approved? }); if (isActionError(ctx)) return ctx;` then **scope every query by `ctx.partner.id`** (and for "own" leads by `ctx.member.id`).
- Permissions: `src/partner/permissions.ts` (`ctx.can("inventory.manage")`). Owner has everything; members may have custom lists.
- Admin pages/actions: `requireStaff()` (editors + admins); destructive account actions `requireStaff(["admin"])`.
- Dealer users have `users.role = "dealer"` and sign in at `/dealer/login` (7-day session, its own `mg_dealer` cookie). They can't use `/admin` or the website sign-in. Logins are separate (see README › Accounts): use `getSessionUser("dealer")` / `createSession(id, "dealer")` / `destroySession("dealer")`.

## Shared helpers
- `src/server/partner/records.ts`: `reference("VEH")`, `notifyPartner()`, `logPartnerActivity()`, `recordApproval()`.
- `src/server/partner/files.ts` + `POST /dealer/upload` (`kind=media` → public image in `media` with `partner_id`; a doc kind → private `partner_files`), `GET /dealer/files/<id>` (members + staff only). Client: `src/components/portal/uploader.tsx` (`ImageUploader`, `DocumentUploader`, `uploadDealerImage`, `uploadDealerDocument`). Limit 900 KB (MySQL packet on the dev server is 1 MB).
- `src/server/partner/crypto.ts`: bank account numbers are stored with `encryptField()`; show `maskAccount()`; only staff may see the full number (decrypt server-side on the admin details page).
- Content blocks used here: `partnerPlans` (plans & prices) and `billing` (MarchGear's payment details — empty until set; never invent bank details).
- UI: `src/components/portal/ui.tsx` (PortalHeader, Panel, StatCard, Badge, Table…), `src/components/ui/*` (Button, TextField, SelectField, Modal, Drawer, Tabs, Segmented…), toasts via `useUI()`. Validate with Zod on the server (`invalid()` from `@/server/validation`) and show `fieldErrors` under fields.

## Conventions
- Indian formats in `src/partner/application.ts` (`PATTERNS`: mobile, GST, PAN, IFSC, PIN, account).
- Brands/models/variants come from the catalogue (`getCatalog()` / `useCatalog()`), never hard-coded — and never typed in by a dealer (see "The catalogue rule").
- Times are stored UTC; show IST (`formatDateTime` / `formatDay`).
- No fake functionality: if something needs an external service that isn't configured (SMS, payment gateway, email), say so in the UI and use an honest fallback (e.g. dev OTP shown on screen in development, bank transfer + UTR for payments).
