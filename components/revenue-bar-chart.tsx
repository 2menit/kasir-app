import { formatRupiah, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export type RevenuePoint = {
  month: number;
  revenue: number;
  transactionCount: number;
};

/** Dependency-free 12-month revenue bar chart (CSS bars + hover tooltip). */
export function RevenueBarChart({
  data,
  highlightMonth,
}: {
  data: RevenuePoint[];
  highlightMonth?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const hasData = data.some((d) => d.revenue > 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>Pendapatan per bulan</span>
        <span className="font-mono">Maks {formatRupiah(max)}</span>
      </div>

      <div className="flex h-52 items-end gap-1.5 sm:gap-2">
        {data.map((d) => {
          const pct = Math.round((d.revenue / max) * 100);
          const isHighlight = d.month === highlightMonth;
          return (
            <div
              key={d.month}
              className="group relative flex h-full flex-1 flex-col items-center justify-end"
            >
              {/* Tooltip */}
              <div className="pointer-events-none absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-md border border-hairline bg-canvas px-2 py-1 text-center opacity-0 shadow-soft transition-opacity group-hover:opacity-100">
                <p className="font-mono text-xs font-semibold tabular-nums">
                  {formatRupiah(d.revenue)}
                </p>
                <p className="text-[10px] text-muted">
                  {formatNumber(d.transactionCount)} transaksi
                </p>
              </div>

              <div
                className={cn(
                  "w-full rounded-t-sm transition-colors",
                  isHighlight
                    ? "bg-warn"
                    : "bg-primary/80 group-hover:bg-primary"
                )}
                style={{ height: `${Math.max(pct, d.revenue > 0 ? 2 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-1.5 sm:gap-2">
        {data.map((d) => (
          <span
            key={d.month}
            className={cn(
              "flex-1 text-center text-[10px] sm:text-xs",
              d.month === highlightMonth
                ? "font-semibold text-ink"
                : "text-muted"
            )}
          >
            {MONTH_SHORT[d.month - 1]}
          </span>
        ))}
      </div>

      {!hasData && (
        <p className="mt-3 text-center text-sm text-muted">
          Belum ada pendapatan pada tahun ini.
        </p>
      )}
    </div>
  );
}
