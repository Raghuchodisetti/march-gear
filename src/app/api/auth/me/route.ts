import { getSessionUser } from "@/server/auth";
import { getWishlist } from "@/server/wishlist";

/** The signed-in customer and their saved cars, for the client-side app state. */
export async function GET() {
  const user = await getSessionUser();
  const body = user ? { user, wishlist: await getWishlist(user.id) } : { user: null, wishlist: null };
  return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
