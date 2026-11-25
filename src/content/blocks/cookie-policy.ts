import { z } from "zod";
import { LEGAL_UPDATED, cookieSections, cookieSummary } from "@/data/editorial-legal";
import { defineBlock } from "../define";
import { legalDate, legalDocument, legalSummary, sectionFields, summaryField, toRows } from "./legal";

/**
 * The cookie policy at /cookies. The tables of cookies and browser storage are built from the code
 * (cookie names and lifetimes can't drift from what the site sets); this block holds the wording around them.
 */
export const cookiePolicy = defineBlock({
  key: "cookiePolicy",
  title: "Cookie policy",
  group: "Legal",
  description:
    "The wording of the cookie policy. The tables listing each cookie and browser-storage item, with its purpose and how long it lasts, come from the code and appear after the sections with the anchors essential, browser-storage and analytics.",
  usedOn: ["/cookies"],
  schema: z.object({
    updated: legalDate,
    summary: legalSummary,
    sections: legalDocument("cookie policy"),
  }),
  defaults: { updated: LEGAL_UPDATED, summary: cookieSummary, sections: toRows(cookieSections) },
  sections: [
    {
      title: "Last updated",
      fields: [{ name: "updated", label: "Last updated", type: "date", required: true, hint: "Change it whenever the wording or the cookies change." }],
    },
    {
      title: "Cookie policy",
      description: "Keep the anchors essential, browser-storage and analytics: the cookie tables appear after those sections (or at the end if they're missing).",
      fields: [summaryField("summary"), { name: "sections", label: "Sections", type: "rows", addLabel: "Add section", itemTitle: "title", fields: sectionFields() }],
    },
  ],
});
