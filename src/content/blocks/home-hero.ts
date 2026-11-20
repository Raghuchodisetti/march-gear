import { z } from "zod";
import { u } from "@/lib/utils";
import { defineBlock, image, link, optionalText, rows, text } from "../define";

/** CSS object-position, e.g. "62% 92%". Empty falls back in the hero. */
const focus = () =>
  optionalText(20).refine((v) => v === "" || /^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/.test(v), "Use two percentages, e.g. 62% 92%");

export const MAX_HERO_SLIDES = 4;

/** The full-screen slides at the top of the home page. */
export const homeHero = defineBlock({
  key: "homeHero",
  title: "Home hero",
  group: "Home",
  description: "The headline and the full-screen photo slides at the top of the home page.",
  usedOn: ["/"],
  schema: z.object({
    eyebrow: text("eyebrow", 80),
    titleFirst: text("first headline line", 40),
    titleSecond: text("second headline line", 40),
    accent: optionalText(30),
    lead: text("intro line", 160),
    slides: rows(
      z.object({
        image: image("photo"),
        position: focus(),
        mobilePosition: focus(),
        chapter: text("chapter label", 40),
        title: text("slide title", 30),
        href: link(),
      }),
      "slide",
      1,
    ).max(MAX_HERO_SLIDES, `Use at most ${MAX_HERO_SLIDES} slides`),
  }).refine((v) => !v.accent || v.titleSecond.includes(v.accent), {
    path: ["accent"],
    message: "Use a word that appears in the second line, exactly as written there",
  }),
  defaults: {
    eyebrow: "India's premium car discovery platform",
    titleFirst: "Find the car",
    titleSecond: "that moves you.",
    accent: "moves",
    lead: "Explore, compare and discover your next car with confidence.",
    // Bright, daylight campaign frames. Each keeps the car low and right of centre so the headline sits on open sky.
    slides: [
      {
        image: u("photo-1533473359331-0135ef1b58bf"),
        position: "62% 92%",
        mobilePosition: "64% 80%",
        chapter: "Built for every road",
        title: "SUVs",
        href: "/new-cars?body=suv",
      },
      {
        image: u("photo-1560958089-b8a1929cea89"),
        position: "62% 92%",
        mobilePosition: "62% 80%",
        chapter: "Electric, effortlessly",
        title: "Electric cars",
        href: "/electric-cars",
      },
      {
        image: u("photo-1537984822441-cff330075342"),
        position: "50% 90%",
        mobilePosition: "50% 88%",
        chapter: "Pure driving joy",
        title: "Sedans & coupés",
        href: "/new-cars?body=sedan",
      },
    ],
  },
  sections: [
    {
      title: "Headline",
      description: "The words over the photos. The headline is set on two lines.",
      fields: [
        { name: "eyebrow", label: "Eyebrow", type: "text", required: true, wide: true, placeholder: "India's premium car discovery platform" },
        { name: "titleFirst", label: "Headline — first line", type: "text", required: true, placeholder: "Find the car" },
        { name: "titleSecond", label: "Headline — second line", type: "text", required: true, placeholder: "that moves you." },
        {
          name: "accent",
          label: "Word in italics",
          type: "text",
          placeholder: "moves",
          hint: "A word or phrase from the second line to set in the italic serif. Leave empty for none.",
        },
        { name: "lead", label: "Intro line", type: "text", required: true, wide: true },
      ],
    },
    {
      title: "Slides",
      description: `One to ${MAX_HERO_SLIDES} photos that crossfade every 7 seconds. Each slide's card links to its page. Use wide daylight photos with the car low and to the right, so the headline sits on open sky.`,
      fields: [
        {
          name: "slides",
          label: "Slides",
          type: "rows",
          addLabel: "Add slide",
          itemTitle: "title",
          fields: [
            { name: "image", label: "Photo", type: "image", required: true, wide: true },
            { name: "chapter", label: "Chapter label", type: "text", required: true, placeholder: "Built for every road" },
            { name: "title", label: "Slide title", type: "text", required: true, placeholder: "SUVs" },
            { name: "href", label: "Link", type: "text", required: true, placeholder: "/new-cars?body=suv" },
            { name: "position", label: "Photo focus (desktop)", type: "text", placeholder: "62% 92%", hint: "Horizontal and vertical position to keep in frame. Empty centres the photo." },
            { name: "mobilePosition", label: "Photo focus (phone)", type: "text", placeholder: "64% 80%", hint: "Empty uses the desktop focus." },
          ],
        },
      ],
    },
  ],
});
