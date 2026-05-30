import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-12 w-full rounded-md border border-hairline bg-canvas px-4 text-[16px] text-ink",
      "placeholder:text-muted-soft",
      "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
      "disabled:cursor-not-allowed disabled:bg-surface-soft",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[88px] w-full rounded-md border border-hairline bg-canvas px-4 py-3 text-[16px] text-ink",
      "placeholder:text-muted-soft",
      "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-12 w-full rounded-md border border-hairline bg-canvas px-3 text-[16px] text-ink",
      "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
