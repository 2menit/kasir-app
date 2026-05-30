import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";

const nav: NavItem[] = [
  { href: "/superadmin/dashboard", label: "Dashboard" },
  { href: "/superadmin/events", label: "Event" },
  { href: "/superadmin/users", label: "Crew" },
  { href: "/superadmin/recaps", label: "Rekap" },
  { href: "/superadmin/profile", label: "Profil" },
];

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") redirect("/dashboard");

  return (
    <AppShell
      user={{ name: user.name, role: user.role }}
      nav={nav}
      profileHref="/superadmin/profile"
    >
      {children}
    </AppShell>
  );
}
