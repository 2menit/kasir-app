import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { StatusBadge, PricingBadge } from "@/components/ui/badge";
import { formatDateRangeWIB, formatTimeRangeWIB } from "@/lib/format";
import { Cashier, type TxnView } from "./cashier";

export const dynamic = "force-dynamic";

export default async function UserEventPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      crew: { where: { userId: me.id } },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!event) notFound();
  // Crew may only open events they are assigned to (NFR-07 / REQ-U-04).
  if (event.crew.length === 0) redirect("/user/dashboard");

  const initialTransactions: TxnView[] = event.transactions.map((t) => ({
    id: t.id,
    createdAt: t.createdAt.toISOString(),
    printCount: t.printCount,
    paymentMethod: t.paymentMethod,
    addOnQty: t.addOnQty,
    total: t.total,
    note: t.note,
    crewName: t.user?.name ?? "(dihapus)",
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/user/dashboard"
        className="inline-flex items-center gap-1 text-sm text-body hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={event.status} />
          <PricingBadge type={event.pricingType} />
        </div>
        <h1 className="text-2xl font-semibold tracking-display">{event.name}</h1>
        <p className="mt-1 text-sm text-body">
          {formatDateRangeWIB(event.eventDateStart, event.eventDateEnd)}
          {formatTimeRangeWIB(event.startTime, event.endTime) && (
            <> · {formatTimeRangeWIB(event.startTime, event.endTime)} WIB</>
          )}{" "}
          · {event.location}
        </p>
      </div>

      <Cashier
        eventId={event.id}
        pricingType={event.pricingType}
        pricePerPrint={event.pricePerPrint}
        copyPrice={event.copyPrice}
        addOnEnabled={event.addOnEnabled}
        addOnName={event.addOnName}
        addOnPrice={event.addOnPrice}
        isOngoing={event.status === "ONGOING"}
        canEditAttendance={
          event.status !== "DONE" && event.status !== "CANCELLED"
        }
        initialAttended={event.crew[0]!.attended}
        initialTransactions={initialTransactions}
      />
    </div>
  );
}
