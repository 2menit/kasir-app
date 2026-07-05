import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/kpi-card";
import { EventsBrowser, type EventListItem } from "./events-browser";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await prisma.event.findMany({
    orderBy: { eventDateStart: "desc" },
    include: { transactions: { select: { total: true } } },
  });

  const items: EventListItem[] = events.map((e) => ({
    id: e.id,
    name: e.name,
    location: e.location,
    eventDateStart: e.eventDateStart.toISOString(),
    eventDateEnd: e.eventDateEnd.toISOString(),
    startTime: e.startTime?.toISOString() ?? null,
    endTime: e.endTime?.toISOString() ?? null,
    pricingType: e.pricingType,
    status: e.status,
    revenue: e.transactions.reduce((s, t) => s + t.total, 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event"
        description="Semua event photobooth."
        action={
          <Link href="/superadmin/events/create">
            <Button>
              <Plus className="h-4 w-4" /> Buat Event
            </Button>
          </Link>
        }
      />
      <EventsBrowser events={items} />
    </div>
  );
}
