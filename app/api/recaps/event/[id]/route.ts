import type { NextRequest } from "next/server";
import { ok, notFound, handle } from "@/lib/api";
import { requireSuperadmin } from "@/lib/session";
import { getEventRecap } from "@/lib/recap";

type Ctx = { params: { id: string } };

// GET /api/recaps/event/:id — [superadmin] per-event recap
export const GET = handle(async (_req: NextRequest, { params }: Ctx) => {
  await requireSuperadmin();
  const recap = await getEventRecap(params.id);
  if (!recap) return notFound("Event");
  return ok(recap);
});
