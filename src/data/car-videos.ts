import type { CarModel } from "@/types";
import type { Catalog } from "@/lib/catalog";

export interface CarVideo {
  id: string;
  title: string;
  dek: string;
  /** "14:32" */
  duration: string;
  poster: string;
  /** Linked editorial article, when the video comes from the newsroom */
  articleSlug?: string;
  kind: "Review" | "Walkaround" | "Drive" | "Ownership";
}

/**
 * Newsroom videos tagged to the model, padded with demo walkaround / drive
 * clips titled from the car so every model page has a Videos section.
 */
export function videosForCar(car: CarModel, cat: Catalog): CarVideo[] {
  const title = `${cat.brandName(car.brand)} ${car.name}`;
  const poster = (i: number) => car.images[i % car.images.length];

  const fromNewsroom: CarVideo[] = cat.articles
    .filter((a) => a.category === "Video" && a.relatedCar === car.slug)
    .map((a) => ({
      id: a.slug,
      title: a.title,
      dek: a.dek,
      duration: a.videoDuration ?? "10:00",
      poster: a.image,
      articleSlug: a.slug,
      kind: "Review" as const,
    }));

  const generic: CarVideo[] = [
    {
      id: `${car.slug}-walkaround`,
      title: `${title} walkaround: design, cabin and space`,
      dek: `A detailed look around the ${car.name} — exterior details, cabin materials, rear-seat room and boot.`,
      duration: "08:24",
      poster: poster(0),
      kind: "Walkaround",
    },
    {
      id: `${car.slug}-drive`,
      title: `${car.name} driven: city, highway and ghats`,
      dek: `How the ${car.name} rides, steers and performs across a full day of Indian roads.`,
      duration: "12:10",
      poster: poster(1),
      kind: "Drive",
    },
    {
      id: `${car.slug}-ownership`,
      title: `${car.name} ownership costs, explained`,
      dek: `Running costs, service intervals and what owners should budget for over five years.`,
      duration: "06:45",
      poster: poster(2),
      kind: "Ownership",
    },
  ];

  return [...fromNewsroom, ...generic].slice(0, 3);
}
