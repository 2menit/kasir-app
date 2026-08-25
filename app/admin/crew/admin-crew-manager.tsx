"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { PageHeader } from "@/components/kpi-card";
import { apiFetch } from "@/lib/client";
import { formatDateWIB } from "@/lib/format";

export type AdminUserRow = {
  id: string;
  name: string;
  username: string;
  role: string;
  cityName: string | null;
  createdAt: string;
};

type FormState = { name: string; username: string; password: string };
const empty: FormState = { name: "", username: "", password: "" };

export function AdminCrewManager({
  initialUsers,
  currentUserId,
  cityName,
}: {
  initialUsers: AdminUserRow[];
  currentUserId: string;
  cityName: string | null;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setErrors({});
    setShowForm(true);
  }

  function openEdit(u: AdminUserRow) {
    setEditing(u);
    setForm({ name: u.name, username: u.username, password: "" });
    setErrors({});
    setShowForm(true);
  }

  async function refresh() {
    const res = await apiFetch<AdminUserRow[]>("/api/users");
    if (res.success) setUsers(res.data);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const url = editing ? `/api/users/${editing.id}` : "/api/users";
    const method = editing ? "PUT" : "POST";
    const res = await apiFetch(url, {
      method,
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.success) {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Crew diperbarui" : "Crew ditambahkan");
    setShowForm(false);
    await refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Crew"
        description={
          cityName
            ? `Kelola akun crew di cabang ${cityName}.`
            : "Kelola akun crew di cabang Anda."
        }
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tambah Crew
          </Button>
        }
      />

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Nama</TH>
              <TH>Username</TH>
              <TH>Kota</TH>
              <TH>Dibuat</TH>
              <TH className="text-right">Aksi</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD className="font-medium">{u.name}</TD>
                <TD className="font-mono text-sm">{u.username}</TD>
                <TD>
                  {u.cityName ? (
                    <Badge>{u.cityName}</Badge>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </TD>
                <TD className="text-sm text-muted">
                  {formatDateWIB(u.createdAt)}
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(u)}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="mb-4 text-lg font-semibold tracking-display">
              {editing ? "Edit Crew" : "Tambah Crew"}
            </h2>
            <form onSubmit={submit} className="space-y-4">
              <Field label="Nama" error={errors.name} required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nama lengkap"
                />
              </Field>
              <Field label="Username" error={errors.username} required>
                <Input
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  placeholder="username"
                />
              </Field>
              <Field
                label="Password"
                error={errors.password}
                required={!editing}
                hint={
                  editing
                    ? "Kosongkan jika tidak ingin mengubah password."
                    : undefined
                }
              >
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="••••••••"
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Batal
                </Button>
                <Button type="submit" loading={saving}>
                  Simpan
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
