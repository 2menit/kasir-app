"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/nav-links";

/** Mobile-only hamburger menu: holds all nav links + logout. */
export function MobileNav({ nav }: { nav: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Tutup menu" : "Buka menu"}
        aria-expanded={open}
        className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-pill text-body hover:bg-surface-soft hover:text-ink"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <>
          {/* Tap-away overlay (below the 64px header) */}
          <div
            className="fixed inset-x-0 bottom-0 top-16 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed right-3 top-16 z-50 w-56 rounded-lg border border-hairline bg-canvas p-2 shadow-soft">
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-warn text-warn-ink"
                      : "text-body hover:bg-surface-soft hover:text-ink"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="my-1 border-t border-hairline" />
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-down hover:bg-down/5"
            >
              <LogOut className="h-4 w-4" /> Keluar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
