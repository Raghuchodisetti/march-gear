import { redirect } from "next/navigation";
import { getPartnerContext } from "@/server/partner/context";

/** /dealer → the right place for whoever is signed in. */
export default async function DealerIndex() {
  const ctx = await getPartnerContext();
  if (!ctx) redirect("/dealer/register");
  if (ctx.partner.status === "draft") redirect("/dealer/register");
  redirect(ctx.approved ? "/dealer/dashboard" : "/dealer/application-status");
}
