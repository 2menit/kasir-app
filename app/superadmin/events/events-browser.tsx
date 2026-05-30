"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { EventStatus, PricingType } from "@prisma/client";
import { Input, Select } from "@/components/ui/input";
import { EventCard } from "@/components/event-card";
import { MONTH_NAMES_ID } from "@/lib/format";

export type EventListItem = {
  id: string;
  name: string;
  location: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  pricingType: PricingType;
  status: EventStatus;
  revenue: number;
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Semua status" },
  { value: "UPCOMING", label: "Akan Datang" },
  { value: "ONGOING", label: "Berlangsung" },
  { value: "DONE", label: "Selesai" },
  { value: "CANCELLED", label: "Dibatalkan" },
];

export function EventsBrowser({ events }: { events: EventListItem[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [month, setMonth] = useState("");

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (status && e.status !== status) return false;
      if (search && !e.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (month) {
        const m = new Date(e.eventDate).getMonth() + 1;
        if (String(m) !== month) return false;
      }
      return true;
    });
  }, [events, search, status, month]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama event..."
            className="rounded-pill pl-10"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="sm:w-48"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="sm:w-44"
        >
          <option value="">Semua bulan</option>
          {MONTH_NAMES_ID.map((name, i) => (
            <option key={name} value={String(i + 1)}>
              {name}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline p-10 text-center text-sm text-muted">
          Tidak ada event yang cocok dengan filter.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <EventCard
              key={e.id}
              href={`/superadmin/events/${e.id}`}
              event={e}
            />
          ))}
        </div>
      )}
    </div>
  );
}
