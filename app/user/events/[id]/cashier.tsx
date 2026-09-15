"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Minus, Plus, Check, CircleCheck, CloudOff, RefreshCw, Cloud } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { MethodBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { apiFetch } from "@/lib/client";
import { formatRupiah, formatTimeWIB } from "@/lib/format";
import { computeTotal, computeAddOnTotal, computeGrandTotal, type AddOnLine } from "@/lib/pricing";
import { normalizeAddOns, type AddOnRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { PricingType } from "@prisma/client";
import { useOfflineSync } from "@/lib/use-offline-sync";
import {
  enqueueTransaction,
  getQueueByEvent,
  generateTempId,
  type QueuedTransaction,
} from "@/lib/offline-db";

export type TxnView = {
  id: string;
  createdAt: string;
  printCount: number;
  paymentMethod: PaymentMethod;
  addOnQty: number;
  /** Per-add-on items snapshot (name + qty + unitPrice) for multi add-on display. */
  addOnItems?: { name: string; qty: number; unitPrice: number }[];
  total: number;
  note: string | null;
  crewName: string;
  /** "synced" = sudah masuk server; "pending" = masih di IndexedDB belum tersinkron */
  syncStatus?: "synced" | "pending";
};

export function Cashier({
  eventId,
  pricingType,
  pricePerPrint,
  copyPrice,
  addOns: rawAddOns,
  allowCash,
  allowQris,
  isOngoing,
  canEditAttendance,
  initialAttended,
  initialTransactions,
}: {
  eventId: string;
  pricingType: PricingType;
  pricePerPrint: number;
  copyPrice: number | null;
  /** Multi add-on list from the event (normalized for backward compat). */
  addOns: AddOnRow[] | null;
  allowCash: boolean;
  allowQris: boolean;
  isOngoing: boolean;
  canEditAttendance: boolean;
  initialAttended: boolean;
  initialTransactions: TxnView[];
}) {
  // Mark initial server-fetched transactions as synced.
  const [transactions, setTransactions] = useState<TxnView[]>(
    initialTransactions.map((t) => ({ ...t, syncStatus: "synced" as const }))
  );
  const [printCount, setPrintCount] = useState(1);
  // Qty per add-on row (index-aligned with addOns).
  const [addOnQtys, setAddOnQtys] = useState<number[]>([]);
  const [copyOnly, setCopyOnly] = useState(false);
  const availableMethods: PaymentMethod[] = [
    ...(allowCash ? ["CASH" as PaymentMethod] : []),
    ...(allowQris ? ["QRIS" as PaymentMethod] : []),
  ];
  const [method, setMethod] = useState<PaymentMethod>(availableMethods[0] ?? "CASH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<TxnView | null>(null);

  const [attended, setAttended] = useState(initialAttended);
  const [togglingAttendance, setTogglingAttendance] = useState(false);

  // Normalize add-ons (handles legacy single add-on rows from old events).
  const addOns = normalizeAddOns(rawAddOns);
  const isPisah = pricingType === "PISAH";

  // Keep the per-row qty array in sync with the addOns list length.
  useEffect(() => {
    setAddOnQtys((prev) => {
      const next = Array.from({ length: addOns.length }, (_, i) => prev[i] ?? 0);
      return next;
    });
  }, [addOns.length]);

  const printsTotal = computeTotal(
    { pricingType, pricePerPrint, copyPrice },
    printCount,
    { copyOnly }
  );

  // Build the active add-on lines (name + qty + unitPrice) for pricing.
  const addOnLines: AddOnLine[] = addOns
    .map((a, i) => ({ name: a.name, qty: addOnQtys[i] ?? 0, unitPrice: a.price }))
    .filter((a) => a.qty > 0);
  const addOnTotal = addOnLines.reduce(
    (sum, a) => sum + computeAddOnTotal(a.qty, a.unitPrice),
    0
  );
  const total = printsTotal + addOnTotal;
  // A transaction needs at least one item (a print or an add-on).
  const itemCount = printCount + addOnLines.reduce((s, a) => s + a.qty, 0);
  const printLabel = copyOnly ? "Salinan" : "Cetak";

  // ── Offline sync hook ────────────────────────────────────────────────
  // Monitors online/offline, processes the IndexedDB queue when connection
  // returns, and exposes a manual sync trigger + pending count.
  const { online, syncStatus, pendingCount, syncNow } = useOfflineSync();
  const isOnline = online;
  const isSyncing = syncStatus === "syncing";

  // When a sync completes, flip pending rows to synced in the visible list.
  // The sync hook calls processQueue() → markSynced() in IndexedDB; we just
  // mirror the status in the React state for immediate visual feedback.
  const prevSyncStatus = useRef(syncStatus);
  useEffect(() => {
    if (prevSyncStatus.current === "syncing" && syncStatus === "success") {
      setTransactions((prev) =>
        prev.map((t) =>
          t.syncStatus === "pending"
            ? { ...t, syncStatus: "synced" as const }
            : t
        )
      );
      toast.success("Transaksi berhasil tersinkron");
    }
    if (prevSyncStatus.current === "syncing" && syncStatus === "error") {
      toast.error("Beberapa transaksi gagal terkirim, akan dicoba lagi");
    }
    prevSyncStatus.current = syncStatus;
  }, [syncStatus]);

  // ── Load pending transactions from IndexedDB on mount ────────────────
  // Merges them with server-fetched transactions so the crew sees their
  // queued work immediately, even after a page refresh while offline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pending = await getQueueByEvent(eventId);
        if (cancelled || pending.length === 0) return;
        const pendingViews: TxnView[] = pending
          .filter((p) => p.status !== "synced")
          .map((p) => {
            // Re-compute the total client-side for preview only.
            // The server re-computes on sync (CON-03).
            const previewTotal = computeGrandTotal(
              { pricingType, pricePerPrint, copyPrice },
              p.printCount,
              (p.addOnItems ?? []).map((a) => ({
                name: a.name,
                qty: a.qty,
                unitPrice: a.unitPrice,
              })),
              { copyOnly: p.copyOnly }
            );
            return {
              id: p.clientTempId,
              createdAt: p.clientCreatedAt,
              printCount: p.printCount,
              paymentMethod: p.paymentMethod,
              addOnQty: (p.addOnItems ?? []).reduce((s, a) => s + a.qty, 0),
              total: previewTotal,
              note: p.note,
              crewName: "Saya",
              syncStatus: "pending" as const,
            };
          });
        // Prepend pending txns; keep the 10-newest window (REQ-U-02).
        setTransactions((prev) => [...pendingViews, ...prev].slice(0, 10));
      } catch {
        // IndexedDB might be unavailable (private mode) — silently ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

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

    // ── Offline-first: always write to IndexedDB first ────────────────
    // Compute the total on the client (preview). The server re-computes
    // the total on sync (CON-03) — this client value is only for the badge.
    const clientTotal = computeGrandTotal(
      { pricingType, pricePerPrint, copyPrice },
      printCount,
      addOnLines,
      { copyOnly: isPisah ? copyOnly : false }
    );

    const clientTempId = generateTempId();
    const clientCreatedAt = new Date().toISOString();

    // Build the add-on items payload (snapshot name + qty + unitPrice).
    const addOnItems = addOnLines.map((a) => ({
      name: a.name,
      qty: a.qty,
      unitPrice: a.unitPrice,
    }));

    // enqueueTransaction expects Omit<QueuedTransaction, "status" | "attempts" |
    // "lastError" | "lastAttemptAt" | "serverId"> — i.e. just the payload fields.
    const draft = {
      clientTempId,
      eventId,
      printCount,
      paymentMethod: method,
      addOnQty: addOnLines.reduce((s, a) => s + a.qty, 0),
      addOnUnitPrice: 0,
      addOnItems,
      copyOnly: isPisah ? copyOnly : false,
      note: note || null,
      clientCreatedAt,
    };

    try {
      await enqueueTransaction(draft);
    } catch {
      // If IndexedDB fails (private mode, quota), fall back to direct API
      // call so we don't block the crew.
      setSaving(false);
      const res = await apiFetch<TxnView>("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          eventId,
          printCount,
          paymentMethod: method,
          addOnItems,
          copyOnly: isPisah ? copyOnly : false,
          note,
        }),
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setTransactions((prev) =>
        [{ ...res.data, syncStatus: "synced" as const }, ...prev].slice(0, 10)
      );
      setLastSaved({ ...res.data, syncStatus: "synced" });
      resetForm();
      toast.success("Transaksi tersimpan");
      return;
    }

    // Transaction is safely in IndexedDB. Show it immediately with pending badge.
    const pendingView: TxnView = {
      id: clientTempId,
      createdAt: clientCreatedAt,
      printCount,
      paymentMethod: method,
      addOnQty: addOnLines.reduce((s, a) => s + a.qty, 0),
      addOnItems,
      total: clientTotal,
      note: note || null,
      crewName: "Saya",
      syncStatus: "pending",
    };
    setTransactions((prev) => [pendingView, ...prev].slice(0, 10));
    setLastSaved(pendingView);
    setSaving(false);

    resetForm();

    // If online, immediately attempt sync so the badge flips to "synced"
    // without waiting for the next online event / interval.
    if (isOnline) {
      toast.success("Transaksi tersimpan (menyinkron…)");
      void syncNow();
    } else {
      toast.success("Transaksi tersimpan (akan tersinkron saat online)");
    }
  }

  function resetForm() {
    setPrintCount(1);
    setAddOnQtys(Array.from({ length: addOns.length }, () => 0));
    setCopyOnly(false);
    setNote("");
    setMethod(availableMethods[0] ?? "CASH");
  }

  // Helper to update qty for a specific add-on row.
  function setAddOnQty(index: number, value: number) {
    setAddOnQtys((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Offline / sync status banner */}
      {(pendingCount > 0 || !isOnline) && (
        <Card
          className={
            !isOnline
              ? "border-warn/40 bg-warn/5"
              : "border-primary/30 bg-primary/5"
          }
        >
          <CardContent className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-2">
              {!isOnline ? (
                <CloudOff className="h-5 w-5 shrink-0 text-warn" />
              ) : isSyncing ? (
                <RefreshCw className="h-5 w-5 shrink-0 animate-spin text-primary" />
              ) : (
                <Cloud className="h-5 w-5 shrink-0 text-primary" />
              )}
              <p className="text-sm font-medium text-ink">
                {!isOnline
                  ? `Mode offline — ${pendingCount} transaksi menunggu sinkronisasi`
                  : isSyncing
                    ? "Sedang menyinkronkan transaksi…"
                    : pendingCount > 0
                      ? `${pendingCount} transaksi menunggu sinkronisasi`
                      : "Semua transaksi tersinkron"}
              </p>
            </div>
            {isOnline && pendingCount > 0 && !isSyncing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void syncNow()}
              >
                <RefreshCw className="h-4 w-4" /> Sinkronkan
              </Button>
            )}
          </CardContent>
        </Card>
      )}

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
                  addOns.length > 0
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

              {addOns.length > 0 && (
                <div className="space-y-3">
                  {addOns.map((a, i) => {
                    const qty = addOnQtys[i] ?? 0;
                    return (
                      <Field
                        key={i}
                        label={a.name}
                        hint={`Add-on · ${formatRupiah(a.price)} / item`}
                      >
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            className="aspect-square px-0"
                            onClick={() =>
                              setAddOnQty(i, Math.max(0, qty - 1))
                            }
                            aria-label={`Kurangi ${a.name}`}
                          >
                            <Minus className="h-5 w-5" />
                          </Button>
                          <Input
                            type="number"
                            min={0}
                            max={999}
                            value={qty}
                            onChange={(e) =>
                              setAddOnQty(
                                i,
                                Math.max(
                                  0,
                                  Math.min(999, Number(e.target.value) || 0)
                                )
                              )
                            }
                            className="h-14 w-24 text-center text-xl font-semibold"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            className="aspect-square px-0"
                            onClick={() =>
                              setAddOnQty(i, Math.min(999, qty + 1))
                            }
                            aria-label={`Tambah ${a.name}`}
                          >
                            <Plus className="h-5 w-5" />
                          </Button>
                        </div>
                      </Field>
                    );
                  })}
                </div>
              )}

              <Field label="Metode Pembayaran" required>
                <div className={cn("grid gap-3", availableMethods.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                  {availableMethods.map((m) => (
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
                {(addOnLines.length > 0 || isPisah) && (
                  <>
                    <div className="flex items-center justify-between text-sm text-body">
                      <span>
                        {printLabel} ({printCount})
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatRupiah(printsTotal)}
                      </span>
                    </div>
                    {addOnLines.map((a, i) => (
                      <div
                        key={i}
                        className="mt-1 flex items-center justify-between text-sm text-body"
                      >
                        <span>
                          {a.name} ({a.qty})
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatRupiah(computeAddOnTotal(a.qty, a.unitPrice))}
                        </span>
                      </div>
                    ))}
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
                <p className="font-semibold text-up">
                  {lastSaved.syncStatus === "pending"
                    ? "Transaksi tersimpan (menunggu sinkronisasi)"
                    : "Transaksi tersimpan"}
                </p>
                <p className="mt-1 text-sm text-body">
                  {lastSaved.printCount} print
                  {lastSaved.addOnQty > 0 && (
                    <>
                      {" "}
                      + {lastSaved.addOnQty} add-on
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
                  {addOns.length > 0 && <TH className="text-right">Add-on</TH>}
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
                    {addOns.length > 0 && (
                      <TD className="text-right font-mono tabular-nums">
                        {t.addOnItems && t.addOnItems.length > 0
                          ? t.addOnItems.map((a, j) => (
                              <div key={j}>
                                {a.qty} {a.name}
                              </div>
                            ))
                          : t.addOnQty > 0
                            ? t.addOnQty
                            : "—"}
                      </TD>
                    )}
                    <TD>
                      <div className="flex items-center gap-2">
                        <MethodBadge method={t.paymentMethod} />
                        {t.syncStatus === "pending" && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-xs font-medium text-warn"
                            title="Belum tersinkron ke server"
                          >
                            <CloudOff className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                      </div>
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
