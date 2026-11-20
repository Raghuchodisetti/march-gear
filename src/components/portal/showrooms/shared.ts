import { z } from "zod";
import { DAY_LABEL } from "@/partner/application";
import type { DayHours } from "@/partner/types";

/* Rules and helpers shared by the showroom and profile forms and their Server Actions. Client-safe. */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const dayHoursSchema = z
  .array(
    z.object({
      day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      open: z.string().regex(TIME, "Use a time like 09:30"),
      close: z.string().regex(TIME, "Use a time like 20:00"),
      closed: z.boolean(),
    }),
  )
  .length(7, "Set hours for every day")
  .superRefine((rows, ctx) => {
    if (new Set(rows.map((r) => r.day)).size !== 7) ctx.addIssue({ code: "custom", message: "Set hours for every day" });
    rows.forEach((r, i) => {
      if (!r.closed && r.close <= r.open) ctx.addIssue({ code: "custom", path: [i, "close"], message: "Closing time must be after opening time" });
    });
  });

/** A public image uploaded through /dealer/upload ("/media/<id>/<file>"). */
export const mediaUrl = z.string().regex(/^\/media\/\d+\/[\w.-]+$/, "Upload this image again");
export const optionalMediaUrl = z.union([z.literal(""), mediaUrl]);
export const mediaId = (url: string) => Number(url.split("/")[2]);

const to12h = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

/** "Mon – Sat · 9:30 AM – 8:00 PM" — the same summary the public listing shows. */
export function hoursSummary(hours: DayHours[]) {
  const open = hours.filter((h) => !h.closed);
  if (!open.length) return "By appointment";
  const key = (h: DayHours) => `${h.open}-${h.close}`;
  const counts = new Map<string, number>();
  for (const h of open) counts.set(key(h), (counts.get(key(h)) ?? 0) + 1);
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const days = open.filter((h) => key(h) === common);
  const [o, c] = common.split("-");
  const first = DAY_LABEL[days[0].day].slice(0, 3);
  const last = DAY_LABEL[days[days.length - 1].day].slice(0, 3);
  return `${first === last ? first : `${first} – ${last}`} · ${to12h(o)} – ${to12h(c)}`;
}

/** Map links for a point (OpenStreetMap embed + Google Maps directions). */
export function osmEmbed(lat: number, lng: number, zoomDelta = 0.006) {
  const bbox = [lng - zoomDelta * 1.6, lat - zoomDelta, lng + zoomDelta * 1.6, lat + zoomDelta].map((n) => n.toFixed(5)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
export const osmLink = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=17/${lat.toFixed(5)}/${lng.toFixed(5)}`;
