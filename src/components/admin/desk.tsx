"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, type ComponentProps, type ReactNode } from "react";
import { deskPath, type Desk } from "@/lib/staff-access";

/* The back office runs as two desks on one set of pages: /admin (admins) and /staff (staff). Pages and components
   write /admin/… links; inside the staff desk these point at /staff/… instead, so staff never leave their own
   sign-in. (Server-side redirects use the desk from the request — see src/server/auth.ts.) */

const DeskContext = createContext<Desk>("admin");

export function DeskProvider({ desk, children }: { desk: Desk; children: ReactNode }) {
  return <DeskContext.Provider value={desk}>{children}</DeskContext.Provider>;
}

export const useDesk = () => useContext(DeskContext);

/** Turns /admin/… paths into this desk's paths, for router.push, fetch and the like. */
export function useDeskHref() {
  const desk = useDesk();
  return (href: string) => deskPath(desk, href);
}

/** next/link for the back office: /admin/… links go to the same page on the desk being used. */
export default function DeskLink({ href, ...props }: ComponentProps<typeof NextLink>) {
  const desk = useDesk();
  const to = typeof href === "string" ? deskPath(desk, href) : href.pathname ? { ...href, pathname: deskPath(desk, href.pathname) } : href;
  return <NextLink href={to} {...props} />;
}

/** useRouter for the back office: push/replace/prefetch of /admin/… paths go to the same page on the desk being used. */
export function useDeskRouter() {
  const router = useRouter();
  const desk = useDesk();
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(deskPath(desk, href), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(deskPath(desk, href), options),
      prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(deskPath(desk, href), options),
    }),
    [router, desk],
  );
}
