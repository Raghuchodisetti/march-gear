/* ──────────────────────────────────────────────────────────────
   Sample legal copy for the demo. This is placeholder text written
   for illustration only — it is not legal advice and has not been
   reviewed by counsel.
   ────────────────────────────────────────────────────────────── */

export const LEGAL_UPDATED = "2026-11-19";

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  list?: string[];
}

export const privacySections: LegalSection[] = [
  {
    id: "overview",
    title: "Overview",
    paragraphs: [
      "This Privacy Policy explains how March Gear (“we”, “us”) collects, uses and protects information when you use our website and services. It is sample text prepared for a demonstration product.",
      "We have written it to be read. Where something matters, we say so plainly rather than hiding it in long sentences.",
    ],
  },
  {
    id: "information-we-collect",
    title: "Information we collect",
    paragraphs: ["We collect only what we need to run March Gear and to respond when you ask us for something."],
    list: [
      "Details you give us — such as your name, email, phone number and city when you request a test drive, a callback or a valuation.",
      "Content you submit — owner reviews, ratings and messages to our team.",
      "Usage information — pages viewed, searches and approximate location derived from your city selection.",
      "Device information — browser type, operating system and a non-identifying device token.",
    ],
  },
  {
    id: "how-we-use",
    title: "How we use information",
    paragraphs: [
      "We use information to provide the features you request, to connect you with dealers when you ask us to, to keep the service secure and to improve our research tools.",
      "We do not sell your personal information. We never use the contents of a message you send us to change an editorial score or ranking.",
    ],
  },
  {
    id: "sharing",
    title: "Sharing with dealers and partners",
    paragraphs: [
      "When you submit an enquiry for a specific car or dealer, we share the details in that enquiry with the dealer you chose, and only for the purpose of responding to you.",
      "We use carefully selected service providers for hosting, analytics and email delivery. They process data on our instructions and under written agreements.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    paragraphs: [
      "March Gear stores a small amount of information in your browser — your saved cars, compare list, selected city and sign-in state — so the site remembers you between visits.",
      "You can clear this at any time from your browser settings. Doing so will reset your saved cars and preferences.",
    ],
  },
  {
    id: "retention",
    title: "Retention",
    paragraphs: [
      "We keep enquiry details for up to 24 months and published owner reviews for as long as they remain useful to other buyers. You may ask us to remove your review at any time.",
    ],
  },
  {
    id: "your-rights",
    title: "Your rights",
    paragraphs: ["Subject to applicable law, you may ask us to:"],
    list: [
      "Access the personal information we hold about you.",
      "Correct information that is inaccurate or incomplete.",
      "Delete your information or withdraw consent for optional processing.",
      "Nominate another person to exercise these rights on your behalf.",
    ],
  },
  {
    id: "security",
    title: "Security",
    paragraphs: [
      "We protect information with encryption in transit, access controls and regular reviews. No system is perfectly secure, and we will notify you and the relevant authorities if a breach affects your data.",
    ],
  },
  {
    id: "contact",
    title: "Contact and grievances",
    paragraphs: [
      "Questions about this policy can be sent through our contact page by choosing “Something else”. Our grievance officer will acknowledge your request within 72 hours.",
    ],
  },
];

export const termsSections: LegalSection[] = [
  {
    id: "acceptance",
    title: "Acceptance of terms",
    paragraphs: [
      "By using March Gear you agree to these Terms of Use. They are sample text prepared for a demonstration product and do not create a binding agreement.",
      "If you do not agree with any part of these terms, please do not use the service.",
    ],
  },
  {
    id: "the-service",
    title: "The service",
    paragraphs: [
      "March Gear is an independent automotive discovery platform. We publish research, reviews and tools, and we can introduce you to dealers. We do not sell vehicles ourselves.",
    ],
  },
  {
    id: "prices-and-information",
    title: "Prices and vehicle information",
    paragraphs: [
      "Prices, specifications, offers and on-road estimates are indicative and may differ from those offered by a dealer. Always confirm the final price, variant details and availability with the seller before you buy.",
      "Photography is representative and may not show the exact model, variant or colour described.",
    ],
  },
  {
    id: "accounts",
    title: "Your account",
    paragraphs: [
      "You are responsible for the accuracy of the information in your account and for keeping your sign-in details secure. Tell us promptly if you suspect unauthorised use.",
    ],
  },
  {
    id: "user-content",
    title: "Reviews and user content",
    paragraphs: ["When you submit a review or other content, you confirm that it is your own honest experience and you grant us a licence to publish it on March Gear. You agree not to post content that:"],
    list: [
      "Is false, misleading or written in exchange for payment or incentives.",
      "Contains personal information about other people.",
      "Is abusive, discriminatory or unlawful.",
      "Promotes a business, product or service.",
    ],
  },
  {
    id: "dealers",
    title: "Dealers and third parties",
    paragraphs: [
      "Dealers and partners listed on March Gear are independent businesses. Any purchase, finance or service agreement is between you and that business, and we are not a party to it.",
    ],
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    paragraphs: [
      "The March Gear name, design, editorial content and tools belong to us or our licensors. You may share links and short quotations with attribution; please ask before reproducing anything more.",
    ],
  },
  {
    id: "liability",
    title: "Limitation of liability",
    paragraphs: [
      "We work hard to keep March Gear accurate and available, but we provide it “as is”. To the extent permitted by law, we are not liable for losses arising from decisions made using information on the service.",
    ],
  },
  {
    id: "changes",
    title: "Changes to these terms",
    paragraphs: [
      "We may update these terms from time to time. When we do, we will change the “last updated” date above and, for significant changes, tell you on the site.",
    ],
  },
  {
    id: "governing-law",
    title: "Governing law",
    paragraphs: [
      "These terms are governed by the laws of India, and the courts of Visakhapatnam have jurisdiction over any dispute arising from them.",
    ],
  },
];
