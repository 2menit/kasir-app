import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";

const nav: NavItem[] = [
  { href: "/user/dashboard", label: "Event Saya" },
  { href: "/user/profile", label: "Profil" },
];

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "USER") redirect("/dashboard");

  return (
    <AppShell
      user={{ name: user.name, role: user.role }}
      nav={nav}
      profileHref="/user/profile"
    >
      {children}
    </AppShell>
  );
}
