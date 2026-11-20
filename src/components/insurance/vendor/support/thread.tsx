import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileRef } from "@/partner/types";
import { formatDateTime } from "@/components/portal/ui";
import { insFileHref, sizeLabel } from "./shared";

/* A support ticket's conversation, as the vendor sees it. Server-safe. */

export interface InsThreadMessage {
  id: number;
  fromStaff: boolean;
  author: string | null;
  body: string;
  attachments: FileRef[];
  createdAt: Date;
}

export function InsTicketThread({ messages }: { messages: InsThreadMessage[] }) {
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const mine = !m.fromStaff;
        const who = m.fromStaff ? `MarchGear support${m.author && !/^marchgear\b/i.test(m.author) ? ` · ${m.author}` : ""}` : (m.author ?? "Your team");
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <article className={cn("w-full max-w-[680px] border bg-white px-4 py-4 sm:px-5", m.fromStaff ? "border-ink/10 border-l-[3px] border-l-ink" : "border-line")}>
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
                  <span aria-hidden className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold", m.fromStaff ? "bg-ink text-white" : "bg-red-50 text-red")}>
                    {m.fromStaff ? "MG" : (m.author ?? "Y").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate">{who}</span>
                </p>
                <time className="text-[12px] text-muted" dateTime={m.createdAt.toISOString()}>
                  {formatDateTime(m.createdAt)}
                </time>
              </header>
              <p className="mt-3 whitespace-pre-line break-words text-[14px] leading-relaxed">{m.body}</p>
              {m.attachments.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {m.attachments.map((f) => (
                    <li key={f.id} className="min-w-0 max-w-full">
                      <a
                        href={insFileHref(f)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-2 rounded-[3px] border border-line bg-[#F6F6F6] px-2.5 py-1.5 text-[12.5px] hover:border-ink/40 sm:max-w-[280px]"
                      >
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
