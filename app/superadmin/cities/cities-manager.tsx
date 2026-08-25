"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/kpi-card";
import { apiFetch } from "@/lib/client";
import { formatDateWIB } from "@/lib/format";

export type CityRow = {
  id: string;
  name: string;
  usersCount: number;
  eventsCount: number;
  createdAt: string;
};

type FormState = { name: string };
const empty: FormState = { name: "" };

export function CitiesManager({
  initialCities,
}: {
  initialCities: CityRow[];
}) {
  const [cities, setCities] = useState(initialCities);
  const [editing, setEditing] = useState<CityRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CityRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setErrors({});
    setShowForm(true);
  }

  function openEdit(c: CityRow) {
    setEditing(c);
    setForm({ name: c.name });
    setErrors({});
    setShowForm(true);
  }

  async function refresh() {
    const res = await apiFetch<CityRow[]>("/api/cities");
    if (res.success) setCities(res.data);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const url = editing ? `/api/cities/${editing.id}` : "/api/cities";
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
    toast.success(editing ? "Kota diperbarui" : "Kota ditambahkan");
    setShowForm(false);
    await refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await apiFetch(`/api/cities/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Kota dihapus");
    setCities((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Kota"
        description="Kelola daftar kota operasi cabang."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tambah Kota
          </Button>
        }
      />

      <Card>
        <Table>
          <THead>
            <TR>
              <TH className="w-12">No.</TH>
              <TH>Nama Kota</TH>
              <TH>Jumlah User</TH>
              <TH>Jumlah Event</TH>
              <TH>Dibuat</TH>
              <TH className="text-right">Aksi</TH>
            </TR>
          </THead>
          <TBody>
            {cities.map((c, i) => (
              <TR key={c.id}>
                <TD className="text-muted">{i + 1}</TD>
                <TD className="font-medium">{c.name}</TD>
                <TD>{c.usersCount}</TD>
                <TD>{c.eventsCount}</TD>
                <TD className="text-body">{formatDateWIB(c.createdAt)}</TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(c)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(c)}
                      aria-label="Hapus"
                      className="text-down hover:bg-down/5"
                      disabled={c.usersCount > 0 || c.eventsCount > 0}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
            {cities.length === 0 && (
              <TR>
                <TD colSpan={6} className="text-center py-8 text-muted">
                  Belum ada data kota.
                </TD>
              </TR>
            )}
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
                {editing ? "Edit Kota" : "Tambah Kota"}
              </h2>
              <Field label="Nama Kota" error={errors.name} required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: Jakarta"
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
        title="Hapus kota?"
        description={`Kota ${deleteTarget?.name ?? ""} akan dihapus permanen.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
