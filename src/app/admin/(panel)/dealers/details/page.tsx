import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { notFound } from "next/navigation";
import { Building2, CarFront, ClipboardCheck, ExternalLink, FileText, Mail, MapPin, Phone, Wrench } from "lucide-react";
import { BUSINESS_TYPE_LABEL, DOC_KIND_LABEL, OFFER_CATEGORY_LABEL, PARTNER_ROLE_LABEL, PLAN_STATUS_LABEL, offerDisplayStatus } from "@/partner/labels";
import { DAY_LABEL, PATTERNS } from "@/partner/application";
import { planById } from "@/partner/plans";
import type { DayHours } from "@/partner/types";
import { getPartnerDetail, type PartnerDetail } from "@/server/admin/partners";
import { requireStaff } from "@/server/auth";
import { todayISO } from "@/server/validation";
import { Button } from "@/components/ui/button";
import { AdminHeader, Panel, StatCard, formatDateTime, formatDay, strParam } from "@/components/admin/ui";
import { BankReveal, BrandActions, ChangeRequestActions, DocumentReview, InternalNoteForm, PartnerDecisionPanel, type DocItem } from "@/components/admin/partner-actions";
import { PartnerTabs } from "@/components/admin/partner-review";
import { HistoryList } from "@/components/admin/partner-history";
import {
  BrandPill,
  CORRECTION_AREAS,
  Check,
  EmptyState,
  Facts,
  FilePill,
  IN_REVIEW,
  KYC_DOC_KINDS,
  OfferPill,
  PartnerPill,
  StatusPill,
  VehiclePill,
  fieldLabel,
  fileSize,
  rupees,
  splitCorrection,
} from "@/components/admin/partner-ui";
import { cn } from "@/lib/utils";
import { MapEmbed } from "@/components/ui/map-embed";

export const metadata: Metadata = { title: "Dealer details" };

const yes = (v: boolean) => (v ? <StatusPill tone="green">Verified</StatusPill> : <StatusPill tone="amber">Not verified</StatusPill>);
const format = (ok: boolean, value: string) =>
  value ? (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono text-[13px]">{value}</span>
      {ok ? <StatusPill tone="green">Valid format</StatusPill> : <StatusPill tone="red">Invalid format</StatusPill>}
    </span>
  ) : null;

const to12h = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

function Hours({ hours }: { hours: DayHours[] }) {
  if (!hours?.length) return <p className="text-[13px] text-muted">Hours not set</p>;
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
      {hours.map((h) => (
        <li key={h.day} className="flex justify-between gap-3">
          <span className="text-muted">{DAY_LABEL[h.day]?.slice(0, 3) ?? h.day}</span>
          <span className="num">{h.closed ? "Closed" : `${to12h(h.open)} – ${to12h(h.close)}`}</span>
        </li>
      ))}
    </ul>
  );
}

type MapPlace = { lat: number | null; lng: number | null; address: string; city: string; pin: string };
const mapQuery = (r: MapPlace) => (r.lat !== null && r.lng !== null ? `${r.lat},${r.lng}` : `${r.address}, ${r.city} ${r.pin}`);
const mapSrc = (r: MapPlace) => `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery(r))}&z=15&output=embed`;
const mapLink = (r: MapPlace) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(r))}`;

export default async function DealerDetailsPage({ searchParams }: PageProps<"/admin/dealers/details">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const raw = strParam(sp.id);
  const d = raw && /^\d+$/.test(raw) ? await getPartnerDetail(Number(raw)) : null;
  if (!d) notFound();
  const isAdmin = me.role === "admin";
  const p = d.partner;
  const app = p.application;
  const pendingBrands = d.brands.filter((b) => b.status === "pending").length;
  const issues = d.checklist.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`);
  const docs = toDocItems(d);
  const pendingDocs = docs.filter((x) => x.current && x.status === "pending").length;
  const pendingChanges = d.changes.filter((c) => c.status === "pending").length;
  const liveVehicles = d.vehicles.filter((v) => v.status === "published").length;
  const pendingVehicles = d.vehicles.filter((v) => v.status === "pending_approval").length;
  const plan = planById(p.plan);

  const tabs = [
    { key: "overview", label: "Overview", content: <Overview d={d} isAdmin={isAdmin} pendingBrands={pendingBrands} issues={issues} liveVehicles={liveVehicles} pendingVehicles={pendingVehicles} plan={plan} /> },
    {
      key: "personal",
      label: "Personal",
      content: (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Applicant">
            <div className="flex items-start gap-4">
              {app.personal.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img decoding="async" src={app.personal.photo} alt={`Photo of ${app.personal.fullName}`} className="size-16 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-mist text-[18px] font-semibold text-muted">{app.personal.fullName.slice(0, 1) || "?"}</span>
              )}
              <Facts
                className="min-w-0 flex-1 -mt-2.5"
                rows={[
                  ["Full name", app.personal.fullName],
                  ["Designation", app.personal.designation],
                  ["Mobile", app.personal.mobile && <span className="inline-flex flex-wrap items-center gap-2">+91 {app.personal.mobile} {yes(app.personal.mobileVerified)}</span>],
                  ["Email", app.personal.email && <span className="inline-flex flex-wrap items-center gap-2 break-all">{app.personal.email} {yes(app.personal.emailVerified)}</span>],
                ]}
              />
            </div>
          </Panel>
          <Panel title="Authorised contact">
            <Facts
              rows={[
                ["Name", app.personal.authorizedContact?.name],
                ["Designation", app.personal.authorizedContact?.designation],
                ["Mobile", app.personal.authorizedContact?.mobile && `+91 ${app.personal.authorizedContact.mobile}`],
                ["Email", app.personal.authorizedContact?.email],
              ]}
            />
          </Panel>
          <Panel title="Declaration" className="lg:col-span-2">
            <Facts
              rows={[
                ["Accepted partner terms", app.declaration?.acceptedTerms ? "Yes" : "No"],
                ["Declared details are true", app.declaration?.declared ? "Yes" : "No"],
                ["Signed by", app.declaration?.signedName],
                ["Signed on", app.declaration?.signedAt ? formatDateTime(app.declaration.signedAt) : null],
              ]}
            />
          </Panel>
        </div>
      ),
    },
    {
      key: "business",
      label: "Business",
      content: (
        <Panel title="Business details">
          <Facts
            rows={[
              ["Legal name", app.business.legalName],
              ["Trade name", app.business.tradeName],
              ["Business type", app.business.businessType ? BUSINESS_TYPE_LABEL[app.business.businessType] : null],
              ["GST number", format(PATTERNS.gst.test(app.business.gst.toUpperCase()), app.business.gst.toUpperCase())],
              ["PAN", format(PATTERNS.pan.test(app.business.pan.toUpperCase()), app.business.pan.toUpperCase())],
              ["Registration number", app.business.registrationNumber],
              ["Established on", app.business.establishedOn ? formatDay(app.business.establishedOn) : null],
              ["Business email", app.business.email],
              ["Business phone", app.business.phone],
              [
                "Website",
                app.business.website && (
                  <a href={/^https?:\/\//.test(app.business.website) ? app.business.website : `https://${app.business.website}`} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1 break-all hover:text-red">
                    {app.business.website} <ExternalLink aria-hidden className="size-3.5 shrink-0" />
                  </a>
                ),
              ],
            ]}
          />
        </Panel>
      ),
    },
    { key: "showrooms", label: "Showrooms", count: d.showrooms.length || app.showrooms.length, content: <Showrooms d={d} /> },
    { key: "brands", label: "Brands", count: d.brands.length, content: <Brands d={d} /> },
    {
      key: "documents",
      label: "Documents",
      count: pendingDocs || undefined,
      content: (
        <Panel title="Account documents" action={<span className="text-[12.5px] text-muted">{docs.filter((x) => x.current && x.status === "verified").length} verified · {pendingDocs} awaiting check</span>}>
          <DocumentReview docs={docs} />
        </Panel>
      ),
    },
    { key: "banking", label: "Banking", content: <Banking d={d} isAdmin={isAdmin} docs={docs} /> },
    { key: "listings", label: "Vehicles & offers", count: d.vehicles.length + d.offers.length, content: <Listings d={d} /> },
    { key: "changes", label: "Change requests", count: pendingChanges || undefined, content: <Changes d={d} /> },
    { key: "team", label: "Team", count: d.members.length, content: <Team d={d} /> },
    {
      key: "history",
      label: "Approval history",
      content: (
        <Panel title="Approval history" action={<Link href={`/admin/approval-history?partner=${p.id}`} className="text-[13px] font-medium text-red hover:underline">Open in full log</Link>}>
          <HistoryList entries={d.history} empty="Nothing has happened on this application yet." />
        </Panel>
      ),
    },
    {
      key: "notes",
      label: "Internal remarks",
      count: d.notes.length || undefined,
      content: (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Panel title="New note">
            <InternalNoteForm partnerId={p.id} />
          </Panel>
          <Panel title="Staff notes">
            <HistoryList entries={d.notes} showTarget={false} empty="No internal notes yet." />
          </Panel>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/dealers", label: "All dealers" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {d.name}
            <PartnerPill status={p.status} />
            {d.resubmitted && <StatusPill tone="dark">Resubmitted</StatusPill>}
          </span>
        }
        description={[p.reference, app.business.legalName && app.business.legalName !== d.name ? app.business.legalName : null, [p.city, p.state].filter(Boolean).join(", ") || null].filter(Boolean).join(" · ")}
        actions={
          <>
            {IN_REVIEW.includes(p.status) && (
              <Button href={`/admin/dealers/verification?id=${p.id}`} size="sm" icon={<ClipboardCheck className="size-4" aria-hidden />}>
                Review workspace
              </Button>
            )}
            {d.publicDealer?.isActive && (
              <Button href={`/dealers/${d.publicDealer.id}`} target="_blank" variant="outline" size="sm" icon={<ExternalLink className="size-4" aria-hidden />}>
                Public listing
              </Button>
            )}
          </>
        }
      />
      <PartnerTabs tabs={tabs} initial={strParam(sp.tab) ?? "overview"} />
    </>
  );
}

function toDocItems(d: PartnerDetail): DocItem[] {
  const kyc = d.files.filter((f) => (KYC_DOC_KINDS as readonly string[]).includes(f.kind));
  const app = d.partner.application;
  const referenced = new Set<number>([
    ...Object.entries(app.documents ?? {}).flatMap(([, v]) => (Array.isArray(v) ? v.map((x) => x.id) : v ? [v.id] : [])),
    ...(app.bank?.cheque ? [app.bank.cheque.id] : []),
    ...d.brands.flatMap((b) => (b.certificate ? [b.certificate.id] : [])),
    ...(app.brands?.items ?? []).flatMap((b) => (b.certificate ? [b.certificate.id] : [])),
  ]);
  const newest = new Map<string, number>();
  for (const f of kyc) if (!newest.has(f.kind)) newest.set(f.kind, f.id);
  const order = (k: string) => KYC_DOC_KINDS.indexOf(k as (typeof KYC_DOC_KINDS)[number]);
  return [...kyc]
    .sort((a, b) => order(a.kind) - order(b.kind) || b.createdAt.getTime() - a.createdAt.getTime())
    .map((f) => ({
      id: f.id,
      kind: f.kind,
      kindLabel: DOC_KIND_LABEL[f.kind as keyof typeof DOC_KIND_LABEL] ?? f.kind,
      filename: f.filename,
      mime: f.mime,
      sizeLabel: fileSize(f.size),
      uploaded: formatDateTime(f.createdAt),
      status: f.status,
      remarks: f.remarks,
      // Supporting documents and brand certificates can be several; otherwise only the newest of a kind counts.
      current: referenced.has(f.id) || f.kind === "supporting" || f.kind === "brand_authorization" || newest.get(f.kind) === f.id,
    }));
}

function Overview({
  d,
  isAdmin,
  pendingBrands,
  issues,
  liveVehicles,
  pendingVehicles,
  plan,
}: {
  d: PartnerDetail;
  isAdmin: boolean;
  pendingBrands: number;
  issues: string[];
  liveVehicles: number;
  pendingVehicles: number;
  plan: ReturnType<typeof planById>;
}) {
  const p = d.partner;
  const now = new Date();
  const liveOffers = p.status === "approved" ? d.offers.filter((o) => offerDisplayStatus(o, now) === "active").length : 0;
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={p.status === "approved" ? "Live listings" : "Published listings"} value={liveVehicles} note={p.status === "approved" ? `${d.vehicles.length} in inventory` : "Hidden while the dealer isn't approved"} />
          <StatCard label="Vehicles to review" value={pendingVehicles} tone={pendingVehicles ? "red" : undefined} href={pendingVehicles ? `/admin/vehicle-approvals?partner=${p.id}` : undefined} />
          <StatCard label="Live offers" value={liveOffers} note={`${d.offers.length} offers in total`} />
          <StatCard label="Enquiries" value={d.leadCount} note="All time" />
        </div>

        {(p.adminRemarks || (p.requiredCorrections && p.requiredCorrections.length > 0)) && (
          <section className="border border-[#e09200]/30 bg-[#fdf3e1]/60 p-5">
            <h2 className="text-[13.5px] font-semibold text-[#7a4800]">Latest message to the dealer</h2>
            {p.adminRemarks && <p className="mt-1.5 whitespace-pre-line text-[13.5px]">{p.adminRemarks}</p>}
            {p.requiredCorrections && p.requiredCorrections.length > 0 && (
              <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[13.5px]">
                {p.requiredCorrections.map((c) => {
                  const { area, text } = splitCorrection(c);
                  return (
                    <li key={c}>
                      {area && <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#7a4800]/70">{CORRECTION_AREAS[area]}</span>}
                      {text}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Account">
            <Facts
              rows={[
                ["Status", <PartnerPill key="s" status={p.status} />],
                ["Reference", <span key="r" className="font-mono text-[13px]">{p.reference}</span>],
                ["Started", formatDateTime(p.createdAt)],
                ["Submitted", p.submittedAt ? formatDateTime(p.submittedAt) : p.status === "draft" ? `Not yet — on step ${p.step} of 7` : null],
                ["Approved", p.approvedAt ? formatDateTime(p.approvedAt) : null],
                ["Last decision by", d.deciderName],
              ]}
            />
          </Panel>
          <Panel title="Owner">
            <Facts
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
                ["Designation", p.application.personal.designation],
                ["Login", d.owner.isActive ? "Active" : <StatusPill key="l" tone="red">Disabled</StatusPill>],
              ]}
            />
          </Panel>
          <Panel title="Plan">
            <Facts
              rows={[
                ["Plan", `${plan.name} · ${rupees(plan.monthly)}/month`],
                ["Billing status", p.status === "approved" || p.status === "suspended" ? PLAN_STATUS_LABEL[p.planStatus] : "Starts on approval"],
                ["Renews / trial ends", p.planRenewsAt ? formatDay(p.planRenewsAt) : null],
              ]}
            />
          </Panel>
          <Panel title="Public listing">
            {d.publicDealer ? (
              <Facts
                rows={[
                  ["Listing", <span key="n">{d.publicDealer.name}</span>],
                  ["Visibility", d.publicDealer.isActive ? <StatusPill key="v" tone="green">Live on MarchGear</StatusPill> : <StatusPill key="v" tone="neutral">Hidden</StatusPill>],
                  [
                    "Links",
                    <span key="l" className="flex flex-wrap gap-3">
                      {d.publicDealer.isActive && (
                        <Link href={`/dealers/${d.publicDealer.id}`} target="_blank" className="inline-flex items-center gap-1 text-red hover:underline">
                          /dealers/{d.publicDealer.id} <ExternalLink aria-hidden className="size-3.5" />
                        </Link>
                      )}
                      <Link href={`/admin/showrooms/${encodeURIComponent(d.publicDealer.id)}`} className="hover:text-red hover:underline">
                        Edit listing
                      </Link>
                    </span>,
                  ],
                ]}
              />
            ) : (
              <p className="text-[13.5px] text-muted">Created automatically when the dealer is approved, from the primary showroom and approved brands.</p>
            )}
          </Panel>
        </div>
      </div>

      <div className="space-y-6">
        <Panel title="Decision">
          <PartnerDecisionPanel partnerId={p.id} name={d.name} status={p.status} isAdmin={isAdmin} pendingBrands={pendingBrands} issues={issues} />
        </Panel>
        <Panel title="Verification checklist" action={<span className="text-[12.5px] text-muted num">{d.checklist.filter((c) => c.ok).length}/{d.checklist.length} passed</span>}>
          <ul className="-my-2.5 divide-y divide-line">
            {d.checklist.map((c) => (
              <Check key={c.key} ok={c.ok} label={c.label} detail={c.detail} warn={c.key === "contact" || c.key === "docs_verified"} />
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Showrooms({ d }: { d: PartnerDetail }) {
  const fromApp = d.showrooms.length === 0;
  const rooms = fromApp
    ? d.partner.application.showrooms.map((r, i) => ({ ...r, id: -1 - i, isActive: true }))
    : d.showrooms;
  if (!rooms.length)
    return (
      <Panel>
        <EmptyState icon={<Building2 aria-hidden className="size-5" />} title="No showrooms yet">
          The dealer adds showrooms in step 3 of the application.
        </EmptyState>
      </Panel>
    );
  return (
    <div className="space-y-6">
      {fromApp && <p className="text-[13px] text-muted">Showing the showrooms from the application — they become showroom records when the dealer submits.</p>}
      {rooms.map((r) => (
        <Panel
          key={r.id}
          title={
            <span className="flex flex-wrap items-center gap-2">
              {r.name || "Unnamed showroom"}
              {r.isPrimary && <StatusPill tone="dark">Primary</StatusPill>}
              {r.serviceCentre && (
                <StatusPill tone="blue">
                  <Wrench aria-hidden className="size-3" /> Service centre
                </StatusPill>
              )}
              {!r.isActive && <StatusPill tone="neutral">Inactive</StatusPill>}
            </span>
          }
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-5">
              <Facts
                className="-mt-2.5"
                rows={[
                  [
                    "Address",
                    <span key="a" className="inline-flex gap-1.5">
                      <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted" />
                      <span>
                        {r.address}
                        <span className="block text-muted">
                          {[r.city, r.district, r.state].filter(Boolean).join(", ")} {r.pin}
                        </span>
                      </span>
                    </span>,
                  ],
                  ["Phone", r.phone],
                  ["Coordinates", r.lat !== null && r.lng !== null ? <span className="num">{`${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`}</span> : "Not pinned"],
                ]}
              />
              <div>
                <p className="mb-2 text-[12.5px] font-medium text-muted">Opening hours</p>
                <Hours hours={r.hours} />
              </div>
              {r.photos.length > 0 && (
                <div>
                  <p className="mb-2 text-[12.5px] font-medium text-muted">Photos</p>
                  <div className="grid grid-cols-3 gap-2">
                    {r.photos.slice(0, 9).map((src) => (
                      <a key={src} href={src} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden bg-mist">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img decoding="async" src={src} alt={`${r.name} showroom`} loading="lazy" className="size-full object-cover transition-transform duration-300 hover:scale-105" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <MapEmbed title={`Map of ${r.name}`} src={mapSrc(r)} href={mapLink(r)} className="h-[280px] lg:h-full lg:min-h-[320px]" />
            </div>
          </div>
        </Panel>
      ))}
    </div>
  );
}

function Brands({ d }: { d: PartnerDetail }) {
  const mode = d.partner.application.brands?.mode;
  const today = todayISO();
  if (!d.brands.length)
    return (
      <Panel>
        <EmptyState icon={<CarFront aria-hidden className="size-5" />} title={mode === "multi_brand" ? "Multi-brand dealer" : "No brand authorisations yet"}>
          {mode === "multi_brand"
            ? "This dealer sells several brands without an OEM authorisation."
            : d.partner.application.brands?.items.length
              ? `${d.partner.application.brands.items.length} brand${d.partner.application.brands.items.length === 1 ? "" : "s"} in the draft application — they appear here for approval once submitted.`
              : "Authorised dealers list their brands and certificates in step 4 of the application."}
        </EmptyState>
      </Panel>
    );
  const showroomName = new Map(d.showrooms.map((s) => [s.id, s.name]));
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">{mode === "authorized" ? "Authorised dealer" : mode === "multi_brand" ? "Multi-brand dealer" : "Dealer"} · approved brands appear on the public listing.</p>
      {d.brands.map((b) => {
        const expired = b.validUntil ? b.validUntil < today : false;
        return (
          <section key={b.id} className="border border-line bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-semibold">{b.brandName}</h3>
                  <BrandPill status={b.status} />
                  {expired && b.status !== "expired" && <StatusPill tone="amber">Certificate expired</StatusPill>}
                </div>
                <p className="text-[13px] text-muted">
                  {b.models.length ? `${b.models.length} model${b.models.length === 1 ? "" : "s"}` : "All models"} · {b.variants.length ? `${b.variants.length} variant${b.variants.length === 1 ? "" : "s"}` : "all variants"}
                  {b.showroomIds.length > 0 && ` · ${b.showroomIds.map((id) => showroomName.get(id) ?? `Showroom #${id}`).join(", ")}`}
                </p>
                {b.modelNames.length > 0 && (
                  <p className="flex flex-wrap gap-1.5">
                    {b.modelNames.slice(0, 12).map((m) => (
                      <span key={m} className="rounded-full bg-mist px-2 py-0.5 text-[11.5px]">
                        {m}
                      </span>
                    ))}
                    {b.modelNames.length > 12 && <span className="px-1 py-0.5 text-[11.5px] text-muted">+{b.modelNames.length - 12} more</span>}
                  </p>
                )}
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                  {b.certificate ? (
                    <a href={`/dealer/files/${b.certificate.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:text-red">
                      <FileText aria-hidden className="size-4 text-muted" /> {b.certificate.filename}
                    </a>
                  ) : (
                    <span className="text-red">No certificate uploaded</span>
                  )}
                  <span className={cn(expired ? "font-medium text-red" : "text-muted")}>Valid until {b.validUntil ? formatDay(b.validUntil) : "—"}</span>
                </p>
                {b.remarks && <p className="text-[13px] text-ink/80">“{b.remarks}”</p>}
              </div>
              <BrandActions id={b.id} brand={b.brandName} status={b.status} validUntil={b.validUntil} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Banking({ d, isAdmin, docs }: { d: PartnerDetail; isAdmin: boolean; docs: DocItem[] }) {
  const bank = d.partner.application.bank;
  const cheque = docs.find((x) => x.kind === "cancelled_cheque" && x.current) ?? null;
  const ifsc = (bank?.ifsc ?? "").toUpperCase();
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Panel title="Bank account">
        <Facts
          rows={[
            ["Account holder", bank?.holder],
            ["Bank", bank?.bankName],
            ["Account number", <BankReveal key="b" partnerId={d.partner.id} masked={bank?.accountNumber ?? ""} isAdmin={isAdmin} hasNumber={d.hasBankNumber} />],
            ["IFSC", format(PATTERNS.ifsc.test(ifsc), ifsc)],
            ["Branch", bank?.branch],
          ]}
        />
        <p className="mt-4 text-[12px] text-muted">Account numbers are encrypted at rest. Each reveal is recorded in the activity log.</p>
      </Panel>
      <Panel title="Cancelled cheque">
        {cheque ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <FilePill status={cheque.status} />
              <span className="text-[13px] text-muted">{cheque.filename}</span>
            </div>
            <div className="flex gap-2">
              <Button href={`/admin/dealers/details?id=${d.partner.id}&tab=documents`} size="sm" variant="outline">
                Review in Documents
              </Button>
              <Button href={`/dealer/files/${cheque.id}`} target="_blank" size="sm" variant="ghost" icon={<ExternalLink aria-hidden className="size-4" />}>
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

function Listings({ d }: { d: PartnerDetail }) {
  const now = new Date();
  return (
    <div className="space-y-6">
      <Panel title="Vehicles" padded={false} action={<Link href={`/admin/vehicle-approvals?view=all&partner=${d.partner.id}`} className="text-[13px] font-medium text-red hover:underline">Open in vehicle approvals</Link>}>
        {d.vehicles.length === 0 ? (
          <p className="p-5 text-[13.5px] text-muted">No vehicles listed yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {d.vehicles.map((v) => (
              <li key={v.id}>
                <Link href={`/admin/vehicle-approvals?view=all&review=${v.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-mist/50">
                  <span className="block h-11 w-16 shrink-0 overflow-hidden rounded-[2px] bg-mist">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {v.image && <img decoding="async" src={v.image} alt="" className="size-full object-cover" loading="lazy" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">
                      {v.year} {v.model} {v.variant}
                    </span>
                    <span className="block truncate text-[12px] text-muted">
                      {v.reference} · {v.kind === "used" ? "Used" : "New"} · {rupees(v.sellingPrice)} · {v.views} views · {v.enquiries} enquiries
                    </span>
                  </span>
                  <VehiclePill status={v.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Offers" padded={false} action={<Link href={`/admin/offer-approvals?view=all&partner=${d.partner.id}`} className="text-[13px] font-medium text-red hover:underline">Open in offer approvals</Link>}>
        {d.offers.length === 0 ? (
          <p className="p-5 text-[13.5px] text-muted">No offers created yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {d.offers.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/offer-approvals?view=all&review=${o.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-mist/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{o.title}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {o.reference} · {OFFER_CATEGORY_LABEL[o.category as keyof typeof OFFER_CATEGORY_LABEL] ?? o.category} · {formatDay(o.startsAt)} – {formatDay(o.endsAt)}
                      {o.endsAt < now ? " (ended)" : ""}
                    </span>
                  </span>
                  <OfferPill offer={o} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Changes({ d }: { d: PartnerDetail }) {
  if (!d.changes.length)
    return (
      <Panel>
        <EmptyState title="No change requests">After approval, edits to verified details (legal name, GST, PAN, bank) wait here for staff approval.</EmptyState>
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
              <span className="font-medium">Dealer&apos;s reason:</span> {c.reason}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[13.5px]">
              <thead>
                <tr className="text-[12px] text-muted">
                  <th className="px-5 py-2 font-semibold">Field</th>
                  <th className="px-5 py-2 font-semibold">Current</th>
                  <th className="px-5 py-2 font-semibold">Requested</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(c.fields).map(([path, v]) => (
                  <tr key={path} className="border-t border-line">
                    <td className="px-5 py-2.5 font-medium">{fieldLabel(path)}</td>
                    <td className="px-5 py-2.5 text-muted line-through decoration-ink/30">{v.from || "—"}</td>
                    <td className="px-5 py-2.5 font-medium">{v.to || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(c.remarks || c.status === "pending") && (
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
              {c.remarks ? <p className="text-[13px] text-ink/80">“{c.remarks}”</p> : <span />}
              {c.status === "pending" && <ChangeRequestActions id={c.id} fields={Object.keys(c.fields).map(fieldLabel)} />}
            </footer>
          )}
        </section>
      ))}
    </div>
  );
}

function Team({ d }: { d: PartnerDetail }) {
  return (
    <Panel title="People at this dealership" padded={false}>
      <div className="overflow-x-auto">
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
                  {PARTNER_ROLE_LABEL[m.role]}
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
    </Panel>
  );
}
