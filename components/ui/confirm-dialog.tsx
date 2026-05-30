"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * Lightweight confirm modal (no Radix dependency). Render it controlled:
 * keep `open` in state and supply onConfirm / onClose.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Hapus",
  cancelLabel = "Batal",
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-hairline bg-canvas p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold tracking-display">{title}</h2>
        {description && <p className="mt-2 text-sm text-body">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
