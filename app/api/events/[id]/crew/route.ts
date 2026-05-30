import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, forbidden, notFound, handle } from "@/lib/api";
import { requireUser } from "@/lib/session";

type Ctx = { params: { id: string } };

const superadminSchema = z.object({
  attendance: z.record(z.string(), z.boolean()),
});
const selfSchema = z.object({ attended: z.boolean() });

// PUT /api/events/:id/crew — update crew attendance
//  - superadmin: bulk attendance map (FR-CREW-2)
//  - user: own attendance only (REQ-U-03 / FR-CREW-1)
export const PUT = handle(async (req: NextRequest, { params }: Ctx) => {
  const me = await requireUser();
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return notFound("Event");

  const json = await req.json();

  if (me.role === "SUPERADMIN") {
    const { attendance } = superadminSchema.parse(json);
    for (const [userId, attended] of Object.entries(attendance)) {
      await prisma.eventCrew.updateMany({
        where: { eventId: params.id, userId },
        data: { attended },
      });
    }
    return ok({ updated: Object.keys(attendance).length });
  }

  // USER: may only toggle their own attendance, and only if assigned.
  const { attended } = selfSchema.parse(json);

  // Attendance is locked once the event is over (DONE/CANCELLED).
  if (event.status === "DONE" || event.status === "CANCELLED") {
    return fail(
      "Kehadiran tidak dapat diubah untuk event yang sudah selesai",
      403
    );
  }

  const membership = await prisma.eventCrew.findUnique({
    where: { eventId_userId: { eventId: params.id, userId: me.id } },
  });
  if (!membership) return forbidden();

  await prisma.eventCrew.update({
    where: { id: membership.id },
    data: { attended },
  });
  return ok({ attended });
});
