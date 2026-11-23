import { CarFront } from "lucide-react";
import { PortalHeader } from "@/components/portal/ui";
import { EmptyState } from "@/components/admin/partner-ui";
import { Button } from "@/components/ui/button";

export default function GarageCarNotFound() {
  return (
    <>
      <PortalHeader title="Car not found" back={{ href: "/account/garage", label: "My garage" }} />
      <section className="border border-line bg-white pb-10">
        <EmptyState icon={<CarFront aria-hidden className="size-5" />} title="That car isn't in your garage">
          It may have been removed, or the link belongs to a different account.
        </EmptyState>
        <div className="-mt-6 flex justify-center">
          <Button href="/account/garage" variant="outline" size="sm">
            Back to my garage
          </Button>
        </div>
      </section>
    </>
  );
}
