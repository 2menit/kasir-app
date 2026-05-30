import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader } from "@/components/kpi-card";
import { EventSections } from "@/components/event-sections";
import type { EventCardData } from "@/components/event-card";

export const dynamic = "force-dynamic";

export default async function UserDashboard() {
  const me = await getCurrentUser();

  const memberships = await prisma.eventCrew.findMany({
    where: { userId: me!.id },
    include: { event: true },
    orderBy: { event: { eventDate: "desc" } },
  });

  const events: EventCardData[] = memberships.map((m) => ({
    id: m.event.id,
    name: m.event.name,
    location: m.event.location,
    eventDate: m.event.eventDate,
    startTime: m.event.startTime,
    endTime: m.event.endTime,
    pricingType: m.event.pricingType,
    status: m.event.status,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Halo, ${me!.name.split(" ")[0]}`}
        description="Event yang ditugaskan kepada Anda."
      />
      <EventSections
        events={events}
        basePath="/user/events"
        ongoingCta="Buka Kasir"
        otherCta="Lihat Detail"
        emptyText="Belum ada event yang ditugaskan kepada Anda."
      />
    </div>
  );
}
