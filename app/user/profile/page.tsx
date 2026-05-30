import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ProfileView } from "@/components/profile-view";

export const dynamic = "force-dynamic";

export default async function UserProfilePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  return <ProfileView name={me.name} username={me.username} role={me.role} />;
}
