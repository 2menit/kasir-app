import type { NextRequest } from "next/server";
import { fail, forbidden, notFound, handle } from "@/lib/api";
import { requireAdminOrSuperadmin } from "@/lib/session";
import {
  getEventRecap,
  getMonthlyRecap,
  getQuarterlyRecap,
} from "@/lib/recap";
import { buildEventWorkbook, buildPeriodWorkbook } from "@/lib/export";
import { slugify } from "@/lib/utils";
import { isoDateWIB } from "@/lib/format";
import {
  monthlyRecapSchema,
  quarterlyRecapSchema,
} from "@/lib/validations";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function xlsxResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}

// GET /api/recaps/export?type=event&id=...
//                       ?type=monthly&month=&year=
//                       ?type=quarterly&quarter=&year=
export const GET = handle(async (req: NextRequest) => {
  const me = await requireAdminOrSuperadmin();
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type");

  const cityId =
    me.role === "ADMIN"
      ? (me.cityId ?? undefined)
      : (sp.get("city") ?? undefined);

  if (type === "event") {
    const id = sp.get("id");
    if (!id) return fail("Parameter id wajib diisi", 400);
    const recap = await getEventRecap(id);
    if (!recap) return notFound("Event");
    // Admin can only export events in their own city.
    if (me.role === "ADMIN" && recap.event.cityId !== me.cityId) {
      return forbidden();
    }
    const buffer = await buildEventWorkbook(recap);
    const filename = `recap_${slugify(recap.event.name)}_${isoDateWIB(
      recap.event.eventDateStart
    )}.xlsx`;
    return xlsxResponse(buffer, filename);
  }

  if (type === "monthly") {
    const { month, year } = monthlyRecapSchema.parse({
      month: sp.get("month"),
      year: sp.get("year"),
    });
    const recap = await getMonthlyRecap(month, year, cityId);
    const buffer = await buildPeriodWorkbook(recap);
    const filename = `recap_bulan_${year}-${String(month).padStart(2, "0")}.xlsx`;
    return xlsxResponse(buffer, filename);
  }

  if (type === "quarterly") {
    const { quarter, year } = quarterlyRecapSchema.parse({
      quarter: sp.get("quarter"),
      year: sp.get("year"),
    });
    const recap = await getQuarterlyRecap(quarter, year, cityId);
    const buffer = await buildPeriodWorkbook(recap);
    const filename = `recap_kuartal_${year}-Q${quarter}.xlsx`;
    return xlsxResponse(buffer, filename);
  }

  return fail("Tipe ekspor tidak valid", 400);
});
