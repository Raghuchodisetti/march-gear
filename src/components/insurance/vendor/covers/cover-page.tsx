import type { InsCoverType } from "@/db/enums";
import type { InsurerContext } from "@/server/insurance/context";
import { getCatalog } from "@/server/catalog";
import { PortalHeader, StatCard, strParam } from "@/components/portal/ui";
import { CoverManager } from "./cover-manager";
import { listCoverViews } from "./queries";
import { COVER_TYPE_META } from "./shared";

/* Server half of /insurance-vendor/coverage and /add-ons. */

export async function CoverPage({ ctx, type, searchParams }: { ctx: InsurerContext; type: InsCoverType; searchParams: Record<string, string | string[] | undefined> }) {
  const [covers, catalog] = await Promise.all([listCoverViews(ctx.vendor.id, type), getCatalog()]);
  const meta = COVER_TYPE_META[type];
  const openRaw = strParam(searchParams.open);
  const open = openRaw && /^\d{1,10}$/.test(openRaw) ? Number(openRaw) : null;
  const approved = covers.filter((c) => c.status === "approved").length;
  const pending = covers.filter((c) => c.status === "pending_approval").length;
  const attention = covers.filter((c) => c.status === "changes_requested" || c.status === "rejected").length;
  const unused = covers.filter((c) => !c.usedBy.length).length;
  const base = meta.base;

  return (
    <>
      <PortalHeader title={meta.title} description={`Your ${meta.plural}. MarchGear reviews each one separately from the products that use it.`} />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Approved" value={approved} note="Shown on public product pages" href={`${base}?status=approved`} />
        <StatCard label="In review" value={pending} note="With the MarchGear team" href={`${base}?status=pending_approval`} />
        <StatCard
          label="Needs your attention"
          value={attention}
          tone={attention ? "red" : undefined}
          note={attention ? "Changes requested or rejected" : "Nothing to fix"}
          href={attention ? `${base}?status=${covers.some((c) => c.status === "changes_requested") ? "changes_requested" : "rejected"}` : undefined}
        />
        <StatCard label="Not used yet" value={unused} note={`of ${covers.length} ${covers.length === 1 ? meta.singular : meta.plural}`} />
      </div>
      <CoverManager
        // A summary card links to another ?status= — start the list over on that filter.
        key={strParam(searchParams.status) ?? "all"}
        type={type}
        covers={covers}
        canManage={ctx.can("products.manage")}
        maxAge={catalog.content.insurancePricing.maxVehicleAgeYears}
        initialStatus={strParam(searchParams.status) ?? ""}
        initialOpen={open}
      />
    </>
  );
}
