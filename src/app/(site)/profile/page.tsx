import type { Metadata } from "next";
import { ProfileView } from "@/components/account/profile-view";

export const metadata: Metadata = {
  title: "Your profile",
  description: "Manage your March Gear account — personal details, saved cars, comparisons, enquiries and notification preferences.",
  robots: { index: false, follow: true },
};

export default function ProfilePage() {
  return <ProfileView />;
}
