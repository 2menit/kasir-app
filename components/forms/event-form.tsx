"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client";

const STATUSES: { value: string; label: string }[] = [
  { value: "UPCOMING", label: "Akan Datang" },
  { value: "ONGOING", label: "Berlangsung" },
  { value: "DONE", label: "Selesai" },
  { value: "CANCELLED", label: "Dibatalkan" },
];

export type CrewOption = { id: string; name: string };

export type EventFormInitial = {
  name: string;
  location: string;
  eventDate: string; // yyyy-MM-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  pricingType: "BIASA" | "PISAH";
  pricePerPrint: number;
  copyPrice: number;
  addOnEnabled: boolean;
  addOnName: string;
  addOnPrice: number;
  status: string;
  notes: string;
  crewIds: string[];
  attendance: Record<string, boolean>;
};

const blank: EventFormInitial = {
  name: "",
  location: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  pricingType: "BIASA",
  pricePerPrint: 15000,
  copyPrice: 10000,
  addOnEnabled: false,
  addOnName: "Gantungan Kunci",
  addOnPrice: 5000,
  status: "UPCOMING",
  notes: "",
  crewIds: [],
  attendance: {},
};

export function EventForm({
  mode,
  eventId,
  crewOptions,
  initial,
}: {
  mode: "create" | "edit";
  eventId?: string;
  crewOptions: CrewOption[];
  initial?: EventFormInitial;
}) {
  const router = useRouter();
  const [form, setForm] = useState<EventFormInitial>(initial ?? blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function set<K extends keyof EventFormInitial>(
    key: K,
    value: EventFormInitial[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleCrew(id: string) {
    setForm((f) => {
      const has = f.crewIds.includes(id);
      return {
        ...f,
        crewIds: has
          ? f.crewIds.filter((c) => c !== id)
          : [...f.crewIds, id],
      };
    });
  }

  function toggleAttendance(id: string) {
    setForm((f) => ({
      ...f,
      attendance: { ...f.attendance, [id]: !f.attendance[id] },
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const payload = {
      name: form.name,
      location: form.location,
      eventDate: form.eventDate,
      startTime: form.startTime,
      endTime: form.endTime,
      pricingType: form.pricingType,
      pricePerPrint: Number(form.pricePerPrint),
      copyPrice: form.pricingType === "PISAH" ? Number(form.copyPrice) : null,
      addOnEnabled: form.addOnEnabled,
      addOnName: form.addOnName,
      addOnPrice: form.addOnEnabled ? Number(form.addOnPrice) : null,
      status: form.status,
      notes: form.notes,
      crewIds: form.crewIds,
      ...(mode === "edit" ? { attendance: form.attendance } : {}),
    };

    const res =
      mode === "create"
        ? await apiFetch("/api/events", {
            method: "POST",
            body: JSON.stringify(payload),
          })
        : await apiFetch(`/api/events/${eventId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });

    setSaving(false);
    if (!res.success) {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      toast.error(res.error);
      return;
    }
    toast.success(mode === "create" ? "Event dibuat" : "Event diperbarui");
    router.push(
      mode === "create" ? "/superadmin/events" : `/superadmin/events/${eventId}`
    );
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Nama Event" error={errors.name} required className="sm:col-span-2">
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Wedding Rizal & Ayu"
            />
          </Field>
          <Field label="Lokasi" error={errors.location} required>
            <Input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Gedung Graha Cakra, Malang"
            />
          </Field>
          <Field label="Tanggal Event" error={errors.eventDate} required>
            <Input
              type="date"
              value={form.eventDate}
              onChange={(e) => set("eventDate", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jam Mulai" error={errors.startTime}>
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)}
              />
            </Field>
            <Field label="Jam Selesai" error={errors.endTime}>
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Skema Harga"
            error={errors.pricingType}
            hint={
              form.pricingType === "PISAH"
                ? "Cetak pertama 1 harga, salinan foto yang sama lebih murah."
                : "Satu harga untuk setiap lembar cetak."
            }
            required
          >
            <Select
              value={form.pricingType}
              onChange={(e) =>
                set("pricingType", e.target.value as "BIASA" | "PISAH")
              }
            >
              <option value="BIASA">Biasa — harga tunggal</option>
              <option value="PISAH">Pisah — cetak + salinan</option>
            </Select>
          </Field>

          <Field
            label={
              form.pricingType === "PISAH"
                ? "Harga Cetak Pertama (Rp)"
                : "Harga per Print (Rp)"
            }
            error={errors.pricePerPrint}
            required
          >
            <Input
              type="number"
              min={1000}
              step={500}
              value={form.pricePerPrint}
              onChange={(e) => set("pricePerPrint", Number(e.target.value))}
            />
          </Field>
          {form.pricingType === "PISAH" && (
            <Field
              label="Harga Salinan / Copy (Rp)"
              error={errors.copyPrice}
              hint="Harga tiap cetakan tambahan dari foto yang sama."
              required
            >
              <Input
                type="number"
                min={1000}
                step={500}
                value={form.copyPrice}
                onChange={(e) => set("copyPrice", Number(e.target.value))}
              />
            </Field>
          )}
          <Field label="Status" error={errors.status} required>
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Catatan" error={errors.notes} className="sm:col-span-2">
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Catatan tambahan (opsional)"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Add-on (optional per-event extra item, e.g. gantungan kunci) */}
      <Card>
        <CardContent>
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <span>
              <span className="text-base font-semibold tracking-display">
                Add-on
              </span>
              <span className="mt-1 block text-sm text-body">
                Produk tambahan opsional yang bisa dijual di kasir.
              </span>
            </span>
            <input
              type="checkbox"
              checked={form.addOnEnabled}
              onChange={(e) => set("addOnEnabled", e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-primary"
            />
          </label>

          {form.addOnEnabled && (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Nama Add-on" error={errors.addOnName} required>
                <Input
                  value={form.addOnName}
                  onChange={(e) => set("addOnName", e.target.value)}
                  placeholder="Gantungan Kunci"
                />
              </Field>
              <Field
                label="Harga / item (Rp)"
                error={errors.addOnPrice}
                required
              >
                <Input
                  type="number"
                  min={1000}
                  step={500}
                  value={form.addOnPrice}
                  onChange={(e) => set("addOnPrice", Number(e.target.value))}
                />
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="text-base font-semibold tracking-display">Crew</h3>
          <p className="mt-1 text-sm text-body">
            Pilih crew yang bertugas di event ini
            {mode === "edit" && " dan tandai kehadirannya"}.
          </p>
          {crewOptions.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Belum ada akun crew. Tambahkan di menu Crew.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {crewOptions.map((c) => {
                const selected = form.crewIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-md border border-hairline px-4 py-3"
                  >
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCrew(c.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="font-medium">{c.name}</span>
                    </label>
                    {mode === "edit" && selected && (
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!form.attendance[c.id]}
                          onChange={() => toggleAttendance(c.id)}
                          className="h-4 w-4 accent-up"
                        />
                        <span className={form.attendance[c.id] ? "text-up" : "text-muted"}>
                          {form.attendance[c.id] ? "Hadir" : "Tidak hadir"}
                        </span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Batal
        </Button>
        <Button type="submit" loading={saving}>
          {mode === "create" ? "Buat Event" : "Simpan Perubahan"}
        </Button>
      </div>
    </form>
  );
}
