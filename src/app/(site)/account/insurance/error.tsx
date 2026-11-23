"use client";

import { AccountSectionError } from "@/components/customer/garage/states";

export default function InsuranceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AccountSectionError title="We couldn't load your insurance" reset={reset} back={{ href: "/account", label: "Account overview" }} />;
}
