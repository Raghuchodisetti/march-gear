import { notFound } from "next/navigation";

// Mistyped admin URLs get the admin 404 (inside the panel, after the sign-in check) rather than the public site's.
export default function MissingAdminPage(): never {
  notFound();
}
