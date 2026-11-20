import { z } from "zod";
import { announcements as launchAnnouncements } from "@/data/navigation";
import { defineBlock, link, rows, text } from "../define";

/** The rotating strip above the header. */
export const announcements = defineBlock({
  key: "announcements",
  title: "Announcement bar",
  group: "Site",
  description: "The rotating messages in the thin bar above the header. Remove all messages to hide the bar.",
  usedOn: ["Every page (top bar)"],
  schema: z.object({
    items: rows(z.object({ tag: text("tag", 20), text: text("message", 120), href: link() }), "message"),
  }),
  defaults: { items: launchAnnouncements.map((a) => ({ tag: a.tag, text: a.text, href: a.href })) },
  sections: [
    {
      title: "Messages",
      description: "Shown one at a time. Keep each message short — it has to fit on a phone.",
      fields: [
        {
          name: "items",
          label: "Messages",
          type: "rows",
          addLabel: "Add message",
          itemTitle: "text",
          fields: [
            { name: "tag", label: "Tag", type: "text", required: true, placeholder: "Launched" },
            { name: "href", label: "Link", type: "text", required: true, placeholder: "/cars/…" },
            { name: "text", label: "Message", type: "text", required: true, wide: true },
          ],
        },
      ],
    },
  ],
});
