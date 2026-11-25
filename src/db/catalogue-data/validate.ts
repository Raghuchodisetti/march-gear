/**
 * Validates the researched catalogue files.
 *
 *   npx tsx src/db/catalogue-data/validate.ts                 every brand file
 *   npx tsx src/db/catalogue-data/validate.ts maruti-suzuki   one brand
 *
 * Run from the project root. Checks the schema, model slugs unique across all brands, and flags prices that look wrong
 * (variant prices far outside the model's range, unsorted, zero). Exit code 1 on errors.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { brandFileSchema, type BrandFile } from "./schema";

const dir = path.join(process.cwd(), "src", "db", "catalogue-data", "brands");
const only = process.argv[2];
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !only || f === `${only}.json`);

let errors = 0;
let warnings = 0;
const slugs = new Map<string, string>();
const totals = { brands: 0, models: 0, variants: 0 };

for (const f of files) {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
  } catch (e) {
    console.log(`✗ ${f}: not valid JSON — ${(e as Error).message}`);
    errors++;
    continue;
  }
  const parsed = brandFileSchema.safeParse(raw);
  if (!parsed.success) {
    errors += parsed.error.issues.length;
    console.log(`✗ ${f}:`);
    for (const i of parsed.error.issues.slice(0, 25)) console.log(`    ${i.path.join(".")}: ${i.message}`);
    if (parsed.error.issues.length > 25) console.log(`    … and ${parsed.error.issues.length - 25} more`);
    continue;
  }
  const b: BrandFile = parsed.data;
  if (`${b.brand.slug}.json` !== f) {
    console.log(`✗ ${f}: file name must be ${b.brand.slug}.json`);
    errors++;
  }
  totals.brands++;
  for (const m of b.models) {
    totals.models++;
    totals.variants += m.variants.length;
    const other = slugs.get(m.slug);
    if (other) {
      console.log(`✗ ${f}: model slug ${m.slug} also used in ${other}`);
      errors++;
    }
    slugs.set(m.slug, f);
    const prices = m.variants.map((v) => v.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (max > min * 6) {
      console.log(`! ${f}: ${m.slug} prices span ₹${min.toLocaleString("en-IN")} – ₹${max.toLocaleString("en-IN")} (over 6×) — check for a typo`);
      warnings++;
    }
    if (min < 300_000) {
      console.log(`! ${f}: ${m.slug} has a variant under ₹3 lakh — check`);
      warnings++;
    }
  }
  console.log(`✓ ${f}: ${b.models.length} models, ${b.models.reduce((n, m) => n + m.variants.length, 0)} variants (as of ${b.asOf}, ex-showroom ${b.priceCity})`);
}

console.log(`\n${totals.brands} brands · ${totals.models} models · ${totals.variants} variants · ${errors} errors · ${warnings} warnings`);
process.exitCode = errors ? 1 : 0;
