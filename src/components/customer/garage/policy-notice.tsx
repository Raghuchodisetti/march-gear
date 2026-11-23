import { ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";

/* Shown above the garage form when it was prefilled from an issued policy. */
export function PolicyNotice({ policy }: { policy: { reference: string; issuedOn: string; insuranceExpiry: string; policyNumber: string | null } }) {
  return (
    <p className="flex gap-3">
      <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-[#1e7a3c]" />
      <span>
        Prefilled from {policy.policyNumber ? `policy ${policy.policyNumber}` : "your policy"} (request <span className="font-mono text-[12px]">{policy.reference}</span>), reported by the insurer as issued on{" "}
        {formatDate(policy.issuedOn)}. We&apos;ve set the expiry to <strong className="font-semibold">{formatDate(policy.insuranceExpiry)}</strong> — one year from issue. Check it against your policy document before
        saving.
      </span>
    </p>
  );
}
