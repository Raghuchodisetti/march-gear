import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { INS_PRODUCT_CATEGORIES, type InsProductCategory } from "@/db/enums";
import { requireInsurer } from "@/server/insurance/context";
import { productUsage } from "@/server/insurance/catalog-limits";
import { Button } from "@/components/ui/button";
import { PortalHeader, StatCard, pageParam, strParam } from "@/components/portal/ui";
import { ProductList } from "@/components/insurance/vendor/products/product-list";
import { PRODUCT_PAGE_SIZE, listProducts } from "@/components/insurance/vendor/products/queries";
import { PRODUCT_SORTS, PRODUCT_TABS, type ProductSort, type ProductTab } from "@/components/insurance/vendor/products/shared";

export const metadata: Metadata = { title: "Insurance products" };

export default async function ProductsPage(props: PageProps<"/insurance-vendor/products">) {
  const ctx = await requireInsurer({ perm: "products.view", next: "/insurance-vendor/products" });
  const sp = await props.searchParams;
  const tabRaw = strParam(sp.tab);
  const tab: ProductTab = PRODUCT_TABS.some((t) => t.value === tabRaw) ? (tabRaw as ProductTab) : "all";
  const catRaw = strParam(sp.category);
  const category = INS_PRODUCT_CATEGORIES.includes(catRaw as InsProductCategory) ? (catRaw as InsProductCategory) : undefined;
  const sortRaw = strParam(sp.sort);
  const sort: ProductSort = PRODUCT_SORTS.some((s) => s.value === sortRaw) ? (sortRaw as ProductSort) : "updated";
  const dir = strParam(sp.dir) === "asc" ? "asc" : "desc";
  const q = strParam(sp.q)?.slice(0, 80);
  const page = pageParam(sp.page);

  const [data, usage] = await Promise.all([listProducts(ctx.vendor, { tab, category, q, sort, dir, page }), productUsage(ctx.vendor.id, ctx.vendor.plan)]);
  const t = data.tabCounts;
  const canManage = ctx.can("products.manage");

  return (
    <>
      <PortalHeader
        title="Insurance products"
        description="Your motor insurance products. MarchGear reviews each one; once approved you can publish it to customers."
        actions={
          canManage ? (
            <Button href="/insurance-vendor/products/create" icon={<Plus aria-hidden className="size-4" />}>
              Add product
            </Button>
          ) : undefined
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Published"
          value={usage.published}
          note={usage.limit === null ? `Unlimited on ${usage.plan.name}` : `of ${usage.limit} on your ${usage.plan.name} plan`}
          href="/insurance-vendor/products?tab=live"
        />
        <StatCard label="Approved, not live" value={t.approved} note={t.approved ? "Ready to publish" : "None waiting"} href="/insurance-vendor/products?tab=approved" />
        <StatCard label="In review" value={t.review} note="With the MarchGear team" href="/insurance-vendor/products?tab=review" />
        <StatCard
          label="Needs your attention"
          value={t.attention}
          tone={t.attention ? "red" : undefined}
          note={t.attention ? "Changes requested or rejected" : "Nothing to fix"}
          href={t.attention ? "/insurance-vendor/products?tab=attention" : undefined}
        />
      </div>

      {usage.limit !== null && usage.published >= usage.limit && (
        <p className="mb-5 border-l-2 border-[#c98a1b] bg-[#fdf3e1] px-4 py-3 text-[13px] text-[#6b4300]">
          You&rsquo;ve published {usage.published} of {usage.limit} products allowed on the {usage.plan.name} plan. Unpublish one to publish another
          {ctx.can("billing.manage") ? (
            <>
              , or{" "}
              <Link href="/insurance-vendor/billing" className="font-medium underline underline-offset-4">
                upgrade your plan
              </Link>
            </>
          ) : null}
          .
        </p>
      )}

      {!canManage && (
        <p className="mb-5 border-l-2 border-ink/20 bg-white px-4 py-3 text-[13px] text-muted">
          You can view products. Creating, editing and submitting them needs the &ldquo;Create, edit and submit products&rdquo; permission — ask your company&rsquo;s owner.
        </p>
      )}

      <ProductList
        rows={data.rows}
        total={data.total}
        pageSize={PRODUCT_PAGE_SIZE}
        filters={{ tab, category: category ?? "", q: q ?? "", sort, dir, page }}
        tabCounts={data.tabCounts}
        canManage={canManage}
        usage={{ published: usage.published, limit: usage.limit, planName: usage.plan.name }}
      />
    </>
  );
}
