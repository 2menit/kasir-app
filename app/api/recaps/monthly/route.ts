import type { NextRequest } from "next/server";
import { ok, handle } from "@/lib/api";
import { requireSuperadmin } from "@/lib/session";
import { getMonthlyRecap, getQuarterlyRecap } from "@/lib/recap";
import { monthlyRecapSchema, quarterlyRecapSchema } from "@/lib/validations";

// GET /api/recaps/monthly?month=&year=  OR  ?quarter=&year=
// [superadmin] period recap (monthly or quarterly)
export const GET = handle(async (req: NextRequest) => {
  await requireSuperadmin();
  const sp = new URL(req.url).searchParams;

  if (sp.get("quarter")) {
    const { quarter, year } = quarterlyRecapSchema.parse({
      quarter: sp.get("quarter"),
      year: sp.get("year"),
    });
    return ok(await getQuarterlyRecap(quarter, year));
  }

  const { month, year } = monthlyRecapSchema.parse({
    month: sp.get("month"),
    year: sp.get("year"),
  });
  return ok(await getMonthlyRecap(month, year));
});
