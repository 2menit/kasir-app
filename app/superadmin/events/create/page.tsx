import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/kpi-card";
import { EventForm } from "@/components/forms/event-form";

export const dynamic = "force-dynamic";

export default async function CreateEventPage() {
  const crew = await prisma.user.findMany({
    where: { role: "USER" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/superadmin/events"
        className="inline-flex items-center gap-1 text-sm text-body hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke daftar event
      </Link>
      <PageHeader title="Buat Event" description="Tambahkan event photobooth baru." />
      <EventForm mode="create" crewOptions={crew} />
    </div>
  );
}
