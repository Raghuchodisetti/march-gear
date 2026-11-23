import { getSessionUser } from "@/server/auth";
import { buildDataExport } from "@/server/customer/account";
import { todayISO } from "@/server/validation";

/**
 * "Download my data" — the signed-in customer's own records as a JSON file.
 * Website session only; another account's data can never be requested.
 */
export async function GET(request: Request) {
  const user = await getSessionUser("customer");
  if (!user) return Response.redirect(new URL(`/login?next=${encodeURIComponent("/account/privacy")}`, request.url), 303);
  const data = await buildDataExport(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="marchgear-my-data-${todayISO()}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
