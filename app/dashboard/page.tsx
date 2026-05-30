import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

// Role router: send users to their area (CON-01).
export default async function DashboardRouter() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "SUPERADMIN" ? "/superadmin/dashboard" : "/user/dashboard");
}
