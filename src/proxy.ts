import { NextResponse, type NextRequest } from "next/server";

/*
 * The two back-office desks share one set of pages (src/app/admin):
 * - /admin/… is the admin desk;
 * - /staff/… is the staff desk, served from the same pages.
 * Each request is told which desk it is for (x-mg-desk) and which /admin/… page it is (x-mg-path), overwriting
 * anything the browser sent. The pages and actions then use that desk's own sign-in and check the staff member's
 * sections (src/server/auth.ts — every Server Action checks its section itself, too).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const staff = pathname === "/staff" || pathname.startsWith("/staff/");
  const adminPath = staff ? `/admin${pathname.slice("/staff".length)}` : pathname;

  const headers = new Headers(request.headers);
  headers.set("x-mg-desk", staff ? "staff" : "admin");
  headers.set("x-mg-path", adminPath);

  if (!staff) return NextResponse.next({ request: { headers } });
  const url = request.nextUrl.clone();
  url.pathname = adminPath;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*"],
};
