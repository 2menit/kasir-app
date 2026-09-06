import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, forbidden, notFound, handle } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { computeGrandTotal } from "@/lib/pricing";
import { z } from "zod";
import type { PricingType, PaymentMethod } from "@prisma/client";

async function isAssigned(eventId: string, userId: string) {
  const m = await prisma.eventCrew.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  return !!m;
}

// Shape of one item in the batch payload. Mirrors createTransactionSchema
// plus `clientTempId` (the idempotency key) and optional `clientCreatedAt`.
const batchItemSchema = z.object({
  clientTempId: z.string().min(1),
  eventId: z.string().min(1),
  printCount: z.coerce.number().int().min(0),
  paymentMethod: z.enum(["CASH", "QRIS"]),
  copyOnly: z.boolean().optional().default(false),
  addOnQty: z.coerce.number().int().min(0).optional().default(0),
  addOnUnitPrice: z.coerce.number().int().min(0).optional().default(0),
  note: z.string().optional().nullable(),
  clientCreatedAt: z.string().optional(), // ISO string
});

const batchSchema = z.object({
  transactions: z.array(batchItemSchema).min(1).max(200),
});

type BatchItem = z.infer<typeof batchItemSchema>;

type BatchResultItem = {
  clientTempId: string;
  status: "created" | "exists" | "error";
  transaction?: {
    id: string;
    createdAt: string;
    printCount: number;
    paymentMethod: PaymentMethod;
    addOnQty: number;
    total: number;
    note: string | null;
    crewName: string;
    userId: string | null;
  };
  error?: string;
};

// POST /api/transactions/batch — idempotent bulk sync dari offline queue.
// Setiap item wajib membawa `clientTempId` (UUID v4 dari browser). Jika
// `clientTempId` sudah pernah diproses, item di-skip (return existing).
export const POST = handle(async (req: NextRequest) => {
  const me = await requireUser();

  const parsed = batchSchema.safeParse(await req.json());
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Input tidak valid";
    return fail(first, 400);
  }

  const { transactions: items } = parsed.data;

  // Cache event lookup biar gak N+1 query kalau banyak transaksi di event yang sama.
  const eventCache = new Map<
    string,
    | {
        kind: "ok";
        event: {
          id: string;
          status: string;
          allowCash: boolean;
          allowQris: boolean;
          pricingType: PricingType;
          pricePerPrint: number;
          copyPrice: number | null;
          addOnEnabled: boolean;
          addOnName: string | null;
          addOnPrice: number | null;
        };
      }
    | { kind: "notfound" }
    | { kind: "forbidden" }
  >();

  async function getEvent(eventId: string) {
    if (eventCache.has(eventId)) return eventCache.get(eventId)!;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      const r = { kind: "notfound" } as const;
      eventCache.set(eventId, r);
      return r;
    }
    // USER must be assigned to the event.
    if (me.role === "USER" && !(await isAssigned(eventId, me.id))) {
      const r = { kind: "forbidden" } as const;
      eventCache.set(eventId, r);
      return r;
    }
    const r = { kind: "ok", event } as const;
    eventCache.set(eventId, r);
    return r;
  }

  // Pre-fetch existing clientTempIds in one query so we can skip duplicates
  // without a round-trip per item.
  const tempIds = items.map((i) => i.clientTempId);
  const existing = await prisma.transaction.findMany({
    where: { clientTempId: { in: tempIds } },
    select: {
      id: true,
      clientTempId: true,
      createdAt: true,
      printCount: true,
      paymentMethod: true,
      addOnQty: true,
      total: true,
      note: true,
      userId: true,
      user: { select: { name: true } },
    },
  });
  const existingMap = new Map(existing.map((e) => [e.clientTempId, e]));

  const results: BatchResultItem[] = [];

  for (const item of items) {
    // Idempotency check: already synced before?
    const prev = existingMap.get(item.clientTempId);
    if (prev) {
      results.push({
        clientTempId: item.clientTempId,
        status: "exists",
        transaction: {
          id: prev.id,
          createdAt: prev.createdAt.toISOString(),
          printCount: prev.printCount,
          paymentMethod: prev.paymentMethod,
          addOnQty: prev.addOnQty,
          total: prev.total,
          note: prev.note,
          crewName: prev.user?.name ?? "(dihapus)",
          userId: prev.userId,
        },
      });
      continue;
    }

    const ev = await getEvent(item.eventId);
    if (ev.kind === "notfound") {
      results.push({
        clientTempId: item.clientTempId,
        status: "error",
        error: "Event tidak ditemukan",
      });
      continue;
    }
    if (ev.kind === "forbidden") {
      results.push({
        clientTempId: item.clientTempId,
        status: "error",
        error: "Akses ditolak",
      });
      continue;
    }

    const event = ev.event;
    if (event.status !== "ONGOING") {
      results.push({
        clientTempId: item.clientTempId,
        status: "error",
        error: "Transaksi hanya bisa dilakukan saat event berlangsung",
      });
      continue;
    }
    if (item.paymentMethod === "CASH" && !event.allowCash) {
      results.push({
        clientTempId: item.clientTempId,
        status: "error",
        error: "Metode pembayaran Tunai tidak tersedia untuk event ini",
      });
      continue;
    }
    if (item.paymentMethod === "QRIS" && !event.allowQris) {
      results.push({
        clientTempId: item.clientTempId,
        status: "error",
        error: "Metode pembayaran QRIS tidak tersedia untuk event ini",
      });
      continue;
    }

    // Server is the source of truth for total (CON-03).
    const addOnQty = event.addOnEnabled ? item.addOnQty : 0;
    const addOnUnitPrice = event.addOnEnabled ? event.addOnPrice ?? 0 : 0;

    const total = computeGrandTotal(
      {
        pricingType: event.pricingType,
        pricePerPrint: event.pricePerPrint,
        copyPrice: event.copyPrice,
      },
      item.printCount,
      { qty: addOnQty, unitPrice: addOnUnitPrice },
      { copyOnly: item.copyOnly }
    );

    // Use clientCreatedAt if provided (offline transactions keep their
    // original wall-clock time). Fall back to now otherwise.
    const createdAt = item.clientCreatedAt
      ? new Date(item.clientCreatedAt)
      : undefined;

    try {
      const txn = await prisma.transaction.create({
        data: {
          clientTempId: item.clientTempId,
          eventId: item.eventId,
          userId: me.id,
          printCount: item.printCount,
          paymentMethod: item.paymentMethod,
          addOnQty,
          addOnUnitPrice,
          total,
          note: item.note ?? null,
          ...(createdAt ? { createdAt } : {}),
        },
        include: { user: { select: { id: true, name: true } } },
      });

      results.push({
        clientTempId: item.clientTempId,
        status: "created",
        transaction: {
          id: txn.id,
          createdAt: txn.createdAt.toISOString(),
          printCount: txn.printCount,
          paymentMethod: txn.paymentMethod,
          addOnQty: txn.addOnQty,
          total: txn.total,
          note: txn.note,
          crewName: txn.user?.name ?? me.name,
          userId: txn.userId,
        },
      });
    } catch (err) {
      // Race condition: another request inserted the same clientTempId
      // between our findMany and create. Re-fetch and treat as "exists".
      const fallback = await prisma.transaction.findUnique({
        where: { clientTempId: item.clientTempId },
        include: { user: { select: { name: true } } },
      });
      if (fallback) {
        results.push({
          clientTempId: item.clientTempId,
          status: "exists",
          transaction: {
            id: fallback.id,
            createdAt: fallback.createdAt.toISOString(),
            printCount: fallback.printCount,
            paymentMethod: fallback.paymentMethod,
            addOnQty: fallback.addOnQty,
            total: fallback.total,
            note: fallback.note,
            crewName: fallback.user?.name ?? "(dihapus)",
            userId: fallback.userId,
          },
        });
      } else {
        results.push({
          clientTempId: item.clientTempId,
          status: "error",
          error: err instanceof Error ? err.message : "Gagal menyimpan transaksi",
        });
      }
    }
  }

  return ok({ results }, 201);
});
