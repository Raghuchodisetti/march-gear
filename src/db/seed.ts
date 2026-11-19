/**
 * Seeds MySQL with the launch catalogue and the first admin account.
 *
 *   npm run db:seed            fill empty tables only (safe to re-run)
 *   npm run db:seed -- --reset reload catalogue + editorial (keeps users & leads)
 */
import bcrypt from "bcryptjs";
import { count, eq, inArray, sql } from "drizzle-orm";
import type { MySqlTable } from "drizzle-orm/mysql-core";
import { closeDb, getDb } from "./index";
import * as s from "./schema";
import { seedBrands } from "./seed-data/brands";
import { seedCars } from "./seed-data/cars";
import { seedDealerProfiles } from "./seed-data/dealer-details";
import { seedDealerReviews } from "./seed-data/dealer-reviews";
import { seedDealers } from "./seed-data/dealers";
import { seedArticles, seedAuthors } from "./seed-data/news";
import { seedOwnerReviews } from "./seed-data/reviews";
import { seedUpcoming } from "./seed-data/upcoming";
import { seedUsedCars } from "./seed-data/used-cars";

const db = getDb();
const reset = process.argv.includes("--reset");

async function isEmpty(table: MySqlTable) {
  const [{ n }] = await db.select({ n: count() }).from(table);
  return n === 0;
}

async function step(label: string, table: MySqlTable, run: () => Promise<number>) {
  if (!(await isEmpty(table))) {
    console.log(`  · ${label}: already has rows, skipped`);
    return;
  }
  const n = await run();
  console.log(`  ✓ ${label}: ${n}`);
}

async function main() {
  console.log(reset ? "Resetting catalogue and editorial…" : "Seeding empty tables…");

  if (reset) {
    // One transaction = one connection, so the FOREIGN_KEY_CHECKS switch applies to every delete.
    await db.transaction(async (tx) => {
      await tx.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
      // Only the seeded owner reviews — reviews submitted on the site are kept.
      await tx.delete(s.ownerReviews).where(inArray(s.ownerReviews.id, seedOwnerReviews.map((r) => r.id)));
      for (const t of [s.variants, s.dealerReviews, s.usedCars, s.articles, s.authors, s.upcomingCars, s.cars, s.dealers, s.brands]) {
        await tx.delete(t);
      }
      await tx.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    });
  }

  await step("brands", s.brands, async () => {
    await db.insert(s.brands).values(seedBrands.map((b, i) => ({ ...b, isLuxury: Boolean(b.isLuxury), sortOrder: i })));
    return seedBrands.length;
  });

  await step("cars + variants", s.cars, async () => {
    let variantCount = 0;
    for (const [i, car] of seedCars.entries()) {
      const { variants, ev, fuelTank, focus, trending, launchedOn, ...rest } = car;
      const [res] = await db.insert(s.cars).values({
        ...rest,
        ev: ev ?? null,
        fuelTank: fuelTank ?? null,
        focus: focus ?? null,
        trending: Boolean(trending),
        launchedOn: launchedOn ?? null,
        sortOrder: i,
      });
      if (variants.length) {
        await db.insert(s.variants).values(variants.map((v, j) => ({ ...v, carId: res.insertId, sortOrder: j })));
        variantCount += variants.length;
      }
    }
    return seedCars.length + variantCount;
  });

  await step("upcoming cars", s.upcomingCars, async () => {
    await db.insert(s.upcomingCars).values(seedUpcoming.map((u, i) => ({ ...u, sortOrder: i })));
    return seedUpcoming.length;
  });

  await step("dealers", s.dealers, async () => {
    await db.insert(s.dealers).values(
      seedDealers.map((d, i) => ({ ...d, usedInventory: Boolean(d.usedInventory), profile: seedDealerProfiles[d.id] ?? null, sortOrder: i })),
    );
    return seedDealers.length;
  });

  await step("dealer reviews", s.dealerReviews, async () => {
    await db.insert(s.dealerReviews).values(seedDealerReviews.map((r) => ({ ...r, status: "approved" as const })));
    return seedDealerReviews.length;
  });

  await step("used cars", s.usedCars, async () => {
    await db.insert(s.usedCars).values(
      seedUsedCars.map(({ seller, newPrice, focus, modelSlug, ...c }) => ({
        ...c,
        modelSlug: modelSlug ?? null,
        newPrice: newPrice ?? null,
        focus: focus ?? null,
        sellerName: seller.name,
        sellerType: seller.type,
        dealerId: seller.dealerId ?? null,
      })),
    );
    return seedUsedCars.length;
  });

  await step("authors", s.authors, async () => {
    await db.insert(s.authors).values(seedAuthors);
    return seedAuthors.length;
  });

  await step("articles", s.articles, async () => {
    await db.insert(s.articles).values(
      seedArticles.map((a) => ({
        ...a,
        pullQuote: a.pullQuote ?? null,
        relatedCar: a.relatedCar ?? null,
        videoDuration: a.videoDuration ?? null,
      })),
    );
    return seedArticles.length;
  });

  // Owner reviews also hold customer submissions, so seed by id instead of "only if empty".
  const [{ n: seededReviews }] = await db.select({ n: count() }).from(s.ownerReviews).where(inArray(s.ownerReviews.id, seedOwnerReviews.map((r) => r.id)));
  if (seededReviews) console.log("  · owner reviews: already has rows, skipped");
  else {
    await db.insert(s.ownerReviews).values(seedOwnerReviews.map((r) => ({ ...r, status: "approved" as const })));
    console.log(`  ✓ owner reviews: ${seedOwnerReviews.length}`);
  }

  // First admin account
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("  · admin: set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local to create one");
  } else {
    const [existing] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
    if (existing) {
      console.log(`  · admin: ${email} already exists, skipped`);
    } else {
      await db.insert(s.users).values({ name: "MarchGear Admin", email, role: "admin", passwordHash: await bcrypt.hash(password, 12) });
      console.log(`  ✓ admin: ${email}`);
    }
  }
}

main()
  .then(() => console.log("Done."))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeDb);
