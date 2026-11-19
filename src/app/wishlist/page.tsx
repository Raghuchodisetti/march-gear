import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { WishlistView } from "@/components/account/wishlist-view";

export const metadata: Metadata = {
  title: "Saved cars",
  description: "Your March Gear shortlist — saved new and used cars, ready to compare side by side.",
  robots: { index: false, follow: true },
};

export default function WishlistPage() {
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
