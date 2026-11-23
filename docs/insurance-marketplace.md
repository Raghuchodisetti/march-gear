# Insurance marketplace — architecture & conventions

Three interfaces in the same Next.js app and MySQL database:

1. **Public insurance website** — `/insurance/*` (inside the `(site)` group, so it has the normal header/footer).
2. **Insurance vendor portal** — `/insurance-vendor/*` for insurers and registered intermediaries (brokers, corporate agents, web aggregators…). Own shell (`PortalShell variant="insurer"`), own login, users with `users.role = "insurer"`.
3. **Insurance administration** — `/admin/insurance/*` inside the existing staff admin, plus the site-wide ad system at `/admin/advertising/*`.

It follows the dealer partner portal's patterns (see `docs/dealer-portal.md`) but uses its own tables (`ins_*`), so the dealer portal is untouched.

## Honesty rules (non-negotiable)

- Every premium the site calculates is **indicative**. Show `INDICATIVE_NOTE` (`src/insurance/labels.ts`) next to it, label it "Indicative premium", and never call it a quote.
- Every vendor quotation is either **Indicative** or **Insurer-authorised** (`ins_quotes.authorization`). Insurer-authorised requires the insurer's own quotation reference (`insurerQuoteRef`). The label is shown on screen, on the customer's quote page and in the PDF.
- MarchGear does **not** issue policies, take payments for policies, verify OTPs by SMS or process claims. No payment gateway: vendors pay MarchGear invoices by bank transfer/UPI/cheque and record the UTR; staff verify. OTP: show the code on screen in development only (as the dealer portal does) and say SMS/email delivery isn't configured.
- Claim settlement figures are shown publicly **only** when staff have verified them (`ins_companies.claim_info.verified`), with year and source.
- Never invent real insurers, real regulator numbers, real bank details or real claim figures. Demo data uses clearly fictional names ending in "(demo)".
- Policy-issued conversions are "reported by the vendor" until staff verify them (`conversion_verified_at`). Dashboards keep the two apart.
- Collected revenue (verified payments − refunds) is always shown separately from outstanding (unpaid invoices).

## Approval workflows (independent)

| Workflow | Table / status | Vendor side | Admin side | Public effect |
| --- | --- | --- | --- | --- |
| Vendor account | `ins_vendors.status` (INS_VENDOR_STATUS) | 7-step wizard → submit → `/insurance-vendor/application-status` | `/admin/insurance/vendor-approvals`, `/admin/insurance/vendors/[id]` | Approved vendors get the full portal. For `category = insurer` staff link/create the `ins_companies` row (`ins_companies.vendor_id`). Branches are copied from the application into `ins_branches` on approval. |
| Product | `ins_products.status` (INS_PRODUCT_STATUS) | draft → submit → `pending_approval` | `/admin/insurance/product-approvals` | Only `published` products of `approved` vendors with an active company are public. |
| Coverage item / add-on | `ins_covers.status` (INS_COVER_STATUS) | `/insurance-vendor/coverage`, `/insurance-vendor/add-ons` | `/admin/insurance/coverage`, `/admin/insurance/add-ons` | Only `approved` covers appear on public product pages / in estimates. A product can't be approved while a cover it uses is not approved (admin can approve them together from the product review). |
| Promotional campaign | `ins_campaigns.status` (INS_CAMPAIGN_STATUS) | `/insurance-vendor/campaigns` | `/admin/insurance/campaigns` | Public only when `campaignDisplayStatus() === "active"` and the vendor is approved. |
| Ad campaign + creatives | `ad_campaigns.status`, `ad_creatives.status` | `/insurance-vendor/advertising` | `/admin/advertising` | Serves when the campaign is approved, today is in its dates and (banners) it has an approved creative. |

Product rules: submitting lands in `pending_approval` (history records "submitted"). Admin: approve (→ `approved`), approve & publish (→ `published`), publish, unpublish (→ `approved`), request changes (→ `changes_requested` + `required_corrections`), reject, suspend (→ `suspended`, locked). The vendor may publish an `approved` product and unpublish a `published` one. Editing an approved/published product sends it back to `pending_approval` (offline until re-approved) — confirm first. Publishing respects the plan's `products` limit (`insurerPlans`).

Every submission and decision is written with `recordInsApproval()` (→ `ins_approvals`) and shown to both sides, except `action = "internal_note"` (staff-only; never select those rows for vendor-facing pages). Staff messages go in `admin_remarks`; required fixes in `required_corrections`.

## Access control — never trust the client

- Separate logins: the insurance vendor portal has its own session cookie (`mg_insurer`), apart from the website (`mg_session`), the staff admin (`mg_admin`) and the dealer portal (`mg_dealer`). `getSessionUser("insurer")` only returns insurer accounts; routes shared with staff (e.g. `/insurance-vendor/files/<id>`) check `getStaffUser()` and the vendor context separately.

- Vendor pages: `await requireInsurer({ perm?, approved? })` from `@/server/insurance/context`. `approved` defaults to **true**; pass `approved: false` only for application status, notifications, support, settings.
- Vendor Server Actions: `const ctx = await insurerAction(perm?, { approved? }); if (isInsurerError(ctx)) return ctx;` then **scope every query by `ctx.vendor.id`** (and "own" enquiries by `ctx.member.id`).
- Permissions: `src/insurance/permissions.ts` (`ctx.can("products.manage")`).
- Admin pages/actions: `requireStaff()`; destructive account actions `requireStaff(["admin"])`. Log admin changes with `audit()` (`src/server/audit.ts`) as well as `recordInsApproval()` where it's a workflow step.
- Public Server Actions: Zod-validate, honeypot field, rate-limit with `allowFromIp()` / `take()` (`src/server/rate-limit.ts`).

## Shared code (foundation — import, don't fork)

- Enums: `src/db/enums.ts` (INS_*, AD_*). Tables: `src/db/schema.ts` (`insCompanies`, `insVendors`, `insMembers`, `insBranches`, `insFiles`, `insCovers`, `insProducts`, `insCampaigns`, `insEnquiries`, `insEnquiryEvents`, `insQuotes`, `insRenewals`, `insNotifications`, `insTickets`, `insTicketMessages`, `insInvoices`, `insPayments`, `insRefunds`, `insApprovals`, `insChangeRequests`, `insActivity`, `insEvents`, `adPlacements`, `adCampaigns`, `adCreatives`, `adStats`; `media.insVendorId`). Migration `drizzle/0008_insurance_marketplace.sql`.
- JSON shapes: `src/insurance/types.ts`. Labels/tones/derived statuses: `src/insurance/labels.ts` (`quoteDisplayStatus`, `campaignDisplayStatus`, `adDisplayStatus`, `INDICATIVE_NOTE`). Permissions: `src/insurance/permissions.ts`. Standard covers (zero dep, engine protection, RSA, RTI, consumables, key replacement, PA, tyre, electrical accessories…): `src/insurance/covers.ts`. Wizard steps & empty application: `src/insurance/application.ts`.
- Estimator: `src/insurance/estimator.ts` — `estimatePremium()`, `eligibilityProblems()`, `parseEngineCc()`, `vehicleAgeMonths()`, `effectiveNcb()`, `CATEGORY_TERMS`, `DEFAULT_PRODUCT_PRICING()`. Config comes from the `insurancePricing` content block (`(await getCatalog()).content.insurancePricing` / `useCatalog().content.insurancePricing`). Ex-showroom price = the catalogue variant's `price`; engine cc = `parseEngineCc(car.engine)`; EV motor kW = `car.ev?.motorKw`.
- Search params: `src/insurance/search.ts` (`parseSearch`, `searchQuery`, `normaliseReg`, `isValidReg`, `isNewVehicle`, `EMPTY_SEARCH`, `FUELS`, `NCB_OPTIONS`).
- Server: `src/server/insurance/context.ts` (above, plus `vendorName()`), `records.ts` (`insReference("PRD")`, `shareToken()`, `notifyInsurer()`, `logInsurerActivity()`, `recordInsApproval()`), `files.ts` (`saveInsurerFile`, `readInsurerFile`, `saveInsurerMedia`, `privateFileHeaders`), `billing.ts` (`insertInsInvoice()` — MGI/26-27/00001 series; `insInvoiceDisplayStatus()`).
- Uploads: `POST /insurance-vendor/upload` (`kind=media` → public `/media` image with `ins_vendor_id`; a doc kind → private `ins_files`), `GET /insurance-vendor/files/<id>` (members + staff). Client: `src/components/insurance/vendor/uploader.tsx` (`InsImageUploader`, `InsDocumentUploader`, `uploadInsurerImage`, `uploadInsurerDocument`, `insFileUrl`). Limit 900 KB.
- Bank account numbers: `encryptField()` / `maskAccount()` / `decryptField()` from `src/server/partner/crypto.ts`.
- Content blocks (`src/content/blocks/`): `insurancePage`, `insuranceGuides` (public copy), `insurancePricing` (estimator), `insuranceSettings` (quote validity, max insurers per request, trial/payment terms, renewal window, lead fee, compliance note, vendor support contacts), `insurerPlans` (vendor plans), `billing` (MarchGear's payment details — shared with dealers, empty until set).
- UI: `src/components/portal/ui.tsx` (PortalHeader, Panel, StatCard, Badge, Table, Th, Td, FilterForm, FilterSelect, SearchInput, Pagination, formatDateTime, formatDay), `src/components/admin/ui.tsx` (AdminHeader…), `src/components/admin/partner-ui.tsx` (EmptyState, LinkTabs, Facts…), `src/components/ui/*` (Button, TextField, SelectField, TextArea, Segmented, Modal, Drawer, Tabs, Accordion), charts in `src/components/portal/analytics/charts.tsx` (TrendPanel, Donut, Funnel, InlineBar), toasts via `useUI().toast`. PDFs with `jspdf` (already a dependency). Money: `rupees()` from `src/components/portal/billing/shared.ts`; IST day: `istDate()` there; `todayISO()` in `src/server/validation.ts`.
- Validation: Zod on the server; return `ActionResult` (`src/lib/action-result.ts`) with `fieldErrors`; `invalid()` from `src/server/validation.ts`. Indian formats in `src/partner/application.ts` (`PATTERNS`: mobile, GST, PAN, IFSC, PIN).
- States/cities: `src/data/states.ts`, `src/data/india-cities.ts`, `StateCityFields` (`src/components/account/state-city-fields.tsx`).

## Cross-interface contracts

- **Public enquiry** (`src/server/actions/insurance-public.ts`): a customer asks one or more products (max `insuranceSettings.maxQuoteRequests`) for a quote → one `ins_enquiries` row per product (vendor = product's vendor, `status = "new"`, `source`, `estimate` snapshot, `consentAt`, `userId` if signed in, `campaignId` / `adCampaignId` from `?campaign=` / `?ad=`), an `ins_enquiry_events` "created" row, `notifyInsurer(kind "enquiry", href "/insurance-vendor/enquiries/<id>")`, and `recordAdEnquiry()` when it came from an ad. A repeat request for the same product from the same mobile within 24 h updates the existing enquiry instead of duplicating it. `intent = "renewal"` also creates an `ins_renewals` row (`source "enquiry"`, `expiryDate` = the customer's policy expiry — required for renewals).
- **Vendor quote** (`src/server/actions/ins-quotes.ts`): built from an enquiry with the estimator; `submitted` sets `submittedAt`, moves the enquiry to `quote_submitted` and logs a "quote" event. The customer's link is `/insurance/quote/<shareToken>` (copy link / WhatsApp share — email isn't configured). The public quote page sets `viewedAt` on first view and lets the customer respond: accepted ("I'm interested" → enquiry `interested`) or declined; both notify the vendor and log an event.
- **Signed-in customers** see their requests and any submitted quotes on `/insurance/quotes` ("Your quote requests").
- **Policy issued**: the vendor marks an enquiry `policy_issued` with policy number/premium (reported). Staff verify in `/admin/insurance/enquiries` (`conversionVerifiedAt`); if `insuranceSettings.leadFeeEnabled`, verification raises a `lead_fee` invoice. The vendor can add an issued policy to renewals (`source "policy"`, expiry = issue date + 1 year − 1 day).
- **Analytics beacons**: `POST /api/insurance/track` `{ kind: InsTrackKind, vendorId, refId }` → `ins_events` (rate-limited, ignores unknown ids). Ad impressions/clicks are separate (`/api/ads/track`, `/ads/click/<id>` → `ad_stats`).
- **Ads**: `src/server/ads/serve.ts` (`pickBanner(placement)`, `getSponsoredListings(placement, limit)`, `recordAdEnquiry(campaignId)`) and `<AdSlot placement="…" />` (`src/components/ads/ad-slot.tsx`, a server component that renders nothing when no campaign is live). Placement keys: `src/ads/placements.ts` (`home_banner`, `insurance_home_banner`, `insurance_category_banner`, `insurance_sponsored_listing`). Sponsored product cards wrap themselves in `<AdImpression campaignId>` (`src/components/ads/ad-impression.tsx`), show a "Sponsored" label, and link through `adClickHref(campaignId)` (`src/ads/links.ts`). Ad clicks to internal pages carry `?ad=<campaignId>` so enquiries can be attributed. Approving an advertiser's campaign raises an `advertising` invoice (`insertInsInvoice`), due by the start date or within the payment terms, whichever is sooner; house (MarchGear) campaigns aren't invoiced.
- **Public queries** live in `src/server/insurance/public.ts` (see the file header for what's public).

## Conventions

- Brands/models/variants come from the catalogue (`getCatalog()` / `useCatalog()`), never hard-coded.
- Times are stored UTC; show IST (`formatDateTime` / `formatDay`). Date-only columns are IST calendar days (`istDate()`).
- References via `insReference()`; retry on duplicate (`isDuplicate()` from `src/server/db-errors.ts`).
- Notifications to vendors via `notifyInsurer()`; vendor activity via `logInsurerActivity()`.
- Layout: max width 1320px in the portal, responsive down to 360px with no horizontal scroll; tables scroll inside their wrapper on mobile. Premium, corporate, minimal shadows, 3–4px radii, the site's tokens (`ink`, `ink-2`, `mist`, `line`, `muted`, `red`).
- No dead buttons: every visible control works or is clearly disabled with a reason.
