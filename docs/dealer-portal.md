# Dealer partner portal — architecture & conventions

The dealer portal (`/dealer/*`) lets dealerships apply to become MarchGear partners, then manage inventory, offers, enquiries, test drives and staff. MarchGear staff review everything in the admin panel (`/admin/*`, "Dealer partners" section). Same Next.js app, same MySQL database, separate shell and login.

## Three independent approval workflows

| Workflow | Table | Dealer side | Admin side | Public effect |
| --- | --- | --- | --- | --- |
| Dealer account | `partners.status` | Wizard → submit → status page | `/admin/dealers/verification` | On approval: a `dealers` row (public `/dealers/<id>`) is created and linked via `partners.public_dealer_id`; the full portal unlocks |
| Vehicle listing | `partner_vehicles.status` | draft → `pending_approval` | `/admin/vehicle-approvals` | Only `published` vehicles are public. Used cars are mirrored into `used_cars` (id `pv-<id>`, `partner_vehicles.public_used_car_id`); new-car stock shows on the dealer's public page |
| Offer | `partner_offers.status` | draft → `pending_approval` | `/admin/offer-approvals` | Only `approved` offers inside their date window are public (`offerDisplayStatus()` = `active`) |

A dealer can be approved while its vehicles/offers are pending. Every submission and decision is written with `recordApproval()` (→ `partner_approvals`) and shown to both sides; admin remarks/corrections go in `admin_remarks` (+ `partners.required_corrections`) and are always displayed to the dealer. Verified business details (legal name, GST, PAN, bank) changed after approval go through `partner_change_requests`.

## Statuses (src/db/enums.ts, labels in src/partner/labels.ts)
- Partner: draft, submitted, pending_approval, under_review, documents_required, changes_requested, approved, rejected, suspended, deactivated. Editable by the dealer in `PARTNER_EDITABLE`.
- Vehicle: draft, pending_approval, changes_requested, approved, published, rejected, unpublished, archived.
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
- Brands/models/variants come from the catalogue (`getCatalog()` / `useCatalog()`), never hard-coded.
- Times are stored UTC; show IST (`formatDateTime` / `formatDay`).
- No fake functionality: if something needs an external service that isn't configured (SMS, payment gateway, email), say so in the UI and use an honest fallback (e.g. dev OTP shown on screen in development, bank transfer + UTR for payments).
