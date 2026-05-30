import type { EventStatus } from "@prisma/client";
import { EventCard, type EventCardData } from "@/components/event-card";

type SectionConfig = {
  status: EventStatus;
  label: string;
};

// Operational order: what's happening now first, then next, then history.
const SECTIONS: SectionConfig[] = [
  { status: "ONGOING", label: "Sedang Berlangsung" },
  { status: "UPCOMING", label: "Akan Datang" },
  { status: "DONE", label: "Selesai" },
  { status: "CANCELLED", label: "Dibatalkan" },
];

export function EventSections({
  events,
  basePath,
  ongoingCta = "Lihat Detail",
  otherCta = "Lihat Detail",
  emptyText = "Belum ada event.",
}: {
  events: EventCardData[];
  basePath: string;
  ongoingCta?: string;
  otherCta?: string;
  emptyText?: string;
}) {
  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-hairline p-10 text-center text-sm text-muted">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {SECTIONS.map(({ status, label }) => {
        const items = events.filter((e) => e.status === status);
        if (items.length === 0) return null;
        const isOngoing = status === "ONGOING";
        return (
          <section key={status} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {label}
              <span className="ml-2 font-mono text-muted-soft">
                {items.length}
              </span>
            </h2>
            {items.map((e) => (
              <EventCard
                key={e.id}
                href={`${basePath}/${e.id}`}
                event={e}
                ctaLabel={isOngoing ? ongoingCta : otherCta}
                highlight={isOngoing}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
