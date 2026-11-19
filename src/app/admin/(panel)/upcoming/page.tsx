import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatPriceRange } from "@/lib/format";
import { listUpcoming } from "@/server/admin/catalog";
import { Button } from "@/components/ui/button";
import { AdminHeader, Badge, EmptyRow, Table, Td, Th } from "@/components/admin/ui";
import { Thumb } from "@/components/admin/thumb";

export const metadata: Metadata = { title: "Upcoming launches" };

export default async function UpcomingAdminPage() {
  const rows = await listUpcoming();
  return (
    <>
      <AdminHeader
        title="Upcoming launches"
        description="Cars shown on /upcoming-cars before they go on sale."
        actions={
          <Button href="/admin/upcoming/new" size="sm" icon={<Plus className="size-4" aria-hidden />}>
            Add launch
          </Button>
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Model</Th>
            <Th>Expected</Th>
            <Th>Expected price</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={4}>No upcoming launches.</EmptyRow>}
          {rows.map((u) => (
            <tr key={u.id} className="hover:bg-mist/50">
              <Td>
                <Link href={`/admin/upcoming/${u.id}`} className="flex items-center gap-3 font-medium hover:text-red">
                  <Thumb src={u.image} />
                  {u.brand} {u.name}
                </Link>
              </Td>
              <Td className="text-muted">{u.expectedLaunch}</Td>
              <Td className="whitespace-nowrap num">{formatPriceRange(u.priceMin, u.priceMax)}</Td>
              <Td>{u.status === "published" ? <Badge tone="green">Published</Badge> : <Badge tone="amber">Draft</Badge>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
