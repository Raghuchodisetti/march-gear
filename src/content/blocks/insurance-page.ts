import { z } from "zod";
import type { Field } from "@/components/admin/fields";
import { defineBlock, lines, optionalText, rows, text } from "../define";

/* ──────────────────────────────────────────────────────────────
   Copy for the /insurance homepage and its category pages.
   Headlines and introductions are editable here; the detailed
   explanations (tables, step lists) live with each page.
   ────────────────────────────────────────────────────────────── */

const intro = z.object({ eyebrow: text("eyebrow", 60), title: text("title", 140), text: text("introduction", 600) });
const step = z.object({ title: text("step title", 80), text: text("step text", 300) });
const pageHero = z.object({ eyebrow: text("eyebrow", 60), title: text("title", 140), subtitle: text("subtitle", 400) });

const introFields = (name: string, label: string): Field => ({
  name,
  label,
  type: "group",
  fields: [
    { name: "eyebrow", label: "Eyebrow", type: "text", required: true },
    { name: "title", label: "Title", type: "text", required: true, wide: true },
    { name: "text", label: "Introduction", type: "textarea", required: true, wide: true },
  ],
});

const stepFields = (name: string, label: string): Field => ({
  name,
  label,
  type: "rows",
  addLabel: "Add step",
  itemTitle: "title",
  fields: [
    { name: "title", label: "Step title", type: "text", required: true },
    { name: "text", label: "Step text", type: "textarea", required: true, wide: true },
  ],
});

const heroFields = (name: string, label: string): Field => ({
  name,
  label,
  type: "group",
  fields: [
    { name: "eyebrow", label: "Eyebrow", type: "text", required: true },
    { name: "title", label: "Title", type: "text", required: true, wide: true },
    { name: "subtitle", label: "Subtitle", type: "textarea", required: true, wide: true },
  ],
});

export const insurancePage = defineBlock({
  key: "insurancePage",
  title: "Insurance pages",
  group: "Insurance",
  description: "Headlines, introductions and FAQs on the public insurance homepage and its category pages.",
  usedOn: ["/insurance", "/insurance/types", "/insurance/new-car", "/insurance/renewal", "/insurance/used-car", "/insurance/ev", "/insurance/add-ons", "/insurance/claims", "/insurance/guides"],
  schema: z.object({
    hero: z.object({
      eyebrow: text("eyebrow", 60),
      title: text("title", 120),
      /** Words of the title set in the italic serif accent (must appear in the title). */
      accent: optionalText(60),
      subtitle: text("subtitle", 300),
      points: lines(120),
    }),
    buy: intro.extend({ steps: rows(step, "step", 1) }),
    renew: intro.extend({ steps: rows(step, "step", 1) }),
    compare: intro,
    providers: intro,
    coverTypes: intro,
    stages: intro,
    addOns: intro,
    claims: intro,
    guides: intro,
    faqTitle: text("FAQ heading", 120),
    faqs: rows(z.object({ q: text("question", 200), a: text("answer", 1200) }), "question"),
    pages: z.object({
      types: pageHero,
      newCar: pageHero,
      renewal: pageHero,
      usedCar: pageHero,
      ev: pageHero,
      addOns: pageHero,
      claims: pageHero,
      guides: pageHero,
      articles: pageHero,
    }),
  }),
  defaults: {
    hero: {
      eyebrow: "MarchGear Insurance",
      title: "Insure the car you love, without the guesswork.",
      accent: "without the guesswork.",
      subtitle:
        "Compare cover, add-ons and indicative premiums from listed insurers and registered intermediaries — then ask the ones you like for a real quotation.",
      points: [
        "Every premium we estimate is clearly marked indicative",
        "Only the insurers you choose receive your request",
        "Policies are issued by the insurer, never by MarchGear",
      ],
    },
    buy: {
      eyebrow: "Buy car insurance",
      title: "A new policy in three calm steps.",
      text: "Whether the car is fresh from the showroom or your old policy has run out, start with the car itself. We show which listed plans fit it and what they typically cost, so the conversation with an insurer starts from facts.",
      steps: [
        { title: "Describe the car", text: "Brand, model, variant and year from our catalogue. No registration number? Tick “new car” and carry on." },
        { title: "Compare like with like", text: "See cover, add-ons, deductibles and indicative premiums side by side, filtered to plans that accept your car." },
        { title: "Ask for quotations", text: "Send your details to the insurers you pick. They reply with an indicative or insurer-authorised quote." },
      ],
    },
    renew: {
      eyebrow: "Renew car insurance",
      title: "Renew on time and keep what you've earned.",
      text: "Your no-claim bonus can take up to half off the own-damage premium. Renewing before the expiry date keeps it, keeps you legal and avoids a vehicle inspection.",
      steps: [
        { title: "Note your expiry date", text: "It's on your policy schedule. Renewing before it means unbroken cover and no inspection." },
        { title: "Declare your NCB honestly", text: "Tell us your current no-claim bonus and whether you claimed last year — insurers verify it." },
        { title: "Compare before you renew", text: "Your existing insurer's renewal notice is one option. Comparing others costs nothing." },
      ],
    },
    compare: {
      eyebrow: "Compare insurance plans",
      title: "The premium is one line. Read the other nine.",
      text: "Two plans at the same price can pay out very differently. Our comparison lines up the details that decide a claim, not just the headline figure.",
    },
    providers: {
      eyebrow: "Insurers on MarchGear",
      title: "Listed insurers and intermediaries.",
      text: "Every provider is reviewed by MarchGear before its products go live, and every product is approved before it appears here.",
    },
    coverTypes: {
      eyebrow: "Types of cover",
      title: "Three kinds of motor cover, explained plainly.",
      text: "Third-party cover is the legal minimum. Own-damage cover protects your own car. A comprehensive policy combines the two.",
    },
    stages: {
      eyebrow: "Cover for your situation",
      title: "New, pre-owned or electric — each needs a different conversation.",
      text: "The rules on policy terms, transfers and add-ons change with the car's age and drivetrain. Start from where you are.",
    },
    addOns: {
      eyebrow: "Add-on covers",
      title: "Add-ons close the gaps a standard policy leaves.",
      text: "A base policy deducts depreciation, excludes engine damage from water and ignores your keys. Add-ons fix that — for a price, and usually only while the car is young.",
    },
    claims: {
      eyebrow: "Claim assistance",
      title: "When something happens, know your next move.",
      text: "Claims are filed with and settled by your insurer — MarchGear doesn't process them. What we can do is explain the steps, the documents and the questions to ask.",
    },
    guides: {
      eyebrow: "Insurance guides",
      title: "Plain-language guides, written for owners.",
      text: "Short reads on the terms that decide what you pay and what you get back.",
    },
    faqTitle: "Car insurance questions, answered.",
    faqs: [
      {
        q: "Is car insurance compulsory in India?",
        a: "Yes. The Motor Vehicles Act requires every car used on a public road to have at least third-party liability cover. Driving without it can lead to a fine, and you would be personally liable for any injury or damage you cause to others. Own-damage cover for your own car is optional, but most owners buy it as part of a comprehensive policy.",
      },
      {
        q: "Does MarchGear sell or issue insurance policies?",
        a: "No. MarchGear lists products from registered insurers and intermediaries, helps you compare them and sends your quote request to the providers you choose. The policy, the final premium and any claim are always handled by the insurer.",
      },
      {
        q: "What does “indicative premium” mean?",
        a: "It's our estimate of what a plan typically costs for your car, worked out from published third-party rates, a standard IDV depreciation schedule and the provider's own rate settings. It is not an offer or a quotation. The insurer sets the final premium, IDV and terms when it issues the policy.",
      },
      {
        q: "Do I need my registration number to get quotes?",
        a: "No. You can choose the brand, model, variant and year yourself — which you have to do anyway, because MarchGear isn't connected to a vehicle registry and can't look your car up from its number. For a car that isn't registered yet, tick “New car / no registration number yet”.",
      },
      {
        q: "What is IDV and can I change it?",
        a: "The Insured Declared Value is the most the insurer will pay if the car is stolen or written off — roughly its current market value. It starts from the ex-showroom price less depreciation for the car's age. Insurers usually let you move it within a band; a higher IDV means a higher own-damage premium.",
      },
      {
        q: "How does the no-claim bonus (NCB) work?",
        a: "Each claim-free policy year earns a discount on the own-damage premium at renewal, typically rising from 20% after one year to 50% after five. It belongs to you, not the car, so it can usually be carried to your next car. A claim, or letting the policy lapse for more than 90 days, normally resets it to zero.",
      },
      {
        q: "Can I switch insurers when I renew?",
        a: "Yes. You can move to a different insurer at every renewal and take your NCB with you, provided you renew on time and declare it correctly. Keep a copy of your previous policy — the new insurer will ask for it as proof.",
      },
      {
        q: "My policy has already expired. What now?",
        a: "Stop driving the car until it's insured — an uninsured car isn't legal on the road. Renew as soon as you can: within 90 days of expiry you usually keep your NCB, after that it's lost. For a lapsed comprehensive or own-damage policy, the insurer will usually inspect the car before cover starts.",
      },
      {
        q: "Which add-ons are worth paying for?",
        a: "It depends on the car's age and how you use it. Zero depreciation and return to invoice make most sense on newer cars; engine protection matters if you drive through flooded roads; roadside assistance suits long-distance drivers; EV owners should look at battery protection. Our add-ons page explains each one.",
      },
      {
        q: "Does MarchGear help with claims?",
        a: "We can explain the process, the documents and what to do at the accident spot, and request a callback if you'd like someone to walk you through it. We can't file, approve or settle a claim — only your insurer can. Always inform your insurer directly, as soon as possible.",
      },
      {
        q: "What's the difference between comprehensive and standalone own-damage cover?",
        a: "A comprehensive policy includes both own-damage and third-party cover. A standalone own-damage policy covers only your own car and can be bought only when the car already has valid third-party cover — for example in years two and three of a new car's bundled policy.",
      },
      {
        q: "Is insurance for an electric car different?",
        a: "The structure is the same, but third-party premiums for electric cars are set by motor power (kW) rather than engine size, and the battery is a large share of the car's value. Many owners add a battery protection cover for water ingress and short circuits, which a standard policy may not pay for.",
      },
      {
        q: "Who sees my details when I ask for a quote?",
        a: "Only the providers you select for that request, so they can prepare a quotation. They may call or message you about it. You can see your requests and any quotes on the quotes page when you're signed in.",
      },
    ],
    pages: {
      types: {
        eyebrow: "Types of car insurance",
        title: "Every kind of motor policy, side by side.",
        subtitle: "From the legal minimum to multi-year cover for new cars — what each policy type covers, who it suits and how long it runs.",
      },
      newCar: {
        eyebrow: "New car insurance",
        title: "Insure it before you drive it home.",
        subtitle: "New cars need three years of third-party cover from day one. Here's how bundled policies work, which add-ons matter most early on, and how to compare before the dealer's offer.",
      },
      renewal: {
        eyebrow: "Car insurance renewal",
        title: "Renew on time. Keep your bonus.",
        subtitle: "How the no-claim bonus grows, what happens when a policy lapses, and how to switch insurers without losing what you've earned.",
      },
      usedCar: {
        eyebrow: "Used car insurance",
        title: "Bought a pre-owned car? Make the policy yours.",
        subtitle: "The existing policy must be transferred to your name, the seller's NCB doesn't come with the car, and a lapsed policy means an inspection. Here's the order to do things in.",
      },
      ev: {
        eyebrow: "Electric car insurance",
        title: "Cover built around the battery.",
        subtitle: "What changes when there's no engine: third-party rates by motor power, the value locked in the battery pack, charging equipment and the add-ons worth considering.",
      },
      addOns: {
        eyebrow: "Car insurance add-ons",
        title: "Pay for the gaps that matter to you.",
        subtitle: "What each add-on cover does, which cars typically qualify, how it's priced and how many listed plans offer it.",
      },
      claims: {
        eyebrow: "Claim assistance",
        title: "A clear head for a bad day.",
        subtitle: "What to do at the accident spot, how cashless and reimbursement claims work, and the documents to keep ready. MarchGear doesn't process claims — your insurer does.",
      },
      guides: {
        eyebrow: "Insurance guides",
        title: "Understand your policy in ten minutes.",
        subtitle: "Plain-language explanations of IDV, NCB, add-ons, claims and renewals — written for owners, not underwriters.",
      },
      articles: {
        eyebrow: "Insurance stories",
        title: "From the MarchGear newsroom.",
        subtitle: "Ownership stories and explainers from our editorial team that touch on insurance, claims and protecting your car.",
      },
    },
  },
  sections: [
    {
      title: "Homepage hero",
      fields: [
        {
          name: "hero",
          label: "Hero",
          type: "group",
          fields: [
            { name: "eyebrow", label: "Eyebrow", type: "text", required: true },
            { name: "title", label: "Title", type: "text", required: true, wide: true },
            { name: "accent", label: "Accent words", type: "text", hint: "Part of the title shown in the italic serif. Leave empty for none." },
            { name: "subtitle", label: "Subtitle", type: "textarea", required: true, wide: true },
            { name: "points", label: "Reassurance points (one per line, up to three)", type: "lines", rows: 3, wide: true },
          ],
        },
      ],
    },
    {
      title: "Buy and renew",
      description: "The two side-by-side panels under the search form.",
      fields: [
        {
          name: "buy",
          label: "Buy car insurance",
          type: "group",
          fields: [
            { name: "eyebrow", label: "Eyebrow", type: "text", required: true },
            { name: "title", label: "Title", type: "text", required: true, wide: true },
            { name: "text", label: "Introduction", type: "textarea", required: true, wide: true },
            stepFields("steps", "Steps"),
          ],
        },
        {
          name: "renew",
          label: "Renew car insurance",
          type: "group",
          fields: [
            { name: "eyebrow", label: "Eyebrow", type: "text", required: true },
            { name: "title", label: "Title", type: "text", required: true, wide: true },
            { name: "text", label: "Introduction", type: "textarea", required: true, wide: true },
            stepFields("steps", "Steps"),
          ],
        },
      ],
    },
    {
      title: "Homepage sections",
      description: "The heading and introduction of each section, top to bottom.",
      fields: [
        introFields("compare", "Compare plans"),
        introFields("providers", "Popular providers"),
        introFields("coverTypes", "Comprehensive / third-party / own-damage"),
        introFields("stages", "New / used / electric"),
        introFields("addOns", "Add-ons"),
        introFields("claims", "Claim assistance"),
        introFields("guides", "Guides"),
      ],
    },
    {
      title: "FAQs",
      description: "Shown on the insurance homepage (and as FAQ structured data for search engines).",
      fields: [
        { name: "faqTitle", label: "Heading", type: "text", required: true, wide: true },
        {
          name: "faqs",
          label: "Questions",
          type: "rows",
          addLabel: "Add question",
          itemTitle: "q",
          fields: [
            { name: "q", label: "Question", type: "text", required: true, wide: true },
            { name: "a", label: "Answer", type: "textarea", required: true, wide: true },
          ],
        },
      ],
    },
    {
      title: "Category page headers",
      fields: [
        {
          name: "pages",
          label: "Pages",
          type: "group",
          fields: [
            heroFields("types", "/insurance/types"),
            heroFields("newCar", "/insurance/new-car"),
            heroFields("renewal", "/insurance/renewal"),
            heroFields("usedCar", "/insurance/used-car"),
            heroFields("ev", "/insurance/ev"),
            heroFields("addOns", "/insurance/add-ons"),
            heroFields("claims", "/insurance/claims"),
            heroFields("guides", "/insurance/guides"),
            heroFields("articles", "/insurance/articles"),
          ],
        },
      ],
    },
  ],
});
