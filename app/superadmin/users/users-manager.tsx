"use client";

import { useMemo, useState } from "react";
import type { Role } from "@prisma/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/kpi-card";
import { apiFetch } from "@/lib/client";
import { formatDateWIB } from "@/lib/format";
import type { CityOption } from "@/components/forms/event-form";

export type UserRow = {
  id: string;
  name: string;
  username: string;
  role: Role;
  cityId: string | null;
  cityName: string | null;
  createdAt: string;
};

type FormState = {
  name: string;
  username: string;
  password: string;
  role: Role;
  cityId: string;
};

const empty: FormState = {
  name: "",
  username: "",
  password: "",
  role: "USER",
  cityId: "",
};

export function UsersManager({
  initialUsers,
  currentUserId,
  currentUserRole,
  cities,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
  currentUserRole: Role;
  cities: CityOption[];
}) {
  const isSuperadmin = currentUserRole === "SUPERADMIN";
  const [users, setUsers] = useState(initialUsers);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cityFilter, setCityFilter] = useState("");

  const filtered = useMemo(() => {
    if (!cityFilter) return users;
    return users.filter((u) => u.cityId === cityFilter);
  }, [users, cityFilter]);

  function openCreate() {
    setEditing(null);
    setForm({ ...empty, role: "USER" });
    setErrors({});
    setShowForm(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({
      name: u.name,
      username: u.username,
      password: "",
      role: u.role,
      cityId: u.cityId ?? "",
    });
    setErrors({});
    setShowForm(true);
  }

  async function refresh() {
    const res = await apiFetch<UserRow[]>("/api/users");
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

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await apiFetch(`/api/users/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Crew dihapus");
    setDeleteTarget(null);
    await refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Crew"
        description="Kelola akun crew (kasir) di semua cabang."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tambah Crew
          </Button>
        }
      />

      {cities.length > 0 && (
        <div className="flex items-center gap-3">
          <Field label="Filter kota" className="w-48">
            <Select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            >
              <option value="">Semua kota</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <span className="text-sm text-muted">
            {filtered.length} crew
          </span>
        </div>
      )}

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Nama</TH>
              <TH>Username</TH>
              <TH>Role</TH>
              <TH>Kota</TH>
              <TH>Dibuat</TH>
              <TH className="text-right">Aksi</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((u) => (
              <TR key={u.id}>
                <TD className="font-medium">{u.name}</TD>
                <TD className="font-mono text-sm">{u.username}</TD>
                <TD>
                  {u.role === "ADMIN" ? (
                    <Badge className="bg-primary/10 text-primary">Admin</Badge>
                  ) : u.role === "SUPERADMIN" ? (
                    <Badge className="bg-warn/15 text-warn">Superadmin</Badge>
                  ) : (
                    <Badge className="bg-surface-strong text-body">Crew</Badge>
                  )}
                </TD>
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
                      disabled={u.role === "SUPERADMIN"}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {u.id !== currentUserId && u.role !== "SUPERADMIN" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(u)}
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
              {isSuperadmin && (
                <Field label="Role" error={errors.role} required>
                  <Select
                    value={form.role}
                    onChange={(e) =>
                      setForm({ ...form, role: e.target.value as Role })
                    }
                    disabled={editing?.role === "SUPERADMIN"}
                  >
                    <option value="USER">Crew (Kasir)</option>
                    <option value="ADMIN">Admin Cabang</option>
                  </Select>
                </Field>
              )}
              {!editing || isSuperadmin ? (
                <Field
                  label="Kota"
                  error={errors.cityId}
                  required={form.role === "ADMIN"}
                  hint={
                    form.role === "ADMIN"
                      ? "Wajib untuk admin cabang."
                      : "Opsional untuk crew (dapat ditugaskan nanti)."
                  }
                >
                  <Select
                    value={form.cityId}
                    onChange={(e) =>
                      setForm({ ...form, cityId: e.target.value })
                    }
                  >
                    <option value="">Pilih kota</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus crew?"
        description={`Akun ${deleteTarget?.name ?? ""} akan dihapus. Riwayat transaksi tetap tersimpan.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
