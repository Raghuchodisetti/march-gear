import type { Metadata } from "next";
import { Download, Plus } from "lucide-react";
import { LEAD_STATUS, LEAD_TYPES } from "@/db/enums";
import { LEAD_STATUS_LABEL, LEAD_TYPE_LABEL } from "@/lib/leads";
import { leadDateRange, listLeads, listStaff, LEADS_PAGE_SIZE } from "@/server/admin/leads";
import { requireStaff } from "@/server/auth";
import { Button, buttonClasses } from "@/components/ui/button";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, filterInput, formatDateTime, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { LeadTable } from "@/components/admin/lead-table";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const range = leadDateRange({ from: strParam(sp.from), to: strParam(sp.to) });
  const params = { q: strParam(sp.q), type: strParam(sp.type), status: strParam(sp.status), assigned: strParam(sp.assigned), from: range.from, to: range.to };
  const [{ rows, total, page }, staff] = await Promise.all([listLeads({ ...params, page: pageParam(sp.page) }), listStaff()]);
  const hasFilters = Object.values(params).some(Boolean);

  return (
    <>
      <AdminHeader
        title="Leads"
        description="Every enquiry, booking and request — from the website or added by the team. Newest first."
        actions={
          <>
            {/* A plain download link: a client-side <Link> would fetch the route twice (RSC request, then a full load). */}
            <a href={hrefWith("/admin/leads/export", params, {})} download className={buttonClasses({ variant: "outline", size: "sm" })}>
              <Download className="size-4" aria-hidden />
              Export CSV
            </a>
            <Button href="/admin/leads/new" size="sm" icon={<Plus className="size-4" aria-hidden />}>
              Add lead
            </Button>
          </>
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
        <fieldset className="flex min-w-0 items-center gap-2">
          <legend className="sr-only">Received between (IST)</legend>
          <input type="date" name="from" defaultValue={params.from} aria-label="Received from (IST)" className={`${filterInput} min-w-0 flex-1 md:w-[150px] md:flex-none`} />
          <span className="text-[12.5px] text-muted">to</span>
          <input type="date" name="to" defaultValue={params.to} aria-label="Received to (IST)" className={`${filterInput} min-w-0 flex-1 md:w-[150px] md:flex-none`} />
        </fieldset>
      </FilterForm>

      <LeadTable
        staff={staff}
        canDelete={me.role === "admin"}
        emptyText={hasFilters ? "No leads match these filters." : "No leads yet. They'll appear here as soon as someone submits a form."}
        rows={rows.map((l) => ({
          id: l.id,
          reference: l.reference,
          typeLabel: LEAD_TYPE_LABEL[l.type] ?? l.type,
          status: l.status,
          name: l.name,
          contact: [l.phone && `+91 ${l.phone}`, l.email].filter(Boolean).join(" · ") || "—",
          about: l.subject ?? l.message ?? "—",
          city: l.city,
          received: formatDateTime(l.createdAt),
          assigneeName: l.assigneeName,
        }))}
      />
      <Pagination base="/admin/leads" params={params} page={page} pageSize={LEADS_PAGE_SIZE} total={total} />
    </>
  );
}
