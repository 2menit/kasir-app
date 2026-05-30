import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-hairline bg-canvas p-5", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-medium tabular-nums tracking-tight text-ink">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-body">{sub}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-display sm:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-body">{description}</p>}
      </div>
      {action}
    </div>
  );
}
