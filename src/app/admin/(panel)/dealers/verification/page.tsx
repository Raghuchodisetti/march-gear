import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, ClipboardCheck, Inbox, Mail, Phone } from "lucide-react";
import { BUSINESS_TYPE_LABEL, DOC_KIND_LABEL } from "@/partner/labels";
import { getPartnerDetail, verificationQueue, type PartnerDetail } from "@/server/admin/partners";
import { requireStaff } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { AdminHeader, Panel, formatDateTime, strParam } from "@/components/admin/ui";
import { DocumentQuickActions, PartnerDecisionPanel } from "@/components/admin/partner-actions";
import { HistoryList } from "@/components/admin/partner-history";
import { Check, EmptyState, Facts, FilePill, LinkTabs, PartnerPill, StatusPill, overdue, requiredDocKinds, waitingLabel } from "@/components/admin/partner-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Verification queue" };

type View = "review" | "dealer" | "decided";

export default async function VerificationPage({ searchParams }: PageProps<"/admin/dealers/verification">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const view: View = sp.view === "dealer" || sp.view === "decided" ? sp.view : "review";
  const { rows, counts, now } = await verificationQueue(view);
  const picked = strParam(sp.id);
  const selectedId = picked && /^\d+$/.test(picked) ? Number(picked) : rows[0]?.id;
  const detail = selectedId ? await getPartnerDetail(selectedId) : null;
  const link = (id: number) => `/admin/dealers/verification?${new URLSearchParams({ ...(view !== "review" ? { view } : {}), id: String(id) })}`;

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/dealers", label: "All dealers" }}
        title="Verification queue"
        description="Dealer applications waiting for a decision — oldest first. Check the documents, run through the checklist and decide."
      />
      <LinkTabs
        active={view}
        items={[
          { key: "review", label: "Waiting for review", count: counts.review, href: "/admin/dealers/verification" },
          { key: "dealer", label: "Waiting for dealer", count: counts.dealer, href: "/admin/dealers/verification?view=dealer" },
          { key: "decided", label: "Recently decided", href: "/admin/dealers/verification?view=decided" },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={cn("min-w-0", picked ? "order-2 lg:order-1" : "")}>
          {rows.length === 0 ? (
            <div className="border border-line bg-white">
              <EmptyState icon={<Inbox aria-hidden className="size-5" />} title={view === "review" ? "Queue is clear" : view === "dealer" ? "Nothing with dealers" : "No decisions yet"}>
                {view === "review" ? "New and resubmitted applications appear here." : view === "dealer" ? "Applications sent back for corrections or documents appear here." : "Approved, rejected and suspended dealers appear here."}
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line border border-line bg-white lg:max-h-[calc(100dvh-220px)] lg:overflow-y-auto">
              {rows.map((r) => {
                const on = r.id === selectedId;
                const late = view === "review" && overdue(r.submittedAt, now);
                return (
                  <li key={r.id}>
                    <Link href={link(r.id)} aria-current={on ? "true" : undefined} className={cn("relative block px-4 py-3.5 transition-colors", on ? "bg-mist" : "hover:bg-mist/50")}>
                      {on && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-red" />}
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold">{r.name}</span>
                          <span className="block truncate text-[12px] text-muted">
                            {r.reference}
                            {r.city ? ` · ${r.city}` : ""}
                          </span>
                        </span>
                        <PartnerPill status={r.status} />
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
                        {view !== "decided" ? (
                          <span className={cn(late ? "font-semibold text-red" : "text-muted")}>
                            {view === "review" ? "Waiting" : "Sent back"} {waitingLabel(view === "review" ? r.submittedAt : r.updatedAt, now)}
                          </span>
                        ) : (
                          <span className="text-muted">Updated {formatDateTime(r.updatedAt)}</span>
                        )}
                        <span className="text-muted num">
                          {r.docsVerified}/{r.docsTotal} docs verified
                        </span>
                        {r.resubmitted && <StatusPill tone="dark" className="h-5 px-2 text-[10.5px]">Resubmitted</StatusPill>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className={cn("min-w-0", picked ? "order-1 lg:order-2" : "")} aria-label="Review workspace">
          {detail ? (
            <Workspace d={detail} isAdmin={me.role === "admin"} now={now} />
          ) : (
            <div className="border border-dashed border-line bg-white">
              <EmptyState icon={<ClipboardCheck aria-hidden className="size-5" />} title={picked ? "Dealer not found" : "Nothing to review"}>
                {picked ? "It may have been deleted." : "Pick an application from the queue to review it here."}
              </EmptyState>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Workspace({ d, isAdmin, now }: { d: PartnerDetail; isAdmin: boolean; now: number }) {
  const p = d.partner;
  const app = p.application;
  const required = requiredDocKinds(app.brands?.mode ?? "");
  const latest = new Map<string, (typeof d.files)[number]>();
  for (const f of d.files) if (!latest.has(f.kind)) latest.set(f.kind, f);
  const extra = d.files.filter((f) => f.kind === "supporting");
  const issues = d.checklist.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`);
  const passed = d.checklist.filter((c) => c.ok).length;

  return (
    <div className="space-y-5">
      <div className="border border-line bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em]">{d.name}</h2>
              <PartnerPill status={p.status} />
              {d.resubmitted && <StatusPill tone="dark">Resubmitted</StatusPill>}
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {p.reference} · {app.business.businessType ? BUSINESS_TYPE_LABEL[app.business.businessType] : "Business type not set"} · {[p.city, p.state].filter(Boolean).join(", ") || "Location not set"}
            </p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
              <a href={`mailto:${d.owner.email}`} className="inline-flex items-center gap-1.5 hover:text-red">
                <Mail aria-hidden className="size-3.5 text-muted" /> {d.owner.email}
              </a>
              {d.owner.phone && (
                <a href={`tel:+91${d.owner.phone}`} className="inline-flex items-center gap-1.5 hover:text-red">
                  <Phone aria-hidden className="size-3.5 text-muted" /> +91 {d.owner.phone}
                </a>
              )}
              {p.submittedAt && <span className={cn(overdue(p.submittedAt, now) && ["submitted", "pending_approval", "under_review"].includes(p.status) ? "font-semibold text-red" : "text-muted")}>Submitted {formatDateTime(p.submittedAt)}</span>}
            </p>
          </div>
          <Button href={`/admin/dealers/details?id=${p.id}`} variant="outline" size="sm" icon={<ArrowUpRight aria-hidden className="size-4" />}>
            Full profile
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <Panel title="Checklist" action={<span className={cn("text-[12.5px] font-medium num", passed === d.checklist.length ? "text-[#1e7a3c]" : "text-muted")}>{passed}/{d.checklist.length} passed</span>}>
            <ul className="-my-2.5 grid grid-cols-1 divide-y divide-line md:grid-cols-2 md:gap-x-6 md:divide-y-0">
              {d.checklist.map((c) => (
                <Check key={c.key} ok={c.ok} label={c.label} detail={c.detail} warn={c.key === "contact" || c.key === "docs_verified"} />
              ))}
            </ul>
          </Panel>

          <Panel title="Documents" padded={false} action={<Link href={`/admin/dealers/details?id=${p.id}&tab=documents`} className="text-[13px] font-medium text-red hover:underline">Open viewer</Link>}>
            <ul className="divide-y divide-line">
              {required.map((kind) => {
                const f = latest.get(kind);
                const label = DOC_KIND_LABEL[kind];
                return (
                  <li key={kind} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium">{label}</span>
                        {f ? <FilePill status={f.status} /> : <StatusPill tone="red">Missing</StatusPill>}
                      </span>
                      {f && (
                        <a href={`/dealer/files/${f.id}`} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-[12px] text-muted hover:text-red">
                          {f.filename} ↗
                        </a>
                      )}
                      {f?.remarks && <span className="mt-0.5 block text-[12px] text-ink/75">“{f.remarks}”</span>}
                    </span>
                    {f && <DocumentQuickActions id={f.id} label={label} status={f.status} />}
                  </li>
                );
              })}
              {extra.map((f) => (
                <li key={f.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-medium">Supporting document</span>
                      <FilePill status={f.status} />
                    </span>
                    <a href={`/dealer/files/${f.id}`} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-[12px] text-muted hover:text-red">
                      {f.filename} ↗
                    </a>
                  </span>
                  <DocumentQuickActions id={f.id} label="Supporting document" status={f.status} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Key details">
            <Facts
              className="-my-2.5"
              rows={[
                ["Legal name", app.business.legalName],
                ["Trade name", app.business.tradeName],
                ["GST / PAN", [app.business.gst.toUpperCase(), app.business.pan.toUpperCase()].filter(Boolean).join(" / ")],
                ["Registration no.", app.business.registrationNumber],
                [
                  "Brands",
                  d.brands.length
                    ? d.brands.map((b) => `${b.brandName} (${b.status === "approved" ? "authorised" : b.status})`).join(", ")
                    : app.brands?.mode === "multi_brand"
                      ? "Multi-brand dealer"
                      : null,
                ],
                [
                  "Showrooms",
                  (d.showrooms.length || app.showrooms.length) > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 aria-hidden className="size-3.5 text-muted" />
                      {(d.showrooms.length ? d.showrooms : app.showrooms).map((s) => `${s.name} (${s.city})`).join(", ")}
                    </span>
                  ),
                ],
                ["Bank", [app.bank?.bankName, app.bank?.accountNumber, (app.bank?.ifsc ?? "").toUpperCase()].filter(Boolean).join(" · ")],
              ]}
            />
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Decision">
            <PartnerDecisionPanel partnerId={p.id} name={d.name} status={p.status} isAdmin={isAdmin} pendingBrands={d.brands.filter((b) => b.status === "pending").length} issues={issues} />
          </Panel>
          <Panel title="Recent history">
            <HistoryList entries={d.history.slice(0, 5)} empty="No history yet." />
            {d.history.length > 5 && (
              <Link href={`/admin/dealers/details?id=${p.id}&tab=history`} className="text-[13px] font-medium text-red hover:underline">
                See all {d.history.length} entries
              </Link>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
