import "server-only";
import { offersForCar, offersForDealer } from "@/server/partner/offers";
import { LiveOfferPanel, LiveOfferSection } from "./live-offers";
import { toCardData } from "./offer-card";

/* Server entry points for the public dealer and car pages (each is a single line on those pages). */

/** "Offers from this showroom" on /dealers/[id]. Renders nothing without live offers. */
export async function DealerOffersSection({ dealerId, dealerName }: { dealerId: string; dealerName: string }) {
  const offers = await offersForDealer(dealerId);
  if (!offers.length) return null;
  return (
    <LiveOfferSection
      offers={offers.map(toCardData)}
      renderedAt={new Date().getTime()}
      title="Offers from this showroom"
      description={`Current promotions from ${dealerName}, approved by MarchGear. Confirm final prices with the showroom.`}
      link={{ href: "/offers", label: "All dealer offers" }}
    />
  );
}

/** Compact "Dealer offers on this car" panel on /cars/[slug]. Renders nothing without live offers. */
export async function CarOffersPanel({ car, carName }: { car: { slug: string; brand: string }; carName: string }) {
  const offers = await offersForCar(car);
  if (!offers.length) return null;
  return (
    <LiveOfferPanel
      offers={offers.map(toCardData)}
      renderedAt={new Date().getTime()}
      title={`Dealer offers on the ${carName}`}
      link={{ href: `/offers?brand=${encodeURIComponent(car.brand)}`, label: "All offers for this brand" }}
    />
  );
}
