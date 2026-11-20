import type { Metadata } from "next";
import { and, asc, eq, ne } from "drizzle-orm";
import { Layers } from "lucide-react";
import { getDb } from "@/db";
import { partnerBrands } from "@/db/schema";
import { getCatalogData } from "@/server/catalog";
import { requirePartner } from "@/server/partner/context";
import { PortalHeader } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { CatalogProvider } from "@/components/providers/catalog-provider";
import { ModelPicker } from "@/components/portal/brands/model-picker";

export const metadata: Metadata = { title: "Models & variants" };

export default async function ModelsPage(props: PageProps<"/dealer/models">) {
  const ctx = await requirePartner({ perm: "brands.manage" });
  const { brand } = await props.searchParams;
  const [rows, data] = await Promise.all([
    getDb()
      .select({ id: partnerBrands.id, brand: partnerBrands.brand, status: partnerBrands.status, models: partnerBrands.models, variants: partnerBrands.variants })
      .from(partnerBrands)
      .where(and(eq(partnerBrands.partnerId, ctx.partner.id), ne(partnerBrands.status, "rejected")))
      .orderBy(asc(partnerBrands.createdAt)),
    getCatalogData(),
  ]);

  // Only what the picker needs: this dealership's brands and their current models.
  const mine = new Set(rows.map((r) => r.brand));
  const catalog = {
    ...data,
    brands: data.brands.filter((b) => mine.has(b.slug)),
    cars: data.cars.filter((c) => mine.has(c.brand)),
    upcoming: [],
    dealers: [],
    dealerProfiles: {},
    dealerReviews: [],
    usedCars: [],
    authors: [],
    articles: [],
    ownerReviews: [],
  };

  return (
    <>
      <PortalHeader title="Models & variants" description="Choose the models and variants you sell for each brand. Used when you list new cars and target offers — no review needed." />
      {rows.length === 0 ? (
        <div className="flex flex-col items-center border border-dashed border-ink/15 bg-white px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
            <Layers aria-hidden className="size-5 text-ink/60" />
          </span>
          <p className="mt-4 text-[15px] font-semibold">Add a brand first</p>
          <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">Your line-up is chosen per brand. Add a brand authorisation and its models appear here.</p>
          <Button className="mt-5" href="/dealer/brands" variant="dark" size="sm">
            Go to Brands
          </Button>
        </div>
      ) : (
        <CatalogProvider data={catalog}>
          <ModelPicker lineups={rows} initialBrand={typeof brand === "string" ? brand : undefined} />
        </CatalogProvider>
      )}
    </>
  );
}
