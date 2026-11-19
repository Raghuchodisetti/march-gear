import { redirect } from "next/navigation";

/** /cars has no index of its own; the catalogue lives at /new-cars. */
export default function CarsIndex() {
  redirect("/new-cars");
}
