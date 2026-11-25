import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { CRM_STATUS, LEAD_SOURCES } from "@/db/enums";
import { CRM_STATUS_LABEL, LEAD_SOURCE_LABEL } from "@/partner/labels";
import { requirePartner } from "@/server/partner/context";
import {
  allLeads,
  getLeadDetail,
  leadAccess,
  leadAnalytics,
  leadFilterParams,
  modelOptions,
  offerOptions,
  parseLeadFilters,
  queryLeads,
  salesMembers,
  showroomOptions,
  vehicleOptions,
} from "@/server/partner/crm";
import { Pagination, PortalHeader, filterInput, hrefWith, pageParam } from "@/components/portal/ui";
import { cn } from "@/lib/utils";
import { EnquiriesView } from "@/components/portal/crm/enquiries-view";
import { FunnelStrip } from "@/components/portal/crm/funnel-strip";

export const metadata: Metadata = { title: "Enquiries" };

const PAGE_SIZE = 25;
const BOARD_LIMIT = 500;

export default async function Page({ searchParams }: PageProps<"/dealer/enquiries">) {
  const ctx = await requirePartner();
  const access = leadAccess(ctx);
  if (!access) redirect("/dealer/dashboard?denied=1");
  const sp = await searchParams;
  const f = parseLeadFilters(sp);
  const view = sp.view === "board" ? "board" : "table";
  const page = pageParam(sp.page);
  const openId = Number.parseInt(typeof sp.lead === "string" ? sp.lead : "", 10);
  const partnerId = ctx.partner.id;
  const canTd = ctx.can("test_drives.manage");
  const viewAll = access === "all";

  const [list, board, analytics, members, offers, allVehicles, published, models, showrooms, selected] = await Promise.all([
    view === "table" ? queryLeads(ctx, f, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }) : Promise.resolve(null),
    view === "board" ? allLeads(ctx, f, BOARD_LIMIT + 1) : Promise.resolve(null),
    leadAnalytics(ctx, f),
    salesMembers(partnerId),
    offerOptions(partnerId),
    vehicleOptions(partnerId, { all: true }),
    vehicleOptions(partnerId),
    modelOptions(ctx.partner.id),
    canTd ? showroomOptions(partnerId) : Promise.resolve([]),
    Number.isFinite(openId) && openId > 0 ? getLeadDetail(ctx, openId) : Promise.resolve(null),
  ]);

  const params = { ...leadFilterParams(f), view: view === "board" ? "board" : undefined };
  const exportQuery = new URLSearchParams(Object.entries(leadFilterParams(f)).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  const hasFilters = Boolean(f.q || f.status || f.source || f.assigned || f.offer || f.vehicle || f.from || f.to || f.overdue || f.sort !== "newest");
  const moreOpen = Boolean(f.source || f.offer || f.vehicle || f.from || f.to || f.overdue);
  const offerName = f.offer ? offers.find((o) => o.id === f.offer) : undefined;
  const can = { manage: ctx.can("leads.manage"), assign: ctx.can("leads.assign") && viewAll, testDrives: canTd };
  const rows = list?.rows ?? board!.slice(0, BOARD_LIMIT);

  return (
    <>
      <PortalHeader
        title="Enquiries"
        description={
          viewAll
            ? "Every enquiry from your MarchGear page, listings and offers — plus walk-ins and calls your team adds."
            : "Enquiries assigned to you. Your manager assigns new ones."
        }
      />

      <FunnelStrip a={analytics} overdueHref={hrefWith("/dealer/enquiries", params, { overdue: "1", status: undefined, page: undefined })} />

      {offerName && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          Showing enquiries for the offer <span className="font-medium text-ink">{offerName.title}</span> <span className="font-mono">{offerName.reference}</span>
          <Link href={hrefWith("/dealer/enquiries", params, { offer: undefined, page: undefined })} className="font-medium text-ink underline underline-offset-4">
            Show all
          </Link>
        </p>
      )}

      <form method="get" className="mb-5 border border-line bg-white">
        {view === "board" && <input type="hidden" name="view" value="board" />}
        <div className="flex flex-col gap-2 p-3 md:flex-row md:flex-wrap md:items-center">
          <input type="search" name="q" defaultValue={f.q} placeholder="Name, mobile, email, reference or car" aria-label="Search enquiries" className={cn(filterInput, "w-full md:w-80")} />
          <select name="status" defaultValue={f.status ?? ""} aria-label="Status" className={cn(filterInput, "cursor-pointer")}>
            <option value="">All statuses</option>
            {CRM_STATUS.map((s) => (
              <option key={s} value={s}>
                {CRM_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {viewAll && (
            <select name="assigned" defaultValue={f.assigned ?? ""} aria-label="Assigned to" className={cn(filterInput, "cursor-pointer")}>
              <option value="">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="none">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <select name="sort" defaultValue={f.sort} aria-label="Sort" className={cn(filterInput, "cursor-pointer")}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="follow_up">Follow-up due soonest</option>
            <option value="updated">Recently updated</option>
          </select>
          <div className="flex gap-2 md:ml-auto">
            {hasFilters && (
              <Link href={view === "board" ? "/dealer/enquiries?view=board" : "/dealer/enquiries"} className="inline-flex h-10 items-center px-3 text-[13px] font-medium text-muted hover:text-ink">
                Reset
              </Link>
            )}
            <button type="submit" className="inline-flex h-10 flex-1 items-center justify-center rounded-[3px] bg-ink px-5 text-[13px] font-medium text-white transition-colors hover:bg-ink-3 md:flex-none">
              Apply
            </button>
          </div>
        </div>
        <details open={moreOpen} className="group border-t border-line">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[12.5px] font-medium text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal aria-hidden className="size-3.5" /> More filters
            <span className="text-muted group-open:hidden">· source, offer, vehicle, dates, overdue</span>
          </summary>
          <div className="grid grid-cols-1 gap-2 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto_auto]">
            <select name="source" defaultValue={f.source ?? ""} aria-label="Source" className={cn(filterInput, "cursor-pointer")}>
              <option value="">Any source</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
            <select name="offer" defaultValue={f.offer ? String(f.offer) : ""} aria-label="Offer" className={cn(filterInput, "min-w-0 cursor-pointer")}>
              <option value="">Any offer</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title} · {o.reference}
                </option>
              ))}
            </select>
            <select name="vehicle" defaultValue={f.vehicle ? String(f.vehicle) : ""} aria-label="Vehicle" className={cn(filterInput, "min-w-0 cursor-pointer")}>
              <option value="">Any vehicle</option>
              {allVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} · {v.reference}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-[12.5px] text-muted">
              From
              <input type="date" name="from" defaultValue={f.from} className={cn(filterInput, "min-w-0 flex-1")} />
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-muted">
              To
              <input type="date" name="to" defaultValue={f.to} className={cn(filterInput, "min-w-0 flex-1")} />
            </label>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[3px] border border-line px-3 text-[13px]">
              <input type="checkbox" name="overdue" value="1" defaultChecked={f.overdue} className="size-4 accent-[#E31E24]" />
              Overdue follow-ups
            </label>
          </div>
        </details>
      </form>

      <EnquiriesView
        rows={rows}
        view={view}
        members={members}
        can={can}
        viewAll={viewAll}
        now={new Date().getTime()}
        selected={selected}
        exportQuery={exportQuery}
        boardTruncated={Boolean(board && board.length > BOARD_LIMIT)}
        tdOptions={canTd ? { vehicles: published, models, showrooms, members, canAssign: can.assign, selfId: ctx.member.id } : null}
        addOptions={{ models, vehicles: published, offers, members, canAssign: can.assign }}
      />
      {list && list.total > PAGE_SIZE && <Pagination base="/dealer/enquiries" params={params} page={page} pageSize={PAGE_SIZE} total={list.total} />}
      {list && list.total > 0 && list.total <= PAGE_SIZE && (
        <p className="mt-4 text-[13px] text-muted num">
          {list.total} enquir{list.total === 1 ? "y" : "ies"}
        </p>
      )}
    </>
  );
}
