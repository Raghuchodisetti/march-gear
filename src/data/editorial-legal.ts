/* ──────────────────────────────────────────────────────────────
   Launch copy for the four policies: privacy (DPDP Act, 2023),
   terms & conditions, cookies and refunds & cancellations.

   Written in plain language to match what the code actually does
   (forms, Server Actions, cookies, browser storage, billing rules).
   Admins edit it at /admin/content (blocks “legal”, “cookiePolicy”
   and “refundPolicy”); this file is only the default. It has not
   been reviewed by a lawyer — have counsel review it before launch.

   Text can use:
   - [label](/path) links (also https://, mailto:, tel: and #anchors)
   - {tokens} filled in from the business details in the “site”
     block (see LEGAL_TOKENS) and, on the refund policy, from the
     billing settings.
   ────────────────────────────────────────────────────────────── */

export const LEGAL_UPDATED = "2026-11-24";

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  list?: string[];
}

/** Tokens every policy can use, with what they become. Shown to admins as a hint. */
export const LEGAL_TOKENS: Record<string, string> = {
  company: "Registered legal name, or “MarchGear” while it's empty",
  address: "Registered office address, or the main address line",
  email: "Main contact email",
  supportEmail: "Support email",
  phone: "Main phone number",
  grievance: "Grievance Officer's name, email and phone — or the support email and a note that one will be named",
  grievanceEmail: "Grievance Officer's email, or the support email",
  jurisdiction: "“the courts at <city>”, or “the courts having jurisdiction over our registered office”",
};

/* ── Privacy policy ─────────────────────────────────────────── */

export const privacySummary: string[] = [
  "We only ask for what a form or feature needs, and each form says who will contact you and why before you agree.",
  "Your request goes only to the dealer, seller, insurer or intermediary it's about. We never sell your personal data.",
  "Analytics cookies are used only if you allow them.",
  "Download your data or delete your account at any time from [Privacy & data](/account/privacy).",
  "Questions or complaints: {grievanceEmail}.",
];

export const privacySections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    paragraphs: [
      "MarchGear (“MarchGear”, “we”, “us”) is operated by {company}, {address}. We run marchgear.in: car research, reviews and tools, and a marketplace that connects car buyers and owners with independent dealers, sellers, insurers and insurance intermediaries.",
      "For the personal data described here, we are the Data Fiduciary under India's Digital Personal Data Protection Act, 2023 (the “DPDP Act”). When a dealer, insurer or intermediary you have chosen receives your request, they decide how to use it to serve you and are responsible for it under their own privacy policies.",
      "This policy explains what we collect, why, who we share it with, how long we keep it and how you can use your rights. It covers the website and its customer, dealer partner and insurance vendor portals.",
    ],
  },
  {
    id: "what-we-collect",
    title: "What we collect and why",
    paragraphs: ["We collect personal data only when you give it to us for a purpose, and only what that purpose needs. Fields marked “optional” really are optional."],
    list: [
      "Your account: name, email, a password (stored only as a one-way hash), optionally your mobile number, your state and city (to show local prices and dealers), your alert and contact preferences, saved cars, cars you add to My garage (registration number, insurer, policy number and renewal dates are all optional) and when you accepted our terms. Used to run your account.",
      "Requests to dealers and sellers (test drives, best price, dealer contact, offers, used-car offers): your name, mobile, city, sometimes your email, the car, dealer or listing you asked about, your message and answers such as a preferred date or buying timeline. Used to respond to that request.",
      "Insurance quote requests: your name, mobile, optional email, your car's details (brand, model, year, registration city and any previous-policy details you give), the plans and add-ons you chose, and your message. Sent to the insurers or intermediaries you selected so they can quote. Expert and claim-help callbacks: your contact details and what you tell us, used only to call you back.",
      "PDI inspections: name, mobile, city, the car and dealership, delivery date and plan, to arrange the inspection. The free PDI checklist: name, mobile, optional email, car and delivery date, to tailor the checklist and contact you about an inspection. The checklist downloads to your device, and these details are also kept in your browser so it stays unlocked.",
      "Selling your car: car details, kilometres, city, name and mobile, to give you an indicative price and arrange an inspection and offers.",
      "Owner reviews: your review, rating, car details, and the display name and city you choose, which are published once our team has checked the review. Messages to our team: name, email, optional phone, topic and message, used only to reply.",
      "Newsletter: your email and the page or topics you signed up from. We collect these only if you tick the newsletter box, which is always a separate choice.",
      "Dealer partner and insurance vendor accounts: contact details of the people who sign in, the business's legal details, GSTIN, PAN, registration or licence numbers, KYC documents, showroom or branch details and bank details for verification and refunds (account numbers are encrypted). Used to verify the business, run its portal, invoice it and keep the records the law requires.",
      "Technical data: when you sign in, we store a hashed session token with your browser type and IP address, so you can see and sign out your devices. Our servers briefly use IP addresses to block abuse; these counters aren't stored. With your permission only, Google Analytics collects pages viewed, device details and approximate location. See the [Cookie Policy](/cookies).",
    ],
  },
  {
    id: "legal-basis",
    title: "Our legal basis",
    paragraphs: ["Under the DPDP Act, we process your personal data either with your consent or for a “legitimate use” the Act allows."],
    list: [
      "Consent: for every request you send through a form, your account, reviews, the newsletter and analytics cookies. Each form tells you who will contact you and why, with an unticked box, before you agree.",
      "Legitimate uses: where you have given us data for a specific purpose and haven't said you object (for example, replying to a message), to comply with the law or a court order, to respond to a medical emergency or a threat to safety, and to keep the records tax and company law require (such as invoices to dealer partners and insurance vendors).",
      "We don't make decisions about you with legal or similarly significant effects by automated means. Indicative prices, premiums and valuations are worked out by formula and are only estimates.",
    ],
  },
  {
    id: "sharing",
    title: "Who we share it with",
    paragraphs: ["We don't sell your personal data or share it for anyone else's advertising. We share it only as follows."],
    list: [
      "The dealer or seller you chose. A request made from a dealer partner's page, listing or offer goes to that dealer's MarchGear portal. If your request isn't about a particular dealer, our team handles it and, where a dealer needs to act (for example, to give an on-road price or arrange a test drive), passes it to a partner dealer in your city, for that request only.",
      "The insurers and intermediaries you selected. A quote request goes only to the insurers, brokers or agents whose plans you picked. They contact you, quote and, if you buy, issue the policy under their own terms. MarchGear doesn't sell or issue policies, or process claims.",
      "Our service providers (data processors), who run the site for us: website hosting, our database host, image delivery and, only with your consent, Google Analytics. They may use the data only to provide their service to us.",
      "Authorities, when the law requires it (for example, a valid request from a court, the police or a regulator), and professional advisers such as auditors and lawyers, who are bound by confidentiality.",
      "A buyer or successor, if MarchGear's business is reorganised, merged or sold. They would be bound by this policy.",
    ],
  },
  {
    id: "retention",
    title: "How long we keep it",
    paragraphs: [
      "We keep personal data only for as long as we need it for the purpose you gave it for, or as the law requires. After that we delete it, or remove the details that identify you.",
    ],
    list: [
      "Your account: while it's open. When you delete it, your profile, preferences, saved cars, garage, notifications and sessions are deleted straight away.",
      "Requests to dealers, sellers and insurers, and messages to our team: up to 24 months after the last activity on them, so we can handle follow-ups and disputes. Deleting your account unlinks them from you. [Ask us](#use-your-rights) to erase them sooner.",
      "Newsletter: until you unsubscribe.",
      "Published reviews: while they remain useful to other buyers. You can ask us to remove yours at any time.",
      "Dealer partner and insurance vendor records: while the account is active, then for as long as tax and company laws require for invoices and accounts (generally up to 8 years).",
      "Signed-in sessions: until they expire or you sign out. Cookies: as listed in the [Cookie Policy](/cookies).",
    ],
  },
  {
    id: "security",
    title: "How we protect it",
    paragraphs: [
      "Data travels over encrypted (HTTPS) connections. Passwords are stored as bcrypt hashes and sign-in sessions as hashed tokens. Dealers' and insurers' bank account numbers are encrypted with AES-256 before they're stored. Private documents are available only to the business that uploaded them and to authorised MarchGear staff, and every staff page checks the person's role on the server.",
      "No system is completely secure. If a personal data breach happens, we will inform the Data Protection Board of India and the people affected, as the DPDP Act requires.",
    ],
  },
  {
    id: "your-rights",
    title: "Your rights",
    paragraphs: ["Under the DPDP Act, you have the right to:"],
    list: [
      "Access: get a summary of the personal data we hold about you, what we do with it, and who we have shared it with.",
      "Correction and erasure: correct, complete or update your data, and have it deleted once it's no longer needed for the purpose you gave it for, unless the law requires us to keep it.",
      "Withdraw consent: at any time, as easily as you gave it. This doesn't affect what we did before, but some requests can't continue without it (a dealer can't call you back without your number).",
      "Grievance redressal: complain to us and get a response, and if you're not satisfied, complain to the Data Protection Board of India.",
      "Nominate: name another person to use these rights for you if you die or become unable to.",
    ],
  },
  {
    id: "use-your-rights",
    title: "How to use your rights",
    paragraphs: [
      "Signed in? You can do most of this yourself, using the options below. For anything else, such as erasing requests you sent as a guest, nominating someone, or getting a summary of who we've shared your data with, email {supportEmail} from the address you used with us, or tell us your mobile number and request reference. We may ask you to confirm who you are.",
      "We aim to reply within 30 days, and always within the time the DPDP Rules allow. You also have duties under the Act: give us accurate information, don't impersonate anyone, and don't file false or frivolous complaints.",
    ],
  },
  {
    id: "children",
    title: "Children",
    paragraphs: [
      "MarchGear is meant for adults. It isn't directed at anyone under 18, and we don't knowingly process a child's personal data without verifiable consent from a parent or lawful guardian. We don't track children or target advertising at them. If you think a child has given us their details, write to {supportEmail} and we'll delete them.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies and browser storage",
    paragraphs: [
      "We use essential cookies to keep you signed in and to remember your cookie choice, and your browser's storage for saved cars, your compare list and your city. Analytics cookies are set only if you allow them. The [Cookie Policy](/cookies) lists each one and how to change your choice.",
    ],
  },
  {
    id: "cross-border",
    title: "Where your data is processed",
    paragraphs: [
      "Our hosting, database and image-delivery providers, and Google Analytics if you allow it, may process data on servers outside India. The DPDP Act allows this except to countries the Central Government restricts by notification. We won't transfer personal data to any such country.",
    ],
  },
  {
    id: "grievance",
    title: "Grievance Officer and contact",
    paragraphs: [
      "If you have a question or complaint about how we handle your personal data, or about content on the site, contact {grievance}.",
      "We acknowledge complaints within 24 hours and aim to resolve them within 15 days. If you're not satisfied with our response, you can complain to the Data Protection Board of India.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this policy",
    paragraphs: [
      "When we change this policy, we update the date at the top. If a change affects how we use data you've already given us, we'll tell you on the site, and ask for your consent again where the law requires it.",
    ],
  },
];

/* ── Terms & conditions ─────────────────────────────────────── */

export const termsSummary: string[] = [
  "MarchGear helps you research cars and connects you with independent dealers, sellers, insurers and intermediaries.",
  "We don't sell cars or insurance, issue policies or settle claims.",
  "Prices, premiums and valuations on the site are indicative. Confirm them with the business before you pay.",
  "Reviews must be your own honest experience. We check them before they're published.",
  "Indian law applies.",
];

export const termsSections: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    paragraphs: [
      "These Terms & Conditions (“Terms”) apply to your use of the MarchGear website and its customer, dealer partner and insurance vendor portals (together, the “Service”), operated by {company} (“MarchGear”, “we”, “us”). By using the Service or creating an account, you agree to them. If you don't agree, please don't use the Service.",
      "Our [Privacy Policy](/privacy), [Cookie Policy](/cookies) and [Refund & Cancellation Policy](/refund-policy) form part of these Terms.",
    ],
  },
  {
    id: "the-service",
    title: "What MarchGear is, and isn't",
    paragraphs: [
      "MarchGear is a car research platform and marketplace. We publish research, reviews, prices and tools, and we connect car buyers and owners with independent dealers, sellers, insurers and insurance intermediaries.",
    ],
    list: [
      "MarchGear isn't a car dealer. We don't sell, buy or deliver vehicles. Any booking, purchase, finance or service agreement is between you and the dealer or seller.",
      "MarchGear isn't an insurer, insurance broker or agent. We don't sell or issue policies, collect premiums, or process or settle claims. Quotations, policies and claims are between you and the insurer or intermediary you choose, under their terms.",
      "PDI inspections and the sell-your-car service are arranged by MarchGear as described on those pages, and paid for as set out in our [Refund & Cancellation Policy](/refund-policy).",
    ],
  },
  {
    id: "prices-and-information",
    title: "Prices, premiums and valuations are indicative",
    paragraphs: [
      "Prices, on-road estimates, offers, specifications, EMIs, insurance premiums, IDVs and valuations on MarchGear are indicative. They're based on information from manufacturers, dealers and insurers and on our own calculations, may be out of date or incomplete, and are not an offer. Always confirm the final price, premium, variant, terms and availability with the dealer, seller or insurer before you pay or sign.",
      "While we launch, parts of the catalogue, including some listings, reviews, ratings, statistics and dealer details, are sample data, as noted at the foot of every page. Don't rely on them to make a decision.",
      "Photographs are representative and may not show the exact model, variant or colour described.",
    ],
  },
  {
    id: "accounts",
    title: "Your account",
    paragraphs: [
      "You must be 18 or over to create an account or send a request. Give accurate details, keep your password secure, and tell us promptly at {supportEmail} if you think someone else has used your account. You're responsible for what happens under your account.",
      "You can close your account at any time from [Privacy & data](/account/privacy).",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    paragraphs: ["When you use the Service, you agree not to:"],
    list: [
      "Send requests in someone else's name, or give a mobile number or email address that isn't yours.",
      "Copy or harvest content or data from the Service in bulk, or use bots or scrapers (search engines that follow our robots rules are welcome).",
      "Interfere with the Service's security or operation, probe it for weaknesses without our permission, or try to reach accounts or data that aren't yours.",
      "Use the Service for anything unlawful, fraudulent or misleading, or to send spam.",
      "Upload malware, or content that infringes anyone's rights.",
    ],
  },
  {
    id: "user-content",
    title: "Reviews and other content you post",
    paragraphs: [
      "When you post a review or other content, you confirm it's your own honest experience and that you have the right to share it. You keep ownership of it, and give MarchGear a non-exclusive, royalty-free, worldwide licence to host, publish, adapt (for example, to fit a layout) and display it on the Service, with the display name and city you chose. You can ask us to remove it at any time.",
      "We check reviews before they appear. We may shorten or tidy them without changing their meaning, or decline or remove them. We won't publish content that:",
    ],
    list: [
      "Is false or misleading, or was written in exchange for payment, discounts or other incentives, or by a business about itself or a competitor.",
      "Contains other people's personal information, such as phone or registration numbers.",
      "Is abusive, defamatory, obscene, discriminatory or otherwise unlawful.",
      "Promotes a business, product or service, or contains links.",
    ],
  },
  {
    id: "partners",
    title: "Dealers, insurers and other businesses",
    paragraphs: [
      "Dealers, sellers, insurers and intermediaries on MarchGear are independent businesses. We check dealer partners and insurance vendors when they join, but we don't guarantee their vehicles, services, policies, prices or conduct, and we're not a party to your agreements with them. If something goes wrong, please contact them first. We'll help where we reasonably can.",
      "Dealer partners and insurance vendors use their portals under these Terms and the partner terms and declarations they accept when they register. Their subscriptions and advertising are covered by our [Refund & Cancellation Policy](/refund-policy). Advertising and sponsored placements are paid for by the business shown and are labelled “Sponsored”.",
    ],
  },
  {
    id: "intellectual-property",
    title: "Our content",
    paragraphs: [
      "The MarchGear name and logo, the site's design, our editorial content, data compilations and tools belong to MarchGear or its licensors. You may use the Service for your own, non-commercial research, and share links and short quotations with credit. Please ask us before reproducing anything more. Manufacturers', dealers' and insurers' names and logos belong to their owners.",
    ],
  },
  {
    id: "third-parties",
    title: "Links and third-party services",
    paragraphs: [
      "The Service links to other websites and uses third-party services, such as image delivery, maps in the partner portals and, if you allow it, analytics. We aren't responsible for their content or practices. Their own terms and policies apply.",
    ],
  },
  {
    id: "liability",
    title: "Our responsibility to you",
    paragraphs: [
      "We work to keep MarchGear accurate, secure and available, but we provide it “as is” and can't promise it will always be error-free or uninterrupted.",
      "To the extent the law allows, MarchGear isn't liable for decisions you make based on indicative information; for the acts, omissions, vehicles, policies or services of dealers, sellers, insurers or intermediaries; or for indirect or consequential losses, such as lost profits or opportunities. Where we are liable, our total liability is limited to the fees you paid MarchGear in the 12 months before the claim arose.",
      "Nothing in these Terms limits liability that can't be limited by law, including for fraud, or your rights under the Consumer Protection Act, 2019.",
    ],
  },
  {
    id: "indemnity",
    title: "Indemnity",
    paragraphs: [
      "If you break these Terms or the law while using the Service, for example by posting unlawful content or sending requests in someone else's name, you agree to compensate MarchGear for reasonable losses and costs (including legal costs) arising from resulting claims by others.",
    ],
  },
  {
    id: "termination",
    title: "Suspension and termination",
    paragraphs: [
      "You can stop using the Service and close your account at any time. We may suspend or close an account, remove content or refuse requests if we reasonably believe these Terms or the law have been broken, or to protect users or the Service. Where it's reasonable, we'll tell you why. Terms that by their nature should continue, such as the content licence, liability and governing law, survive termination.",
    ],
  },
  {
    id: "changes",
    title: "Changes to these terms",
    paragraphs: [
      "We may update these Terms, for example when we add features or the law changes. We'll change the “last updated” date and, for significant changes, tell you on the site before they take effect. If you keep using the Service after that, the updated Terms apply.",
    ],
  },
  {
    id: "governing-law",
    title: "Governing law and disputes",
    paragraphs: [
      "These Terms are governed by the laws of India. Please contact us first: most problems can be sorted out quickly. Subject to your rights under consumer protection law, {jurisdiction} have exclusive jurisdiction over any dispute arising from these Terms or the Service.",
    ],
  },
  {
    id: "contact",
    title: "Contact and grievances",
    paragraphs: [
      "Questions about these Terms: {supportEmail}. Complaints about content on the site or about your personal data: {grievance}. We acknowledge complaints within 24 hours and aim to resolve them within 15 days.",
    ],
  },
];

/* ── Cookie policy ──────────────────────────────────────────── */

export const cookieSummary: string[] = [
  "Essential cookies keep you signed in and remember your cookie choice. They're always on.",
  "Your saved cars, compare list and city are kept in your browser's storage.",
  "Google Analytics cookies are set only if you choose “Allow analytics”.",
  "Change your choice at any time with Cookie settings in the footer.",
];

export const cookieSections: LegalSection[] = [
  {
    id: "about",
    title: "About this policy",
    paragraphs: [
      "This policy explains the cookies and browser storage MarchGear uses, what each one does, how long it lasts and how to change your choices. It's part of our [Privacy Policy](/privacy).",
      "Cookies are small text files a website stores in your browser and receives back with each visit. Browser (local) storage works in a similar way, but it's read only by the page itself and isn't sent to our servers automatically.",
    ],
  },
  {
    id: "essential",
    title: "Essential cookies",
    paragraphs: [
      "These keep the site working and secure, so they don't need your consent. They're set by MarchGear, contain no advertising identifiers and are never shared.",
      "Each kind of account has its own sign-in cookie, so signing in or out of one never affects the others. The cookie holds a random token. We store only a hash of it, with your browser type and IP address, so you can see and sign out your devices.",
    ],
  },
  {
    id: "browser-storage",
    title: "Browser storage on your device",
    paragraphs: [
      "These remember choices you make on this device. They stay in your browser, aren't sent to MarchGear with each visit, and are removed when you clear this site's data in your browser. When you're signed in, saved cars also sync to your account.",
    ],
  },
  {
    id: "analytics",
    title: "Analytics cookies (only with your consent)",
    paragraphs: [
      "If you choose “Allow analytics” and analytics is switched on, we load Google Analytics 4 to see which pages are useful and improve the site. Advertising features are turned off, and we don't use the data to show you ads. If you don't allow it, Google Analytics isn't loaded at all.",
      "Google processes this data as our service provider, on servers that may be outside India. See [Google's privacy policy](https://policies.google.com/privacy).",
    ],
  },
  {
    id: "your-choices",
    title: "Changing your choice",
    paragraphs: [
      "You can change or withdraw your choice at any time with Cookie settings in the footer of every page. If you withdraw it, Google Analytics stops collecting and we delete its cookies from your browser.",
      "You can also block or delete cookies in your browser's settings. If you block essential cookies, you won't be able to sign in. Clearing this site's data resets your compare list, city and (unless you're signed in) saved cars.",
    ],
  },
  {
    id: "other-services",
    title: "Content from other services",
    paragraphs: [
      "Car photographs are loaded from Unsplash's image servers, and the maps in the dealer and insurance vendor portals from OpenStreetMap. Like any server, they receive your IP address and browser details to deliver the content.",
    ],
  },
  {
    id: "changes",
    title: "Changes and questions",
    paragraphs: [
      "If we add a cookie, we'll update this page and the date at the top, and if it needs your consent, we'll ask you again. Questions: {supportEmail}. Complaints: {grievance}.",
    ],
  },
];

/* ── Refund & cancellation policy ───────────────────────────── */

export const refundSummary: string[] = [
  "Using MarchGear as a car buyer or owner is free. Nothing is charged for enquiries, quote requests or valuations.",
  "We don't take card or online payments. Paid services are invoiced and paid by bank transfer, UPI or cheque.",
  "Cancelled subscriptions run to the end of the period already paid for. There are no part-period refunds.",
  "Approved refunds are paid {refundTimeline}, to the account the payment came from.",
];

export const refundSections: LegalSection[] = [
  {
    id: "about",
    title: "About this policy",
    paragraphs: [
      "This policy explains cancellations and refunds for the paid services on MarchGear: dealer partner subscriptions, insurance vendor subscriptions and advertising, and PDI inspections. Researching cars, sending enquiries and quote requests, valuing your car and the newsletter are free.",
      "MarchGear doesn't sell cars or insurance. Money you pay a dealer, seller or insurer, such as a booking amount, a car payment or a premium, is between you and them. Ask them about their refund policy.",
    ],
  },
  {
    id: "payments",
    title: "How payments work",
    paragraphs: [
      "We don't take card or online payments on the site. Paid services are invoiced, and you pay by bank transfer, UPI or cheque using the details on the invoice. Dealer partners and insurance vendors then record the payment in their portal, and our accounts team checks it against our bank statement.",
      "Subscription and advertising prices are shown before GST, which is added to the invoice. PDI prices include GST.",
    ],
  },
  {
    id: "subscriptions",
    title: "Dealer partner and insurance vendor subscriptions",
    paragraphs: ["Plans are billed monthly, in advance."],
    list: [
      "Free trial: new dealer partners get {dealerTrialDays} days, and insurance vendors {vendorTrialDays} days, free from approval. You can change plan as often as you like during the trial, and nothing is invoiced until it ends.",
      "Invoices are due within {dealerPaymentTerms} days for dealer partners and {vendorPaymentTerms} days for insurance vendors.",
      "Upgrades start as soon as we verify payment of the prorated difference for the rest of the period.",
      "Downgrades, and moves to a free plan, take effect at your next renewal. You keep your current plan until then, and there's no refund for the part of the period you've already paid for.",
      "Cancelling: insurance vendors can move to the free plan from Billing in their portal. Dealer partners can ask us to end their subscription by writing to {supportEmail}. Cancellation takes effect at the end of the paid period, no further invoices are raised, and unpaid invoices for later periods are cancelled.",
      "We refund subscription fees if you were charged in error (for example, a duplicate payment, or a payment for an invoice we had cancelled), or if we end your subscription without cause before the period ends, in which case we refund the unused days pro rata.",
    ],
  },
  {
    id: "advertising",
    title: "Advertising campaigns",
    paragraphs: ["Insurance vendors book advertising campaigns in their portal. Each booking is invoiced once it's approved."],
    list: [
      "Before the start date: you can cancel a campaign in your portal while it's awaiting approval or changes, or once it's approved but hasn't started. Its unpaid invoice is cancelled. If you've already paid in full, we refund the full amount. If you've paid part of it, contact us and we'll cancel it and settle the payment with you.",
      "Not approved: if we don't approve a campaign you've paid for, we refund it in full.",
      "After the start date: a running campaign can't be cancelled in the portal. Contact us and we'll stop it. Refunds for days not yet run are at our discretion and, if given, are pro rata.",
      "If a placement doesn't run because of a fault on our side, we'll extend the campaign or refund the days affected.",
    ],
  },
  {
    id: "pdi-inspections",
    title: "PDI inspections",
    paragraphs: [
      "You pay for a PDI inspection after it's done, so there's nothing to refund if you cancel. You can cancel or reschedule {pdiCancellation} by calling {phone} or emailing {supportEmail} with your booking reference.",
      "If the inspection can't go ahead because of us, or because the dealership won't allow it, you aren't charged.",
    ],
  },
  {
    id: "refunds",
    title: "How refunds are processed",
    paragraphs: [
      "To ask for a refund, write to {supportEmail} with the invoice or booking reference. Dealer partners and insurance vendors can also raise a billing ticket in their portal.",
      "Approved refunds are paid {refundTimeline}, by bank transfer to the account the payment came from, or to the bank account verified on your partner or vendor account. We don't refund in cash. Where the invoice included GST, we issue a credit note.",
    ],
  },
  {
    id: "contact",
    title: "Questions",
    paragraphs: ["Billing questions: {supportEmail} or {phone}. Complaints: {grievance}."],
  },
];
