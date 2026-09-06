"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { countPending, clearQueue, getAllQueued } from "@/lib/offline-db";
import { processQueue, type BatchSyncResult } from "@/lib/sync-queue";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

export type OfflineSyncState = {
  online: boolean;
  pendingCount: number;
  syncStatus: SyncStatus;
  lastSyncAt: Date | null;
  lastError: string | null;
  /** Trigger a sync attempt now (manual button). Returns whether it started. */
  syncNow: () => void;
};

/**
 * useOfflineSync — tracks online/offline status, pending transaction count,
 * and exposes a manual `syncNow()`. Automatically syncs when connectivity is
 * restored.
 *
 * Usage (inside a single root client component near the top of the tree):
 *   const { online, pendingCount, syncNow } = useOfflineSync();
 *
 * Because this hook touches IndexedDB and navigator, it must run client-side.
 * It is safe to mount multiple instances — the queue is single-writer via a
 * module-level `syncing` guard in sync-queue.ts.
 */
export function useOfflineSync(): OfflineSyncState {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Refresh pending count from IndexedDB.
  const refreshCount = useCallback(async () => {
    try {
      const n = await countPending();
      setPendingCount(n);
    } catch {
      // IndexedDB might be unavailable (rare); ignore quietly.
    }
  }, []);

  // Run a sync attempt and update state accordingly.
  const runSync = useCallback(async () => {
    setSyncStatus("syncing");
    setLastError(null);
    try {
      const result: BatchSyncResult = await processQueue();
      await refreshCount();
      setLastSyncAt(new Date());
      if (result.retryCount > 0) {
        setSyncStatus("error");
        setLastError(
          `${result.retryCount} transaksi gagar sync; akan di-retry otomatis`
        );
      } else if (result.failedCount > 0) {
        setSyncStatus("error");
        setLastError(
          `${result.failedCount} transaksi ditolak server (cek data)`
        );
      } else {
        setSyncStatus("success");
      }
    } catch (err) {
      setSyncStatus("error");
      setLastError(err instanceof Error ? err.message : "Sync gagal");
    }
  }, [refreshCount]);

  const syncNow = useCallback(() => {
    void runSync();
  }, [runSync]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    setOnline(navigator.onLine);
    void refreshCount();

    const handleOnline = () => {
      setOnline(true);
      void runSync();
    };
    const handleOffline = () => {
      setOnline(false);
      void refreshCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Poll pending count every 5s — catches cross-tab changes & manual
    // enqueueing from the cashier form without extra wiring.
    const interval = window.setInterval(refreshCount, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(interval);
    };
  }, [refreshCount, runSync]);

  return {
    online,
    pendingCount,
    syncStatus,
    lastSyncAt,
    lastError,
    syncNow,
  };
}

// Re-export for components that need to wipe the queue (dev only)
export { clearQueue, getAllQueued };
