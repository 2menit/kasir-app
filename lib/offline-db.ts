"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { PaymentMethod } from "@prisma/client";

/**
 * Offline-first transaction queue backed by IndexedDB.
 *
 * When a crew member records a transaction and the server is unreachable,
 * the transaction is saved here first. A sync loop later replays pending
 * items to the server when connectivity is restored.
 *
 * Each queued item carries a `clientTempId` — a UUID generated client-side.
 * The server uses this as an idempotency key: if the same item is replayed
 * multiple times (e.g. the connection dropped right after the server saved
 * but before the client got the 201), the server returns the already-saved
 * row instead of creating a duplicate.
 */

export type SyncStatus = "pending" | "syncing" | "synced" | "error";

export interface QueuedTransaction {
  /** UUID generated client-side; the idempotency key on the server. */
  clientTempId: string;
  /** The server-assigned id once synced (null while pending). */
  serverId: string | null;
  eventId: string;
  printCount: number;
  paymentMethod: PaymentMethod;
  addOnQty: number;
  addOnUnitPrice: number;
  copyOnly: boolean;
  note: string | null;
  /** ISO timestamp captured at the moment of input (WIB-equivalent wall clock). */
  clientCreatedAt: string;
  status: SyncStatus;
  /** Monotonic error count so we can back off / surface persistent failures. */
  attempts: number;
  lastError: string | null;
  /** Epoch ms of the last sync attempt. */
  lastAttemptAt: number | null;
}

const DB_NAME = "photobooth-cashier";
const DB_VERSION = 1;
const STORE_QUEUE = "txn-queue";

interface CashierDB extends DBSchema {
  "txn-queue": {
    key: string; // clientTempId
    value: QueuedTransaction;
    indexes: {
      "by-status": SyncStatus;
      "by-event": string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<CashierDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("offline-db only runs in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB<CashierDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_QUEUE, {
          keyPath: "clientTempId",
        });
        store.createIndex("by-status", "status");
        store.createIndex("by-event", "eventId");
      },
    });
  }
  return dbPromise;
}

/** Generate a v4 UUID without crypto.randomUUID dependency fallback. */
export function generateTempId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback (RFC4122 v4-ish). Good enough for an idempotency key.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Add a new transaction to the queue (status = pending). */
export async function enqueueTransaction(
  tx: Omit<
    QueuedTransaction,
    "status" | "attempts" | "lastError" | "lastAttemptAt" | "serverId"
  >
): Promise<QueuedTransaction> {
  const db = await getDB();
  const record: QueuedTransaction = {
    ...tx,
    serverId: null,
    status: "pending",
    attempts: 0,
    lastError: null,
    lastAttemptAt: null,
  };
  await db.put(STORE_QUEUE, record);
  return record;
}

/** Fetch all queued transactions for an event, newest first. */
export async function getQueueByEvent(
  eventId: string
): Promise<QueuedTransaction[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE_QUEUE, "by-event", eventId);
  return all.sort(
    (a, b) =>
      new Date(b.clientCreatedAt).getTime() -
      new Date(a.clientCreatedAt).getTime()
  );
}

/** Fetch all items still needing sync (pending | syncing | error). */
export async function getPending(): Promise<QueuedTransaction[]> {
  const db = await getDB();
  const statuses: SyncStatus[] = ["pending", "syncing", "error"];
  const results = await Promise.all(
    statuses.map((s) => db.getAllFromIndex(STORE_QUEUE, "by-status", s))
  );
  return results.flat();
}

/** Mark an item as currently being synced. */
export async function markSyncing(clientTempId: string): Promise<void> {
  const db = await getDB();
  const rec = await db.get(STORE_QUEUE, clientTempId);
  if (!rec) return;
  rec.status = "syncing";
  rec.lastAttemptAt = Date.now();
  await db.put(STORE_QUEUE, rec);
}

/** Mark an item as successfully synced with its server-assigned id. */
export async function markSynced(
  clientTempId: string,
  serverId: string
): Promise<void> {
  const db = await getDB();
  const rec = await db.get(STORE_QUEUE, clientTempId);
  if (!rec) return;
  rec.status = "synced";
  rec.serverId = serverId;
  rec.lastError = null;
  await db.put(STORE_QUEUE, rec);
}

/** Record a sync failure and bump the attempt counter. */
export async function markError(
  clientTempId: string,
  error: string
): Promise<void> {
  const db = await getDB();
  const rec = await db.get(STORE_QUEUE, clientTempId);
  if (!rec) return;
  rec.status = "error";
  rec.attempts += 1;
  rec.lastError = error;
  rec.lastAttemptAt = Date.now();
  await db.put(STORE_QUEUE, rec);
}

/** Remove synced items older than `keepMs` (default: 24h) to keep the store small. */
export async function pruneSynced(keepMs = 24 * 60 * 60 * 1000): Promise<void> {
  const db = await getDB();
  const synced = await db.getAllFromIndex(STORE_QUEUE, "by-status", "synced");
  const cutoff = Date.now() - keepMs;
  await Promise.all(
    synced
      .filter((r) => r.lastAttemptAt && r.lastAttemptAt < cutoff)
      .map((r) => db.delete(STORE_QUEUE, r.clientTempId))
  );
}

/** Count items still pending (used by the header badge). */
export async function countPending(): Promise<number> {
  const db = await getDB();
  const statuses: SyncStatus[] = ["pending", "syncing", "error"];
  const counts = await Promise.all(
    statuses.map((s) => db.countFromIndex(STORE_QUEUE, "by-status", s))
  );
  return counts.reduce((a, b) => a + b, 0);
}

/** Remove all queued items (dev/reset only). */
export async function clearQueue(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_QUEUE);
}

/** Get all queued items regardless of status (for debugging/UI). */
export async function getAllQueued(): Promise<QueuedTransaction[]> {
  const db = await getDB();
  return db.getAll(STORE_QUEUE);
}

/** Subscribe to queue changes. Returns an unsubscribe function. */
export function subscribeToQueue(callback: () => void): () => void {
  let active = true;
  const poll = async () => {
    if (!active) return;
    callback();
  };
  // IndexedDB has no native change events. We use a polling + storage-event
  // hybrid: storage events fire cross-tab, polling covers same-tab.
  poll();
  window.addEventListener("storage", poll);
  // Also poll every 2s while subscribed (cheap; counts only).
  const interval = setInterval(poll, 2000);
  return () => {
    active = false;
    window.removeEventListener("storage", poll);
    clearInterval(interval);
  };
}
