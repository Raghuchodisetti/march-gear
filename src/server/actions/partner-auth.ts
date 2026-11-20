"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerMembers, partners, users } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { emptyApplication } from "@/partner/application";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/server/auth";
import { isDuplicate } from "@/server/db-errors";
import { logPartnerActivity, recordApproval, reference } from "@/server/partner/records";
import { HOUR, MINUTE, allowFromIp, clientIp, reset, take } from "@/server/rate-limit";
import { email, invalid, mobile, name, password } from "@/server/validation";

/* Dealer portal sign-in, sign-up (registration step 1) and sign-out. */

const DEALER_TTL = 7 * 86_400_000;
const TOO_MANY = "Too many attempts. Please wait 15 minutes and try again.";

/** Where a signed-in dealer should land. */
async function landing(userId: number) {
  const [row] = await getDb()
    .select({ status: partners.status })
    .from(partnerMembers)
    .innerJoin(partners, eq(partners.id, partnerMembers.partnerId))
    .where(and(eq(partnerMembers.userId, userId), eq(partnerMembers.isActive, true)))
    .limit(1);
  if (!row) return null;
  if (row.status === "draft") return "/dealer/register";
  return row.status === "approved" ? "/dealer/dashboard" : "/dealer/application-status";
}

export async function dealerSignInAction(input: unknown): Promise<ActionResult<{ next: string }>> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password").max(200) }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ip = await clientIp();
  const keys = [`dealer-signin:${ip ?? "?"}:${parsed.data.email}`, `dealer-signin:${parsed.data.email}`];
  if ([take(keys[0], 8, 15 * MINUTE), take(keys[1], 20, 15 * MINUTE)].includes(false)) return { ok: false, error: TOO_MANY };

  const [user] = await getDb().select().from(users).where(eq(users.email, parsed.data.email));
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash);
  if (!user || !valid) return { ok: false, error: "Email or password is incorrect." };
  if (user.role !== "dealer") return { ok: false, error: "This isn't a dealer partner account. Customers sign in at /login and MarchGear staff at /admin." };
  if (!user.isActive) return { ok: false, error: "This account has been disabled. Contact your dealership's administrator." };
  const next = await landing(user.id);
  if (!next) return { ok: false, error: "Your access to this dealership has been removed. Contact its owner or administrator." };
  keys.forEach(reset);
  await createSession(user.id, DEALER_TTL);
  return { ok: true, next };
}

const registerSchema = z.object({
  fullName: name,
  email,
  mobile,
  password,
  acceptTerms: z.literal(true, { error: "Please accept the partner terms to continue" }),
});

/** Registration step 1: creates the dealer login, the draft application and the owner membership, then signs in. */
export async function dealerRegisterAccountAction(input: unknown): Promise<ActionResult<{ next: string }>> {
  if (!(await allowFromIp("dealer-register", 5, HOUR))) return { ok: false, error: "Too many sign-ups from your network. Please try again later." };
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { fullName, email: mail, mobile: phone, password: pw } = parsed.data;
  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, mail));
  if (existing) return { ok: false, fieldErrors: { email: "An account with this email already exists — sign in instead." } };

  const passwordHash = await hashPassword(pw);
  try {
    const created = await db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ name: fullName, email: mail, phone, role: "dealer", passwordHash });
      let pid = 0;
      for (let attempt = 0; attempt < 3 && !pid; attempt++) {
        try {
          const [p] = await tx.insert(partners).values({
            reference: reference("DLR"),
            ownerUserId: u.insertId,
            status: "draft",
            application: emptyApplication({ fullName, email: mail, mobile: phone }),
            step: 1,
          });
          pid = p.insertId;
        } catch (err) {
          if (!isDuplicate(err) || attempt === 2) throw err;
        }
      }
      await tx.insert(partnerMembers).values({ partnerId: pid, userId: u.insertId, role: "owner" });
      return { partnerId: pid, userId: u.insertId };
    });
    await createSession(created.userId, DEALER_TTL);
    await recordApproval({ partnerId: created.partnerId, target: "partner", action: "created", toStatus: "draft", actorUserId: created.userId, actorSide: "dealer" });
    await logPartnerActivity(created.partnerId, created.userId, "create", "application", null, "Started the dealer partner application");
    return { ok: true, next: "/dealer/register/personal-details" };
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, fieldErrors: { email: "An account with this email already exists — sign in instead." } };
    throw err;
  }
}

export async function dealerSignOutAction(): Promise<ActionResult> {
  await destroySession();
  return { ok: true };
}

