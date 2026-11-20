import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { listDealers } from "@/server/admin/catalog";
import { Button } from "@/components/ui/button";
import { AdminHeader, Badge, EmptyRow, Table, Td, Th } from "@/components/admin/ui";
import { Thumb } from "@/components/admin/thumb";

export const metadata: Metadata = { title: "Dealers" };

export default async function DealersAdminPage() {
  const rows = await listDealers();
  return (
    <>
      <AdminHeader
        title="Showroom listings"
        description="Showrooms listed on the public /dealers page. Approved dealer partners are linked here automatically."
        actions={
          <Button href="/admin/showrooms/new" size="sm" icon={<Plus className="size-4" aria-hidden />}>
            Add dealer
          </Button>
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Showroom</Th>
            <Th>City</Th>
            <Th>Rating</Th>
            <Th>Contact</Th>
            <Th>Visibility</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={5}>No dealers yet.</EmptyRow>}
          {rows.map((d) => (
            <tr key={d.id} className="hover:bg-mist/50">
              <Td>
                <Link href={`/admin/showrooms/${d.id}`} className="flex items-center gap-3 font-medium hover:text-red">
                  <Thumb src={d.image} />
                  <span>
                    {d.name}
                    <span className="block text-[12px] font-normal text-muted">/{d.id}</span>
                  </span>
                </Link>
              </Td>
              <Td className="text-muted">
                {d.area}, {d.city}
              </Td>
              <Td className="whitespace-nowrap num">
                <Star aria-hidden className="mr-1 inline size-3.5 fill-red text-red" />
                {d.rating.toFixed(1)} <span className="text-muted">({d.reviewCount})</span>
              </Td>
              <Td className="text-muted">
                {d.phone}
                <span className="block text-[12px]">{d.email}</span>
              </Td>
              <Td>{d.isActive ? <Badge tone="green">Visible</Badge> : <Badge tone="amber">Hidden</Badge>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
