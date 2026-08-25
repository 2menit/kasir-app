import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handle } from "@/lib/api";
import { requireAdminOrSuperadmin } from "@/lib/session";
import { getYearlyRevenue } from "@/lib/recap";

const schema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

// GET /api/recaps/yearly?year= [&city= for superadmin]
// [admin, superadmin] 12-month revenue series
export const GET = handle(async (req: NextRequest) => {
  const me = await requireAdminOrSuperadmin();
  const sp = new URL(req.url).searchParams;
  const { year } = schema.parse({ year: sp.get("year") });

  const cityId =
    me.role === "ADMIN"
      ? (me.cityId ?? undefined)
      : (sp.get("city") ?? undefined);

  return ok(await getYearlyRevenue(year, cityId));
});
