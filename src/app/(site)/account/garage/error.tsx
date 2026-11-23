"use client";

import { AccountSectionError } from "@/components/customer/garage/states";

export default function GarageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AccountSectionError title="We couldn't load your garage" reset={reset} back={{ href: "/account", label: "Account overview" }} />;
}
