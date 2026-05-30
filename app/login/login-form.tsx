"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  // Login matches the real Coinbase sign-in: single centered column on a
  // plain dark canvas, brand mark top-left. Always dark (independent of theme).
  const inputClass =
    "h-12 w-full rounded-md border border-white/15 bg-surface-dark-elevated px-4 text-[16px] text-on-dark placeholder:text-on-dark-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="relative min-h-screen bg-surface-dark text-on-dark">
      {/* Brand mark, top-left */}
      <div className="absolute left-6 top-6 sm:left-8 sm:top-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink">
          <Camera className="h-5 w-5" />
        </span>
      </div>

      {/* Centered form column */}
      <div className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-[400px]">
          <h1 className="mb-8 text-2xl font-semibold tracking-display sm:text-3xl">
            Masuk ke Photobooth Cashier
          </h1>

          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-sm font-semibold"
              >
                Username
              </label>
              <input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className={inputClass}
                required
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={loading}
            >
              Masuk
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-on-dark-soft">
            Akun dibuat oleh admin. Hubungi superadmin jika belum punya akses.
          </p>
        </div>
      </div>
    </div>
  );
}
