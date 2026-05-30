"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client";

type FormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};
const empty: FormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function ChangePasswordForm() {
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side confirm check before hitting the server.
    if (form.newPassword !== form.confirmPassword) {
      setErrors({ confirmPassword: "Konfirmasi password tidak cocok" });
      return;
    }

    setSaving(true);
    const res = await apiFetch("/api/profile/password", {
      method: "PUT",
      body: JSON.stringify({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      }),
    });
    setSaving(false);

    if (!res.success) {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      toast.error(res.error);
      return;
    }
    toast.success("Password berhasil diubah");
    setForm(empty);
  }

  return (
    <Card>
      <CardContent>
        <h2 className="text-base font-semibold tracking-display">
          Ubah Password
        </h2>
        <p className="mt-1 text-sm text-body">
          Untuk keamanan, gunakan password minimal 8 karakter.
        </p>
        <form onSubmit={submit} className="mt-5 max-w-sm space-y-4">
          <Field
            label="Password Saat Ini"
            error={errors.currentPassword}
            required
          >
            <Input
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => set("currentPassword", e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Field
            label="Password Baru"
            error={errors.newPassword}
            hint="Minimal 8 karakter."
            required
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(e) => set("newPassword", e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Field
            label="Konfirmasi Password Baru"
            error={errors.confirmPassword}
            required
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Button type="submit" loading={saving}>
            Simpan Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
