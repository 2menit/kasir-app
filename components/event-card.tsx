import Link from "next/link";
import { CalendarDays, MapPin, ArrowRight, Clock } from "lucide-react";
import type { EventStatus, PricingType } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { StatusBadge, PricingBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateRangeWIB, formatRupiah, formatTimeRangeWIB } from "@/lib/format";
import { cn } from "@/lib/utils";

export type EventCardData = {
  id: string;
  name: string;
  location: string;
  eventDateStart: Date | string;
  eventDateEnd: Date | string;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  pricingType: PricingType;
  status: EventStatus;
  revenue?: number; // superadmin only
};

export function EventCard({
  event,
  href,
  ctaLabel = "Lihat Detail",
  highlight,
}: {
  event: EventCardData;
  href: string;
  ctaLabel?: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "transition-shadow hover:shadow-soft",
        highlight && "border-primary ring-1 ring-primary/30"
      )}
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={event.status} />
            <PricingBadge type={event.pricingType} />
          </div>
          <h3 className="truncate text-lg font-semibold tracking-display">
            {event.name}
          </h3>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-body">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted" />
              {formatDateRangeWIB(event.eventDateStart, event.eventDateEnd)}
            </span>
            {formatTimeRangeWIB(event.startTime ?? null, event.endTime ?? null) && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted" />
                {formatTimeRangeWIB(event.startTime ?? null, event.endTime ?? null)} WIB
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-muted" />
              {event.location}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
          {event.revenue !== undefined && (
            <div className="text-right">
              <p className="text-xs text-muted">Pendapatan</p>
              <p className="font-mono text-base font-medium tabular-nums">
                {formatRupiah(event.revenue)}
              </p>
            </div>
          )}
          <Link href={href}>
            <Button variant={highlight ? "primary" : "outline"} size="sm">
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
