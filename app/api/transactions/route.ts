import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, forbidden, notFound, handle } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { createTransactionSchema } from "@/lib/validations";
import { computeGrandTotal } from "@/lib/pricing";

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

  // USER must be assigned to the event.
  if (me.role === "USER" && !(await isAssigned(body.eventId, me.id))) {
    return forbidden();
  }

  // Add-on snapshot: only if the event has it enabled.
  const addOnUnitPrice = event.addOnEnabled ? (event.addOnPrice ?? 0) : 0;
  const addOnQty = addOnUnitPrice > 0 ? body.addOnQty : 0;

  // CON-03: total computed server-side, never trusted from client.
  const total = computeGrandTotal(event, body.printCount, {
    qty: addOnQty,
    unitPrice: addOnUnitPrice,
  });

  const txn = await prisma.transaction.create({
    data: {
      eventId: body.eventId,
      userId: me.id,
      printCount: body.printCount,
      paymentMethod: body.paymentMethod,
      addOnQty,
      addOnUnitPrice,
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
      total: txn.total,
      note: txn.note,
      crewName: txn.user?.name ?? "",
      userId: txn.userId,
    },
    201
  );
});
