import type { EventStatus, PaymentMethod, PricingType } from "@prisma/client";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { JAKARTA_TZ } from "@/lib/format";

export type EventRecap = {
  event: {
    id: string;
    name: string;
    location: string;
    eventDate: Date;
    startTime: Date | null;
    endTime: Date | null;
    pricingType: PricingType;
    pricePerPrint: number;
    copyPrice: number | null;
    addOnEnabled: boolean;
    addOnName: string | null;
    addOnPrice: number | null;
    status: EventStatus;
    notes: string | null;
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
      eventDate: event.eventDate,
      startTime: event.startTime,
      endTime: event.endTime,
      pricingType: event.pricingType,
      pricePerPrint: event.pricePerPrint,
      copyPrice: event.copyPrice,
      addOnEnabled: event.addOnEnabled,
      addOnName: event.addOnName,
      addOnPrice: event.addOnPrice,
      status: event.status,
      notes: event.notes,
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
      name: c.user.name,
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
  eventDate: Date;
  location: string;
  pricingType: PricingType;
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

async function buildPeriodRecap(
  label: string,
  start: Date,
  end: Date
): Promise<PeriodRecap> {
  const events = await prisma.event.findMany({
    // Cancelled events are excluded from all financial aggregations.
    where: { eventDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
    include: { transactions: true },
    orderBy: { eventDate: "asc" },
  });

  const rows: PeriodRecapRow[] = events.map((e) => {
    let totalPrints = 0;
    let totalRevenue = 0;
    let cashRevenue = 0;
    let qrisRevenue = 0;
    let addOnRevenue = 0;
    for (const t of e.transactions) {
      totalPrints += t.printCount;
      totalRevenue += t.total;
      if (t.paymentMethod === "CASH") cashRevenue += t.total;
      else qrisRevenue += t.total;
      addOnRevenue += t.addOnQty * t.addOnUnitPrice;
    }
    return {
      id: e.id,
      name: e.name,
      eventDate: e.eventDate,
      location: e.location,
      pricingType: e.pricingType,
      transactionCount: e.transactions.length,
      totalPrints,
      totalRevenue,
      cashRevenue,
      qrisRevenue,
      addOnRevenue,
    };
  });

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
  year: number
): Promise<PeriodRecap> {
  const { start, end } = monthRangeUtc(month, year);
  const { monthLabel } = await import("@/lib/format");
  return buildPeriodRecap(`${monthLabel(month)} ${year}`, start, end);
}

/** Quarterly recap (FR-RECAP-3): Q1=Jan-Mar ... Q4=Oct-Dec. */
export async function getQuarterlyRecap(
  quarter: number,
  year: number
): Promise<PeriodRecap> {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const { start } = monthRangeUtc(startMonth, year);
  const { end } = monthRangeUtc(endMonth, year);
  return buildPeriodRecap(`Q${quarter} ${year}`, start, end);
}

export type MonthlyDashboard = {
  totalPrints: number;
  totalRevenue: number;
  eventCount: number;
  crewCount: number; // distinct crew assigned to that month's events
};

/** Month-scoped KPIs for the superadmin dashboard. */
export async function getMonthlyDashboard(
  month: number,
  year: number
): Promise<MonthlyDashboard> {
  const { start, end } = monthRangeUtc(month, year);
  const events = await prisma.event.findMany({
    // Cancelled events are excluded from all financial aggregations.
    where: { eventDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
    include: {
      transactions: { select: { total: true, printCount: true } },
      crew: { select: { userId: true } },
    },
  });

  let totalPrints = 0;
  let totalRevenue = 0;
  const crewIds = new Set<string>();
  for (const e of events) {
    for (const t of e.transactions) {
      totalPrints += t.printCount;
      totalRevenue += t.total;
    }
    for (const c of e.crew) crewIds.add(c.userId);
  }

  return {
    totalPrints,
    totalRevenue,
    eventCount: events.length,
    crewCount: crewIds.size,
  };
}

export type MonthlyRevenuePoint = {
  month: number; // 1-12
  revenue: number;
  transactionCount: number;
};

/** 12-month revenue series for a year — feeds the rekap bar chart. */
export async function getYearlyRevenue(
  year: number
): Promise<MonthlyRevenuePoint[]> {
  const { start } = monthRangeUtc(1, year);
  const { end } = monthRangeUtc(12, year);
  const events = await prisma.event.findMany({
    // Cancelled events are excluded from all financial aggregations.
    where: { eventDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
    select: {
      eventDate: true,
      transactions: { select: { total: true } },
    },
  });

  const series: MonthlyRevenuePoint[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    revenue: 0,
    transactionCount: 0,
  }));

  for (const e of events) {
    // Group by WIB month of the event date.
    const wibMonth = Number(
      formatInTimeZone(e.eventDate, JAKARTA_TZ, "M")
    );
    const point = series[wibMonth - 1];
    if (point) {
      for (const t of e.transactions) {
        point.revenue += t.total;
        point.transactionCount += 1;
      }
    }
  }

  return series;
}
