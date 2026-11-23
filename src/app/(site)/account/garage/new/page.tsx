import type { Metadata } from "next";
import { isIndianState } from "@/data/states";
import { requireUser } from "@/server/auth";
import { todayISO } from "@/server/validation";
import { countGarage, garagePrefillFromPolicy } from "@/server/customer/garage";
import { PortalHeader } from "@/components/portal/ui";
import { EmptyState } from "@/components/admin/partner-ui";
import { Button } from "@/components/ui/button";
import { EMPTY_GARAGE_FORM, GARAGE_LIMIT, type GarageFormValues } from "@/components/customer/garage/shared";
import { VehicleForm } from "@/components/customer/garage/vehicle-form";
import { PolicyNotice } from "@/components/customer/garage/policy-notice";

export const metadata: Metadata = { title: "Add a car" };

export default async function NewGarageCarPage(props: PageProps<"/account/garage/new">) {
  const user = await requireUser("/account/garage/new");
  const sp = await props.searchParams;
  const today = todayISO();
  const n = await countGarage(user.id);
  const header = <PortalHeader title="Add a car" back={{ href: "/account/garage", label: "My garage" }} description="A car you own, or one you've booked and are waiting for." />;

  if (n >= GARAGE_LIMIT)
    return (
      <>
        {header}
        <section className="border border-line bg-white pb-10">
          <EmptyState title="Your garage is full">Your garage holds up to {GARAGE_LIMIT} cars. Remove one you no longer own to add another.</EmptyState>
          <div className="-mt-6 flex justify-center">
            <Button href="/account/garage" variant="outline" size="sm">
              Back to my garage
            </Button>
          </div>
        </section>
      </>
    );

  const from = typeof sp.from === "string" ? sp.from.trim().toUpperCase() : "";
  const prefill = from ? await garagePrefillFromPolicy(user.id, from) : null;
  const initial: GarageFormValues = prefill?.values ?? { ...EMPTY_GARAGE_FORM, state: user.state && isIndianState(user.state) ? user.state : "", city: user.state && isIndianState(user.state) ? (user.city ?? "") : "" };

  return (
    <>
      {header}
      <VehicleForm
        initial={initial}
        today={today}
        cancelHref={prefill ? "/account/insurance" : "/account/garage"}
        notice={
          prefill ? (
            <PolicyNotice policy={prefill.policy} />
          ) : from ? (
            <p>We couldn&apos;t find an issued policy with that reference on your account, so the form starts empty.</p>
          ) : undefined
        }
      />
    </>
  );
}
