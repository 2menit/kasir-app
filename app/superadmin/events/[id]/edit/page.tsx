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
  const [event, crew, cities] = await Promise.all([
    prisma.event.findUnique({
      where: { id: params.id },
      include: { crew: true },
    }),
    prisma.user.findMany({
      where: { role: "USER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.city.findMany({
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
    eventDateStart: isoDateWIB(event.eventDateStart),
    eventDateEnd: isoDateWIB(event.eventDateEnd),
    startTime: event.startTime ? timeHHmmWIB(event.startTime) : "",
    endTime: event.endTime ? timeHHmmWIB(event.endTime) : "",
    pricingType: event.pricingType,
    pricePerPrint: event.pricePerPrint,
    copyPrice: event.copyPrice ?? 10000,
    addOns:
      // Migrate legacy single add-on to array; empty if not enabled.
      event.addOns
        ? (event.addOns as unknown as { name: string; price: number }[])
        : event.addOnEnabled && event.addOnName && event.addOnPrice != null
          ? [{ name: event.addOnName, price: event.addOnPrice }]
          : [{ name: "", price: 0 }],
    allowCash: event.allowCash,
    allowQris: event.allowQris,
    splitEnabled: event.splitEnabled,
    splitKitaPercent: event.splitKitaPercent,
    splitPanitiaPercent: event.splitPanitiaPercent,
    status: event.status,
    notes: event.notes ?? "",
    crewIds: event.crew.map((c) => c.userId),
    attendance,
    cityId: event.cityId || "",
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
        cityOptions={cities}
        initial={initial}
      />
    </div>
  );
}
