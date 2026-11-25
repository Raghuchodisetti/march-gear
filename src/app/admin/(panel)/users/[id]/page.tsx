import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { accountHref } from "@/lib/accounts";
import { deskRedirect, requireStaff } from "@/server/auth";

/* Old account links (/admin/users/<id>) open the account in its own list's section. */
export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  await requireStaff(["customers", "dealers", "insurance"]);
  const { id } = await params;
  const [user] = /^\d+$/.test(id) ? await getDb().select({ role: users.role }).from(users).where(eq(users.id, Number(id))) : [];
  if (!user) notFound();
  await deskRedirect(accountHref(user.role, Number(id)));
}
