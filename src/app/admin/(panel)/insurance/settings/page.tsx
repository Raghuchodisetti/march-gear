import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Landmark, LayoutTemplate, RotateCcw, SlidersHorizontal } from "lucide-react";
import { BLOCKS } from "@/content/registry";
import { resetContentAction, saveContentAction } from "@/server/actions/content";
import { contentForm } from "@/server/admin/content";
import { requireStaff } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { AdminHeader, formatDateTime } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";
import { LinkTabs, StatusPill } from "@/components/admin/insurance/ui";

export const metadata: Metadata = { title: "Insurance settings" };

const TABS = { settings: "insuranceSettings", plans: "insurerPlans" } as const;

export default async function InsuranceSettingsPage({ searchParams }: PageProps<"/admin/insurance/settings">) {
  await requireStaff();
  const sp = await searchParams;
  const tab = sp.tab === "plans" ? "plans" : "settings";
  const key = TABS[tab];
  const block = BLOCKS[key];
  const [{ values, meta, invalidSaved }, catalog] = await Promise.all([contentForm(key), getCatalog()]);
  const billing = catalog.content.billing;
  const billingSet = Boolean(billing.accountNumber || billing.upi);
  const href = `/admin/insurance/settings${tab === "plans" ? "?tab=plans" : ""}`;

  const related = [
    {
      href: "/admin/content/billing",
      icon: Landmark,
      title: "Payment details",
      text: "MarchGear's bank and UPI details on vendor invoices (shared with dealers). Never invent these — leave empty until accounts confirm them.",
      badge: billingSet ? <StatusPill tone="green">Set</StatusPill> : <StatusPill tone="amber">Not set</StatusPill>,
    },
    { href: "/admin/advertising/placements", icon: LayoutTemplate, title: "Ad placements & pricing", text: "Where vendors can advertise and the price per day." },
    { href: "/admin/insurance/pricing", icon: SlidersHorizontal, title: "Pricing configuration", text: "Third-party rates, depreciation and the own-damage range behind every estimate." },
  ];

  return (
    <>
      <AdminHeader
        title="Insurance settings"
        description="How the marketplace behaves and the plans vendors subscribe to. Changes go live as soon as you save."
        actions={
          meta && (
            <DeleteButton
              action={resetContentAction.bind(null, key)}
              label="Reset to default"
              doneText="Reset to the launch version"
              icon={<RotateCcw aria-hidden className="size-4" />}
              confirmText={`Reset “${block.title}” to the launch version? Your saved changes will be lost.`}
              redirectTo={href}
            />
          )
        }
      />
      <ul className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        {related.map((r) => (
          <li key={r.href}>
            <Link href={r.href} className="group flex h-full gap-3.5 border border-line bg-white p-4 transition-colors hover:border-ink/30">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-mist text-ink">
                <r.icon aria-hidden className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
                  {r.title} {r.badge}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-muted">{r.text}</span>
              </span>
              <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted transition-colors group-hover:text-red" />
            </Link>
          </li>
        ))}
      </ul>
      <LinkTabs
        active={tab}
        items={[
          { key: "settings", label: "Marketplace settings", href: "/admin/insurance/settings" },
          { key: "plans", label: "Vendor plans", href: "/admin/insurance/settings?tab=plans" },
        ]}
      />
      <p className="-mt-1 mb-5 text-[12.5px] text-muted">
        {block.description} Used on: {block.usedOn.join(" · ")}
        {meta ? ` · last updated ${formatDateTime(meta.updatedAt)}${meta.updatedBy ? ` by ${meta.updatedBy}` : ""}` : " · showing the launch defaults"}
      </p>
      {invalidSaved && (
        <p role="alert" className="mb-6 border-l-2 border-red bg-red-50 px-4 py-3 text-[13.5px] text-red">
          The saved version no longer matches this form, so the site is showing the defaults. Saving will replace it.
        </p>
      )}
      <ResourceForm
        key={`${key}-${meta ? meta.updatedAt.toISOString() : "defaults"}`}
        sections={block.sections}
        initial={values}
        action={saveContentAction.bind(null, key)}
        listHref="/admin/insurance/dashboard"
        submitLabel="Save & publish"
      />
    </>
  );
}
