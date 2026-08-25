import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";

const nav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/events", label: "Event" },
  { href: "/admin/crew", label: "Crew" },
  { href: "/admin/recaps", label: "Rekap" },
  { href: "/admin/profile", label: "Profil" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  return (
    <AppShell
      user={{ name: user.name, role: user.role }}
      nav={nav}
      profileHref="/admin/profile"
    >
      {children}
    </AppShell>
  );
}
