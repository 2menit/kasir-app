import type { EventStatus, PaymentMethod, PricingType, Prisma } from "@prisma/client";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { JAKARTA_TZ } from "@/lib/format";

export type EventRecap = {
  event: {
    id: string;
    name: string;
    location: string;
    eventDateStart: Date;
    eventDateEnd: Date;
    startTime: Date | null;
    endTime: Date | null;
    pricingType: PricingType;
    pricePerPrint: number;
    copyPrice: number | null;
    addOnEnabled: boolean;
    addOnName: string | null;
    addOnPrice: number | null;
    allowCash: boolean;
    allowQris: boolean;
    splitEnabled: boolean;
    splitKitaPercent: number;
    splitPanitiaPercent: number;
    status: EventStatus;
    notes: string | null;
    cityId: string | null;
    cityName: string | null;
  };
  totals: {
    transactionCount: number;
    totalPrints: number;
    totalRevenue: number;
    cashRevenue: number;
    qrisRevenue: number;
    addOnQty: number;
    addOnRevenue: number;
    crewCount: number;
    crewAttended: number;
  };
  crew: { id: string; name: string; attended: boolean }[];
  transactions: {
    id: string;
    createdAt: Date;
    crewName: string;
    printCount: number;
    paymentMethod: PaymentMethod;
    addOnQty: number;
    total: number;
    note: string | null;
  }[];
};

/** Full recap for a single event (FR-RECAP-1). */
export async function getEventRecap(eventId: string): Promise<EventRecap | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      crew: { include: { user: true } },
      transactions: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
      },
      city: { select: { name: true } },
    },
  });
  if (!event) return null;

  let totalPrints = 0;
  let totalRevenue = 0;
  let cashRevenue = 0;
  let qrisRevenue = 0;
  let addOnQty = 0;
  let addOnRevenue = 0;

  for (const t of event.transactions) {
    totalPrints += t.printCount;
    totalRevenue += t.total;
    if (t.paymentMethod === "CASH") cashRevenue += t.total;
    else qrisRevenue += t.total;
    addOnQty += t.addOnQty;
    addOnRevenue += t.addOnQty * t.addOnUnitPrice;
  }

  return {
    event: {
      id: event.id,
      name: event.name,
      location: event.location,
      eventDateStart: event.eventDateStart,
      eventDateEnd: event.eventDateEnd,
      startTime: event.startTime,
      endTime: event.endTime,
      pricingType: event.pricingType,
      pricePerPrint: event.pricePerPrint,
      copyPrice: event.copyPrice,
      addOnEnabled: event.addOnEnabled,
      addOnName: event.addOnName,
      addOnPrice: event.addOnPrice,
      allowCash: event.allowCash,
      allowQris: event.allowQris,
      splitEnabled: event.splitEnabled,
      splitKitaPercent: event.splitKitaPercent,
      splitPanitiaPercent: event.splitPanitiaPercent,
      status: event.status,
      notes: event.notes,
      cityId: event.cityId,
      cityName: event.city?.name ?? null,
    },
    totals: {
      transactionCount: event.transactions.length,
      totalPrints,
      totalRevenue,
      cashRevenue,
      qrisRevenue,
      addOnQty,
      addOnRevenue,
      crewCount: event.crew.length,
      crewAttended: event.crew.filter((c) => c.attended).length,
    },
    crew: event.crew.map((c) => ({
      id: c.userId,
      name: c.user?.name ?? "(dihapus)",
      attended: c.attended,
    })),
    transactions: event.transactions.map((t) => ({
      id: t.id,
      createdAt: t.createdAt,
      crewName: t.user?.name ?? "(dihapus)",
      printCount: t.printCount,
      paymentMethod: t.paymentMethod,
      addOnQty: t.addOnQty,
      total: t.total,
      note: t.note,
    })),
  };
}

export type PeriodRecapRow = {
  id: string;
  name: string;
  eventDateStart: Date;
  location: string;
  pricingType: PricingType;
  cityId: string | null;
  cityName: string | null;
  transactionCount: number;
  totalPrints: number;
  totalRevenue: number;
  cashRevenue: number;
  qrisRevenue: number;
  addOnRevenue: number;
};

export type PeriodRecap = {
  label: string;
  range: { start: Date; end: Date };
  rows: PeriodRecapRow[];
  totals: {
    eventCount: number;
    transactionCount: number;
    totalPrints: number;
    totalRevenue: number;
    cashRevenue: number;
    qrisRevenue: number;
    addOnRevenue: number;
  };
};

/** UTC range [start, end) for a WIB month. */
export function monthRangeUtc(month: number, year: number) {
  const start = fromZonedTime(
    `${year}-${String(month).padStart(2, "0")}-01T00:00:00`,
    JAKARTA_TZ
  );
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = fromZonedTime(
    `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00`,
    JAKARTA_TZ
  );
  return { start, end };
}

/**
 * Build a period recap using TRANSACTION-BASED logic.
 *
 * Key difference from the old event-based approach: the period filter is
 * applied to `transaction.createdAt` (when the sale actually happened), NOT
 * to `event.eventDateStart`. This means an event that spans two months
 * (e.g. starts Jan 30, ends Feb 2) will have its January transactions counted
 * in the January recap and its February transactions in the February recap.
 *
 * Cancelled events are still excluded — their transactions are filtered out
 * via the `event.status != CANCELLED` join condition.
 */
async function buildPeriodRecap(
  label: string,
  start: Date,
  end: Date,
  cityId?: string
): Promise<PeriodRecap> {
  // Fetch transactions whose createdAt falls in [start, end), excluding
  // transactions on cancelled events. City scope applied via the event
  // relation.
  const eventWhere: Prisma.EventWhereInput = {
    status: { not: "CANCELLED" },
    ...(cityId ? { cityId } : {}),
  };

  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      event: { is: eventWhere },
    },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          location: true,
          eventDateStart: true,
          pricingType: true,
          cityId: true,
          city: { select: { name: true } },
          status: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group transactions by event id to produce one row per event.
  const byEvent = new Map<string, PeriodRecapRow & { _txCount: number }>();
  for (const t of transactions) {
    const e = t.event;
    let row = byEvent.get(e.id);
    if (!row) {
      row = {
        id: e.id,
        name: e.name,
        eventDateStart: e.eventDateStart,
        location: e.location,
        pricingType: e.pricingType,
        cityId: e.cityId,
        cityName: e.city?.name ?? null,
        transactionCount: 0,
        totalPrints: 0,
        totalRevenue: 0,
        cashRevenue: 0,
        qrisRevenue: 0,
        addOnRevenue: 0,
        _txCount: 0,
      };
      byEvent.set(e.id, row);
    }
    row.transactionCount += 1;
    row.totalPrints += t.printCount;
    row.totalRevenue += t.total;
    if (t.paymentMethod === "CASH") row.cashRevenue += t.total;
    else row.qrisRevenue += t.total;
    row.addOnRevenue += t.addOnQty * t.addOnUnitPrice;
  }

  // Sort rows by eventDateStart asc, then by name for stable ordering.
  const rows: PeriodRecapRow[] = Array.from(byEvent.values())
    .sort((a, b) => a.eventDateStart.getTime() - b.eventDateStart.getTime())
    .map(({ _txCount, ...rest }) => rest);

  const totals = rows.reduce(
    (acc, r) => ({
      eventCount: acc.eventCount + 1,
      transactionCount: acc.transactionCount + r.transactionCount,
      totalPrints: acc.totalPrints + r.totalPrints,
      totalRevenue: acc.totalRevenue + r.totalRevenue,
      cashRevenue: acc.cashRevenue + r.cashRevenue,
      qrisRevenue: acc.qrisRevenue + r.qrisRevenue,
      addOnRevenue: acc.addOnRevenue + r.addOnRevenue,
    }),
    {
      eventCount: 0,
      transactionCount: 0,
      totalPrints: 0,
      totalRevenue: 0,
      cashRevenue: 0,
      qrisRevenue: 0,
      addOnRevenue: 0,
    }
  );

  return { label, range: { start, end }, rows, totals };
}

/** Monthly recap (FR-RECAP-2). */
export async function getMonthlyRecap(
  month: number,
  year: number,
  cityId?: string
): Promise<PeriodRecap> {
  const { start, end } = monthRangeUtc(month, year);
  const { monthLabel } = await import("@/lib/format");
  return buildPeriodRecap(`${monthLabel(month)} ${year}`, start, end, cityId);
}

/** Quarterly recap (FR-RECAP-3): Q1=Jan-Mar ... Q4=Oct-Dec. */
export async function getQuarterlyRecap(
  quarter: number,
  year: number,
  cityId?: string
): Promise<PeriodRecap> {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const { start } = monthRangeUtc(startMonth, year);
  const { end } = monthRangeUtc(endMonth, year);
  return buildPeriodRecap(`Q${quarter} ${year}`, start, end, cityId);
}

export type MonthlyDashboard = {
  totalPrints: number;
  totalRevenue: number;
  eventCount: number;
  crewCount: number; // distinct crew assigned to that month's events
};

/** Month-scoped KPIs for the dashboard. Scoped to cityId if provided. */
export async function getMonthlyDashboard(
  month: number,
  year: number,
  cityId?: string
): Promise<MonthlyDashboard> {
  const { start, end } = monthRangeUtc(month, year);

  // TRANSACTION-BASED: count transactions created in this WIB month, on
  // non-cancelled events in the given city (if any).
  const eventWhere: Prisma.EventWhereInput = {
    status: { not: "CANCELLED" },
    ...(cityId ? { cityId } : {}),
  };

  const [agg, eventCountAgg, crewAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        createdAt: { gte: start, lt: end },
        event: { is: eventWhere },
      },
      _sum: { total: true, printCount: true },
      _count: true,
    }),
    prisma.event.findMany({
      where: {
        eventDateStart: { gte: start, lt: end },
        ...eventWhere,
      },
      select: { id: true },
    }),
    prisma.eventCrew.findMany({
      where: {
        event: {
          eventDateStart: { gte: start, lt: end },
          ...eventWhere,
        },
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  return {
    totalPrints: agg._sum.printCount ?? 0,
    totalRevenue: agg._sum.total ?? 0,
    eventCount: eventCountAgg.length,
    crewCount: crewAgg.length,
  };
}

export type MonthlyRevenuePoint = {
  month: number; // 1-12
  revenue: number;
  transactionCount: number;
};

/** 12-month revenue series for a year — feeds the rekap bar chart. Scoped to cityId if provided. */
export async function getYearlyRevenue(
  year: number,
  cityId?: string
): Promise<MonthlyRevenuePoint[]> {
  const { start } = monthRangeUtc(1, year);
  const { end } = monthRangeUtc(12, year);

  // TRANSACTION-BASED: group all transactions in the year by the WIB month of
  // their createdAt. Cancelled events excluded via the join condition.
  const eventWhere: Prisma.EventWhereInput = {
    status: { not: "CANCELLED" },
    ...(cityId ? { cityId } : {}),
  };

  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      event: { is: eventWhere },
    },
    select: { createdAt: true, total: true },
  });

  const series: MonthlyRevenuePoint[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    revenue: 0,
    transactionCount: 0,
  }));

  for (const t of transactions) {
    // Group by WIB month of the transaction's createdAt — NOT the event date.
    const wibMonth = Number(formatInTimeZone(t.createdAt, JAKARTA_TZ, "M"));
    const point = series[wibMonth - 1];
    if (point) {
      point.revenue += t.total;
      point.transactionCount += 1;
    }
  }

  return series;
}
