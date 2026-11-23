"use server";

import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { insMembers, insVendors, users } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { emptyInsurerApplication } from "@/insurance/application";
import { INS_PORTAL_OPEN } from "@/server/insurance/context";
import { insReference, logInsurerActivity, recordInsApproval } from "@/server/insurance/records";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/server/auth";
import { isDuplicate } from "@/server/db-errors";
import { HOUR, MINUTE, allowFromIp, clientIp, reset, take } from "@/server/rate-limit";
import { email, invalid, mobile, name, password } from "@/server/validation";

/* Sign-in, sign-up (the account behind a vendor application) and sign-out for the insurance vendor portal (/insurance-vendor). */

const TOO_MANY = "Too many attempts. Please wait 15 minutes and try again.";
const TAKEN = "An account with this email already exists — sign in instead.";

/** Where a signed-in vendor user should land. */
async function landing(userId: number) {
  const [row] = await getDb()
    .select({ status: insVendors.status })
    .from(insMembers)
    .innerJoin(insVendors, eq(insVendors.id, insMembers.vendorId))
    .where(and(eq(insMembers.userId, userId), eq(insMembers.isActive, true)))
    .orderBy(asc(insMembers.id))
    .limit(1);
  if (!row) return null;
  if (row.status === "draft") return "/insurance-vendor/register";
  return INS_PORTAL_OPEN.includes(row.status) ? "/insurance-vendor/dashboard" : "/insurance-vendor/application-status";
}

export async function insurerSignInAction(input: unknown): Promise<ActionResult<{ next: string }>> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password").max(200) }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ip = await clientIp();
  const keys = [`insurer-signin:${ip ?? "?"}:${parsed.data.email}`, `insurer-signin:${parsed.data.email}`];
  if ([take(keys[0], 8, 15 * MINUTE), take(keys[1], 20, 15 * MINUTE)].includes(false)) return { ok: false, error: TOO_MANY };

  const [user] = await getDb().select().from(users).where(eq(users.email, parsed.data.email));
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash);
  if (!user || !valid) return { ok: false, error: "Email or password is incorrect." };
  if (user.role !== "insurer")
    return { ok: false, error: "This isn't an insurance vendor account. Customers sign in at /login, dealer partners at /dealer/login and MarchGear staff at /admin/login." };
  if (!user.isActive) return { ok: false, error: "This account has been deactivated. Contact your company's owner or administrator." };
  const next = await landing(user.id);
  if (!next) return { ok: false, error: "Your access to this company has been removed. Contact its owner or administrator." };
  keys.forEach(reset);
  await createSession(user.id, "insurer");
  return { ok: true, next };
}

const registerSchema = z.object({
  fullName: name,
  email,
  mobile,
  password,
  acceptTerms: z.literal(true, { error: "Accept the terms and privacy policy to continue" }),
});

/** Creates the vendor login, the draft application (ins_vendors) and the owner membership, then signs in. */
export async function insurerRegisterAccountAction(input: unknown): Promise<ActionResult<{ next: string }>> {
  if (!(await allowFromIp("insurer-register", 5, HOUR))) return { ok: false, error: "Too many sign-ups from your network. Please try again later." };
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { fullName, email: mail, mobile: phone, password: pw } = parsed.data;
  if (!take(`insurer-register:${mail}`, 5, HOUR)) return { ok: false, error: "Too many attempts. Please try again later." };
  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, mail));
  if (existing) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { email: TAKEN } };

  const passwordHash = await hashPassword(pw);
  try {
    const created = await db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ name: fullName, email: mail, phone, role: "insurer", passwordHash });
      let vendorId = 0;
      for (let attempt = 0; attempt < 3 && !vendorId; attempt++) {
        try {
          const [v] = await tx.insert(insVendors).values({
            reference: insReference("INS"),
            ownerUserId: u.insertId,
            status: "draft",
            application: emptyInsurerApplication({ name: fullName, email: mail, mobile: phone }),
            step: 1,
          });
          vendorId = v.insertId;
        } catch (err) {
          if (!isDuplicate(err) || attempt === 2) throw err;
        }
      }
      await tx.insert(insMembers).values({ vendorId, userId: u.insertId, role: "owner" });
      return { vendorId, userId: u.insertId };
    });
    await createSession(created.userId, "insurer");
    await recordInsApproval({ vendorId: created.vendorId, target: "vendor", targetId: created.vendorId, action: "created", toStatus: "draft", actorUserId: created.userId, actorSide: "vendor" });
    await logInsurerActivity(created.vendorId, created.userId, "create", "application", created.vendorId, "Started the insurance vendor application");
    return { ok: true, next: "/insurance-vendor/register/contact" };
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { email: TAKEN } };
    throw err;
  }
}

export async function insurerSignOutAction(): Promise<ActionResult> {
  await destroySession("insurer");
  return { ok: true };
}
