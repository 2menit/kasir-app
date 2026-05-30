import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  // Signature Coinbase Blue pill.
  primary:
    "bg-primary text-on-primary hover:bg-primary active:bg-primary-active disabled:bg-primary-disabled disabled:cursor-not-allowed",
  // Secondary action — accent yellow with fixed dark text for contrast.
  secondary:
    "bg-warn text-warn-ink hover:bg-warn-active active:bg-warn-active disabled:opacity-50",
  outline:
    "bg-transparent text-ink border border-hairline hover:bg-surface-soft disabled:opacity-50",
  ghost: "bg-transparent text-body hover:bg-surface-soft disabled:opacity-50",
  danger:
    "bg-down text-white hover:opacity-90 active:opacity-100 disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[16px]",
  lg: "h-14 px-8 text-[16px]",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading, disabled, children, ...props },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-pill font-semibold leading-none transition-colors",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";
