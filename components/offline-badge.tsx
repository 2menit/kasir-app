"use client";

import { CloudOff, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOfflineSync } from "@/lib/use-offline-sync";

/**
 * Global offline sync indicator.
 *
 * Shows:
 * - null (hidden) when online and no pending transactions
 * - "Offline — X transaksi belum tersinkron" (amber) when offline
 * - "Menyinkronkan..." (blue, spinner) when syncing
 * - "X transaksi belum tersinkron" (amber) when online but queue not empty
 *
 * Mounted once in the user layout so it floats over every crew page.
 * Uses useOfflineSync() — the same hook the cashier page uses — so the
 * badge, the queue, and the cashier table all stay in lockstep.
 */
export function OfflineBadge() {
  const { online, pendingCount, syncStatus, syncNow } = useOfflineSync();
  const syncing = syncStatus === "syncing";

  // Hide when everything is fine: online, no pending, not syncing.
  if (online && pendingCount === 0 && !syncing) {
    return null;
  }

  const hasPending = pendingCount > 0;
  const label = syncing
    ? "Menyinkronkan transaksi..."
    : !online
      ? `Offline — ${pendingCount} transaksi belum tersinkron`
      : hasPending
        ? `${pendingCount} transaksi belum tersinkron`
        : "Online";

  return (
    <button
      type="button"
      onClick={syncNow}
      disabled={syncing || (online && pendingCount === 0)}
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg transition-colors",
        "cursor-pointer disabled:cursor-default",
        syncing
          ? "border-blue-300 bg-blue-50 text-blue-700"
          : !online || hasPending
            ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
            : "border-green-300 bg-green-50 text-green-700"
      )}
      title={hasPending || !online ? "Klik untuk sinkronisasi manual" : undefined}
    >
      {syncing ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : !online ? (
        <CloudOff className="h-4 w-4" />
      ) : (
        <Check className="h-4 w-4" />
      )}
      <span className="font-medium">{label}</span>
    </button>
  );
}
