import type { Metadata } from "next";
import { Download } from "lucide-react";
import { deleteSubscriberAction } from "@/server/actions/admin";
import { countSubscribers, listSubscribers } from "@/server/admin/audience";
import { buttonClasses } from "@/components/ui/button";
import { AdminHeader, EmptyRow, FilterForm, SearchInput, Table, Td, Th, formatDateTime, strParam } from "@/components/admin/ui";
import { InlineDelete } from "@/components/admin/inline-delete";

export const metadata: Metadata = { title: "Subscribers" };

export default async function SubscribersPage({ searchParams }: PageProps<"/admin/subscribers">) {
  const sp = await searchParams;
  const q = strParam(sp.q);
  const [rows, total] = await Promise.all([listSubscribers(q), countSubscribers()]);
  return (
    <>
      <AdminHeader
        title="Newsletter subscribers"
        description="People who signed up for the newsletter on the website."
        actions={
          // A plain download link: a client-side <Link> would fetch the route twice (RSC request, then a full load).
          <a href="/admin/subscribers/export" download className={buttonClasses({ variant: "outline", size: "sm" })}>
            <Download className="size-4" aria-hidden />
            Export CSV
          </a>
        }
      />
      <FilterForm resetHref="/admin/subscribers" hasFilters={Boolean(q)}>
        <SearchInput value={q} placeholder="Email…" />
      </FilterForm>
      <Table>
        <thead>
          <tr>
            <Th>Email</Th>
            <Th>Signed up from</Th>
            <Th>Date</Th>
            <Th className="w-16" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={4}>No subscribers yet.</EmptyRow>}
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-mist/50">
              <Td className="font-medium">{s.email}</Td>
              <Td className="text-muted">{s.source ?? "—"}</Td>
              <Td className="whitespace-nowrap text-muted">{formatDateTime(s.createdAt)}</Td>
              <Td className="text-right">
                <InlineDelete action={deleteSubscriberAction.bind(null, s.id)} confirmText={`Remove ${s.email}?`} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-3 text-[12.5px] text-muted num">
        {q
          ? `${rows.length} matching`
          : rows.length < total
            ? `Showing the latest ${rows.length.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")} — export the CSV for everyone`
            : `${total.toLocaleString("en-IN")} ${total === 1 ? "subscriber" : "subscribers"}`}
      </p>
    </>
  );
}
