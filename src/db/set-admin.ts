/**
 * Creates the admin from .env.local, or resets its password to ADMIN_PASSWORD.
 *
 *   npm run db:admin
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "./index";
import { sessions, users } from "./schema";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local first.");
  if (password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters.");

  const db = getDb();
  const passwordHash = await bcrypt.hash(password, 12);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    await db.update(users).set({ passwordHash, role: "admin", isActive: true }).where(eq(users.id, existing.id));
    // Sign out old sessions so only the new password works.
    await db.delete(sessions).where(eq(sessions.userId, existing.id));
    console.log(`✓ Password updated for ${email} (role: admin, active).`);
  } else {
    await db.insert(users).values({ name: "MarchGear Admin", email, role: "admin", passwordHash });
    console.log(`✓ Admin created: ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(closeDb);
