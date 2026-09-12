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
  // Refs to avoid stale-closure issues across re-renders and StrictMode
  // remounts. We keep mutable flags in refs so they survive the
  // mount→unmount→mount cycle that React.StrictMode triggers in dev.
  const refreshCountRef = useRef<() => void>(() => {});
  const runSyncRef = useRef<() => void>(() => {});
  const isSyncingRef = useRef(false);

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
    // Guard against concurrent sync attempts — also prevents a sync storm
    // when both the "online" event and the initial-mount sync fire.
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
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
    } finally {
      isSyncingRef.current = false;
    }
  }, [refreshCount]);

  // Keep refs in sync so event handlers always call the latest versions.
  refreshCountRef.current = refreshCount;
  runSyncRef.current = runSync;

  const syncNow = useCallback(() => {
    void runSyncRef.current();
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshCountRef.current();

    const handleOnline = () => {
      setOnline(true);
      // Sync immediately when connectivity is restored.
      void runSyncRef.current();
    };
    const handleOffline = () => {
      setOnline(false);
      void refreshCountRef.current();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 🔑 Listen for messages from the service worker. When Background Sync
    // fires (tag: "sync-transactions"), the SW broadcasts PROCESS_SYNC_QUEUE
    // to all open tabs — this is the bridge that makes the SW→hook link work.
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PROCESS_SYNC_QUEUE") {
        void runSyncRef.current();
      }
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleMessage);
    }

    // Poll pending count every 5s — catches cross-tab changes & manual
    // enqueueing from the cashier form without extra wiring.
    const interval = window.setInterval(() => {
      void refreshCountRef.current();
    }, 5000);

    // 🔑 Auto-sync on mount when already online — covers the case where the
    // app boots (or reconnects) in an online state with pending items but
    // no `online` event fires. Also handles StrictMode remounts via refs.
    void (async () => {
      const isOnline = navigator.onLine;
      const pending = await countPending().catch(() => 0);
      if (isOnline && pending > 0) {
        void runSyncRef.current();
      }
    })();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleMessage);
      }
      window.clearInterval(interval);
    };
  }, []);

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
