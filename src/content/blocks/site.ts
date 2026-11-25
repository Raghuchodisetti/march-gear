import { z } from "zod";
import { contactFaqs, contactTopics, offices, supportChannels } from "@/data/editorial-company";
import { defineBlock, lines, optionalLink, optionalText, rows, text } from "../define";

const email = (label: string) => z.string().trim().toLowerCase().max(190).email(`Enter a valid ${label}`);

/** Optional, upper-cased identifier that must match `pattern` when it's filled in. */
const optionalCode = (max: number, pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .max(max, message)
    .nullish()
    .transform((v) => (v ?? "").replace(/\s+/g, ""))
    .refine((v) => v === "" || pattern.test(v), message);

/** GSTIN: 2-digit state code, PAN, entity number, "Z", check character. */
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
/** Company CIN (21 characters) or an LLP's LLPIN (AAA-1234). */
export const CIN_PATTERN = /^(?:[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}|[A-Z]{3}-\d{4})$/;
/** Google Analytics 4 measurement ID. */
export const GA_ID_PATTERN = /^G-[A-Z0-9]{4,12}$/;

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(190)
  .nullish()
  .transform((v) => v ?? "")
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address");

/** Company contact details, legal identity, analytics ID, social links and the contact page. */
export const site = defineBlock({
  key: "site",
  title: "Contact details, business details & analytics",
  group: "Site",
  description:
    "Phone, email, opening hours, address and social links shown in the footer and on the contact page; the company's legal details and Grievance Officer shown in the footer, on the contact page and in the policies; the Google Analytics ID; and the contact form's topics and FAQs.",
  usedOn: ["Footer", "/contact", "/privacy, /terms, /cookies, /refund-policy", "Google Analytics", "PDI checklist PDF"],
  schema: z.object({
    phone: text("phone number", 30),
    email: email("email address"),
    hours: text("opening hours", 60),
    address: text("address", 200),
    supportEmail: email("support email"),
    pressEmail: email("press email"),
    /* Business details — all optional, empty until the owner fills them in. Never invent values. */
    legalName: optionalText(160),
    registeredAddress: optionalText(300),
    gstin: optionalCode(15, GSTIN_PATTERN, "Enter a valid 15-character GSTIN, e.g. 37ABCDE1234F1Z5"),
    cin: optionalCode(21, CIN_PATTERN, "Enter a valid 21-character CIN (e.g. U74999AP2026PTC123456) or an LLPIN (e.g. ABC-1234)"),
    jurisdictionCity: optionalText(60),
    grievanceOfficer: z
      .object({ name: optionalText(120), email: optionalEmail, phone: optionalText(30) })
      .nullish()
      .transform((v) => v ?? { name: "", email: "", phone: "" }),
    /** Google Analytics 4 measurement ID. Empty = analytics off. */
    gaMeasurementId: optionalCode(14, GA_ID_PATTERN, "Enter a Google Analytics 4 measurement ID like G-AB12CD34EF, or leave it empty"),
    socials: z.object({
      instagram: optionalLink(),
      youtube: optionalLink(),
      facebook: optionalLink(),
    }),
    offices: rows(
      z.object({
        city: text("city", 60),
        label: text("label", 60),
        address: lines(120),
        phone: text("phone number", 30),
        email: email("email address"),
        hours: text("hours", 60),
        hq: z.boolean().default(false),
      }),
      "office",
      1,
    ),
    contactTopics: rows(z.object({ value: z.string().trim().regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"), label: text("label", 80) }), "topic", 1),
    contactFaqs: rows(z.object({ q: text("question", 200), a: text("answer", 1000) }), "question"),
  }),
  defaults: {
    phone: offices[0]?.phone ?? supportChannels.phone,
    email: offices[0]?.email ?? "hello@marchgear.in",
    hours: offices[0]?.hours ?? "9:00 AM – 9:00 PM",
    address: "Visakhapatnam, Andhra Pradesh, India",
    supportEmail: supportChannels.email,
    pressEmail: supportChannels.press,
    legalName: "",
    registeredAddress: "",
    gstin: "",
    cin: "",
    jurisdictionCity: "",
    grievanceOfficer: { name: "", email: "", phone: "" },
    gaMeasurementId: "",
    socials: { instagram: "https://instagram.com", youtube: "https://youtube.com", facebook: "https://facebook.com" },
    offices: offices.map((o) => ({ city: o.city, label: o.label, address: o.address, phone: o.phone, email: o.email, hours: o.hours, hq: Boolean(o.hq) })),
    contactTopics: contactTopics.map((t) => ({ value: t.value, label: t.label })),
    contactFaqs: contactFaqs.map((f) => ({ q: f.q, a: f.a })),
  },
  sections: [
    {
      title: "Main contact",
      description: "Shown in the footer on every page.",
      fields: [
        { name: "phone", label: "Phone number", type: "text", required: true, placeholder: "+91 91283 33777" },
        { name: "email", label: "Email", type: "text", required: true },
        { name: "hours", label: "Opening hours", type: "text", required: true, placeholder: "9:00 AM – 9:00 PM" },
        { name: "address", label: "Address line", type: "text", required: true },
        { name: "supportEmail", label: "Support email", type: "text", required: true },
        { name: "pressEmail", label: "Press email", type: "text", required: true },
      ],
    },
    {
      title: "Business details",
      description:
        "Your company's legal identity. Each filled-in item shows in the footer's legal line, on the contact page and in the policies; empty ones are left out. Copy them exactly from your registration certificates.",
      fields: [
        { name: "legalName", label: "Registered legal name", type: "text", placeholder: "e.g. MarchGear Private Limited", hint: "As on your certificate of incorporation. The policies name this company as the data fiduciary." },
        { name: "cin", label: "CIN / LLPIN", type: "text", placeholder: "U74999AP2026PTC123456", hint: "Corporate Identity Number (21 characters), or LLPIN for an LLP." },
        { name: "gstin", label: "GSTIN", type: "text", placeholder: "37ABCDE1234F1Z5", hint: "15 characters. Checked for the right format when saved." },
        { name: "jurisdictionCity", label: "Courts' city (jurisdiction)", type: "text", placeholder: "Visakhapatnam", hint: "The city whose courts handle disputes under the terms. Empty: “the courts having jurisdiction over our registered office”." },
        { name: "registeredAddress", label: "Registered office address", type: "textarea", rows: 2, wide: true, hint: "One line, as on your registration. Empty: the policies use the address line above." },
      ],
    },
    {
      title: "Grievance Officer",
      description:
        "Required by the IT Rules, 2021 and the DPDP Act, 2023: the person who handles privacy and content complaints. Shown in the policies and on the contact page. Until a name and email are set, the policies point people to the support email and say a Grievance Officer will be named.",
      fields: [
        {
          name: "grievanceOfficer",
          label: "Grievance Officer",
          type: "group",
          fields: [
            { name: "name", label: "Name", type: "text", placeholder: "Full name" },
            { name: "email", label: "Email", type: "text", placeholder: "grievance@…" },
            { name: "phone", label: "Phone", type: "text", placeholder: "+91 …" },
          ],
        },
      ],
    },
    {
      title: "Analytics",
      description: "Google Analytics only loads for visitors who accept analytics cookies in the cookie banner.",
      fields: [
        {
          name: "gaMeasurementId",
          label: "Google Analytics 4 measurement ID",
          type: "text",
          placeholder: "G-XXXXXXXXXX",
          hint: "From Google Analytics → Admin → Data streams → your web stream. Leave empty to turn analytics (and the cookie banner's analytics option) off.",
        },
      ],
    },
    {
      title: "Social links",
      description: "Leave a link empty to hide that icon.",
      fields: [
        {
          name: "socials",
          label: "Social profiles",
          type: "group",
          fields: [
            { name: "instagram", label: "Instagram", type: "url", placeholder: "https://instagram.com/…" },
            { name: "youtube", label: "YouTube", type: "url", placeholder: "https://youtube.com/@…" },
            { name: "facebook", label: "Facebook", type: "url", placeholder: "https://facebook.com/…" },
          ],
        },
      ],
    },
    {
      title: "Offices",
      description: "Listed on the contact page.",
      fields: [
        {
          name: "offices",
          label: "Offices",
          type: "rows",
          addLabel: "Add office",
          itemTitle: "city",
          fields: [
            { name: "city", label: "City", type: "text", required: true },
            { name: "label", label: "Label", type: "text", required: true, placeholder: "Head office" },
            { name: "address", label: "Address", type: "lines", rows: 3 },
            { name: "phone", label: "Phone", type: "text", required: true },
            { name: "email", label: "Email", type: "text", required: true },
            { name: "hours", label: "Hours", type: "text", required: true },
            { name: "hq", label: "Head office", type: "checkbox" },
          ],
        },
      ],
    },
    {
      title: "Contact form",
      fields: [
        {
          name: "contactTopics",
          label: "Topics",
          type: "rows",
          addLabel: "Add topic",
          itemTitle: "label",
          fields: [
            { name: "label", label: "Label", type: "text", required: true },
            { name: "value", label: "Key", type: "text", required: true, hint: "Lowercase, e.g. buying" },
          ],
        },
        {
          name: "contactFaqs",
          label: "Questions & answers",
          type: "rows",
          addLabel: "Add question",
          itemTitle: "q",
          fields: [
            { name: "q", label: "Question", type: "text", required: true, wide: true },
            { name: "a", label: "Answer", type: "textarea", required: true },
          ],
        },
      ],
    },
  ],
});
