import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileRef } from "@/partner/types";
import { formatDateTime } from "@/components/portal/ui";
import { fileHref, sizeLabel } from "@/components/portal/support/shared";

/* A support ticket's conversation. Server-safe; used by the dealer portal and the admin inbox. */

export interface ThreadMessage {
  id: number;
  fromStaff: boolean;
  author: string | null;
  body: string;
  attachments: FileRef[];
  createdAt: Date;
}

export function TicketThread({ messages, viewer, dealerName }: { messages: ThreadMessage[]; viewer: "dealer" | "staff"; dealerName: string }) {
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const mine = viewer === "staff" ? m.fromStaff : !m.fromStaff;
        const who = m.fromStaff ? `MarchGear support${m.author && !/^marchgear\b/i.test(m.author) ? ` · ${m.author}` : ""}` : `${m.author ?? "Dealer"}${viewer === "staff" ? ` · ${dealerName}` : ""}`;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <article className={cn("w-full max-w-[680px] border px-5 py-4", m.fromStaff ? "border-ink/10 bg-white" : "border-line bg-white", mine && "border-l-[3px]", mine && (m.fromStaff ? "border-l-ink" : "border-l-red"))}>
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="flex items-center gap-2 text-[13px] font-semibold">
                  <span aria-hidden className={cn("inline-flex size-6 items-center justify-center rounded-full text-[10.5px] font-semibold", m.fromStaff ? "bg-ink text-white" : "bg-red-50 text-red")}>
                    {m.fromStaff ? "MG" : (m.author ?? "D").slice(0, 1).toUpperCase()}
                  </span>
                  {who}
                </p>
                <time className="text-[12px] text-muted" dateTime={m.createdAt.toISOString()}>
                  {formatDateTime(m.createdAt)}
                </time>
              </header>
              <p className="mt-3 whitespace-pre-line break-words text-[14px] leading-relaxed">{m.body}</p>
              {m.attachments.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {m.attachments.map((f) => (
                    <li key={f.id}>
                      <a href={fileHref(f)} target="_blank" rel="noreferrer" className="inline-flex max-w-[260px] items-center gap-2 rounded-[3px] border border-line bg-[#F6F6F6] px-2.5 py-1.5 text-[12.5px] hover:border-ink/40">
                        <FileText className="size-3.5 shrink-0 text-red" aria-hidden />
                        <span className="truncate font-medium">{f.filename}</span>
                        <span className="shrink-0 text-muted">{sizeLabel(f.size)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
