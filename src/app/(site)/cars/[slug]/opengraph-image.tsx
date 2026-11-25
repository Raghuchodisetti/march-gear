import { OG_CONTENT_TYPE, OG_SIZE } from "@/components/seo/og";
import { carShareCard } from "@/components/seo/car-card";

/** Share card for a model page: photo, name, indicative price and key facts. Rendered on first request, then cached. */
export const alt = "Car price, specs and review on MarchGear";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return carShareCard((await params).slug);
}
