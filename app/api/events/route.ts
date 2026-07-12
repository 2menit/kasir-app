import type { NextRequest } from "next/server";
import type { Prisma, EventStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requireUser, requireSuperadmin } from "@/lib/session";
import { createEventSchema } from "@/lib/validations";
import { isoDateWIB, combineWibDateTime } from "@/lib/format";

const STATUSES = ["UPCOMING", "ONGOING", "DONE", "CANCELLED"];

// GET /api/events — list events filtered by role
export const GET = handle(async (req: NextRequest) => {
  const me = await requireUser();
  const { searchParams } = new URL(req.url);

  const where: Prisma.EventWhereInput = {};

  const status = searchParams.get("status");
  if (status && STATUSES.includes(status)) {
    where.status = status as EventStatus;
  }
  const search = searchParams.get("search");
  if (search) where.name = { contains: search, mode: "insensitive" };

  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));
  if (month >= 1 && month <= 12 && year >= 2000) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    where.eventDateStart = { gte: start, lt: end };
  }

  // USER sees only events they are crew on (CON-07 / REQ-U-04).
  if (me.role === "USER") {
    where.crew = { some: { userId: me.id } };
  }

  const isSuperadmin = me.role === "SUPERADMIN";
  const events = await prisma.event.findMany({
    where,
    orderBy: { eventDateStart: "desc" },
    include: {
      transactions: { select: { total: true } },
      _count: { select: { transactions: true, crew: true } },
    },
  });

  const data = events.map((e) => {
    // Revenue is exposed to superadmin only (CON-07).
    const revenue = isSuperadmin
      ? e.transactions.reduce((sum, t) => sum + t.total, 0)
      : undefined;
    return {
      id: e.id,
      name: e.name,
      location: e.location,
      eventDateStart: e.eventDateStart,
      eventDateEnd: e.eventDateEnd,
      startTime: e.startTime,
      endTime: e.endTime,
      pricingType: e.pricingType,
      pricePerPrint: e.pricePerPrint,
      status: e.status,
      transactionCount: e._count.transactions,
      crewCount: e._count.crew,
      ...(revenue !== undefined ? { revenue } : {}),
    };
  });

  return ok(data);
});

// POST /api/events — [superadmin] create event
export const POST = handle(async (req: NextRequest) => {
  await requireSuperadmin();
  const body = createEventSchema.parse(await req.json());

  const dateStr = isoDateWIB(body.eventDateStart);
  const event = await prisma.event.create({
    data: {
      name: body.name,
      location: body.location,
      eventDateStart: body.eventDateStart,
      eventDateEnd: body.eventDateEnd,
      startTime: combineWibDateTime(dateStr, body.startTime),
      endTime: combineWibDateTime(dateStr, body.endTime),
      pricingType: body.pricingType,
      pricePerPrint: body.pricePerPrint,
      copyPrice: body.pricingType === "PISAH" ? (body.copyPrice ?? null) : null,
      addOnEnabled: body.addOnEnabled,
      addOnName: body.addOnEnabled ? (body.addOnName || "Add-on") : null,
      addOnPrice: body.addOnEnabled ? (body.addOnPrice ?? null) : null,
      allowCash: body.allowCash,
      allowQris: body.allowQris,
      status: body.status,
      notes: body.notes || null,
      crew: {
        create: (body.crewIds ?? []).map((userId) => ({ userId })),
      },
    },
  });
  return ok(event, 201);
});
