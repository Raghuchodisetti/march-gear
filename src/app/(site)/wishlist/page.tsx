import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { PageHeader } from "@/components/ui/page-header";
import { WishlistView } from "@/components/account/wishlist-view";

export const metadata: Metadata = {
  title: "Saved cars",
  description: "Your MarchGear shortlist — saved new and used cars, ready to compare side by side.",
  alternates: { canonical: "/wishlist" },
  robots: { index: false, follow: true },
};

export default async function WishlistPage() {
  // Signed-in customers keep their saved cars on their account (/account/saved); guests keep a list on this device.
  if (await getSessionUser("customer")) redirect("/account/saved");
  return (
    <>
      <PageHeader
        eyebrow="Your shortlist"
        crumbs={[{ label: "Saved cars" }]}
        title={
          <>
            Saved <span className="type-editorial">cars</span>
          </>
        }
        description="Everything you've hearted, in one place. Line up the finalists side by side, or pick up where you left off."
      />
      <WishlistView />
    </>
  );
}
