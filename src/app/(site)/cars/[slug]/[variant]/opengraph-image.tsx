import { OG_CONTENT_TYPE, OG_SIZE } from "@/components/seo/og";
import { carShareCard } from "@/components/seo/car-card";

/** Variant pages share their model's card. */
export const alt = "Car variant price and features on MarchGear";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ slug: string; variant: string }> }) {
  return carShareCard((await params).slug);
}
