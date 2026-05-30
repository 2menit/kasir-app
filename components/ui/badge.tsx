import * as React from "react";
import { cn } from "@/lib/utils";
import type { EventStatus, PaymentMethod, PricingType } from "@prisma/client";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-semibold",
        "bg-surface-strong text-ink",
        className
      )}
      {...props}
    />
  );
}

const statusStyles: Record<EventStatus, string> = {
  UPCOMING: "bg-primary/10 text-primary",
  ONGOING: "bg-up/10 text-up",
  DONE: "bg-surface-strong text-body",
  CANCELLED: "bg-down/10 text-down",
};

const statusLabel: Record<EventStatus, string> = {
  UPCOMING: "Akan Datang",
  ONGOING: "Berlangsung",
  DONE: "Selesai",
  CANCELLED: "Dibatalkan",
};

export function StatusBadge({ status }: { status: EventStatus }) {
  return <Badge className={statusStyles[status]}>{statusLabel[status]}</Badge>;
}

const pricingStyles: Record<PricingType, string> = {
  BIASA: "bg-surface-strong text-body",
  PISAH: "bg-warn/15 text-warn",
};

const pricingShort: Record<PricingType, string> = {
  BIASA: "Biasa",
  PISAH: "Pisah",
};

export function PricingBadge({ type }: { type: PricingType }) {
  return <Badge className={pricingStyles[type]}>{pricingShort[type]}</Badge>;
}

const methodLabel: Record<PaymentMethod, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
};

export function MethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <Badge
      className={
        method === "CASH" ? "bg-up/10 text-up" : "bg-primary/10 text-primary"
      }
    >
      {methodLabel[method]}
    </Badge>
  );
}
