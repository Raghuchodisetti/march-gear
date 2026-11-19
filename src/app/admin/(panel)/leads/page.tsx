import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { LEAD_STATUS, LEAD_TYPES } from "@/db/enums";
import { LEAD_STATUS_LABEL, LEAD_STATUS_TONE, LEAD_TYPE_LABEL } from "@/lib/leads";
import { listLeads, LEADS_PAGE_SIZE } from "@/server/admin/leads";
import { buttonClasses } from "@/components/ui/button";
import {
  AdminHeader,
  Badge,
  EmptyRow,
  FilterForm,
  FilterSelect,
  Pagination,
  SearchInput,
  Table,
  Td,
  Th,
  formatDateTime,
  hrefWith,
  pageParam,
  strParam,
} from "@/components/admin/ui";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const sp = await searchParams;
  const params = { q: strParam(sp.q), type: strParam(sp.type), status: strParam(sp.status), assigned: strParam(sp.assigned) };
  const { rows, total, page } = await listLeads({ ...params, page: pageParam(sp.page) });
  const hasFilters = Object.values(params).some(Boolean);

  return (
    <>
      <AdminHeader
        title="Leads"
        description="Every enquiry, booking and request from the website. Newest first."
        actions={
          // A plain download link: a client-side <Link> would fetch the route twice (RSC request, then a full load).
          <a href={hrefWith("/admin/leads/export", params, {})} download className={buttonClasses({ variant: "outline", size: "sm" })}>
            <Download className="size-4" aria-hidden />
            Export CSV
          </a>
        }
      />

      <FilterForm resetHref="/admin/leads" hasFilters={hasFilters}>
        <SearchInput value={params.q} placeholder="Name, phone, email, reference…" />
        <FilterSelect name="type" label="All types" value={params.type} options={LEAD_TYPES.map((t) => ({ value: t, label: LEAD_TYPE_LABEL[t] }))} />
        <FilterSelect name="status" label="Any status" value={params.status} options={LEAD_STATUS.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))} />
        <FilterSelect
          name="assigned"
          label="Anyone"
          value={params.assigned}
          options={[
            { value: "me", label: "Assigned to me" },
            { value: "none", label: "Unassigned" },
          ]}
        />
      </FilterForm>

      <Table>
        <thead>
          <tr>
            <Th>Received</Th>
            <Th>Type</Th>
            <Th>Customer</Th>
            <Th>About</Th>
            <Th>Status</Th>
            <Th>Owner</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={6}>{hasFilters ? "No leads match these filters." : "No leads yet. They'll appear here as soon as someone submits a form."}</EmptyRow>}
          {rows.map((l) => (
            <tr key={l.id} className="transition-colors hover:bg-mist/50">
              <Td className="whitespace-nowrap">
                <Link href={`/admin/leads/${l.id}`} className="font-medium hover:text-red">
                  {l.reference}
                </Link>
                <span className="mt-0.5 block text-[12px] text-muted">{formatDateTime(l.createdAt)}</span>
              </Td>
              <Td className="whitespace-nowrap">{LEAD_TYPE_LABEL[l.type] ?? l.type}</Td>
              <Td>
                <Link href={`/admin/leads/${l.id}`} className="font-medium hover:text-red">
                  {l.name ?? "Unnamed"}
                </Link>
                <span className="mt-0.5 block text-[12px] text-muted">{[l.phone && `+91 ${l.phone}`, l.email].filter(Boolean).join(" · ") || "—"}</span>
              </Td>
              <Td className="max-w-[260px]">
                <span className="line-clamp-2">{l.subject ?? l.message ?? "—"}</span>
                {l.city && <span className="mt-0.5 block text-[12px] text-muted">{l.city}</span>}
              </Td>
              <Td>
                <Badge tone={LEAD_STATUS_TONE[l.status]}>{LEAD_STATUS_LABEL[l.status]}</Badge>
              </Td>
              <Td className="whitespace-nowrap text-muted">{l.assigneeName ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination base="/admin/leads" params={params} page={page} pageSize={LEADS_PAGE_SIZE} total={total} />
    </>
  );
}
