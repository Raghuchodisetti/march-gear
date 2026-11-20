import { cn } from "@/lib/utils";
import { INS_VENDOR_STATUS, type InsVendorStatus } from "@/db/enums";
import { INS_VENDOR_STATUS_LABEL, INS_VENDOR_STATUS_TONE } from "@/insurance/labels";

/* What every vendor application status means — the current one highlighted. */

export const INS_STATUS_MEANING: Record<InsVendorStatus, string> = {
  draft: "You're still completing the application. Nothing has been sent to MarchGear yet.",
  submitted: "Your application has reached MarchGear and is joining the verification queue.",
  pending_approval: "In the verification queue. A vendor specialist will pick it up — nothing needed from you.",
  under_review: "A specialist is verifying your company, regulatory registration, bank account and documents.",
  documents_required: "One or more documents need adding or replacing. The application is reopened so you can upload them.",
  changes_requested: "Some details need correcting. The application is reopened with a list of what to change.",
  approved: "Verified. Your full portal is open — products, quote requests, renewals, campaigns and analytics.",
  rejected: "We couldn't approve this application. The reason is in the remarks — contact vendor support to discuss it.",
  suspended: "The account is paused and your listings are hidden. The reason is in the remarks.",
};

const DOT: Record<string, string> = {
  neutral: "bg-ink/25",
  blue: "bg-[#2456a6]",
  amber: "bg-[#c98a12]",
  green: "bg-[#1e7a3c]",
  red: "bg-red",
  dark: "bg-ink",
};

export function StatusGuide({ current }: { current: InsVendorStatus }) {
  return (
    <ul className="divide-y divide-line">
      {INS_VENDOR_STATUS.map((s) => {
        const on = s === current;
        return (
          <li key={s} aria-current={on ? "true" : undefined} className={cn("relative flex gap-3 px-5 py-3.5", on && "bg-[#FAFAFA]")}>
            {on && <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-red" />}
            <span aria-hidden className={cn("mt-[7px] size-2 shrink-0 rounded-full", DOT[INS_VENDOR_STATUS_TONE[s]])} />
            <span className="min-w-0">
              <span className={cn("flex flex-wrap items-center gap-2 text-[13.5px]", on ? "font-semibold text-ink" : "font-medium text-ink/85")}>
                {INS_VENDOR_STATUS_LABEL[s]}
                {on && <span className="inline-flex h-5 items-center rounded-full bg-ink px-2 text-[10.5px] font-semibold text-white">You are here</span>}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{INS_STATUS_MEANING[s]}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
