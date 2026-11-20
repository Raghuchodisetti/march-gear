import type { Metadata } from "next";
import { ACTIVITY_AREAS, ACTIVITY_PAGE_SIZE, activityFilterOptions, listActivity } from "@/server/admin/activity";
import { AdminHeader, EmptyRow, FilterForm, FilterSelect, Pagination, SearchInput, Table, Td, Th, formatDateTime, pageParam, strParam } from "@/components/admin/ui";
import { ActionBadge, ActivitySummary, who } from "@/components/admin/activity";

export const metadata: Metadata = { title: "Activity log" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const params = { q: strParam(sp.q), area: strParam(sp.area), user: strParam(sp.user) };
  // Both check staff access before reading anything.
  const [{ rows, total, page }, options] = await Promise.all([listActivity({ ...params, page: pageParam(sp.page) }), activityFilterOptions()]);
  const hasFilters = Object.values(params).some(Boolean);

  return (
    <>
      <AdminHeader title="Activity log" description="Who changed what in this panel, newest first. Entries link to the record while it still exists." />

      <FilterForm resetHref="/admin/activity" hasFilters={hasFilters}>
        <SearchInput value={params.q} placeholder="Search what happened…" />
        <FilterSelect name="area" label="All areas" value={params.area} options={options.areas} />
        <FilterSelect name="user" label="Everyone" value={params.user} options={options.people} />
      </FilterForm>

      <Table>
        <thead>
          <tr>
            <Th className="w-[170px]">When</Th>
            <Th className="w-[160px]">Who</Th>
            <Th className="w-[150px]">Area</Th>
            <Th>What happened</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={4}>{hasFilters ? "Nothing matches these filters." : "No activity yet. Changes made in the panel will appear here."}</EmptyRow>}
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-mist/50">
              <Td className="whitespace-nowrap text-muted">{formatDateTime(r.createdAt)}</Td>
              <Td className="font-medium">{who(r)}</Td>
              <Td className="whitespace-nowrap text-muted">{ACTIVITY_AREAS[r.entity] ?? r.entity}</Td>
              <Td>
                <span className="flex items-start gap-2.5">
                  <span className="shrink-0">
                    <ActionBadge action={r.action} />
                  </span>
                  <ActivitySummary entry={r} className="min-w-0 break-words pt-0.5" />
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination base="/admin/activity" params={params} page={page} pageSize={ACTIVITY_PAGE_SIZE} total={total} />
    </>
  );
}
