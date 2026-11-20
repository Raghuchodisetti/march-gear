"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Copy, ExternalLink, EyeOff, FileEdit, Globe, Loader2, Lock, MessageSquareWarning, Trash2, Undo2, XCircle } from "lucide-react";
import type { InsProductStatus } from "@/db/enums";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { useUI } from "@/components/providers/app-provider";
import { ConfirmDialog } from "@/components/portal/profile/kit";
import { deleteProductAction, duplicateProductAction, publishProductAction, unpublishProductAction, withdrawProductAction } from "@/server/actions/ins-products";

/* The product page's status banner (with the actions that fit the status) and its tabs. */

export interface ProductBannerProps {
  id: number;
  reference: string;
  status: InsProductStatus;
  adminRemarks: string | null;
  requiredCorrections: string[];
  submittedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  publicHref: string | null;
  canManage: boolean;
  lastDecision: { label: string; at: string } | null;
  usage: { published: number; limit: number | null; planName: string };
  companyActive: boolean;
  unapprovedCovers: number;
}

const TONE: Record<InsProductStatus, { box: string; icon: ReactNode; title: string }> = {
  draft: { box: "border-l-ink/30", icon: <FileEdit className="size-5 text-muted" />, title: "Draft — not submitted yet" },
  submitted: { box: "border-l-[#2456a6]", icon: <Clock3 className="size-5 text-[#2456a6]" />, title: "Submitted — waiting for MarchGear" },
  pending_approval: { box: "border-l-[#2456a6]", icon: <Clock3 className="size-5 text-[#2456a6]" />, title: "Waiting for MarchGear's review" },
  changes_requested: { box: "border-l-[#c98a1b]", icon: <MessageSquareWarning className="size-5 text-[#9a5b00]" />, title: "MarchGear asked for changes" },
  approved: { box: "border-l-[#1e7a3c]", icon: <CheckCircle2 className="size-5 text-[#1e7a3c]" />, title: "Approved — not live yet" },
  published: { box: "border-l-[#1e7a3c]", icon: <Globe className="size-5 text-[#1e7a3c]" />, title: "Live on the website" },
  rejected: { box: "border-l-red", icon: <XCircle className="size-5 text-red" />, title: "Rejected by MarchGear" },
  suspended: { box: "border-l-ink", icon: <Lock className="size-5 text-ink" />, title: "Suspended by MarchGear" },
};

export function ProductBanner(p: ProductBannerProps) {
  const router = useRouter();
  const { toast } = useUI();
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | "withdraw" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const t = TONE[p.status];
  const atLimit = p.usage.limit !== null && p.usage.published >= p.usage.limit;

  const run = async () => {
    if (!confirm) return;
    setBusy(true);
    const kind = confirm;
    const res =
      kind === "publish" ? await publishProductAction(p.id) : kind === "unpublish" ? await unpublishProductAction(p.id) : kind === "withdraw" ? await withdrawProductAction(p.id) : await deleteProductAction(p.id);
    setBusy(false);
    setConfirm(null);
    if (!res.ok) return toast(res.error ?? "Couldn't do that. Please try again.", { tone: "error" });
    toast(kind === "publish" ? `${p.reference} is live` : kind === "unpublish" ? `${p.reference} is offline` : kind === "withdraw" ? `${p.reference} is back to draft` : `${p.reference} deleted`, { tone: "success" });
    if (kind === "delete") router.push("/insurance-vendor/products");
    router.refresh();
  };
  const duplicate = async () => {
    setBusy(true);
    const res = await duplicateProductAction(p.id);
    setBusy(false);
    if (!res.ok) return toast(res.error ?? "Couldn't copy the product.", { tone: "error" });
    toast(`Draft copy ${res.reference} created`, { tone: "success" });
    router.push(`/insurance-vendor/products/${res.id}`);
  };

  const detail = (() => {
    switch (p.status) {
      case "draft":
        return p.submittedAt ? "Withdrawn from review. Submit it again when it's ready." : "Fill in every section, then submit it. MarchGear reviews every product before it can go live.";
      case "submitted":
      case "pending_approval":
        return `Submitted ${p.submittedAt ? formatDateTime(p.submittedAt) : ""}. You'll be notified when it's decided. It's locked meanwhile — withdraw it to make changes.`;
      case "approved":
        return !p.companyActive
          ? "The underwriting insurer isn't active on MarchGear right now, so it can't be published."
          : atLimit
            ? `Your ${p.usage.planName} plan's ${p.usage.limit} published products are in use — unpublish one to publish this.`
            : `Approved ${p.approvedAt ? formatDateTime(p.approvedAt) : ""}. Publish it when you want customers to see it.`;
      case "published":
        return `Live since ${p.publishedAt ? formatDateTime(p.publishedAt) : "approval"}. Customers can compare it and ask for quotes.${p.unapprovedCovers ? ` ${p.unapprovedCovers} of its covers aren't approved, so they're hidden.` : ""}`;
      case "suspended":
        return "It's offline and locked. Contact MarchGear support for details.";
      default:
        return null;
    }
  })();
  const showRemarks = ["changes_requested", "rejected", "suspended"].includes(p.status);

  return (
    <section className={cn("mb-6 border border-line border-l-2 bg-white", t.box)}>
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between md:px-6">
        <div className="flex min-w-0 gap-3">
          <span aria-hidden className="mt-0.5 shrink-0">
            {t.icon}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{t.title}</p>
            {detail && <p className="mt-0.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">{detail}</p>}
            {showRemarks && (
              <div className="mt-3 space-y-2">
                <p className="whitespace-pre-line border-l-2 border-red py-1 pl-3 text-[13.5px] text-ink">{p.adminRemarks || "No remarks were left. See the approval history or contact support."}</p>
                {p.status === "changes_requested" && p.requiredCorrections.length > 0 && (
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Required corrections</p>
                    <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[13.5px]">
                      {p.requiredCorrections.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
            {p.lastDecision && <p className="mt-2 text-[12px] text-muted">Last decision: {p.lastDecision.label} · {formatDateTime(p.lastDecision.at)}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {p.publicHref && (
            <Button href={p.publicHref} target="_blank" variant="outline" size="sm" icon={<ExternalLink aria-hidden className="size-4" />}>
              View on website
            </Button>
          )}
          {p.canManage && p.status === "approved" && (
            <Button size="sm" variant="dark" disabled={atLimit || !p.companyActive || busy} onClick={() => setConfirm("publish")} icon={<Globe aria-hidden className="size-4" />}>
              Publish
            </Button>
          )}
          {p.canManage && p.status === "published" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm("unpublish")} icon={<EyeOff aria-hidden className="size-4" />}>
              Unpublish
            </Button>
          )}
          {p.canManage && (p.status === "pending_approval" || p.status === "submitted") && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm("withdraw")} icon={<Undo2 aria-hidden className="size-4" />}>
              Withdraw
            </Button>
          )}
          {p.canManage && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={duplicate} icon={busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Copy aria-hidden className="size-4" />}>
              Duplicate
            </Button>
          )}
          {p.canManage && p.status === "draft" && !p.submittedAt && (
            <Button size="sm" variant="ghost" className="text-red hover:bg-red-50" disabled={busy} onClick={() => setConfirm("delete")} icon={<Trash2 aria-hidden className="size-4" />}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        busy={busy}
        onConfirm={run}
        tone={confirm === "delete" || confirm === "unpublish" ? "primary" : "dark"}
        title={confirm === "publish" ? "Publish this product?" : confirm === "unpublish" ? "Take it off the website?" : confirm === "withdraw" ? "Withdraw from review?" : "Delete this draft?"}
        confirm={confirm === "publish" ? "Publish" : confirm === "unpublish" ? "Unpublish" : confirm === "withdraw" ? "Withdraw to draft" : "Delete draft"}
        body={
          confirm === "publish"
            ? `It goes live on the MarchGear insurance pages straight away.${p.usage.limit !== null ? ` This uses ${p.usage.published + 1} of the ${p.usage.limit} published products on your ${p.usage.planName} plan.` : ""}`
            : confirm === "unpublish"
              ? "Customers can no longer find it or request quotes. It stays approved, so you can publish it again at any time."
              : confirm === "withdraw"
                ? "It leaves MarchGear's queue and goes back to draft so you can keep editing."
                : "This draft was never submitted, so it's removed for good."
        }
      />
    </section>
  );
}

/** Tabs that keep every panel mounted (the form keeps its unsaved state when you look at the history). */
export function KeepTabs({ items, panels, initial }: { items: { value: string; label: string; count?: number }[]; panels: Record<string, ReactNode>; initial: string }) {
  const [tab, setTab] = useState(items.some((i) => i.value === initial) ? initial : items[0].value);
  const change = (val: string) => {
    setTab(val);
    const url = new URL(window.location.href);
    if (val === items[0].value) url.searchParams.delete("tab");
    else url.searchParams.set("tab", val);
    window.history.replaceState(window.history.state, "", url);
  };
  return (
    <div>
      <Tabs items={items} value={tab} onChange={change} className="mb-6" ariaLabel="Product sections" />
      {items.map((i) => (
        <div key={i.value} hidden={tab !== i.value} className={cn(tab === i.value && "animate-rise")}>
          {panels[i.value]}
        </div>
      ))}
    </div>
  );
}
