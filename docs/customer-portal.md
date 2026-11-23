# Customer portal (/account) — architecture & conventions

The website customer's own area. It replaces the old single `/profile` page, which now redirects to `/account`. It lives inside the normal site header and footer, with its own sidebar (`src/components/customer/account-shell.tsx`, layout `src/app/(site)/account/layout.tsx`). It brings together everything a customer has done on MarchGear: saved cars, the cars they own, enquiries and dealer replies, test drives, insurance quotes, reviews and notifications.

## Rules
- **Customer login only.** Every page calls `requireUser("/account/<path>")` from `@/server/auth`; that's the customer session `mg_session`. Every action checks `getSessionUser("customer")`. Staff, dealer and insurer accounts never reach it: logins are separate (README › Accounts).
- **Scope every query by the customer's user id.** Website leads link through `leads.userId`. Dealer CRM rows link through `partner_leads.site_lead_id → leads.user_id`, and test drives through `partner_test_drives.lead_id → partner_leads → leads.user_id`. Insurance enquiries link through `ins_enquiries.user_id`, owner reviews through `owner_reviews.user_id`, the garage through `customer_vehicles.user_id`, and notifications through `customer_notifications.user_id`.
  - **Never match by email or mobile.** They aren't verified, so matching would leak other people's requests.
- **Customer-safe data only.**
  - Never show dealer or insurer internal notes (`partner_lead_events`, `ins_enquiry_events`), staff notes, assignees' internal details or other customers' data.
  - Show the dealership or insurer name and a customer-friendly status.
- **Honesty.**
  - Insurance premiums are indicative (`INDICATIVE_NOTE`). Quotes carry their Indicative or Insurer-authorised label.
  - Policies are "reported by the insurer" unless staff verified the conversion.
  - Reminders are the customer's own dates. Don't promise SMS or email: they aren't configured. Reminders show in the portal and as notifications.
- **Design:** same quality bar as the dealer and insurance portals. Use `PortalHeader`, `Panel`, `StatCard`, `Badge`, `Table` (`src/components/portal/ui.tsx`) and `src/components/ui/*`. Background `#F6F6F6`, white panels, 3–4px radii, minimal shadows, responsive from 360px.

## Sections (owner in brackets)

| Route | What |
| --- | --- |
| `/account` | **Overview** [A]: greeting, KPIs, reminders, next test drive, latest replies, offers on saved cars, suggested next steps |
| `/account/garage`, `/account/garage/new`, `/account/garage/[id]` | **My garage** [C]: cars the customer owns, with insurance/PUC/service/warranty dates, reminders and quick actions |
| `/account/saved` | **Saved cars** [A]: new and used cars from `wishlist_items` with live price, availability and current dealer offers |
| `/account/comparisons` | **Comparisons** [A]: the compare list (client store) plus quick compare sets of saved cars |
| `/account/enquiries`, `/account/enquiries/[ref]` | **Enquiries** [B]: every website request with status, the dealer that's handling it and its progress |
| `/account/test-drives` | **Test drives** [B]: requested and booked test drives; cancel, or ask for another time |
| `/account/insurance` | **Insurance** [C]: quote requests, quotes received, policies (reported or verified), renewal reminders |
| `/account/reviews` | **My reviews** [A]: owner reviews written, with moderation status |
| `/account/notifications` | **Notifications** [B]: read/unread, mark all read |
| `/account/profile` | **Personal details** [A] |
| `/account/security` | **Password & security** [A]: change password, active sessions, sign out other devices |
| `/account/preferences` | **Preferences** [A]: alerts and how to contact the customer (`myPreferencesAction` / `savePreferencesAction`) |
| `/account/privacy` | **Privacy & data** [A]: download my data (JSON), delete my account |

## Shared helpers (contracts between teams — keep these signatures)
- `src/server/customer/notify.ts` (foundation): `notifyCustomer(userId, { kind, title, body?, href? })` (never throws; no-op for guests or non-customers), `customerOfSiteLead(leadId)`, `customerOfPartnerLead(partnerLeadId)`.
- `src/server/customer/requests.ts` [B]:
  - `getCustomerEnquiries(userId, { limit? }) → CustomerEnquiry[]`
  - `getCustomerTestDrives(userId) → CustomerTestDrive[]`
  - `CustomerEnquiry = { reference, type: LeadType, title, status: { label, tone }, createdAt (ISO), dealerName | null, href }`
  - `CustomerTestDrive = { id, reference, car, dealerName, showroom | null, when (ISO) | null, status: { label, tone }, upcoming: boolean, href }`
- `src/server/customer/notifications.ts` [B]: `getCustomerNotifications(userId, { limit?, unreadOnly? })`, `countUnreadCustomerNotifications(userId)`.
- `src/server/customer/garage.ts` [C]:
  - `getGarage(userId)` returns the `customer_vehicles` rows.
  - `getGarageReminders(userId, today?) → GarageReminder[]`.
  - `GarageReminder = { vehicleId, vehicle, kind: "insurance" | "puc" | "service" | "warranty", dueOn, daysLeft, label, tone, action: { label, href } | null }`
- `src/server/customer/insurance.ts` [C]: `getCustomerInsuranceSummary(userId) → { requests, quotesReady, policies, latest: { reference, title, status: { label, tone }, href }[] }`.

## Notifications to customers (who calls `notifyCustomer`) [B]
- **Dealer CRM:** a customer-visible status change on a `partner_leads` row that came from a signed-in customer's website lead, i.e. contacted, test drive scheduled, booking completed, closed or lost. Kind `enquiry`.
- **Dealer test drives:** accepted, scheduled, rescheduled, completed, rejected or cancelled by the dealer. Kind `test_drive`.
- **Admin leads** (`/admin/leads`): status changes on a customer's lead. Kind `enquiry`.
- **Insurance vendor:** a quote submitted to the customer (link `/insurance/quote/<token>`), and an enquiry marked policy issued. Kind `insurance`.
- **Admin review moderation:** an owner review approved or rejected. Kind `review`.
- **Garage reminders:** generated idempotently when the customer visits (once per vehicle, kind and due date). Kind `reminder`.

Customer actions that reach dealers [B]: cancelling a test drive, or asking for another time. Both notify the dealership (`notifyPartner`) and show in the dealer CRM.
