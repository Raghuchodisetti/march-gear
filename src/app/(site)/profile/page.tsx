import { permanentRedirect } from "next/navigation";

// The customer area moved to /account for good — a permanent (308) redirect, so links and bookmarks update.
// (next.config.mjs redirects /profile too, before rendering; this page is the fallback.)
export default function ProfilePage() {
  permanentRedirect("/account");
}
