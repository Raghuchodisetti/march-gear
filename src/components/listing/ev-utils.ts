import type { CarModel } from "@/types";

/** EV detail route for a model. */
export function evHref(car: Pick<CarModel, "slug">) {
  return `/electric-cars/${car.slug}`;
}

/** Minutes from a DC charge string such as "20 min (20–80%)". */
export function dcMinutes(car: Pick<CarModel, "ev"> | { ev?: { dcCharge: string } }) {
  const m = car.ev?.dcCharge.match(/(\d+)\s*min/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}
