import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, forbidden, notFound, handle } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { createTransactionSchema } from "@/lib/validations";
import { computeGrandTotal } from "@/lib/pricing";
import { normalizeAddOns } from "@/lib/types";

const USER_LIMIT = 10;

async function isAssigned(eventId: string, userId: string) {
  const m = await prisma.eventCrew.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  return !!m;
}

// GET /api/transactions?eventId=... — list
//  - USER: hard limit of 10, newest first (REQ-U-02), own events only
//  - SUPERADMIN: all transactions for the event
export const GET = handle(async (req: NextRequest) => {
  const me = await requireUser();
  const eventId = new URL(req.url).searchParams.get("eventId");
  if (!eventId) return fail("eventId wajib diisi", 400);

  if (me.role === "USER" && !(await isAssigned(eventId, me.id))) {
    return forbidden();
  }

  const transactions = await prisma.transaction.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    take: me.role === "USER" ? USER_LIMIT : undefined,
    include: { user: { select: { id: true, name: true } } },
  });

  return ok(
    transactions.map((t) => ({
      id: t.id,
      createdAt: t.createdAt,
      printCount: t.printCount,
      paymentMethod: t.paymentMethod,
      addOnQty: t.addOnQty,
      addOnItems: t.addOnItems,
      total: t.total,
      note: t.note,
      crewName: t.user?.name ?? "(dihapus)",
      userId: t.userId,
    }))
  );
});

// POST /api/transactions — create (server computes total)
export const POST = handle(async (req: NextRequest) => {
  const me = await requireUser();
  const body = createTransactionSchema.parse(await req.json());

  const event = await prisma.event.findUnique({
    where: { id: body.eventId },
  });
  if (!event) return notFound("Event");

  // Only ONGOING events accept transactions (SRS alt-flow B).
  if (event.status !== "ONGOING") {
    return fail("Transaksi hanya bisa dilakukan saat event berlangsung", 403);
  }

  // Validate the chosen payment method is allowed for this event.
  if (body.paymentMethod === "CASH" && !event.allowCash) {
    return fail("Metode pembayaran Tunai tidak tersedia untuk event ini", 400);
  }
  if (body.paymentMethod === "QRIS" && !event.allowQris) {
    return fail("Metode pembayaran QRIS tidak tersedia untuk event ini", 400);
  }

  // USER must be assigned to the event.
  if (me.role === "USER" && !(await isAssigned(body.eventId, me.id))) {
    return forbidden();
  }

  // ── Add-on items (multi add-on) ─────────────────────────────────────
  // The event defines the valid add-on {name, price} pairs. We only accept
  // items that match the event's config; unknown names are dropped.
  // For each accepted item, the server snapshots the unit price from the
  // event (defense-in-depth: never trust client-sent prices).
  const eventAddOns = normalizeAddOns(event);
  const eventAddOnMap = new Map(eventAddOns.map((a) => [a.name, a.price]));

  const addOnItems = (body.addOnItems ?? [])
    .filter((a) => a.qty > 0)
    .map((a) => ({
      name: a.name,
      qty: a.qty,
      unitPrice: eventAddOnMap.get(a.name) ?? 0,
    }))
    .filter((a) => a.unitPrice > 0); // drop items with unknown name or 0 price

  // Legacy single add-on fallback: if the client sent addOnQty (old client)
  // Legacy fallback: ONLY when the client is old (didn't send addOnItems
  // at all — undefined, not an empty array). This prevents accidentally
  // using the first add-on when a new client explicitly sends [] (no
  // add-on selected).
  const legacyQty = event.addOnEnabled ? body.addOnQty : 0;
  const legacyUnitPrice = event.addOnEnabled ? event.addOnPrice ?? 0 : 0;
  if (body.addOnItems === undefined && addOnItems.length === 0 && legacyQty > 0 && legacyUnitPrice > 0) {
    addOnItems.push({
      name: event.addOnName ?? "Add-on",
      qty: legacyQty,
      unitPrice: legacyUnitPrice,
    });
  }

  const totalAddOnQty = addOnItems.reduce((s, a) => s + a.qty, 0);

  // Defense-in-depth: a transaction must have at least one real item.
  if (body.printCount < 1 && totalAddOnQty < 1) {
    return fail("Minimal 1 item (cetak atau add-on)", 400);
  }

  // CON-03: total computed server-side, never trusted from client.
  const total = computeGrandTotal(
    event,
    body.printCount,
    addOnItems.map((a) => ({ name: a.name, qty: a.qty, unitPrice: a.unitPrice })),
    { copyOnly: body.copyOnly }
  );

  const txn = await prisma.transaction.create({
    data: {
      eventId: body.eventId,
      userId: me.id,
      printCount: body.printCount,
      paymentMethod: body.paymentMethod,
      // Legacy fields (for backward compat with old readers/reports).
      addOnQty: totalAddOnQty,
      addOnUnitPrice: legacyUnitPrice,
      // New multi add-on field.
      addOnItems,
      total,
      note: body.note || null,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return ok(
    {
      id: txn.id,
      createdAt: txn.createdAt,
      printCount: txn.printCount,
      paymentMethod: txn.paymentMethod,
      addOnQty: txn.addOnQty,
      addOnItems: txn.addOnItems,
      total: txn.total,
      note: txn.note,
      crewName: txn.user?.name ?? "",
      userId: txn.userId,
    },
    201
  );
});
