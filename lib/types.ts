import type { Prisma } from "@prisma/client";

// ── Add-on type definitions (multi add-on support) ─────────────────────────

/** A single add-on definition stored in Event.addOns JSON array. */
export type AddOnItem = {
  name: string;
  price: number;
};

/** Alias used by the event form (UI-facing name). */
export type AddOnRow = AddOnItem;

/** A snapshot of an add-on sold in a transaction (addOnItems JSON array). */
export type TxnAddOnItem = {
  name: string;
  qty: number;
  unitPrice: number;
};

/**
 * Shape of an event-like object accepted by `normalizeAddOns`.
 */
export type AddOnSource =
  | unknown // raw `addOns` JSON value (array | null)
  | {
      addOns?: unknown;
      addOnEnabled?: boolean;
      addOnName?: string | null;
      addOnPrice?: number | null;
    };

/**
 * Normalize the raw Prisma JSON value into a typed AddOnItem[] array.
 *
 * Accepts EITHER form, so both call styles work:
 *   • `normalizeAddOns(event.addOns)` — raw JSON value from the Event row.
 *   • `normalizeAddOns(event)`        — the whole event object (reads
 *     `.addOns` / `.addOnEnabled` / `.addOnName` / `.addOnPrice` off it).
 *
 * Handles three cases:
 *  1. New multi add-on: `addOns` is a non-null JSON array → return as-is.
 *  2. Legacy single add-on: `addOns` is null but `addOnEnabled=true` and
 *     `addOnName`/`addOnPrice` exist → migrate on-the-fly to `[{name, price}]`.
 *  3. No add-on: return `[]`.
 *
 * This lets the rest of the app always work with an array, regardless of
 * whether the event was created before or after the multi add-on migration.
 */
export function normalizeAddOns(
  source: AddOnSource,
  legacyArg?: {
    addOnEnabled?: boolean;
    addOnName?: string | null;
    addOnPrice?: number | null;
  }
): AddOnItem[] {
  let raw: unknown = source;
  let legacy = legacyArg;

  // Event-like object? (has at least one of the known keys, and isn't an array)
  if (source != null && typeof source === "object" && !Array.isArray(source)) {
    const ev = source as {
      addOns?: unknown;
      addOnEnabled?: boolean;
      addOnName?: string | null;
      addOnPrice?: number | null;
    };
    if (
      "addOns" in ev ||
      "addOnEnabled" in ev ||
      "addOnName" in ev ||
      "addOnPrice" in ev
    ) {
      raw = ev.addOns ?? null;
      // Explicit legacy arg wins; otherwise fall back to the event's own fields.
      legacy = {
        addOnEnabled: legacy?.addOnEnabled ?? ev.addOnEnabled,
        addOnName: legacy?.addOnName ?? ev.addOnName ?? null,
        addOnPrice: legacy?.addOnPrice ?? ev.addOnPrice ?? null,
      };
    }
  }

  // Case 1 — new field: JSON array.
  if (raw != null && Array.isArray(raw)) {
    return (raw as AddOnItem[]).filter(
      (a): a is AddOnItem =>
        a != null && typeof a.name === "string" && typeof a.price === "number"
    );
  }

  // Case 2 — legacy single add-on: migrate on-the-fly.
  if (legacy?.addOnEnabled && legacy.addOnName && legacy.addOnPrice != null) {
    return [{ name: legacy.addOnName, price: legacy.addOnPrice }];
  }

  // Case 3 — none.
  return [];
}

/**
 * Normalize raw transaction JSON `addOnItems` into a typed array.
 *
 * Handles two cases:
 *  1. New multi add-on: `addOnItems` is a non-null JSON array → return as-is.
 *  2. Legacy single add-on: `addOnItems` is null but `addOnQty > 0` and
 *     `addOnUnitPrice > 0` → migrate on-the-fly to
 *     `[{name: "(add-on)", qty: addOnQty, unitPrice: addOnUnitPrice}]`.
 *  3. No add-on: return `[]`.
 *
 * `fallbackName` is used as the add-on name for legacy transactions where
 * the name was not snapshot (since the old schema didn't store it per-tx).
 */
export function normalizeTxnAddOns(
  tx: {
    addOnItems: Prisma.JsonValue | null;
    addOnQty?: number;
    addOnUnitPrice?: number;
  },
  fallbackName = "Add-on"
): TxnAddOnItem[] {
  // New field: JSON array
  if (tx.addOnItems != null) {
    const raw = tx.addOnItems as unknown;
    if (Array.isArray(raw)) {
      return (raw as TxnAddOnItem[]).filter(
        (a): a is TxnAddOnItem =>
          a != null &&
          typeof a.name === "string" &&
          typeof a.qty === "number" &&
          typeof a.unitPrice === "number"
      );
    }
  }
  // Legacy single add-on: migrate on-the-fly
  const qty = tx.addOnQty ?? 0;
  const unitPrice = tx.addOnUnitPrice ?? 0;
  if (qty > 0 && unitPrice > 0) {
    return [{ name: fallbackName, qty, unitPrice }];
  }
  return [];
}
