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
 */
export function computeTotal(p: PricingInput, printCount: number): number {
  const count = Math.max(0, Math.floor(printCount));
  if (count === 0) return 0;
  if (p.pricingType === "PISAH") {
    const copy = p.copyPrice ?? p.pricePerPrint;
    return p.pricePerPrint + (count - 1) * copy;
  }
  return count * p.pricePerPrint;
}

/** Add-on subtotal = qty × unit price (clamped to ≥ 0). */
export function computeAddOnTotal(qty: number, unitPrice: number): number {
  return Math.max(0, Math.floor(qty)) * Math.max(0, Math.floor(unitPrice));
}

/** Prints total + add-on total. Used by the cashier preview and the API. */
export function computeGrandTotal(
  p: PricingInput,
  printCount: number,
  addOn?: { qty: number; unitPrice: number }
): number {
  const prints = computeTotal(p, printCount);
  const addOnTotal = addOn ? computeAddOnTotal(addOn.qty, addOn.unitPrice) : 0;
  return prints + addOnTotal;
}

export const pricingLabel: Record<PricingType, string> = {
  BIASA: "Biasa",
  PISAH: "Pisah (cetak + salinan)",
};
