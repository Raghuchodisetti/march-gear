import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { Plus } from "lucide-react";
import { listBrands } from "@/server/admin/catalog";
import { Button } from "@/components/ui/button";
import { BrandLogo, hasBrandLogo } from "@/components/ui/brand-logo";
import { AdminHeader, Badge, EmptyRow, Table, Td, Th } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsAdminPage() {
  const rows = await listBrands();
  return (
    <>
      <AdminHeader
        title="Brands"
        description="Manufacturers shown across the site. Hidden brands also hide their cars."
        actions={
          <Button href="/admin/brands/new" size="sm" icon={<Plus className="size-4" aria-hidden />}>
            Add brand
          </Button>
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Brand</Th>
            <Th>Country</Th>
            <Th>Models</Th>
            <Th>Segment</Th>
            <Th>Visibility</Th>
            <Th className="text-right">Order</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={6}>No brands yet.</EmptyRow>}
          {rows.map((b) => (
            <tr key={b.id} className="hover:bg-mist/50">
              <Td>
                <Link href={`/admin/brands/${b.id}`} className="flex items-center gap-3 font-medium hover:text-red">
                  <span className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-[3px] border border-line bg-white">
                    {hasBrandLogo(b.slug) ? <BrandLogo slug={b.slug} className="h-[60%] w-auto" /> : <span className="text-[11px] font-semibold">{b.name.slice(0, 2)}</span>}
                  </span>
                  <span>
                    {b.name}
                    <span className="block text-[12px] font-normal text-muted">/{b.slug}</span>
                  </span>
                </Link>
              </Td>
              <Td className="text-muted">{b.country}</Td>
              <Td className="num">{b.models}</Td>
              <Td>{b.isLuxury ? <Badge tone="dark">Luxury</Badge> : <Badge>Mainstream</Badge>}</Td>
              <Td>{b.isActive ? <Badge tone="green">Visible</Badge> : <Badge tone="amber">Hidden</Badge>}</Td>
              <Td className="text-right text-muted num">{b.sortOrder}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
