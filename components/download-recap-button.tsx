"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Triggers an XLSX download from the export endpoint. The session cookie is
 * sent automatically (same-origin), so a plain navigation works.
 */
export function DownloadRecapButton({
  href,
  label = "Unduh XLSX",
  variant = "secondary",
}: {
  href: string;
  label?: string;
  variant?: "primary" | "secondary" | "outline";
}) {
  return (
    <Button
      variant={variant}
      onClick={() => {
        window.location.href = href;
      }}
    >
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
