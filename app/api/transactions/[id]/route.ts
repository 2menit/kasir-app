import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, forbidden, notFound, handle } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { updateTransactionSchema } from "@/lib/validations";
import { computeGrandTotal } from "@/lib/pricing";

import { normalizeAddOns } from "@/lib/types";

type Ctx = { params: { id: string } };

// PUT /api/transactions/:id — edit transaction (recomputes total server-side)
export const PUT = handle(async (req: NextRequest, { params }: Ctx) => {
  const me = await requireUser();
  const body = updateTransactionSchema.parse(await req.json());

  const txn = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: { event: true },
  });
  if (!txn) return notFound("Transaksi");

  // USER may only edit their own transaction on an ONGOING event.
  if (me.role === "USER") {
    if (txn.userId !== me.id) return forbidden();
    if (txn.event.status !== "ONGOING") return forbidden();
  }

  // ── Add-on items (multi add-on) ─────────────────────────────────────
  const eventAddOns = normalizeAddOns(txn.event);
  const eventAddOnMap = new Map(eventAddOns.map((a) => [a.name, a.price]));

  const addOnItems = (body.addOnItems ?? [])
    .filter((a) => a.qty > 0)
    .map((a) => ({
      name: a.name,
      qty: a.qty,
      unitPrice: eventAddOnMap.get(a.name) ?? 0,
    }))
    .filter((a) => a.unitPrice > 0);

  // Legacy fallback: ONLY when the client is old (didn't send addOnItems
  // at all — undefined, not an empty array). This prevents accidentally
  // using the first add-on when a new client explicitly sends [] (no
  // add-on selected).
  const legacyQty = txn.event.addOnEnabled ? body.addOnQty : 0;
  const legacyUnitPrice = txn.event.addOnEnabled ? txn.event.addOnPrice ?? 0 : 0;
  if (body.addOnItems === undefined && addOnItems.length === 0 && legacyQty > 0 && legacyUnitPrice > 0) {
    addOnItems.push({
      name: txn.event.addOnName ?? "Add-on",
      qty: legacyQty,
      unitPrice: legacyUnitPrice,
    });
  }

  const totalAddOnQty = addOnItems.reduce((s, a) => s + a.qty, 0);

  if (body.printCount < 1 && totalAddOnQty < 1) {
    return fail("Minimal 1 item (cetak atau add-on)", 400);
  }

  const total = computeGrandTotal(
    txn.event,
    body.printCount,
    addOnItems.map((a) => ({ name: a.name, qty: a.qty, unitPrice: a.unitPrice })),
    { copyOnly: body.copyOnly }
  );

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: {
      printCount: body.printCount,
      paymentMethod: body.paymentMethod,
      addOnQty: totalAddOnQty,
      addOnUnitPrice: legacyUnitPrice,
      addOnItems,
      note: body.note || null,
      total,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return ok({
    id: updated.id,
    createdAt: updated.createdAt,
    printCount: updated.printCount,
    paymentMethod: updated.paymentMethod,
    addOnQty: updated.addOnQty,
    addOnItems: updated.addOnItems,
    total: updated.total,
    note: updated.note,
    crewName: updated.user?.name ?? "(dihapus)",
    userId: updated.userId,
  });
});
