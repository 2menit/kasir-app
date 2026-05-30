import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handle } from "@/lib/api";
import { requireSuperadmin } from "@/lib/session";
import { getYearlyRevenue } from "@/lib/recap";

const schema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

// GET /api/recaps/yearly?year= — [superadmin] 12-month revenue series
export const GET = handle(async (req: NextRequest) => {
  await requireSuperadmin();
  const { year } = schema.parse({
    year: new URL(req.url).searchParams.get("year"),
  });
  return ok(await getYearlyRevenue(year));
});
