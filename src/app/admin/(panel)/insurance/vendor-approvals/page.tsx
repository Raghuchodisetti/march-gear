import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, ClipboardCheck, Inbox, Mail, Phone, XCircle } from "lucide-react";
import { INS_BUSINESS_TYPE_LABEL, INS_VENDOR_CATEGORY_LABEL, INS_VENDOR_CATEGORY_SHORT, INS_VENDOR_IN_REVIEW } from "@/insurance/labels";
import { getInsVendorDetail, insVendorQueue, requiredInsDocuments, type InsChecklistItem, type InsVendorDetail } from "@/server/admin/insurance";
import { requireStaff } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { Button } from "@/components/ui/button";
import { AdminHeader, Panel, formatDateTime, strParam } from "@/components/admin/ui";
import { Check, EmptyState, Facts, InsFilePill, InsHistoryList, LicenceValidity, LinkTabs, SlaAge, StatusPill, VendorMessage, VendorPill } from "@/components/admin/insurance/ui";
import { InsDocumentQuickActions, VendorDecisionPanel } from "@/components/admin/insurance/vendors/vendor-actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Vendor verification" };

type View = "review" | "vendor" | "decided";

const SHORT: Record<InsChecklistItem["key"], string> = { contact: "Contact", company: "Company", registration: "Registration", regulatory: "Regulatory", branches: "Branches", bank: "Bank", documents: "Documents" };

/** Seven dots: one per checklist item. */
function MiniChecklist({ items }: { items: InsChecklistItem[] }) {
  return (
    <span className="flex flex-wrap gap-1" aria-label={items.map((c) => `${SHORT[c.key]}: ${c.ok ? "passed" : "needs attention"}`).join(", ")}>
      {items.map((c) => {
        const Icon = c.ok ? CheckCircle2 : c.warn ? AlertTriangle : XCircle;
        return (
          <span key={c.key} title={`${c.label}: ${c.detail}`} className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium", c.ok ? "bg-[#e8f5ec] text-[#1e7a3c]" : c.warn ? "bg-[#fdf3e1] text-[#9a5b00]" : "bg-red-50 text-red")}>
            <Icon aria-hidden className="size-3" />
            {SHORT[c.key]}
          </span>
        );
      })}
    </span>
  );
}

export default async function VendorApprovalsPage({ searchParams }: PageProps<"/admin/insurance/vendor-approvals">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const view: View = sp.view === "vendor" || sp.view === "decided" ? sp.view : "review";
  const { rows, counts, now } = await insVendorQueue(view);
  const picked = strParam(sp.id);
  const selectedId = picked && /^\d+$/.test(picked) ? Number(picked) : rows[0]?.id;
  const [detail, catalog] = await Promise.all([selectedId ? getInsVendorDetail(selectedId) : Promise.resolve(null), getCatalog()]);
  const link = (id: number) => `/admin/insurance/vendor-approvals?${new URLSearchParams({ ...(view !== "review" ? { view } : {}), id: String(id) })}`;

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/insurance/vendors", label: "All vendors" }}
        title="Vendor verification"
        description="Insurer and intermediary applications waiting for a decision — oldest first. Check the documents, run through the checklist and decide. Anything waiting over 48 hours is flagged."
      />
      <LinkTabs
        active={view}
        items={[
          { key: "review", label: "To review", count: counts.review, href: "/admin/insurance/vendor-approvals" },
          { key: "vendor", label: "Waiting for vendor", count: counts.vendor, href: "/admin/insurance/vendor-approvals?view=vendor" },
          { key: "decided", label: "Decided", href: "/admin/insurance/vendor-approvals?view=decided" },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className={cn("min-w-0", picked ? "order-2 lg:order-1" : "")}>
          {rows.length === 0 ? (
            <div className="border border-line bg-white">
              <EmptyState icon={<Inbox aria-hidden className="size-5" />} title={view === "review" ? "Queue is clear" : view === "vendor" ? "Nothing with vendors" : "No decisions yet"}>
                {view === "review" ? "New and resubmitted applications appear here." : view === "vendor" ? "Applications sent back for corrections or documents appear here." : "Approved, rejected and suspended vendors appear here."}
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line border border-line bg-white lg:max-h-[calc(100dvh-220px)] lg:overflow-y-auto">
              {rows.map((r) => {
                const on = r.id === selectedId;
                const passed = r.checklist.filter((c) => c.ok).length;
                return (
                  <li key={r.id}>
                    <Link href={link(r.id)} aria-current={on ? "true" : undefined} className={cn("relative block px-4 py-3.5 transition-colors", on ? "bg-mist" : "hover:bg-mist/50")}>
                      {on && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-red" />}
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold">{r.name}</span>
                          <span className="block truncate text-[12px] text-muted">
                            {r.reference} · {r.category ? INS_VENDOR_CATEGORY_SHORT[r.category] : "No category"}
                            {r.city ? ` · ${r.city}` : ""}
                          </span>
                        </span>
                        <VendorPill status={r.status} />
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
                        {view !== "decided" ? <SlaAge since={view === "review" ? r.submittedAt : r.updatedAt} now={now} prefix={view === "review" ? "Waiting" : "Sent back"} className="text-[11.5px]" /> : <span className="text-muted">Updated {formatDateTime(r.updatedAt)}</span>}
                        <span className="text-muted num">
                          {passed}/{r.checklist.length} checks
                        </span>
                        {r.resubmitted && (
                          <StatusPill tone="dark" className="h-5 px-2 text-[10.5px]">
                            Resubmitted
                          </StatusPill>
                        )}
                      </span>
                      <span className="mt-2 block">
                        <MiniChecklist items={r.checklist} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className={cn("min-w-0", picked ? "order-1 lg:order-2" : "", !detail && !picked && rows.length === 0 && "hidden lg:block")} aria-label="Review workspace">
          {detail ? (
            <Workspace d={detail} isAdmin={me.role === "admin"} now={now} trialDays={catalog.content.insuranceSettings.vendorTrialDays} />
          ) : (
            <div className="border border-dashed border-line bg-white">
              <EmptyState icon={<ClipboardCheck aria-hidden className="size-5" />} title={picked ? "Vendor not found" : "Nothing to review"}>
                {picked ? "It may have been deleted." : "Pick an application from the queue to review it here."}
              </EmptyState>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Workspace({ d, isAdmin, now, trialDays }: { d: InsVendorDetail; isAdmin: boolean; now: number; trialDays: number }) {
  const v = d.vendor;
  const app = v.application;
  const docs = requiredInsDocuments(app, d.files);
  const supporting = d.files.filter((f) => f.kind === "supporting");
  const bankProof = (app.bank.proof && d.files.find((f) => f.id === app.bank.proof!.id)) || d.files.find((f) => f.kind === "bank_proof") || null;
  const issues = d.checklist.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`);
  const passed = d.checklist.filter((c) => c.ok).length;
  const isInsurer = (v.category ?? app.regulatory.category) === "insurer";
  const linked = d.linkedCompanies[0] ?? null;

  return (
    <div className="space-y-5">
      <div className="border border-line bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 break-words font-display text-[22px] font-semibold tracking-[-0.02em]">{d.name}</h2>
              <VendorPill status={v.status} />
              {d.resubmitted && <StatusPill tone="dark">Resubmitted</StatusPill>}
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {v.reference} · {v.category ? INS_VENDOR_CATEGORY_LABEL[v.category] : "Category not set"} · {app.company.businessType ? INS_BUSINESS_TYPE_LABEL[app.company.businessType] : "Business type not set"} · {[v.city, v.state].filter(Boolean).join(", ") || "Location not set"}
            </p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
              <a href={`mailto:${d.owner.email}`} className="inline-flex items-center gap-1.5 break-all hover:text-red">
                <Mail aria-hidden className="size-3.5 shrink-0 text-muted" /> {d.owner.email}
              </a>
              {d.owner.phone && (
                <a href={`tel:+91${d.owner.phone}`} className="inline-flex items-center gap-1.5 hover:text-red">
                  <Phone aria-hidden className="size-3.5 text-muted" /> +91 {d.owner.phone}
                </a>
              )}
              {v.submittedAt && INS_VENDOR_IN_REVIEW.includes(v.status) && <SlaAge since={v.submittedAt} now={now} prefix="Submitted" className="text-[12.5px]" />}
            </p>
          </div>
          <Button href={`/admin/insurance/vendors/${v.id}`} variant="outline" size="sm" icon={<ArrowUpRight aria-hidden className="size-4" />}>
            Full profile
          </Button>
        </div>
      </div>

      <VendorMessage remarks={v.adminRemarks} corrections={v.requiredCorrections} title="Last message sent to the vendor" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <Panel title="Review checklist" action={<span className={cn("text-[12.5px] font-medium num", passed === d.checklist.length ? "text-[#1e7a3c]" : "text-muted")}>{passed}/{d.checklist.length} passed</span>}>
            <ul className="-my-2.5 grid grid-cols-1 divide-y divide-line md:grid-cols-2 md:gap-x-6 md:divide-y-0">
              {d.checklist.map((c) => (
                <Check key={c.key} ok={c.ok} label={c.label} detail={c.detail} warn={c.warn} />
              ))}
            </ul>
          </Panel>

          <Panel title="Documents" padded={false} action={<Link href={`/admin/insurance/vendors/${v.id}?tab=documents`} className="text-[13px] font-medium text-red hover:underline">Open viewer</Link>}>
            <ul className="divide-y divide-line">
              {[...docs.map((x) => ({ key: x.key, label: x.label, file: x.file })), { key: "bank", label: "Bank proof (cancelled cheque / statement)", file: bankProof }, ...supporting.map((f) => ({ key: `s${f.id}`, label: "Supporting document", file: f }))].map((x) => (
                <li key={x.key} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-medium">{x.label}</span>
                      {x.file ? <InsFilePill status={x.file.status} /> : <StatusPill tone="red">Missing</StatusPill>}
                    </span>
                    {x.file && (
                      <a href={`/insurance-vendor/files/${x.file.id}`} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-[12px] text-muted hover:text-red">
                        {x.file.filename} ↗
                      </a>
                    )}
                    {x.file?.remarks && <span className="mt-0.5 block break-words text-[12px] text-ink/75">“{x.file.remarks}”</span>}
                  </span>
                  {x.file && <InsDocumentQuickActions id={x.file.id} label={x.label} status={x.file.status} />}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Key details">
            <Facts
              className="-my-2.5"
              rows={[
                ["Legal name", app.company.legalName],
                ["Brand name", app.company.brandName],
                ["GSTIN / PAN", [app.registration.gstin.toUpperCase(), app.registration.pan.toUpperCase()].filter(Boolean).join(" / ")],
                ["CIN", app.registration.cin],
                ["Registration type", app.regulatory.registrationType],
                ["Licence", app.regulatory.licenceNumber && <span className="font-mono text-[13px]">{app.regulatory.licenceNumber}</span>],
                ["Licence valid until", <LicenceValidity key="l" until={app.regulatory.licenceValidUntil} today={d.today} />],
                ["Representative", [app.regulatory.representative?.name, app.regulatory.representative?.designation].filter(Boolean).join(", ")],
                ["Branches", (d.branches.length ? d.branches : app.branches).map((b) => `${b.name} (${b.city})`).join(", ")],
                ["Bank", [app.bank.bankName, app.bank.accountMasked, (app.bank.ifsc ?? "").toUpperCase()].filter(Boolean).join(" · ")],
                ["Insurance company", isInsurer ? (linked ? linked.name : "Linked or created on approval") : "Not applicable (intermediary)"],
              ]}
            />
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Decision">
            <VendorDecisionPanel
              vendorId={v.id}
              name={d.name}
              status={v.status}
              isAdmin={isAdmin}
              isInsurer={isInsurer}
              issues={issues}
              trialDays={trialDays}
              companies={{ linked: linked ? { id: linked.id, name: linked.name } : null, free: d.freeCompanies, createName: (app.company.brandName || app.company.legalName || "").trim() }}
            />
          </Panel>
          <Panel title="Recent history">
            <InsHistoryList
              entries={d.history.slice(0, 5)}
              empty="No history yet."
              footer={
                d.history.length > 5 ? (
                  <Link href={`/admin/insurance/vendors/${v.id}?tab=history`} className="text-[13px] font-medium text-red hover:underline">
                    See all {d.history.length} entries
                  </Link>
                ) : undefined
              }
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
