import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const JAKARTA_TZ = "Asia/Jakarta";

/**
 * Indonesian Rupiah, integer only: 1500000 -> "Rp1.500.000".
 * Uses id-ID grouping (dot as thousands separator).
 */
export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\s/g, ""); // "Rp 1.500.000" -> "Rp1.500.000"
}

/** Plain grouped integer: 1500000 -> "1.500.000" (no currency symbol). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

/** Full timestamp in WIB: "30 Mei 2026, 14:05". */
export function formatDateTimeWIB(date: Date | string): string {
  return formatInTimeZone(new Date(date), JAKARTA_TZ, "d MMM yyyy, HH:mm");
}

/** Time only in WIB: "14:05". */
export function formatTimeWIB(date: Date | string): string {
  return formatInTimeZone(new Date(date), JAKARTA_TZ, "HH:mm");
}

/** Date only in WIB: "30 Mei 2026". */
export function formatDateWIB(date: Date | string): string {
  return formatInTimeZone(new Date(date), JAKARTA_TZ, "d MMM yyyy");
}

/**
 * Smart date range in WIB:
 * - Same day: "5 Jul 2026"
 * - Same month: "5–7 Jul 2026"
 * - Different month: "30 Jun – 2 Jul 2026"
 */
export function formatDateRangeWIB(
  start: Date | string,
  end: Date | string
): string {
  const s = new Date(start);
  const e = new Date(end);
  const sStr = formatInTimeZone(s, JAKARTA_TZ, "d MMM yyyy");
  const eStr = formatInTimeZone(e, JAKARTA_TZ, "d MMM yyyy");
  if (sStr === eStr) return sStr;
  const sMonth = formatInTimeZone(s, JAKARTA_TZ, "MMM yyyy");
  const eMonth = formatInTimeZone(e, JAKARTA_TZ, "MMM yyyy");
  if (sMonth === eMonth) {
    // Same month: "5–7 Jul 2026"
    const sDay = formatInTimeZone(s, JAKARTA_TZ, "d");
    return `${sDay}–${eStr}`;
  }
  // Different month: "30 Jun – 2 Jul 2026"
  const sNoYear = formatInTimeZone(s, JAKARTA_TZ, "d MMM");
  return `${sNoYear} – ${eStr}`;
}

/** ISO date (yyyy-MM-dd) in WIB — used for export filenames + form inputs. */
export function isoDateWIB(date: Date | string): string {
  return formatInTimeZone(new Date(date), JAKARTA_TZ, "yyyy-MM-dd");
}

/** "HH:mm" of a date in WIB — used to prefill <input type="time">. */
export function timeHHmmWIB(date: Date | string): string {
  return formatInTimeZone(new Date(date), JAKARTA_TZ, "HH:mm");
}

/**
 * Combine a yyyy-MM-dd date string and an HH:mm time string into a UTC Date,
 * interpreting both in WIB. Returns null if time is empty.
 */
export function combineWibDateTime(
  dateStr: string,
  timeHHmm: string | null | undefined
): Date | null {
  if (!timeHHmm) return null;
  return fromZonedTime(`${dateStr}T${timeHHmm}:00`, JAKARTA_TZ);
}

/** "10:00–14:00" range (WIB), or just start, or "" if neither set. */
export function formatTimeRangeWIB(
  start: Date | string | null,
  end: Date | string | null
): string {
  const s = start ? formatTimeWIB(start) : "";
  const e = end ? formatTimeWIB(end) : "";
  if (s && e) return `${s}–${e}`;
  return s || e || "";
}

export const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export function monthLabel(month: number): string {
  return MONTH_NAMES_ID[month - 1] ?? String(month);
}
