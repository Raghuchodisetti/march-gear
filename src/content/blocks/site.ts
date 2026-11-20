import { z } from "zod";
import { contactFaqs, contactTopics, offices, supportChannels } from "@/data/editorial-company";
import { defineBlock, lines, optionalLink, rows, text } from "../define";

const email = (label: string) => z.string().trim().toLowerCase().max(190).email(`Enter a valid ${label}`);

/** Company contact details, social links and the contact page. */
export const site = defineBlock({
  key: "site",
  title: "Contact details & social links",
  group: "Site",
  description: "Phone, email, opening hours, address and social links shown in the footer and on the contact page, plus the contact form's topics and FAQs.",
  usedOn: ["Footer", "/contact", "PDI checklist PDF"],
  schema: z.object({
    phone: text("phone number", 30),
    email: email("email address"),
    hours: text("opening hours", 60),
    address: text("address", 200),
    supportEmail: email("support email"),
    pressEmail: email("press email"),
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
