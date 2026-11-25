import { notFound } from "next/navigation";
import { getPublicProduct } from "@/server/insurance/public";

/**
 * Checks the plan exists before the page's loading skeleton starts streaming, so an unknown or withdrawn
 * reference gets a real 404 status (not a 200 with a noindex tag). The lookup is cached per request, so the
 * page doesn't query again. The not-found UI lives one level up (../not-found.tsx).
 */
export default async function ProductLayout({ children, params }: LayoutProps<"/insurance/products/[ref]">) {
  if (!(await getPublicProduct((await params).ref))) notFound();
  return children;
}
