import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/kpi-card";
import { EventsBrowser, type EventListItem } from "@/app/superadmin/events/events-browser";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  const events = await prisma.event.findMany({
    where: user.cityId ? { cityId: user.cityId } : {},
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
    cityId: e.cityId,
    revenue: e.transactions.reduce((s, t) => s + t.total, 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event"
        description="Event photobooth cabang Anda."
        action={
          <Link href="/admin/events/create">
            <Button>
              <Plus className="h-4 w-4" /> Buat Event
            </Button>
          </Link>
        }
      />
      {/* No city filter for admin — they only see their own city */}
      <EventsBrowser events={items} />
    </div>
  );
}
