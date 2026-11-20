import type { Metadata } from "next";
import { INS_PRODUCT_CATEGORIES, type InsProductCategory } from "@/db/enums";
import { getCatalog } from "@/server/catalog";
import { requireInsurer } from "@/server/insurance/context";
import { PortalHeader, strParam } from "@/components/portal/ui";
import { ProductForm } from "@/components/insurance/vendor/products/product-form";
import { companyOptions, coverOptions } from "@/components/insurance/vendor/products/queries";
import { emptyProduct, pricingConfigOf } from "@/components/insurance/vendor/products/shared";

export const metadata: Metadata = { title: "Add product" };

export default async function CreateProductPage(props: PageProps<"/insurance-vendor/products/create">) {
  const ctx = await requireInsurer({ perm: "products.manage", next: "/insurance-vendor/products/create" });
  const sp = await props.searchParams;
  const catRaw = strParam(sp.category);
  const category: InsProductCategory = INS_PRODUCT_CATEGORIES.includes(catRaw as InsProductCategory) ? (catRaw as InsProductCategory) : "comprehensive";
  const [covers, companies, catalog] = await Promise.all([coverOptions(ctx.vendor.id), companyOptions(ctx.vendor), getCatalog()]);
  const config = pricingConfigOf(catalog.content.insurancePricing);
  // Insurers are locked to their own company; intermediaries choose (a single listed insurer is preselected).
  const own = ctx.vendor.category === "insurer" ? companies[0] : companies.length === 1 ? companies[0] : undefined;

  return (
    <>
      <PortalHeader
        title="Add an insurance product"
        description="Save a draft at any point. When every section is ready, submit it — MarchGear reviews it before you can publish."
        back={{ href: "/insurance-vendor/products", label: "Insurance products" }}
      />
      <ProductForm initial={emptyProduct(category, config, own?.id ?? null)} covers={covers} companies={companies} vendorCategory={ctx.vendor.category} canManage />
    </>
  );
}
