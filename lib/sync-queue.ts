"use client";

import {
  type QueuedTransaction,
  getPending,
  markSyncing,
  markSynced,
  markError,
} from "./offline-db";
import { apiFetch } from "./client";

/**
 * Sync outcome for a single queued transaction.
 * - "synced"   → server accepted; removed from pending state.
 * - "failed"   → server rejected (validation/business error); not retried.
 * - "retry"    → network/timeout error; will be retried next cycle.
 */
export type SyncOutcome = "synced" | "failed" | "retry";

export type SyncResult = {
  tempId: string;
  outcome: SyncOutcome;
  serverId?: string;
  error?: string;
};

export type BatchSyncResult = {
  results: SyncResult[];
  syncedCount: number;
  failedCount: number;
  retryCount: number;
  /** Items that need retry — used by the UI to show "X transaksi gagar". */
  retryItems: SyncResult[];
};

// Module-level guard so multiple hook instances / the service worker can't
// run processQueue() concurrently (avoids duplicate requests).
let syncing = false;

/**
 * Process the pending queue: send all pending transactions to the server in
 * a single batch request. The batch endpoint is idempotent via clientTempId
 * — safe to retry even if part of a previous batch already landed.
 *
 * - success → markSynced (store serverId).
 * - 4xx     → markError (validation/business rejection — don't retry).
 * - 5xx/network → leave as pending/error, try next cycle.
 *
 * Returns a summary of outcomes. UI can subscribe to drive badges/toasts.
 */
export async function processQueue(): Promise<BatchSyncResult> {
  if (syncing) {
    return { results: [], syncedCount: 0, failedCount: 0, retryCount: 0, retryItems: [] };
  }
  syncing = true;

  try {
    const pending = await getPending();

    const results: SyncResult[] = [];
    let syncedCount = 0;
    let failedCount = 0;
    let retryCount = 0;

    if (pending.length === 0) {
      return { results, syncedCount, failedCount, retryCount, retryItems: [] };
    }

    // Mark all as syncing so the UI can show a "syncing..." state.
    await Promise.all(pending.map((tx) => markSyncing(tx.clientTempId)));

    // Build the batch payload. Shape must match POST /api/transactions/batch.
    const payload = pending.map((tx) => ({
      clientTempId: tx.clientTempId,
      eventId: tx.eventId,
      printCount: tx.printCount,
      paymentMethod: tx.paymentMethod,
      copyOnly: tx.copyOnly,
      addOnQty: tx.addOnQty,
      addOnUnitPrice: tx.addOnUnitPrice,
      note: tx.note ?? "",
      // Preserve original client-side timestamp so the server sees when the
      // crew actually made the sale (during the offline period), not when
      // sync happened. Server may override if invalid.
      clientCreatedAt: tx.clientCreatedAt,
    }));

    const res = await apiFetch<{
      results: Array<{
        clientTempId: string;
        status: "created" | "exists" | "error";
        transaction?: {
          id: string;
          createdAt: string;
          printCount: number;
          paymentMethod: string;
          addOnQty: number;
          total: number;
          note: string | null;
          crewName: string;
        };
        error?: string;
      }>;
    }>("/api/transactions/batch", {
      method: "POST",
      body: JSON.stringify({ items: payload }),
    });

    if (!res.success) {
      // Whole batch failed at the transport level — retry everything next cycle.
      for (const tx of pending) {
        await markError(tx.clientTempId, res.error);
        const r: SyncResult = {
          tempId: tx.clientTempId,
          outcome: "retry",
          error: res.error,
        };
        results.push(r);
        retryCount++;
      }
      return { results, syncedCount, failedCount, retryCount, retryItems: results };
    }

    // Process per-item results from the batch response.
    const byTempId = new Map(
      res.data.results.map((r) => [r.clientTempId, r] as const)
    );

    for (const tx of pending) {
      const item = byTempId.get(tx.clientTempId);
      if (!item) {
        // Server didn't return a result for this item — treat as retry.
        await markError(tx.clientTempId, "Server tidak merespons item ini");
        results.push({
          tempId: tx.clientTempId,
          outcome: "retry",
          error: "Server tidak merespons item ini",
        });
        retryCount++;
        continue;
      }

      if (item.status === "error") {
        // Validation/business error — don't retry, keep as error so the
        // crew/superadmin can see what went wrong.
        await markError(tx.clientTempId, item.error ?? "Error tidak diketahui");
        results.push({
          tempId: tx.clientTempId,
          outcome: "failed",
          error: item.error,
        });
        failedCount++;
      } else {
        // "created" or "exists" — both mean the transaction is safely in the DB.
        const serverId = item.transaction?.id ?? "";
        await markSynced(tx.clientTempId, serverId);
        results.push({
          tempId: tx.clientTempId,
          outcome: "synced",
          serverId,
        });
        syncedCount++;
      }
    }

    const retryItems = results.filter((r) => r.outcome === "retry");
    return {
      results,
      syncedCount,
      failedCount,
      retryCount,
      retryItems,
    };
  } finally {
    syncing = false;
  }
}

/**
 * Try to send a single transaction immediately. If it succeeds, returns the
 * server record. If the network fails, returns null — caller should enqueue
 * it to IndexedDB for later retry.
 */
export async function syncOne(
  tx: QueuedTransaction
): Promise<{ serverId: string; createdAt: string } | null> {
  const res = await apiFetch<{
    id: string;
    createdAt: string;
  }>("/api/transactions", {
    method: "POST",
    body: JSON.stringify({
      clientTempId: tx.clientTempId,
      eventId: tx.eventId,
      printCount: tx.printCount,
      paymentMethod: tx.paymentMethod,
      copyOnly: tx.copyOnly,
      addOnQty: tx.addOnQty,
      addOnUnitPrice: tx.addOnUnitPrice,
      note: tx.note ?? "",
      clientCreatedAt: tx.clientCreatedAt,
    }),
  });

  if (!res.success) return null;
  return { serverId: res.data.id, createdAt: res.data.createdAt };
}

export type { QueuedTransaction };
