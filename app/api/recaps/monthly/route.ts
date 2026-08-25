import type { NextRequest } from "next/server";
import { ok, handle } from "@/lib/api";
import { requireAdminOrSuperadmin } from "@/lib/session";
import { getMonthlyRecap, getQuarterlyRecap } from "@/lib/recap";
import { monthlyRecapSchema, quarterlyRecapSchema } from "@/lib/validations";

// GET /api/recaps/monthly?month=&year=  OR  ?quarter=&year=  [&city= for superadmin]
// [admin, superadmin] period recap (monthly or quarterly)
export const GET = handle(async (req: NextRequest) => {
  const me = await requireAdminOrSuperadmin();
  const sp = new URL(req.url).searchParams;

  // Admin is always scoped to their city; superadmin can optionally filter
  const cityId =
    me.role === "ADMIN"
      ? (me.cityId ?? undefined)
      : (sp.get("city") ?? undefined);

  if (sp.get("quarter")) {
    const { quarter, year } = quarterlyRecapSchema.parse({
      quarter: sp.get("quarter"),
      year: sp.get("year"),
    });
    return ok(await getQuarterlyRecap(quarter, year, cityId));
  }

  const { month, year } = monthlyRecapSchema.parse({
    month: sp.get("month"),
    year: sp.get("year"),
  });
  return ok(await getMonthlyRecap(month, year, cityId));
});
