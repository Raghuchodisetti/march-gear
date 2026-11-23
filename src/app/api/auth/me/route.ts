import { getSessionUser } from "@/server/auth";
import { countUnreadCustomerNotifications } from "@/server/customer/notifications";
import { getWishlist } from "@/server/wishlist";

/** The signed-in customer, their saved cars and unread account notifications, for the client-side app state. */
export async function GET() {
  const user = await getSessionUser("customer");
  if (!user) return Response.json({ user: null, wishlist: null, unreadNotifications: 0 }, { headers: { "Cache-Control": "private, no-store" } });
  const [wishlist, unreadNotifications] = await Promise.all([getWishlist(user.id), countUnreadCustomerNotifications(user.id)]);
  const body = { user, wishlist, unreadNotifications };
  return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
