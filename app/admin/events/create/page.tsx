import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader } from "@/components/kpi-card";
import { EventForm } from "@/components/forms/event-form";

export const dynamic = "force-dynamic";

export default async function AdminCreateEventPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  // Admin can only assign crew from their own city
  const crew = await prisma.user.findMany({
    where: { role: "USER", cityId: user.cityId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1 text-sm text-body hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke daftar event
      </Link>
      <PageHeader title="Buat Event" description="Tambahkan event photobooth baru." />
      {/* No cityOptions — admin city is auto-tagged server-side */}
      <EventForm mode="create" crewOptions={crew} />
    </div>
  );
}
