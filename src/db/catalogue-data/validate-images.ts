/**
 * Validates the catalogue photo files against the image schema and the researched catalogue.
 *
 *   npx tsx src/db/catalogue-data/validate-images.ts            every brand
 *   npx tsx src/db/catalogue-data/validate-images.ts hyundai    one brand
 *
 * Run from the project root. Every model of the brand's catalogue file must be either in `models`
 * (with photos) or in `missing` (with a reason). Exit code 1 on errors.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { brandFileSchema } from "./schema";
import { brandImagesSchema } from "./images-schema";

const root = path.join(process.cwd(), "src", "db", "catalogue-data");
const imagesDir = path.join(root, "images");
const brandsDir = path.join(root, "brands");
const only = process.argv[2];
const files = existsSync(imagesDir) ? readdirSync(imagesDir).filter((f) => f.endsWith(".json") && (!only || f === `${only}.json`)) : [];

let errors = 0;
const totals = { brands: 0, models: 0, withPhotos: 0, photos: 0, missing: 0 };
const usedFiles = new Map<string, string>();

for (const f of files) {
  const parsed = brandImagesSchema.safeParse(JSON.parse(readFileSync(path.join(imagesDir, f), "utf8")));
  if (!parsed.success) {
    errors += parsed.error.issues.length;
    console.log(`✗ ${f}:`);
    for (const i of parsed.error.issues.slice(0, 25)) console.log(`    ${i.path.join(".")}: ${i.message}`);
    continue;
  }
  const img = parsed.data;
  const catalogueFile = path.join(brandsDir, `${img.brand}.json`);
  if (`${img.brand}.json` !== f || !existsSync(catalogueFile)) {
    console.log(`✗ ${f}: brand "${img.brand}" must match a catalogue file brands/${img.brand}.json`);
    errors++;
    continue;
  }
  const catalogue = brandFileSchema.parse(JSON.parse(readFileSync(catalogueFile, "utf8")));
  const slugs = catalogue.models.map((m) => m.slug);
  for (const s of [...Object.keys(img.models), ...Object.keys(img.missing)]) {
    if (!slugs.includes(s)) {
      console.log(`✗ ${f}: ${s} is not a model in brands/${img.brand}.json`);
      errors++;
    }
  }
  const unaccounted = slugs.filter((s) => !(s in img.models) && !(s in img.missing));
  if (unaccounted.length) {
    console.log(`✗ ${f}: no photos and no "missing" reason for: ${unaccounted.join(", ")}`);
    errors += unaccounted.length;
  }
  for (const [slug, photos] of Object.entries(img.models)) {
    for (const p of photos) {
      const other = usedFiles.get(p.file);
      if (other && other !== slug) console.log(`! ${f}: ${p.file} is used for both ${other} and ${slug} — check it shows both`);
      usedFiles.set(p.file, slug);
    }
  }
  totals.brands++;
  totals.models += slugs.length;
  totals.withPhotos += Object.keys(img.models).length;
  totals.photos += Object.values(img.models).reduce((n, p) => n + p.length, 0);
  totals.missing += Object.keys(img.missing).length;
  console.log(`✓ ${f}: ${Object.keys(img.models).length}/${slugs.length} models with photos (${Object.values(img.models).reduce((n, p) => n + p.length, 0)} photos), ${Object.keys(img.missing).length} without`);
}

console.log(`\n${totals.brands} brands · ${totals.withPhotos}/${totals.models} models with photos · ${totals.photos} photos · ${totals.missing} without · ${errors} errors`);
process.exitCode = errors ? 1 : 0;
