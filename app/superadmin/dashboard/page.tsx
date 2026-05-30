import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getMonthlyDashboard } from "@/lib/recap";
import { formatRupiah, formatNumber, monthLabel } from "@/lib/format";
import { KpiCard, PageHeader } from "@/components/kpi-card";
import { MonthPicker } from "@/components/month-picker";
import { EventSections } from "@/components/event-sections";
import { Button } from "@/components/ui/button";
import type { EventCardData } from "@/components/event-card";

export const dynamic = "force-dynamic";

export default async function SuperadminDashboard({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const now = new Date();
  const month = clampMonth(Number(searchParams.month), now.getMonth() + 1);
  const year = clampYear(Number(searchParams.year), now.getFullYear());

  // Month-scoped KPIs + operational event list (grouped by status, all-time).
  const [kpis, ongoingUpcoming, recentDone] = await Promise.all([
    getMonthlyDashboard(month, year),
    prisma.event.findMany({
      where: { status: { in: ["ONGOING", "UPCOMING"] } },
      orderBy: { eventDate: "asc" },
      include: { transactions: { select: { total: true } } },
    }),
    prisma.event.findMany({
      where: { status: { in: ["DONE", "CANCELLED"] } },
      orderBy: { eventDate: "desc" },
      take: 6,
      include: { transactions: { select: { total: true } } },
    }),
  ]);

  const toCard = (e: (typeof ongoingUpcoming)[number]): EventCardData => ({
    id: e.id,
    name: e.name,
    location: e.location,
    eventDate: e.eventDate,
    startTime: e.startTime,
    endTime: e.endTime,
    pricingType: e.pricingType,
    status: e.status,
    revenue: e.transactions.reduce((s, t) => s + t.total, 0),
  });
  const events = [...ongoingUpcoming, ...recentDone].map(toCard);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Ringkasan operasional dan keuangan photobooth."
        action={
          <Link href="/superadmin/events/create">
            <Button>
              <Plus className="h-4 w-4" /> Buat Event
            </Button>
          </Link>
        }
      />

      {/* Month-scoped KPIs */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Ringkasan {monthLabel(month)} {year}
          </h2>
          <MonthPicker month={month} year={year} />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Total Pendapatan" value={formatRupiah(kpis.totalRevenue)} />
          <KpiCard label="Total Print" value={formatNumber(kpis.totalPrints)} />
          <KpiCard label="Event" value={formatNumber(kpis.eventCount)} />
          <KpiCard label="Jumlah Crew" value={formatNumber(kpis.crewCount)} />
        </div>
      </section>

      {/* Operational events, grouped */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-display">Event</h2>
          <Link
            href="/superadmin/events"
            className="text-sm font-medium text-primary hover:underline"
          >
            Lihat semua
          </Link>
        </div>
        <EventSections
          events={events}
          basePath="/superadmin/events"
          emptyText="Belum ada event. Buat event pertama Anda."
        />
      </section>
    </div>
  );
}

function clampMonth(v: number, fallback: number) {
  return Number.isInteger(v) && v >= 1 && v <= 12 ? v : fallback;
}
function clampYear(v: number, fallback: number) {
  return Number.isInteger(v) && v >= 2000 && v <= 2100 ? v : fallback;
}
