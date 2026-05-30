import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isoDateWIB, timeHHmmWIB } from "@/lib/format";
import { PageHeader } from "@/components/kpi-card";
import { EventForm, type EventFormInitial } from "@/components/forms/event-form";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: { id: string };
}) {
  const [event, crew] = await Promise.all([
    prisma.event.findUnique({
      where: { id: params.id },
      include: { crew: true },
    }),
    prisma.user.findMany({
      where: { role: "USER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!event) notFound();

  const attendance: Record<string, boolean> = {};
  for (const c of event.crew) attendance[c.userId] = c.attended;

  const initial: EventFormInitial = {
    name: event.name,
    location: event.location,
    eventDate: isoDateWIB(event.eventDate),
    startTime: event.startTime ? timeHHmmWIB(event.startTime) : "",
    endTime: event.endTime ? timeHHmmWIB(event.endTime) : "",
    pricingType: event.pricingType,
    pricePerPrint: event.pricePerPrint,
    copyPrice: event.copyPrice ?? 10000,
    status: event.status,
    notes: event.notes ?? "",
    crewIds: event.crew.map((c) => c.userId),
    attendance,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/superadmin/events/${event.id}`}
        className="inline-flex items-center gap-1 text-sm text-body hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke detail event
      </Link>
      <PageHeader title="Edit Event" description={event.name} />
      <EventForm
        mode="edit"
        eventId={event.id}
        crewOptions={crew}
        initial={initial}
      />
    </div>
  );
}
