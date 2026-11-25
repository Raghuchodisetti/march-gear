import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deleteCarAction, saveCarAction } from "@/server/actions/catalog";
import { brandOptions, carForm, carOptions, isBrandVisible, NEW_DEFAULTS } from "@/server/admin/catalog";
import { requireStaff } from "@/server/auth";
import { creditsForAdmin } from "@/server/photo-credits";
import { AdminHeader, ViewOnSite } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import { DeleteButton } from "@/components/admin/delete-button";
import { ResourceForm } from "@/components/admin/resource-form";
import { withOptions } from "@/components/admin/fields";
import { carSections } from "@/components/admin/resources";

export const metadata: Metadata = { title: "Car" };

/** Read-only provenance of a model loaded by `npm run db:import-catalogue`: when the facts were checked, the price city and sources. */
function ResearchedFacts({ initial }: { initial: Record<string, unknown> }) {
  const sources = Array.isArray(initial.sources) ? (initial.sources as string[]) : [];
  const asOf = typeof initial.dataAsOf === "string" ? initial.dataAsOf : null;
  const city = typeof initial.priceCity === "string" ? initial.priceCity : null;
  const images = Array.isArray(initial.images) ? initial.images.length : 0;
  if (!asOf && !city && sources.length === 0) return null;
  const host = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return u;
    }
  };
  return (
    <section aria-label="Researched facts" className="mb-6 border border-line bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Researched catalogue facts · read-only</p>
      <p className="mt-2 text-[14px]">
        {[asOf && `Data as of ${formatDate(asOf)}`, city && `ex-showroom ${city}`, sources.length > 0 && `${sources.length} ${sources.length === 1 ? "source" : "sources"}`].filter(Boolean).join(" · ")}
      </p>
      {sources.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
          {sources.map((u) => (
            <li key={u} className="min-w-0 max-w-full">
              <a href={u} target="_blank" rel="noopener noreferrer" className="block truncate text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink" title={u}>
                {host(u)}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
        Prices, specs, variants, colours, features and highlights are refreshed each time the importer runs; edits to those fields here are overwritten then.
        Ratings, the review, overview, pros/cons, trending and status are never touched by the importer.
        Photos come from the photo importer (genuine Wikimedia Commons photos, credited as their licences require): it resets them when they are all its own
        photos, so add one of your own uploads to keep a hand-picked set.
        {images === 0 && " This model has no photos yet — the site shows a body-type placeholder until you add licensed ones."}
      </p>
    </section>
  );
}

export default async function CarEditPage({ params }: PageProps<"/admin/cars/[id]">) {
  await requireStaff();
  const { id } = await params;
  const isNew = id === "new";
  const recordId = isNew ? null : /^\d+$/.test(id) ? Number(id) : NaN;
  const [initial, brands, cars] = await Promise.all([
    isNew ? NEW_DEFAULTS.car() : Number.isNaN(recordId) ? null : carForm(recordId!),
    brandOptions(),
    carOptions(),
  ]);
  if (!initial) notFound();

  const sections = withOptions(carSections, { brand: brands, competitors: cars.filter((c) => c.value !== initial.slug) });
  const imageCredits = await creditsForAdmin(Array.isArray(initial.images) ? (initial.images as string[]) : []);
  const offline = isNew ? null : initial.status !== "published" ? "Draft — not on the site" : !(await isBrandVisible(String(initial.brand))) ? "Brand hidden — not on the site" : null;

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/cars", label: "New cars" }}
        title={isNew ? "Add car" : String(initial.name)}
        description={isNew ? "Start as a draft — publish when the details are complete." : undefined}
        actions={
          !isNew && (
            <>
              <ViewOnSite href={`/cars/${initial.slug}`} offline={offline} />
              <DeleteButton action={deleteCarAction.bind(null, recordId)} confirmText={`Delete ${initial.name} and all its variants? This can't be undone.`} redirectTo="/admin/cars" />
            </>
          )
        }
      />
      {!isNew && <ResearchedFacts initial={initial} />}
      <ResourceForm
        sections={sections}
        initial={initial}
        action={saveCarAction.bind(null, recordId)}
        listHref="/admin/cars"
        createdHref={isNew ? "/admin/cars/:id" : undefined}
        submitLabel={isNew ? "Create car" : "Save changes"}
        imageCredits={imageCredits}
      />
    </>
  );
}
