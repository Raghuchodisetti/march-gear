import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, ClipboardCheck, ExternalLink, FileText, Landmark, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import {
  INS_BUSINESS_TYPE_LABEL,
  INS_DOC_KIND_LABEL,
  INS_INVOICE_KIND_LABEL,
  INS_LEAD_STATUS_LABEL,
  INS_PRODUCT_CATEGORY_LABEL,
  INS_ROLE_LABEL,
  INS_VENDOR_CATEGORY_LABEL,
  INS_VENDOR_IN_REVIEW,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
} from "@/insurance/labels";
import { INS_LEAD_STATUS } from "@/db/enums";
import { PATTERNS } from "@/partner/application";
import { PLAN_STATUS_LABEL } from "@/partner/labels";
import { getInsVendorDetail, type InsVendorDetail } from "@/server/admin/insurance";
import { requireStaff } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { Button } from "@/components/ui/button";
import { AdminHeader, Panel, StatCard, formatDateTime, formatDay } from "@/components/admin/ui";
import { InlineBar } from "@/components/portal/analytics/charts";
import {
  Check,
  EmptyState,
  Facts,
  INS_KYC_DOC_KINDS,
  InsFilePill,
  InsHistoryList,
  LicenceValidity,
  ProductPill,
  StatusPill,
  VendorMessage,
  VendorPill,
  fileSize,
  insFieldLabel,
  rupees,
} from "@/components/admin/insurance/ui";
import { insTrialFor } from "@/components/insurance/vendor/billing/shared";
import { InsBankReveal, InsChangeRequestActions, InsDetailTabs, InsDocumentReview, InsInternalNoteForm, VendorDecisionPanel, type InsDocItem } from "@/components/admin/insurance/vendors/vendor-actions";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/admin/insurance/vendors/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: /^\d+$/.test(id) ? `Insurance vendor ${id}` : "Insurance vendor" };
}

const yes = (v: boolean) => (v ? <StatusPill tone="green">Verified</StatusPill> : <StatusPill tone="amber">Not verified</StatusPill>);
const format = (ok: boolean, value: string, extra?: React.ReactNode) =>
  value ? (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono text-[13px]">{value}</span>
      {ok ? <StatusPill tone="green">Valid format</StatusPill> : <StatusPill tone="red">Invalid format</StatusPill>}
      {extra}
    </span>
  ) : null;
const site = (url: string) =>
  url ? (
    <a href={/^https?:\/\//.test(url) ? url : `https://${url}`} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1 break-all hover:text-red">
      {url} <ExternalLink aria-hidden className="size-3.5 shrink-0" />
    </a>
  ) : null;

export default async function InsuranceVendorPage({ params, searchParams }: PageProps<"/admin/insurance/vendors/[id]">) {
  const me = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const d = /^\d+$/.test(id) ? await getInsVendorDetail(Number(id)) : null;
  if (!d) notFound();
  const { insuranceSettings } = (await getCatalog()).content;
  const v = d.vendor;
  const app = v.application;
  const docs = toDocItems(d);
  const pendingDocs = docs.filter((x) => x.current && x.status === "pending").length;
  const pendingChanges = d.changes.filter((c) => c.status === "pending").length;
  const issues = d.checklist.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`);
  const isInsurer = (v.category ?? app.regulatory.category) === "insurer";
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";

  const tabs = [
    { key: "overview", label: "Overview", content: <Overview d={d} isAdmin={me.role === "admin"} isInsurer={isInsurer} issues={issues} trialDays={insuranceSettings.vendorTrialDays} /> },
    { key: "company", label: "Company", content: <Company d={d} /> },
    { key: "regulatory", label: "Regulatory", content: <Regulatory d={d} docs={docs} /> },
    { key: "branches", label: "Branches", count: d.branches.length || app.branches.length, content: <Branches d={d} /> },
    { key: "banking", label: "Banking", content: <Banking d={d} docs={docs} isAdmin={me.role === "admin"} /> },
    {
      key: "documents",
      label: "Documents",
      count: pendingDocs || undefined,
      content: (
        <Panel title="Account documents" action={<span className="text-[12.5px] text-muted">{docs.filter((x) => x.current && x.status === "verified").length} verified · {pendingDocs} awaiting review</span>}>
          <InsDocumentReview docs={docs} />
        </Panel>
      ),
    },
    { key: "products", label: "Products", count: d.products.length, content: <Products d={d} /> },
    { key: "business", label: "Enquiries & billing", content: <Business d={d} /> },
    { key: "changes", label: "Change requests", count: pendingChanges || undefined, content: <Changes d={d} /> },
    { key: "team", label: "Team", count: d.members.length, content: <Team d={d} /> },
    {
      key: "history",
      label: "History",
      content: (
        <Panel title="Full history" action={<span className="text-[12.5px] text-muted">Submissions, decisions and internal notes</span>}>
          <InsHistoryList entries={d.history} empty="Nothing has happened on this vendor yet." />
        </Panel>
      ),
    },
    {
      key: "notes",
      label: "Internal comments",
      count: d.notes.length || undefined,
      content: (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Panel title="New comment">
            <InsInternalNoteForm vendorId={v.id} />
          </Panel>
          <Panel title="Staff comments">
            <InsHistoryList entries={d.notes} showTarget={false} empty="No internal comments yet." />
          </Panel>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/insurance/vendors", label: "All vendors" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-words">{d.name}</span>
            <span className="flex flex-wrap items-center gap-2 tracking-normal">
              <VendorPill status={v.status} />
              {d.resubmitted && <StatusPill tone="dark">Resubmitted</StatusPill>}
            </span>
          </span>
        }
        description={[v.reference, v.category ? INS_VENDOR_CATEGORY_LABEL[v.category] : null, app.company.legalName && app.company.legalName !== d.name ? app.company.legalName : null, [v.city, v.state].filter(Boolean).join(", ") || null].filter(Boolean).join(" · ")}
        actions={
          INS_VENDOR_IN_REVIEW.includes(v.status) ? (
            <Button href={`/admin/insurance/vendor-approvals?id=${v.id}`} size="sm" icon={<ClipboardCheck className="size-4" aria-hidden />}>
              Review workspace
            </Button>
          ) : undefined
        }
      />
      <InsDetailTabs tabs={tabs} initial={tab} />
    </>
  );
}

function toDocItems(d: InsVendorDetail): InsDocItem[] {
  const kyc = d.files.filter((f) => (INS_KYC_DOC_KINDS as readonly string[]).includes(f.kind));
  const app = d.vendor.application;
  const referenced = new Set<number>([
    ...Object.values(app.documents ?? {}).flatMap((x) => (Array.isArray(x) ? x.map((r) => r.id) : x ? [x.id] : [])),
    ...(app.regulatory?.documents ?? []).map((r) => r.id),
    ...(app.bank?.proof ? [app.bank.proof.id] : []),
  ]);
  const newest = new Map<string, number>();
  for (const f of kyc) if (!newest.has(f.kind)) newest.set(f.kind, f.id);
  const referencedKinds = new Set(kyc.filter((f) => referenced.has(f.id)).map((f) => f.kind));
  const order = (k: string) => INS_KYC_DOC_KINDS.indexOf(k as (typeof INS_KYC_DOC_KINDS)[number]);
  return [...kyc]
    .sort((a, b) => order(a.kind) - order(b.kind) || b.createdAt.getTime() - a.createdAt.getTime())
    .map((f) => ({
      id: f.id,
      kind: f.kind,
      kindLabel: INS_DOC_KIND_LABEL[f.kind as keyof typeof INS_DOC_KIND_LABEL] ?? f.kind,
      filename: f.filename,
      mime: f.mime,
      sizeLabel: fileSize(f.size),
      uploaded: formatDateTime(f.createdAt),
      status: f.status,
      remarks: f.remarks,
      // Supporting documents can be several; otherwise only the newest of a kind (or the one the application points at) counts.
      current: f.kind === "supporting" || referenced.has(f.id) || (!referencedKinds.has(f.kind) && newest.get(f.kind) === f.id),
    }));
}

function Overview({ d, isAdmin, isInsurer, issues, trialDays }: { d: InsVendorDetail; isAdmin: boolean; isInsurer: boolean; issues: string[]; trialDays: number }) {
  const v = d.vendor;
  const live = d.products.filter((p) => p.status === "published").length;
  const pending = d.products.filter((p) => p.status === "pending_approval" || p.status === "submitted").length;
  const coversPending = d.covers.filter((c) => c.status === "pending_approval").reduce((a, c) => a + c.n, 0);
  const linked = d.linkedCompanies[0] ?? null;
  const createName = (v.application.company.brandName || v.application.company.legalName || "").trim();
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={v.status === "approved" ? "Live products" : "Published products"} value={live} note={v.status === "approved" ? `${d.products.length} in total` : "Hidden while the vendor isn't approved"} />
          <StatCard label="To review" value={pending + coversPending} tone={pending + coversPending ? "red" : undefined} note={`${pending} product${pending === 1 ? "" : "s"} · ${coversPending} cover${coversPending === 1 ? "" : "s"}`} href={pending ? `/admin/insurance/products?vendor=${v.id}&status=queue` : undefined} />
          <StatCard label="Enquiries" value={d.enquiry.total.toLocaleString("en-IN")} note={`${d.enquiry.last30} in the last 30 days`} />
          <StatCard label="Verified policies" value={d.enquiry.verified} note={`${d.enquiry.reported} reported, not yet verified`} />
        </div>

        <VendorMessage remarks={v.adminRemarks} corrections={v.requiredCorrections} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Account">
            <Facts
              className="-my-2.5"
              rows={[
                ["Status", <VendorPill key="s" status={v.status} />],
                ["Reference", <span key="r" className="font-mono text-[13px]">{v.reference}</span>],
                ["Category", v.category ? INS_VENDOR_CATEGORY_LABEL[v.category] : null],
                ["Started", formatDateTime(v.createdAt)],
                ["Submitted", v.submittedAt ? formatDateTime(v.submittedAt) : v.status === "draft" ? `Not yet — on step ${v.step} of 7` : null],
                ["Approved", v.approvedAt ? formatDateTime(v.approvedAt) : null],
                ["Last decision by", d.deciderName],
              ]}
            />
          </Panel>
          <Panel title="Owner">
            <Facts
              className="-my-2.5"
              rows={[
                ["Name", d.owner.name],
                [
                  "Email",
                  <a key="e" href={`mailto:${d.owner.email}`} className="inline-flex items-center gap-1.5 break-all hover:text-red">
                    <Mail aria-hidden className="size-3.5 shrink-0 text-muted" /> {d.owner.email}
                  </a>,
                ],
                [
                  "Phone",
                  d.owner.phone && (
                    <a key="p" href={`tel:+91${d.owner.phone}`} className="inline-flex items-center gap-1.5 hover:text-red">
                      <Phone aria-hidden className="size-3.5 text-muted" /> +91 {d.owner.phone}
                    </a>
                  ),
                ],
                ["Designation", v.application.contact.designation],
                ["Login", d.owner.isActive ? "Active" : <StatusPill key="l" tone="red">Disabled</StatusPill>],
              ]}
            />
          </Panel>
          <Panel title="Plan">
            <Facts
              className="-my-2.5"
              rows={[
                ["Plan", d.plan ? `${d.plan.name} · ${rupees(d.plan.monthly)}/month` : v.plan],
                ["Billing status", v.status === "approved" || v.status === "suspended" ? PLAN_STATUS_LABEL[v.planStatus] : "Starts on approval"],
                ["Renews / trial ends", v.planRenewsAt ? formatDay(v.planRenewsAt) : v.status === "approved" && v.planStatus === "trial" && v.approvedAt ? `Trial until ${formatDay(insTrialFor(v.approvedAt, v.createdAt, trialDays).lastDay)}` : null],
                ["Published products", d.plan?.products ? `${live} of ${d.plan.products} allowed` : `${live} (unlimited)`],
              ]}
            />
          </Panel>
          <Panel title="Insurance company">
            {linked ? (
              <Facts
                className="-my-2.5"
                rows={[
                  ["Company", <Link key="c" href={`/admin/insurance/companies/${linked.id}`} className="font-medium hover:text-red">{linked.name}</Link>],
                  ["Visibility", linked.isActive ? <StatusPill key="v" tone="green">Active</StatusPill> : <StatusPill key="v" tone="neutral">Inactive — products hidden</StatusPill>],
                  ["Slug", <span key="s" className="font-mono text-[12.5px]">{linked.slug}</span>],
                ]}
              />
            ) : (
              <p className="text-[13.5px] text-muted">
                {isInsurer
                  ? v.status === "approved"
                    ? "No insurance company is linked yet. Link one from Insurance companies."
                    : "Approving links this insurer to its insurance company — an existing one, or a new one created from the application."
                  : "Intermediaries sell products underwritten by insurance companies; they aren't linked to one."}
              </p>
            )}
          </Panel>
        </div>
      </div>

      <div className="order-first space-y-6 xl:order-none">
        <Panel title="Decision">
          <VendorDecisionPanel vendorId={v.id} name={d.name} status={v.status} isAdmin={isAdmin} isInsurer={isInsurer} issues={issues} trialDays={trialDays} companies={{ linked: linked ? { id: linked.id, name: linked.name } : null, free: d.freeCompanies, createName }} />
        </Panel>
        <Panel title="Verification checklist" action={<span className="text-[12.5px] text-muted num">{d.checklist.filter((c) => c.ok).length}/{d.checklist.length} passed</span>}>
          <ul className="-my-2.5 divide-y divide-line">
            {d.checklist.map((c) => (
              <Check key={c.key} ok={c.ok} label={c.label} detail={c.detail} warn={c.warn} />
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Company({ d }: { d: InsVendorDetail }) {
  const app = d.vendor.application;
  const gst = app.registration.gstin.toUpperCase();
  const pan = app.registration.pan.toUpperCase();
  const panMatch = PATTERNS.gst.test(gst) && PATTERNS.pan.test(pan) ? gst.slice(2, 12) === pan : null;
  const profile = d.vendor.profile;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel title="Company information">
        <Facts
          className="-my-2.5"
          rows={[
            ["Legal name", app.company.legalName],
            ["Brand name", app.company.brandName],
            ["Business type", app.company.businessType ? INS_BUSINESS_TYPE_LABEL[app.company.businessType] : null],
            ["Website", site(app.company.website)],
            [
              "Registered address",
              app.company.address && (
                <span key="a" className="inline-flex gap-1.5">
                  <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted" />
                  <span>
                    {app.company.address}
                    <span className="block text-muted">
                      {[app.company.city, app.company.state].filter(Boolean).join(", ")} {app.company.pin}
                    </span>
                  </span>
                </span>
              ),
            ],
          ]}
        />
      </Panel>
      <Panel title="Registration details">
        <Facts
          className="-my-2.5"
          rows={[
            ["GSTIN", format(PATTERNS.gst.test(gst), gst)],
            ["PAN", format(PATTERNS.pan.test(pan), pan, panMatch === null ? null : panMatch ? <StatusPill tone="green">Matches GSTIN</StatusPill> : <StatusPill tone="red">Doesn&apos;t match GSTIN</StatusPill>)],
            ["CIN / registration", app.registration.cin && <span className="font-mono text-[13px]">{app.registration.cin}</span>],
            ["Established on", app.registration.establishedOn ? formatDay(app.registration.establishedOn) : null],
          ]}
        />
      </Panel>
      <Panel title="Contact person">
        <Facts
          className="-my-2.5"
          rows={[
            ["Name", app.contact.name],
            ["Designation", app.contact.designation],
            ["Mobile", app.contact.mobile && <span className="inline-flex flex-wrap items-center gap-2">+91 {app.contact.mobile} {yes(app.contact.mobileVerified)}</span>],
            ["Email", app.contact.email && <span className="inline-flex flex-wrap items-center gap-2 break-all">{app.contact.email} {yes(app.contact.emailVerified)}</span>],
          ]}
        />
        <p className="mt-3 text-[12px] text-muted">SMS and email delivery aren&apos;t configured yet — verification codes are shown on screen in development.</p>
      </Panel>
      <Panel title="Declaration">
        <Facts
          className="-my-2.5"
          rows={[
            ["Declared details are true", app.declaration?.accepted ? "Yes" : "No"],
            ["Signed by", app.declaration?.name],
            ["Signed on", app.declaration?.acceptedAt ? formatDateTime(app.declaration.acceptedAt) : null],
          ]}
        />
      </Panel>
      <Panel title="Public profile" className="lg:col-span-2" action={<span className="text-[12px] text-muted">Editable by the vendor any time</span>}>
        {profile ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[96px_minmax(0,1fr)]">
            <span className="flex size-24 items-center justify-center overflow-hidden rounded-[3px] border border-line bg-white">
              {profile.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img decoding="async" src={profile.logo} alt={`${d.name} logo`} className="max-h-full max-w-full object-contain p-2" />
              ) : (
                <Building2 aria-hidden className="size-7 text-muted" />
              )}
            </span>
            <Facts
              className="-my-2.5"
              rows={[
                ["About", profile.about && <span className="whitespace-pre-line">{profile.about}</span>],
                ["Website", site(profile.website)],
                ["Support", [profile.supportPhone, profile.supportEmail].filter(Boolean).join(" · ")],
                ["Claims", [profile.claimsPhone, profile.claimsEmail].filter(Boolean).join(" · ")],
                ["Hours", profile.supportHours],
              ]}
            />
          </div>
        ) : (
          <p className="text-[13.5px] text-muted">The vendor hasn&apos;t filled in their public profile yet.</p>
        )}
      </Panel>
    </div>
  );
}

function Regulatory({ d, docs }: { d: InsVendorDetail; docs: InsDocItem[] }) {
  const r = d.vendor.application.regulatory;
  const regDocs = docs.filter((x) => x.kind === "regulatory_licence");
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Panel title="Regulatory authorisation">
        <Facts
          className="-my-2.5"
          rows={[
            ["Category", r.category ? INS_VENDOR_CATEGORY_LABEL[r.category] : null],
            ["Registration type", r.registrationType],
            ["Licence number", r.licenceNumber && <span className="font-mono text-[13px]">{r.licenceNumber}</span>],
            ["Valid until", <LicenceValidity key="v" until={r.licenceValidUntil} today={d.today} />],
          ]}
        />
        <p className="mt-4 text-[12px] text-muted">Check the licence against the regulator&apos;s public register before approving. MarchGear doesn&apos;t verify licences automatically.</p>
      </Panel>
      <Panel title="Authorised representative">
        <Facts
          className="-my-2.5"
          rows={[
            ["Name", r.representative?.name],
            ["Designation", r.representative?.designation],
            ["Mobile", r.representative?.mobile && `+91 ${r.representative.mobile}`],
            ["Email", r.representative?.email && <span className="break-all">{r.representative.email}</span>],
          ]}
        />
      </Panel>
      <Panel title="Authorisation documents" className="lg:col-span-2" padded={false}>
        {regDocs.length === 0 ? (
          <p className="p-5 text-[13.5px] text-muted">No regulatory authorisation uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {regDocs.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <a href={`/insurance-vendor/files/${x.id}`} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 text-[13.5px] font-medium hover:text-red">
                  <FileText aria-hidden className="size-4 shrink-0 text-muted" /> <span className="truncate">{x.filename}</span>
                </a>
                <span className="flex items-center gap-3">
                  <span className="text-[12px] text-muted">{x.uploaded}</span>
                  <InsFilePill status={x.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">
          Verify or reject documents on the{" "}
          <Link href={`/admin/insurance/vendors/${d.vendor.id}?tab=documents`} className="font-medium text-red hover:underline">
            Documents tab
          </Link>
          .
        </p>
      </Panel>
    </div>
  );
}

function Branches({ d }: { d: InsVendorDetail }) {
  const fromApp = d.branches.length === 0;
  const rows = fromApp ? d.vendor.application.branches.map((b, i) => ({ ...b, id: -1 - i, isActive: true })) : d.branches;
  if (!rows.length)
    return (
      <Panel>
        <EmptyState icon={<Building2 aria-hidden className="size-5" />} title="No branches yet">
          The vendor adds branch offices in step 5 of the application.
        </EmptyState>
      </Panel>
    );
  return (
    <div className="space-y-4">
      {fromApp && <p className="text-[13px] text-muted">Showing the branches from the application — they become branch records when the vendor is approved.</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.map((b) => (
          <section key={b.id} className="border border-line bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold">{b.name || "Unnamed branch"}</h3>
              {b.isPrimary && <StatusPill tone="dark">Primary</StatusPill>}
              {!b.isActive && <StatusPill tone="neutral">Inactive</StatusPill>}
            </div>
            <p className="mt-2 flex gap-1.5 text-[13.5px]">
              <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted" />
              <span>
                {b.address}
                <span className="block text-muted">
                  {[b.city, b.state].filter(Boolean).join(", ")} {b.pin}
                </span>
              </span>
            </p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
              {b.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone aria-hidden className="size-3.5" /> {b.phone}
                </span>
              )}
              {b.email && (
                <span className="inline-flex items-center gap-1.5 break-all">
                  <Mail aria-hidden className="size-3.5 shrink-0" /> {b.email}
                </span>
              )}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}

function Banking({ d, docs, isAdmin }: { d: InsVendorDetail; docs: InsDocItem[]; isAdmin: boolean }) {
  const bank = d.vendor.application.bank;
  const proof = docs.find((x) => x.kind === "bank_proof" && x.current) ?? docs.find((x) => x.kind === "bank_proof") ?? null;
  const ifsc = (bank.ifsc ?? "").toUpperCase();
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Panel title="Bank account">
        <Facts
          className="-my-2.5"
          rows={[
            ["Account holder", bank.holder],
            ["Bank", bank.bankName],
            ["Account number", <InsBankReveal key="b" vendorId={d.vendor.id} masked={bank.accountMasked} hasNumber={d.hasBankNumber} canReveal={isAdmin} />],
            ["IFSC", format(PATTERNS.ifsc.test(ifsc), ifsc)],
          ]}
        />
        <p className="mt-4 text-[12px] text-muted">Account numbers are encrypted at rest and masked by default. Each reveal is recorded in the activity log.</p>
      </Panel>
      <Panel title="Bank proof">
        {proof ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <InsFilePill status={proof.status} />
              <span className="min-w-0 truncate text-[13px] text-muted">{proof.filename}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button href={`/admin/insurance/vendors/${d.vendor.id}?tab=documents`} size="sm" variant="outline">
                Review in Documents
              </Button>
              <Button href={`/insurance-vendor/files/${proof.id}`} target="_blank" size="sm" variant="ghost" icon={<ExternalLink aria-hidden className="size-4" />}>
                Open
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[13.5px] text-muted">Not uploaded yet.</p>
        )}
      </Panel>
    </div>
  );
}

function Products({ d }: { d: InsVendorDetail }) {
  const covers = (type: string) => {
    const rows = d.covers.filter((c) => c.type === type);
    const total = rows.reduce((a, c) => a + c.n, 0);
    const pending = rows.filter((c) => c.status === "pending_approval").reduce((a, c) => a + c.n, 0);
    const approved = rows.filter((c) => c.status === "approved").reduce((a, c) => a + c.n, 0);
    return { total, pending, approved };
  };
  const cv = covers("coverage");
  const ad = covers("addon");
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href={`/admin/insurance/coverage?vendor=${d.vendor.id}&status=all`} className="block border border-line bg-white p-5 transition-colors hover:border-ink/30">
          <p className="text-[12.5px] font-medium text-muted">Coverage items</p>
          <p className="mt-2 font-display text-[26px] font-semibold leading-none tracking-[-0.03em] num">{cv.total}</p>
          <p className="mt-2 text-[12.5px] text-muted">
            {cv.approved} approved{cv.pending ? <span className="font-medium text-red"> · {cv.pending} to review</span> : null}
          </p>
        </Link>
        <Link href={`/admin/insurance/add-ons?vendor=${d.vendor.id}&status=all`} className="block border border-line bg-white p-5 transition-colors hover:border-ink/30">
          <p className="text-[12.5px] font-medium text-muted">Add-on covers</p>
          <p className="mt-2 font-display text-[26px] font-semibold leading-none tracking-[-0.03em] num">{ad.total}</p>
          <p className="mt-2 text-[12.5px] text-muted">
            {ad.approved} approved{ad.pending ? <span className="font-medium text-red"> · {ad.pending} to review</span> : null}
          </p>
        </Link>
      </div>
      <Panel title="Products" padded={false} action={<Link href={`/admin/insurance/products?vendor=${d.vendor.id}`} className="text-[13px] font-medium text-red hover:underline">Open in products</Link>}>
        {d.products.length === 0 ? (
          <p className="p-5 text-[13.5px] text-muted">No products created yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {d.products.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/insurance/products/${p.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-mist/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{p.name}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {p.reference} · {INS_PRODUCT_CATEGORY_LABEL[p.category]} · {p.companyName}
                      {!p.companyActive ? " (company inactive)" : ""}
                    </span>
                  </span>
                  <ProductPill status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Business({ d }: { d: InsVendorDetail }) {
  const e = d.enquiry;
  const max = Math.max(1, ...Object.values(e.byStatus));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Enquiries" value={e.total.toLocaleString("en-IN")} note={`${e.open} open`} />
        <StatCard label="Quotes submitted" value={e.quotes.toLocaleString("en-IN")} />
        <StatCard label="Policies reported" value={e.reported} note="By the vendor, not yet verified" />
        <StatCard label="Policies verified" value={e.verified} note="Checked by MarchGear" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Enquiries by status">
          {e.total === 0 ? (
            <p className="text-[13.5px] text-muted">No enquiries yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {INS_LEAD_STATUS.filter((s) => e.byStatus[s]).map((s) => (
                <li key={s} className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3 text-[13px]">
                  <span className="truncate text-muted">{INS_LEAD_STATUS_LABEL[s]}</span>
                  <InlineBar value={e.byStatus[s]} max={max} tone={s === "policy_issued" ? "red" : "ink"} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Billing">
          <Facts
            className="-my-2.5"
            rows={[
              ["Collected", <span key="c" className="font-semibold num">{rupees(d.billing.collected)}</span>],
              ["Outstanding", <span key="o" className={cn("num", d.billing.outstanding && "font-semibold")}>{rupees(d.billing.outstanding)}</span>],
              ["Overdue", d.billing.overdue ? <span key="od" className="font-semibold text-red num">{rupees(d.billing.overdue)}</span> : rupees(0)],
              ["Refunded", rupees(d.billing.refunds)],
              ["Payments to verify", d.billing.paymentsPending ? <Link key="p" href="/admin/insurance/payments" className="font-medium text-red hover:underline">{d.billing.paymentsPending} awaiting verification</Link> : "None"],
            ]}
          />
          <p className="mt-3 text-[12px] text-muted">Collected = verified payments minus refunds (incl. GST). Outstanding = what is still owed on unpaid invoices.</p>
        </Panel>
      </div>
      <Panel title="Invoices" padded={false} action={d.invoiceCount > d.invoices.length ? <span className="text-[12.5px] text-muted">Latest {d.invoices.length} of {d.invoiceCount}</span> : undefined}>
        {d.invoices.length === 0 ? (
          <p className="p-5 text-[13.5px] text-muted">No invoices yet.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13.5px]">
              <thead>
                <tr className="text-[12px] text-muted">
                  {["Invoice", "Kind", "Due", "Total", "Status"].map((h, i) => (
                    <th key={h} className={cn("border-b border-line bg-mist/60 px-5 py-3 font-semibold", i === 3 && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.invoices.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <span className="font-mono text-[12.5px]">{i.number}</span>
                      <span className="block max-w-[280px] truncate text-[12px] text-muted">{i.description}</span>
                    </td>
                    <td className="px-5 py-3">{INS_INVOICE_KIND_LABEL[i.kind]}</td>
                    <td className="whitespace-nowrap px-5 py-3">{formatDay(i.dueOn)}</td>
                    <td className="px-5 py-3 text-right num">{rupees(i.total)}</td>
                    <td className="px-5 py-3">
                      <StatusPill tone={INVOICE_STATUS_TONE[i.shown]}>{INVOICE_STATUS_LABEL[i.shown]}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Changes({ d }: { d: InsVendorDetail }) {
  if (!d.changes.length)
    return (
      <Panel>
        <EmptyState icon={<Landmark aria-hidden className="size-5" />} title="No change requests">
          After approval, edits to verified details (legal name, GSTIN, PAN, licence, bank) wait here for staff approval.
        </EmptyState>
      </Panel>
    );
  return (
    <div className="space-y-4">
      {d.changes.map((c) => (
        <section key={c.id} className={cn("border bg-white", c.status === "pending" ? "border-ink/25" : "border-line")}>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={c.status === "pending" ? "blue" : c.status === "approved" ? "green" : "red"} pulse={c.status === "pending"}>
                {c.status === "pending" ? "Pending" : c.status === "approved" ? "Approved" : "Rejected"}
              </StatusPill>
              <span className="text-[13px] text-muted">
                Requested {formatDateTime(c.createdAt)}
                {c.requestedBy ? ` by ${c.requestedBy}` : ""}
              </span>
            </div>
            {c.decidedAt && (
              <span className="text-[12.5px] text-muted">
                Decided {formatDateTime(c.decidedAt)}
                {c.decidedBy ? ` by ${c.decidedBy}` : ""}
              </span>
            )}
          </header>
          {c.reason && (
            <p className="border-b border-line bg-mist/40 px-5 py-2.5 text-[13px]">
              <span className="font-medium">Vendor&apos;s reason:</span> {c.reason}
            </p>
          )}
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[13.5px]">
              <thead>
                <tr className="text-[12px] text-muted">
                  <th className="px-5 py-2 font-semibold">Field</th>
                  <th className="px-5 py-2 font-semibold">Current</th>
                  <th className="px-5 py-2 font-semibold">Requested</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(c.fields).map(([path, f]) => (
                  <tr key={path} className="border-t border-line">
                    <td className="px-5 py-2.5 font-medium">{insFieldLabel(path)}</td>
                    <td className="break-all px-5 py-2.5 text-muted line-through decoration-ink/30">{f.from || "—"}</td>
                    <td className="break-all px-5 py-2.5 font-medium">{f.to || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(c.remarks || c.status === "pending") && (
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
              {c.remarks ? <p className="text-[13px] text-ink/80">“{c.remarks}”</p> : <span />}
              {c.status === "pending" && <InsChangeRequestActions id={c.id} fields={Object.keys(c.fields).map(insFieldLabel)} />}
            </footer>
          )}
        </section>
      ))}
    </div>
  );
}

function Team({ d }: { d: InsVendorDetail }) {
  return (
    <Panel title="People at this vendor" padded={false}>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13.5px]">
          <thead>
            <tr className="text-[12px] text-muted">
              {["Name", "Role", "Contact", "Access", "Added"].map((h) => (
                <th key={h} className="border-b border-line bg-mist/60 px-5 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.members.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-medium">
                  {m.name}
                  {m.userId === d.owner.id && <span className="ml-2 text-[11.5px] font-normal text-muted">Account owner</span>}
                </td>
                <td className="px-5 py-3">
                  {INS_ROLE_LABEL[m.role]}
                  {m.permissions && <span className="block text-[11.5px] text-muted">{m.permissions.length} custom permissions</span>}
                </td>
                <td className="px-5 py-3">
                  <span className="block break-all">{m.email}</span>
                  {m.phone && <span className="block text-[12px] text-muted">+91 {m.phone}</span>}
                </td>
                <td className="px-5 py-3">{m.isActive && m.userActive ? <StatusPill tone="green">Active</StatusPill> : <StatusPill tone="neutral">Removed</StatusPill>}</td>
                <td className="whitespace-nowrap px-5 py-3 text-muted">{formatDay(m.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-1.5 border-t border-line px-5 py-3 text-[12px] text-muted">
        <ShieldCheck aria-hidden className="size-3.5" /> The vendor manages their own team in the portal.
      </p>
    </Panel>
  );
}
