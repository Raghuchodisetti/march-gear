import { redirect } from "next/navigation";

// The customer area moved to /account.
export default function ProfilePage() {
  redirect("/account");
}
