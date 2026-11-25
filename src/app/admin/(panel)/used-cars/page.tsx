import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { Plus } from "lucide-react";
import { USED_STATUS } from "@/db/enums";
import { formatPrice } from "@/lib/format";
import { listUsedCars } from "@/server/admin/catalog";
import { Button } from "@/components/ui/button";
import { AdminHeader, Badge, EmptyRow, FilterForm, FilterSelect, SearchInput, Table, Td, Th, formatDay, strParam, type BadgeTone } from "@/components/admin/ui";
import { Thumb } from "@/components/admin/thumb";

export const metadata: Metadata = { title: "Used cars" };

const TONE: Record<string, BadgeTone> = { active: "green", reserved: "blue", sold: "dark", draft: "amber" };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default async function UsedAdminPage({ searchParams }: PageProps<"/admin/used-cars">) {
  const sp = await searchParams;
  const q = strParam(sp.q);
  const status = strParam(sp.status);
  const rows = await listUsedCars(q, status);

  return (
    <>
      <AdminHeader
        title="Used cars"
        description="Pre-owned listings. Only Active listings appear on /used-cars."
        actions={
          <Button href="/admin/used-cars/new" size="sm" icon={<Plus className="size-4" aria-hidden />}>
            Add listing
          </Button>
        }
      />
      <FilterForm resetHref="/admin/used-cars" hasFilters={Boolean(q || status)}>
        <SearchInput value={q} placeholder="Model, variant, city or ID…" />
        <FilterSelect name="status" label="Any status" value={status} options={USED_STATUS.map((s) => ({ value: s, label: cap(s) }))} />
      </FilterForm>
      <Table>
        <thead>
          <tr>
            <Th>Car</Th>
            <Th>Year · km</Th>
            <Th>City</Th>
            <Th>Price</Th>
            <Th>Seller</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={6}>No listings match.</EmptyRow>}
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-mist/50">
              <Td>
                <Link href={`/admin/used-cars/${c.id}`} className="flex items-center gap-3 font-medium hover:text-red">
                  <Thumb src={c.images[0]} />
                  <span>
                    {c.name} <span className="font-normal text-muted">{c.variant}</span>
                    <span className="block text-[12px] font-normal text-muted">
                      {c.id} · posted {formatDay(c.postedOn)}
                    </span>
                  </span>
                </Link>
              </Td>
              <Td className="whitespace-nowrap num">
                {c.year} · {c.km.toLocaleString("en-IN")} km
              </Td>
              <Td className="text-muted">{c.city}</Td>
              <Td className="whitespace-nowrap num">{formatPrice(c.price)}</Td>
              <Td className="text-muted">
                {c.sellerName}
                <span className="block text-[12px]">{c.sellerType}</span>
              </Td>
              <Td>
                <span className="flex flex-wrap gap-1.5">
                  <Badge tone={TONE[c.status]}>{cap(c.status)}</Badge>
                  {c.verified && <Badge tone="red">Verified</Badge>}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-3 text-[12.5px] text-muted num">{rows.length} listings</p>
    </>
  );
}
