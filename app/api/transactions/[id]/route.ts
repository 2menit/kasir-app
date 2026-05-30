import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, forbidden, notFound, handle } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { updateTransactionSchema } from "@/lib/validations";
import { computeTotal } from "@/lib/pricing";

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

  const total = computeTotal(txn.event, body.printCount);

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: {
      printCount: body.printCount,
      paymentMethod: body.paymentMethod,
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
    total: updated.total,
    note: updated.note,
    crewName: updated.user?.name ?? "(dihapus)",
    userId: updated.userId,
  });
});
