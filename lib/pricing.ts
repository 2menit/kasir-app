import type { PricingType } from "@prisma/client";

export type PricingInput = {
  pricingType: PricingType;
  pricePerPrint: number;
  copyPrice: number | null;
};

/**
 * Compute a transaction total. A transaction = prints of ONE photo.
 *  - BIASA: every print costs pricePerPrint.
 *  - PISAH: the first print costs pricePerPrint, each same-photo copy costs
 *    copyPrice (falls back to pricePerPrint if copyPrice is missing).
 *
 * Always computed server-side (CON-03); the client mirrors it only for preview.
 *
 * `copyOnly` (PISAH only): charge ALL prints at the copy price — used for
 * reprints/salinan of a photo whose first print was already paid earlier.
 */
export function computeTotal(
  p: PricingInput,
  printCount: number,
  opts?: { copyOnly?: boolean }
): number {
  const count = Math.max(0, Math.floor(printCount));
  if (count === 0) return 0;
  if (p.pricingType === "PISAH") {
    const copy = p.copyPrice ?? p.pricePerPrint;
    if (opts?.copyOnly) return count * copy;
    return p.pricePerPrint + (count - 1) * copy;
  }
  return count * p.pricePerPrint;
}

/** Add-on subtotal = qty × unit price (clamped to ≥ 0). */
export function computeAddOnTotal(qty: number, unitPrice: number): number {
  return Math.max(0, Math.floor(qty)) * Math.max(0, Math.floor(unitPrice));
}

export type AddOnLine = { name: string; qty: number; unitPrice: number };

/** Sum across an array of add-on items. */
export function computeAddOnItemsTotal(items: AddOnLine[]): number {
  return items.reduce((sum, a) => sum + computeAddOnTotal(a.qty, a.unitPrice), 0);
}

/**
 * Prints total + add-on total. Used by the cashier preview and the API.
 *
 * Accepts either a single legacy add-on (`addOn`) or an array of add-on
 * items (`addOnItems`). If both are provided, only `addOnItems` is used
 * (new format takes precedence).
 */
export function computeGrandTotal(
  p: PricingInput,
  printCount: number,
  addOn?: { qty: number; unitPrice: number },
  opts?: { copyOnly?: boolean }
): number;

export function computeGrandTotal(
  p: PricingInput,
  printCount: number,
  addOn?: AddOnLine[],
  opts?: { copyOnly?: boolean }
): number;

export function computeGrandTotal(
  p: PricingInput,
  printCount: number,
  addOn?:
    | { qty: number; unitPrice: number }
    | AddOnLine[],
  opts?: { copyOnly?: boolean }
): number {
  const prints = computeTotal(p, printCount, opts);
  if (!addOn) return prints;
  if (Array.isArray(addOn)) return prints + computeAddOnItemsTotal(addOn);
  return prints + computeAddOnTotal(addOn.qty, addOn.unitPrice);
}

export const pricingLabel: Record<PricingType, string> = {
  BIASA: "Biasa",
  PISAH: "Pisah (cetak + salinan)",
};
