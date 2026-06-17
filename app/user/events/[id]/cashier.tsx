"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Check, CircleCheck } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { MethodBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { apiFetch } from "@/lib/client";
import { formatRupiah, formatTimeWIB } from "@/lib/format";
import { computeTotal, computeAddOnTotal } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { PricingType } from "@prisma/client";

export type TxnView = {
  id: string;
  createdAt: string;
  printCount: number;
  paymentMethod: PaymentMethod;
  addOnQty: number;
  total: number;
  note: string | null;
  crewName: string;
};

export function Cashier({
  eventId,
  pricingType,
  pricePerPrint,
  copyPrice,
  addOnEnabled,
  addOnName,
  addOnPrice,
  isOngoing,
  canEditAttendance,
  initialAttended,
  initialTransactions,
}: {
  eventId: string;
  pricingType: PricingType;
  pricePerPrint: number;
  copyPrice: number | null;
  addOnEnabled: boolean;
  addOnName: string | null;
  addOnPrice: number | null;
  isOngoing: boolean;
  canEditAttendance: boolean;
  initialAttended: boolean;
  initialTransactions: TxnView[];
}) {
  const [transactions, setTransactions] = useState<TxnView[]>(initialTransactions);
  const [printCount, setPrintCount] = useState(1);
  const [addOnQty, setAddOnQty] = useState(0);
  const [copyOnly, setCopyOnly] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<TxnView | null>(null);

  const [attended, setAttended] = useState(initialAttended);
  const [togglingAttendance, setTogglingAttendance] = useState(false);

  const isPisah = pricingType === "PISAH";
  const addOnActive = addOnEnabled && !!addOnPrice && addOnPrice > 0;
  const addOnLabel = addOnName || "Add-on";
  const printsTotal = computeTotal(
    { pricingType, pricePerPrint, copyPrice },
    printCount,
    { copyOnly }
  );
  const addOnTotal = addOnActive ? computeAddOnTotal(addOnQty, addOnPrice) : 0;
  const total = printsTotal + addOnTotal;
  // A transaction needs at least one item (a print or an add-on).
  const itemCount = printCount + (addOnActive ? addOnQty : 0);
  const printLabel = copyOnly ? "Salinan" : "Cetak";

  async function toggleAttendance() {
    setTogglingAttendance(true);
    const next = !attended;
    const res = await apiFetch(`/api/events/${eventId}/crew`, {
      method: "PUT",
      body: JSON.stringify({ attended: next }),
    });
    setTogglingAttendance(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setAttended(next);
    toast.success(next ? "Ditandai hadir" : "Ditandai tidak hadir");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (itemCount < 1) return;
    setSaving(true);
    const res = await apiFetch<TxnView>("/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        eventId,
        printCount,
        paymentMethod: method,
        addOnQty: addOnActive ? addOnQty : 0,
        copyOnly: isPisah ? copyOnly : false,
        note,
      }),
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    // New transaction appears at the top; keep visible window at 10 (REQ-U-02).
    setTransactions((prev) => [res.data, ...prev].slice(0, 10));
    setLastSaved(res.data);
    setPrintCount(1);
    setAddOnQty(0);
    setCopyOnly(false);
    setNote("");
    setMethod("CASH");
    toast.success("Transaksi tersimpan");
  }

  return (
    <div className="space-y-6">
      {/* Self attendance */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="text-sm font-semibold">Kehadiran Saya</p>
            <p className="text-sm text-muted">
              {!canEditAttendance
                ? `Event sudah selesai — kehadiran terkunci (${
                    attended ? "Hadir" : "Tidak hadir"
                  }).`
                : attended
                  ? "Anda ditandai hadir."
                  : "Anda belum hadir."}
            </p>
          </div>
          {canEditAttendance && (
            <Button
              variant={attended ? "secondary" : "primary"}
              onClick={toggleAttendance}
              loading={togglingAttendance}
            >
              {attended ? "Batalkan Hadir" : "Tandai Hadir"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Transaction form */}
      <Card>
        <CardContent>
          <h2 className="text-base font-semibold tracking-display">
            Input Transaksi
          </h2>

          {!isOngoing ? (
            <p className="mt-4 rounded-md border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-ink">
              Transaksi hanya bisa dilakukan saat event berlangsung.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-5">
              {isPisah && (
                <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                  <p className="font-semibold text-ink">Skema harga: Pisah</p>
                  <p className="mt-0.5 text-body">
                    Cetak pertama{" "}
                    <span className="font-mono">{formatRupiah(pricePerPrint)}</span>
                    , tiap salinan foto yang sama{" "}
                    <span className="font-mono">
                      {formatRupiah(copyPrice ?? pricePerPrint)}
                    </span>
                    .
                  </p>
                  <label className="mt-2 flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={copyOnly}
                      onChange={(e) => setCopyOnly(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-ink">
                      Hanya salinan — semua lembar pakai harga copy{" "}
                      <span className="font-mono">
                        {formatRupiah(copyPrice ?? pricePerPrint)}
                      </span>
                    </span>
                  </label>
                </div>
              )}
              <Field
                label={`Jumlah ${isPisah ? printLabel : "Cetak"}`}
                hint={
                  addOnActive
                    ? "Boleh 0 jika pelanggan hanya membeli add-on."
                    : undefined
                }
              >
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="aspect-square px-0"
                    onClick={() => setPrintCount((c) => Math.max(0, c - 1))}
                    aria-label="Kurangi"
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    max={999}
                    value={printCount}
                    onChange={(e) =>
                      setPrintCount(
                        Math.max(0, Math.min(999, Number(e.target.value) || 0))
                      )
                    }
                    className="h-14 w-24 text-center text-xl font-semibold"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="aspect-square px-0"
                    onClick={() => setPrintCount((c) => Math.min(999, c + 1))}
                    aria-label="Tambah"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </Field>

              {addOnActive && (
                <Field
                  label={addOnLabel}
                  hint={`Add-on · ${formatRupiah(addOnPrice)} / item`}
                >
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="aspect-square px-0"
                      onClick={() => setAddOnQty((c) => Math.max(0, c - 1))}
                      aria-label="Kurangi add-on"
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      max={999}
                      value={addOnQty}
                      onChange={(e) =>
                        setAddOnQty(
                          Math.max(0, Math.min(999, Number(e.target.value) || 0))
                        )
                      }
                      className="h-14 w-24 text-center text-xl font-semibold"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="aspect-square px-0"
                      onClick={() => setAddOnQty((c) => Math.min(999, c + 1))}
                      aria-label="Tambah add-on"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </Field>
              )}

              <Field label="Metode Pembayaran" required>
                <div className="grid grid-cols-2 gap-3">
                  {(["CASH", "QRIS"] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={cn(
                        "flex h-12 items-center justify-center gap-2 rounded-md border text-[16px] font-semibold transition-colors",
                        method === m
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-hairline text-body hover:bg-surface-soft"
                      )}
                    >
                      {method === m && <Check className="h-4 w-4" />}
                      {m === "CASH" ? "Tunai" : "QRIS"}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Catatan" hint="Opsional, maksimal 500 karakter">
                <Textarea
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Catatan pelanggan…"
                />
              </Field>

              <div className="rounded-md bg-surface-soft px-4 py-3">
                {(addOnActive || isPisah) && (
                  <>
                    <div className="flex items-center justify-between text-sm text-body">
                      <span>
                        {printLabel} ({printCount})
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatRupiah(printsTotal)}
                      </span>
                    </div>
                    {addOnActive && (
                      <div className="mt-1 flex items-center justify-between text-sm text-body">
                        <span>
                          {addOnLabel} ({addOnQty})
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatRupiah(addOnTotal)}
                        </span>
                      </div>
                    )}
                    <div className="my-2 border-t border-hairline" />
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">Total</span>
                  <span className="font-mono text-xl font-semibold tabular-nums">
                    {formatRupiah(total)}
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={saving}
                disabled={itemCount < 1}
              >
                Simpan Transaksi
              </Button>
              {itemCount < 1 && (
                <p className="text-center text-sm text-muted">
                  Tambah minimal 1 cetak atau add-on untuk menyimpan.
                </p>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      {/* Confirmation card after save */}
      {lastSaved && (
        <Card className="border-up/40 bg-up/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-up" />
              <div className="flex-1">
                <p className="font-semibold text-up">Transaksi tersimpan</p>
                <p className="mt-1 text-sm text-body">
                  {lastSaved.printCount} print
                  {lastSaved.addOnQty > 0 && (
                    <>
                      {" "}
                      + {lastSaved.addOnQty} {addOnLabel}
                    </>
                  )}{" "}
                  · {lastSaved.paymentMethod === "CASH" ? "Tunai" : "QRIS"} ·{" "}
                  <span className="font-mono tabular-nums">
                    {formatRupiah(lastSaved.total)}
                  </span>{" "}
                  · {formatTimeWIB(lastSaved.createdAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Latest 10 transactions, newest first */}
      <Card>
        <CardContent>
          <h2 className="mb-4 text-base font-semibold tracking-display">
            10 Transaksi Terakhir
          </h2>
          {transactions.length === 0 ? (
            <p className="rounded-md border border-dashed border-hairline p-8 text-center text-sm text-muted">
              Belum ada transaksi.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH className="w-10">#</TH>
                  <TH>Waktu</TH>
                  <TH className="text-right">Print</TH>
                  {addOnActive && <TH className="text-right">{addOnLabel}</TH>}
                  <TH>Metode</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Catatan</TH>
                </TR>
              </THead>
              <TBody>
                {transactions.map((t, i) => (
                  <TR key={t.id}>
                    <TD className="text-muted">{i + 1}</TD>
                    <TD className="whitespace-nowrap">
                      {formatTimeWIB(t.createdAt)}
                    </TD>
                    <TD className="text-right font-mono tabular-nums">
                      {t.printCount}
                    </TD>
                    {addOnActive && (
                      <TD className="text-right font-mono tabular-nums">
                        {t.addOnQty || "—"}
                      </TD>
                    )}
                    <TD>
                      <MethodBadge method={t.paymentMethod} />
                    </TD>
                    <TD className="text-right font-mono tabular-nums">
                      {formatRupiah(t.total)}
                    </TD>
                    <TD className="max-w-[160px] truncate text-body">
                      {t.note ?? "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
