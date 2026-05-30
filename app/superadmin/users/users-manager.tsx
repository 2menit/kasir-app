"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/kpi-card";
import { apiFetch } from "@/lib/client";
import { formatDateWIB } from "@/lib/format";

export type UserRow = {
  id: string;
  name: string;
  username: string;
  role: string;
  createdAt: string;
};

type FormState = { name: string; username: string; password: string };
const empty: FormState = { name: "", username: "", password: "" };

export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setErrors({});
    setShowForm(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({ name: u.name, username: u.username, password: "" });
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
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Crew"
        description="Kelola akun crew yang dapat mencatat transaksi."
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
              <TH className="w-12">No.</TH>
              <TH>Nama</TH>
              <TH>Username</TH>
              <TH>Peran</TH>
              <TH>Dibuat</TH>
              <TH className="text-right">Aksi</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((u, i) => (
              <TR key={u.id}>
                <TD className="text-muted">{i + 1}</TD>
                <TD className="font-medium">{u.name}</TD>
                <TD className="font-mono text-body">{u.username}</TD>
                <TD>
                  <Badge
                    className={
                      u.role === "SUPERADMIN"
                        ? "bg-primary/10 text-primary"
                        : "bg-surface-strong text-body"
                    }
                  >
                    {u.role === "SUPERADMIN" ? "Superadmin" : "Crew"}
                  </Badge>
                </TD>
                <TD className="text-body">{formatDateWIB(u.createdAt)}</TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(u)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {u.id !== currentUserId && u.role !== "SUPERADMIN" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(u)}
                        aria-label="Hapus"
                        className="text-down hover:bg-down/5"
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

      {/* Create / Edit modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-4"
          onClick={() => setShowForm(false)}
        >
          <Card
            className="w-full max-w-md shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={submit} className="space-y-4 p-6">
              <h2 className="text-lg font-semibold tracking-display">
                {editing ? "Edit Crew" : "Tambah Crew"}
              </h2>
              <Field label="Nama Lengkap" error={errors.name} required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Budi Santoso"
                />
              </Field>
              <Field label="Username" error={errors.username} required>
                <Input
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  placeholder="budi"
                />
              </Field>
              <Field
                label="Password"
                error={errors.password}
                hint={
                  editing
                    ? "Kosongkan jika tidak ingin mengubah password."
                    : "Minimal 8 karakter."
                }
                required={!editing}
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
