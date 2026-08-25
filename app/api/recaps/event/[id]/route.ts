import type { NextRequest } from "next/server";
import { ok, forbidden, notFound, handle } from "@/lib/api";
import { requireAdminOrSuperadmin } from "@/lib/session";
import { getEventRecap } from "@/lib/recap";

type Ctx = { params: { id: string } };

// GET /api/recaps/event/:id — [admin, superadmin] per-event recap
// Admin is scoped to their own city; the recap's event.cityId is checked.
export const GET = handle(async (_req: NextRequest, { params }: Ctx) => {
  const me = await requireAdminOrSuperadmin();
  const recap = await getEventRecap(params.id);
  if (!recap) return notFound("Event");

  // Admin can only view recaps for events in their own city.
  if (me.role === "ADMIN" && recap.event.cityId !== me.cityId) {
    return forbidden();
  }

  return ok(recap);
});
