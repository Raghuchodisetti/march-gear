"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, MessageSquareWarning } from "lucide-react";
import type { InsDocKind } from "@/db/enums";
import { FILE_REVIEW_LABEL, FILE_REVIEW_TONE } from "@/insurance/labels";
import type { FileRef } from "@/insurance/types";
import { cn } from "@/lib/utils";
import { replaceKycDocumentAction } from "@/server/actions/ins-profile";
import { Badge, formatDateTime } from "@/components/portal/ui";
import { useUI } from "@/components/providers/app-provider";
import { InsDocumentUploader, fileSize, insFileUrl } from "@/components/insurance/vendor/uploader";
import type { DocView } from "./shared";

/* KYC documents from the application, with MarchGear's review status; rejected ones can be replaced. */

export function KycDocuments({ docs }: { docs: DocView[] }) {
  const counts = { verified: docs.filter((d) => d.status === "verified").length, pending: docs.filter((d) => d.status === "pending").length, rejected: docs.filter((d) => d.status === "rejected").length };
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 border border-line bg-white px-5 py-4 text-[13.5px] sm:flex-row sm:items-center sm:justify-between md:px-6">
        <p className="text-muted">The documents you submitted with your application. Only your team and MarchGear staff can open them.</p>
        <p className="flex shrink-0 gap-4 text-[12.5px] num">
          <span>
            <span className="font-semibold">{counts.verified}</span> verified
          </span>
          <span>
            <span className="font-semibold">{counts.pending}</span> awaiting review
          </span>
          <span className={cn(counts.rejected && "text-red")}>
            <span className="font-semibold">{counts.rejected}</span> rejected
          </span>
        </p>
      </div>
      {docs.length ? (
        <ul className="divide-y divide-line border border-line bg-white">
          {docs.map((d) => (
            <DocRow key={d.path} doc={d} />
          ))}
        </ul>
      ) : (
        <p className="border border-line bg-white px-6 py-12 text-center text-[13.5px] text-muted">No documents on file. MarchGear will ask through Support if anything is needed.</p>
      )}
    </div>
  );
}

function DocRow({ doc }: { doc: DocView }) {
  const router = useRouter();
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [replacement, setReplacement] = useState<FileRef | null>(null);

  const upload = async (f: FileRef | null) => {
    setReplacement(f);
    if (!f) return;
    setBusy(true);
    const res = await replaceKycDocumentAction({ path: doc.path, fileId: f.id });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Couldn't replace the document.", { tone: "error" });
      setReplacement(null);
      return;
    }
    toast(`${doc.label} replaced — MarchGear will review it again.`, { tone: "success" });
    router.refresh();
  };

  return (
    <li className="px-5 py-4 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-[3px]", doc.status === "rejected" ? "bg-red-50 text-red" : "bg-mist text-ink/60")}>
            <FileText aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold">{doc.label}</p>
            <a href={insFileUrl(doc.file)} target="_blank" rel="noreferrer" className="block truncate text-[12.5px] text-muted hover:text-red">
              {doc.file.filename} · {fileSize(doc.file.size)}
              {doc.uploadedAt ? ` · uploaded ${formatDateTime(doc.uploadedAt)}` : ""}
            </a>
          </div>
        </div>
        <Badge tone={FILE_REVIEW_TONE[doc.status]}>{FILE_REVIEW_LABEL[doc.status]}</Badge>
      </div>
      {doc.remarks && (
        <p className={cn("mt-3 flex gap-2 text-[13px]", doc.status === "rejected" ? "text-ink" : "text-ink/75")}>
          <MessageSquareWarning aria-hidden className={cn("mt-0.5 size-4 shrink-0", doc.status === "rejected" ? "text-red" : "text-muted")} />
          <span>
            <span className="font-medium">MarchGear:</span> {doc.remarks}
          </span>
        </p>
      )}
      {doc.status === "rejected" && (
        <div className="mt-4 max-w-xl">
          <InsDocumentUploader kind={doc.kind as InsDocKind} label="Upload a replacement" required value={replacement} onChange={upload} hint={busy ? "Saving…" : "PDF, JPEG, PNG or WebP up to 900 KB. MarchGear reviews it again."} />
        </div>
      )}
    </li>
  );
}
