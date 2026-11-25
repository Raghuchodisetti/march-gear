import { OG_CONTENT_TYPE, OG_SIZE } from "@/components/seo/og";
import { carShareCard } from "@/components/seo/car-card";

/** Electric-car pages use the model's card (it shows the claimed range). */
export const alt = "Electric car range, battery and charging on MarchGear";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return carShareCard((await params).slug);
}
