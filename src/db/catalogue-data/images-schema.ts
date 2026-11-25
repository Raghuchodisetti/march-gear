import { z } from "zod";

/* ──────────────────────────────────────────────────────────────
   Genuine, free-licensed photos for catalogue models: one JSON
   file per brand in src/db/catalogue-data/images/<brand-slug>.json,
   validated here and loaded by `npm run db:import-images`.

   Source: Wikimedia Commons, licences that allow commercial use
   (CC0, public domain, CC BY, CC BY-SA). Every photo was checked by
   eye to show the actual model (current generation, Indian-market
   design). Attribution is stored and shown as the licence requires.
   ────────────────────────────────────────────────────────────── */

/** Licences we accept, by their Commons "LicenseShortName". */
export const ALLOWED_LICENSE = /^(CC0( 1\.0)?|Public domain|PD[- ].*|CC BY(-SA)? [1-4]\.[05]( [A-Za-z]{2,3})?)$/i;

export const ANGLES = ["front", "rear", "side", "interior", "detail"] as const;

const commonsFileUrl = z
  .string()
  .regex(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:.+/, "The Commons file page, https://commons.wikimedia.org/wiki/File:…");
const uploadUrl = z.string().regex(/^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\/.+/, "A Wikimedia upload/thumb URL");

export const photoSchema = z.object({
  /** "File:2024 Hyundai Creta SX.jpg" */
  file: z.string().regex(/^File:.+\.(jpe?g|png|webp|tiff?)$/i, "A Commons file title ending in an image extension"),
  /** The file's page on Commons (source + licence details). */
  pageUrl: commonsFileUrl,
  /** A download URL for a large rendition (1600–2560 px wide preferred), from the API's thumburl/url. */
  downloadUrl: uploadUrl,
  /** Original pixel size. */
  width: z.number().int().min(800),
  height: z.number().int().min(450),
  /** Author / creator as plain text (HTML stripped), e.g. "Chanokchon". */
  author: z.string().trim().min(1).max(160),
  /** Author's page if Commons gives one. */
  authorUrl: z.string().url().nullable(),
  /** Commons LicenseShortName, e.g. "CC BY-SA 4.0", "CC0", "Public domain". */
  license: z.string().regex(ALLOWED_LICENSE, "Only CC0, public domain, CC BY or CC BY-SA licences"),
  /** The licence's URL (from extmetadata LicenseUrl); null for public domain without one. */
  licenseUrl: z.string().url().nullable(),
  angle: z.enum(ANGLES),
  /** What the photo shows, for alt text: model, version/year if visible, angle, colour. */
  alt: z.string().trim().min(10).max(200),
  /** Why this is the right model (e.g. "Indian-market facelift: split LED headlamps, new grille"), or caveats. */
  note: z.string().max(400).nullable(),
});

export const brandImagesSchema = z
  .object({
    brand: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    checkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** model slug → photos, best first (a front three-quarter view first when one exists). Up to 4. */
    models: z.record(z.string(), z.array(photoSchema).min(1).max(4)),
    /** model slug → why no photo was used (e.g. "no free photo of the Indian model on Commons"). */
    missing: z.record(z.string(), z.string().min(5).max(300)),
  })
  .superRefine((f, ctx) => {
    for (const slug of Object.keys(f.models)) {
      if (slug in f.missing) ctx.addIssue({ code: "custom", path: ["missing", slug], message: `${slug} is in both models and missing` });
      const files = f.models[slug].map((p) => p.file);
      if (new Set(files).size !== files.length) ctx.addIssue({ code: "custom", path: ["models", slug], message: `${slug} uses the same file twice` });
    }
  });

export type BrandImages = z.infer<typeof brandImagesSchema>;
export type CataloguePhoto = z.infer<typeof photoSchema>;
