import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatPriceRange } from "@/lib/format";
import { brandOptions, listCars } from "@/server/admin/catalog";
import { Button } from "@/components/ui/button";
import { AdminHeader, Badge, EmptyRow, FilterForm, FilterSelect, SearchInput, Table, Td, Th, strParam } from "@/components/admin/ui";
import { Thumb } from "@/components/admin/thumb";

export const metadata: Metadata = { title: "New cars" };

export default async function CarsAdminPage({ searchParams }: PageProps<"/admin/cars">) {
  const sp = await searchParams;
  const q = strParam(sp.q);
  const brand = strParam(sp.brand);
  const [rows, brands] = await Promise.all([listCars(q, brand), brandOptions()]);

  return (
    <>
      <AdminHeader
        title="New cars"
        description="Models, prices, specs and variants shown on model pages, listings and comparisons."
        actions={
          <Button href="/admin/cars/new" size="sm" icon={<Plus className="size-4" aria-hidden />}>
            Add car
          </Button>
        }
      />
      <FilterForm resetHref="/admin/cars" hasFilters={Boolean(q || brand)}>
        <SearchInput value={q} placeholder="Model name or slug…" />
        <FilterSelect name="brand" label="All brands" value={brand} options={brands} />
      </FilterForm>
      <Table>
        <thead>
          <tr>
            <Th>Model</Th>
            <Th>Body</Th>
            <Th>Price</Th>
            <Th>Variants</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={5}>No cars match.</EmptyRow>}
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-mist/50">
              <Td>
                <Link href={`/admin/cars/${c.id}`} className="flex items-center gap-3 font-medium hover:text-red">
                  <Thumb src={c.image} />
                  <span>
                    {c.brand} {c.name}
                    <span className="block text-[12px] font-normal text-muted">/cars/{c.slug}</span>
                  </span>
                </Link>
              </Td>
              <Td className="text-muted">{c.bodyType}</Td>
              <Td className="whitespace-nowrap num">{formatPriceRange(c.priceMin, c.priceMax)}</Td>
              <Td className="num">{c.variants}</Td>
              <Td>
                <span className="flex flex-wrap gap-1.5">
                  {c.status === "published" ? <Badge tone="green">Published</Badge> : <Badge tone="amber">Draft</Badge>}
                  {c.trending && <Badge tone="red">Trending</Badge>}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-3 text-[12.5px] text-muted num">{rows.length} models</p>
    </>
  );
}
