"use client";

import { useRouter, usePathname } from "next/navigation";
import { Select } from "@/components/ui/input";
import { MONTH_NAMES_ID } from "@/lib/format";

/** Month + year selector that drives a server page via URL search params. */
export function MonthPicker({
  month,
  year,
  yearsBack = 5,
}: {
  month: number;
  year: number;
  yearsBack?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: yearsBack + 1 }, (_, i) => thisYear - i);

  function go(nextMonth: number, nextYear: number) {
    router.push(`${pathname}?month=${nextMonth}&year=${nextYear}`);
  }

  return (
    <div className="flex gap-2">
      <Select
        value={month}
        onChange={(e) => go(Number(e.target.value), year)}
        className="w-40"
        aria-label="Bulan"
      >
        {MONTH_NAMES_ID.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </Select>
      <Select
        value={year}
        onChange={(e) => go(month, Number(e.target.value))}
        className="w-28"
        aria-label="Tahun"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  );
}
