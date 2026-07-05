import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, notFound, forbidden, handle } from "@/lib/api";
import { requireUser, requireSuperadmin } from "@/lib/session";
import { updateEventSchema } from "@/lib/validations";
import { isoDateWIB, combineWibDateTime } from "@/lib/format";

type Ctx = { params: { id: string } };

// GET /api/events/:id — event detail + crew (+ transactions for superadmin)
export const GET = handle(async (_req: NextRequest, { params }: Ctx) => {
  const me = await requireUser();

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      crew: { include: { user: { select: { id: true, name: true } } } },
      transactions: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        ...(me.role === "USER" ? { take: 10 } : {}),
      },
    },
  });
  if (!event) return notFound("Event");

  // USER may only view events they are assigned to.
  if (me.role === "USER" && !event.crew.some((c) => c.userId === me.id)) {
    return forbidden();
  }

  return ok(event);
});

// PUT /api/events/:id — [superadmin] edit event + crew + attendance
export const PUT = handle(async (req: NextRequest, { params }: Ctx) => {
  await requireSuperadmin();
  const body = updateEventSchema.parse(await req.json());

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { crew: true },
  });
  if (!event) return notFound("Event");

  const desiredCrew = new Set(body.crewIds ?? []);
  const currentCrew = new Set(event.crew.map((c) => c.userId));
  const toAdd = [...desiredCrew].filter((id) => !currentCrew.has(id));
  const toRemove = [...currentCrew].filter((id) => !desiredCrew.has(id));
  const attendance = body.attendance ?? {};

  await prisma.$transaction(async (tx) => {
    const dateStr = isoDateWIB(body.eventDateStart);
    await tx.event.update({
      where: { id: params.id },
      data: {
        name: body.name,
        location: body.location,
        eventDateStart: body.eventDateStart,
        eventDateEnd: body.eventDateEnd,
        startTime: combineWibDateTime(dateStr, body.startTime),
        endTime: combineWibDateTime(dateStr, body.endTime),
        pricingType: body.pricingType,
        pricePerPrint: body.pricePerPrint,
        copyPrice:
          body.pricingType === "PISAH" ? (body.copyPrice ?? null) : null,
        addOnEnabled: body.addOnEnabled,
        addOnName: body.addOnEnabled ? (body.addOnName || "Add-on") : null,
        addOnPrice: body.addOnEnabled ? (body.addOnPrice ?? null) : null,
        status: body.status,
        notes: body.notes || null,
      },
    });

    if (toRemove.length) {
      await tx.eventCrew.deleteMany({
        where: { eventId: params.id, userId: { in: toRemove } },
      });
    }
    for (const userId of toAdd) {
      await tx.eventCrew.create({
        data: {
          eventId: params.id,
          userId,
          attended: attendance[userId] ?? false,
        },
      });
    }
    // Apply attendance updates for kept crew.
    for (const [userId, attended] of Object.entries(attendance)) {
      if (desiredCrew.has(userId) && !toAdd.includes(userId)) {
        await tx.eventCrew.updateMany({
          where: { eventId: params.id, userId },
          data: { attended },
        });
      }
    }
  });

  return ok({ id: params.id });
});

// DELETE /api/events/:id — [superadmin] delete event ONLY if it has no
// transactions (protects financial history; otherwise use CANCELLED status).
export const DELETE = handle(async (_req: NextRequest, { params }: Ctx) => {
  await requireSuperadmin();

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { _count: { select: { transactions: true } } },
  });
  if (!event) return notFound("Event");

  if (event._count.transactions > 0) {
    return fail(
      `Event memiliki ${event._count.transactions} transaksi dan tidak dapat dihapus. Gunakan status "Dibatalkan".`,
      409
    );
  }

  // Crew assignments cascade-delete; no transactions exist to remove.
  await prisma.event.delete({ where: { id: params.id } });
  return ok({ id: params.id });
});
