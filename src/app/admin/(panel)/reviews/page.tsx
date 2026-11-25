import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { Star } from "lucide-react";
import { REVIEW_STATUS } from "@/db/enums";
import { cn } from "@/lib/utils";
import { listDealerReviews, listOwnerReviews, reviewCounts } from "@/server/admin/audience";
import { dealerOptions } from "@/server/admin/catalog";
import { AdminHeader, Badge, EmptyRow, Table, Td, Th, formatDay, strParam, type BadgeTone } from "@/components/admin/ui";
import { ReviewActions } from "@/components/admin/review-actions";
import { AddDealerReviewButton } from "@/components/admin/review-editor";

export const metadata: Metadata = { title: "Reviews" };

const TONE: Record<string, BadgeTone> = { pending: "red", approved: "green", rejected: "neutral" };
const LABEL: Record<string, string> = { pending: "Pending", approved: "Published", rejected: "Hidden" };

export default async function ReviewsAdminPage({ searchParams }: PageProps<"/admin/reviews">) {
  const sp = await searchParams;
  const kind = sp.kind === "dealer" ? "dealer" : "owner";
  const status = strParam(sp.status);
  // reviewCounts() checks staff access before anything else is shown.
  const [counts, ownerRows, dealerRows, dealers] = await Promise.all([
    reviewCounts(),
    kind === "owner" ? listOwnerReviews(status) : Promise.resolve([]),
    kind === "dealer" ? listDealerReviews(status) : Promise.resolve([]),
    dealerOptions(),
  ]);
  const c = counts[kind];
  const tab = (active: boolean) =>
    cn("inline-flex h-9 items-center gap-2 rounded-[3px] px-3.5 text-[13px] font-medium transition-colors", active ? "bg-ink text-white" : "text-muted hover:bg-white hover:text-ink");
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const next = { kind, status, ...patch };
    if (next.kind === "dealer") p.set("kind", "dealer");
    if (next.status) p.set("status", next.status);
    const s = p.toString();
    return s ? `/admin/reviews?${s}` : "/admin/reviews";
  };

  const rows = (kind === "owner" ? ownerRows : dealerRows).map((r) => ({
    ...r,
    about: "car" in r ? `${r.brand} ${r.car}` : r.dealer,
    aboutHref: "carSlug" in r ? `/cars/${r.carSlug}` : `/dealers/${(r as { dealerId: string }).dealerId}`,
    meta: "city" in r ? r.city : (r as { visit: string }).visit,
    visit: "visit" in r ? r.visit : undefined,
  }));

  return (
    <>
      <AdminHeader
        title="Reviews"
        description="Owner reviews submitted on the site wait here until you approve them. Edit any review, or add dealer feedback collected offline."
        actions={<AddDealerReviewButton dealers={dealers} />}
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex gap-1 rounded-[4px] bg-mist p-1">
          <Link href={qs({ kind: "owner", status: undefined })} className={tab(kind === "owner")}>
            Owner reviews {counts.owner.pending ? <span className="rounded-full bg-red px-1.5 text-[11px] text-white num">{counts.owner.pending}</span> : null}
          </Link>
          <Link href={qs({ kind: "dealer", status: undefined })} className={tab(kind === "dealer")}>
            Dealer reviews
          </Link>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link href={qs({ status: undefined })} className={tab(!status)}>
            All
          </Link>
          {REVIEW_STATUS.map((s) => (
            <Link key={s} href={qs({ status: s })} className={tab(status === s)}>
              {LABEL[s]} <span className="num opacity-70">{c[s] ?? 0}</span>
            </Link>
          ))}
        </div>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Review</Th>
            <Th>{kind === "owner" ? "Car" : "Showroom"}</Th>
            <Th>Rating</Th>
            <Th>Status</Th>
            <Th className="w-[270px]">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={5}>{status === "pending" ? "Nothing waiting for review." : "No reviews here."}</EmptyRow>}
          {rows.map((r) => (
            <tr key={r.id} id={`review-${r.id}`} className="scroll-mt-20 hover:bg-mist/40 target:bg-red-50/60">
              <Td className="max-w-[460px]">
                <p className="font-medium">{r.title}</p>
                <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-muted">{r.body}</p>
                <p className="mt-1.5 text-[12px] text-muted">
                  {r.name} · {r.meta} · {formatDay(r.date)}
                </p>
              </Td>
              <Td>
                <Link href={r.aboutHref} target="_blank" className="hover:text-red">
                  {r.about}
                </Link>
              </Td>
              <Td className="whitespace-nowrap num">
                <Star aria-hidden className="mr-1 inline size-3.5 fill-red text-red" />
                {r.rating.toFixed(1)}
              </Td>
              <Td>
                <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
              </Td>
              <Td>
                <ReviewActions kind={kind} id={r.id} status={r.status} review={{ title: r.title, body: r.body, rating: r.rating, visit: r.visit }} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
