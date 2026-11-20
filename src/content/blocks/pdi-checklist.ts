import { z } from "zod";
import type { Field } from "@/components/admin/fields";
import { pdiChecklist as launchGroups, pdiEvGroupTitles, pdiEvWording, pdiFuelChecks, pdiLockedSummary } from "@/data/pdi";
import { PDI_FUELS, PDI_ICONS, PDI_ICON_NAMES, fuelGroupId, type ChecklistItem, type FuelChecks } from "@/lib/pdi";
import { defineBlock, optionalText, rows, text } from "../define";

const key = (label: string) =>
  z
    .string({ error: `Enter the ${label}` })
    .trim()
    .min(1, `Enter the ${label}`)
    .max(60, `Keep the ${label} under 60 characters`)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens, e.g. ext-mirrors");

const icon = z.enum(PDI_ICON_NAMES, { error: "Choose an icon" });
const item = z.object({ id: key("check id"), text: text("check wording", 200), tip: optionalText(300) });
const fuelChecks = z.object({ title: text("section title", 80), icon, items: rows(item, "check") });

const schema = z
  .object({
    groups: rows(z.object({ id: key("section id"), title: text("section title", 80), icon, items: rows(item, "check", 1) }), "section", 1),
    lockedSummary: text("locked preview text", 200),
    fuels: z.object({ Petrol: fuelChecks, Diesel: fuelChecks, CNG: fuelChecks, Hybrid: fuelChecks, Electric: fuelChecks }),
    evGroupTitles: rows(z.object({ id: key("section id"), title: text("title", 80) }), "renamed section"),
    evWording: rows(z.object({ id: key("check id"), text: text("wording", 200) }), "reworded check"),
  })
  .superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });

    // Section ids are page anchors; the fuel sections use fuel-<fuel>.
    const sectionIds = new Set<string>(PDI_FUELS.map(fuelGroupId));
    v.groups.forEach((g, gi) => {
      if (sectionIds.has(g.id)) issue(["groups", gi, "id"], g.id.startsWith("fuel-") ? "Ids starting with “fuel-” are kept for the fuel sections" : "Another section already uses this id");
      sectionIds.add(g.id);
    });

    // Visitors' ticks are saved by check id, so ids must be unique across the whole checklist.
    const checkIds = new Set<string>();
    const unique = (id: string, path: (string | number)[]) => {
      if (checkIds.has(id)) issue(path, "Another check already uses this id — each id must be unique");
      checkIds.add(id);
    };
    v.groups.forEach((g, gi) => g.items.forEach((it, ii) => unique(it.id, ["groups", gi, "items", ii, "id"])));
    for (const fuel of PDI_FUELS) v.fuels[fuel].items.forEach((it, ii) => unique(it.id, ["fuels", fuel, "items", ii, "id"]));

    const groupIds = new Set(v.groups.map((g) => g.id));
    const itemIds = new Set(v.groups.flatMap((g) => g.items.map((i) => i.id)));
    const renamed = new Set<string>();
    v.evGroupTitles.forEach((t, i) => {
      if (!groupIds.has(t.id)) issue(["evGroupTitles", i, "id"], "No section above has this id");
      else if (renamed.has(t.id)) issue(["evGroupTitles", i, "id"], "This section is already renamed above");
      renamed.add(t.id);
    });
    const reworded = new Set<string>();
    v.evWording.forEach((w, i) => {
      if (!itemIds.has(w.id)) issue(["evWording", i, "id"], "No check in the sections above has this id");
      else if (reworded.has(w.id)) issue(["evWording", i, "id"], "This check is already reworded above");
      reworded.add(w.id);
    });
  });

const formItem = (i: ChecklistItem) => ({ id: i.id, text: i.text, tip: i.tip ?? "" });
const formFuel = (f: FuelChecks) => ({ title: f.title, icon: f.icon, items: f.items.map(formItem) });

const ID_HINT = "Lowercase with hyphens, unique. Visitors' ticks are saved against it — don't change it once published.";

const checkFields = (label: string): Field => ({
  name: "items",
  label,
  type: "rows",
  addLabel: "Add check",
  itemTitle: "text",
  fields: [
    { name: "text", label: "Check", type: "text", required: true, wide: true },
    { name: "id", label: "Check id", type: "text", required: true, placeholder: "ext-mirrors", hint: ID_HINT },
    { name: "tip", label: "Tip", type: "text", wide: true, hint: "Shown under the check as “Tip: …”." },
  ],
});

/** The free DIY checklist — on /pdi-check and in the downloadable PDF. */
export const pdiChecklist = defineBlock({
  key: "pdiChecklist",
  title: "PDI checklist",
  group: "PDI",
  description: "The free DIY checklist on the page and in the PDF, including fuel-specific checks.",
  usedOn: ["/pdi-check", "Checklist PDF"],
  schema,
  defaults: {
    groups: launchGroups.map((g) => ({ id: g.id, title: g.title, icon: g.icon, items: g.items.map(formItem) })),
    lockedSummary: pdiLockedSummary,
    fuels: {
      Petrol: formFuel(pdiFuelChecks.Petrol),
      Diesel: formFuel(pdiFuelChecks.Diesel),
      CNG: formFuel(pdiFuelChecks.CNG),
      Hybrid: formFuel(pdiFuelChecks.Hybrid),
      Electric: formFuel(pdiFuelChecks.Electric),
    },
    evGroupTitles: pdiEvGroupTitles.map((t) => ({ ...t })),
    evWording: pdiEvWording.map((w) => ({ ...w })),
  },
  sections: [
    {
      title: "Checklist sections",
      description: "In the order you'd do them at the dealership. The first section is free on the page; the rest unlock (and go in the PDF) once a visitor leaves their details.",
      fields: [
        {
          name: "groups",
          label: "Sections",
          type: "rows",
          addLabel: "Add section",
          itemTitle: "title",
          fields: [
            { name: "title", label: "Title", type: "text", required: true, placeholder: "Exterior" },
            { name: "id", label: "Section id", type: "text", required: true, placeholder: "exterior", hint: "Lowercase with hyphens, unique." },
            { name: "icon", label: "Icon", type: "select", required: true, options: [...PDI_ICONS] },
            checkFields("Checks"),
          ],
        },
        {
          name: "lockedSummary",
          label: "Locked preview text",
          type: "text",
          required: true,
          wide: true,
          hint: "What's behind the lock, shown before “Get them all as a PDF in your inbox.”",
        },
      ],
    },
    {
      title: "Fuel-specific checks",
      description: "Added for the visitor's fuel type — on the unlocked page and in the PDF — just before the last section. Leave a fuel with no checks to skip its section.",
      fields: [
        {
          name: "fuels",
          label: "Fuel types",
          type: "group",
          fields: PDI_FUELS.map(
            (fuel): Field => ({
              name: fuel,
              label: fuel,
              type: "group",
              fields: [
                { name: "title", label: "Section title", type: "text", required: true, wide: true, placeholder: `Extra checks for your ${fuel.toLowerCase()} car` },
                { name: "icon", label: "Icon", type: "select", required: true, options: [...PDI_ICONS] },
                checkFields(`${fuel} checks`),
              ],
            }),
          ),
        },
      ],
    },
    {
      title: "Electric car wording",
      description: "Electric cars have no engine, so some sections and checks read differently for them. Refer to a section or check by its id.",
      fields: [
        {
          name: "evGroupTitles",
          label: "Renamed sections",
          type: "rows",
          addLabel: "Rename a section",
          itemTitle: "title",
          fields: [
            { name: "id", label: "Section id", type: "text", required: true, placeholder: "electrical" },
            { name: "title", label: "Title for electric cars", type: "text", required: true },
          ],
        },
        {
          name: "evWording",
          label: "Reworded checks",
          type: "rows",
          addLabel: "Reword a check",
          itemTitle: "text",
          fields: [
            { name: "id", label: "Check id", type: "text", required: true, placeholder: "ele-start" },
            { name: "text", label: "Wording for electric cars", type: "text", required: true, wide: true },
          ],
        },
      ],
    },
  ],
});
