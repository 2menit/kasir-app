import Link from "next/link";
import { Camera } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLinks, type NavItem } from "@/components/nav-links";

export function AppShell({
  user,
  nav,
  profileHref,
  children,
}: {
  user: { name: string; role: string };
  nav: NavItem[];
  profileHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-soft">
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary">
                <Camera className="h-4 w-4" />
              </span>
              <span className="hidden text-[15px] font-semibold tracking-display sm:inline">
                Photobooth Cashier
              </span>
            </Link>
            <NavLinks items={nav} />
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={profileHref}
              className="hidden rounded-md px-2 py-1 text-right transition-colors hover:bg-surface-soft sm:block"
              title="Profil saya"
            >
              <p className="text-sm font-semibold leading-tight">{user.name}</p>
              <p className="text-xs text-muted">
                {user.role === "SUPERADMIN" ? "Superadmin" : "Crew"}
              </p>
            </Link>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-content px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
