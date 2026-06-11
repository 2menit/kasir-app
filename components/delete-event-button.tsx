"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiFetch } from "@/lib/client";

export function DeleteEventButton({
  eventId,
  transactionCount,
}: {
  eventId: string;
  transactionCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const hasTransactions = transactionCount > 0;

  async function confirmDelete() {
    setDeleting(true);
    const res = await apiFetch(`/api/events/${eventId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.success) {
      toast.error(res.error);
      setOpen(false);
      return;
    }
    toast.success("Event dihapus");
    router.push("/superadmin/events");
    router.refresh();
  }

  // Events with transactions can't be deleted — guide to CANCELLED instead.
  if (hasTransactions) {
    return (
      <Button
        variant="outline"
        disabled
        className="text-muted"
        title={`Tidak bisa dihapus: ada ${transactionCount} transaksi. Gunakan status "Dibatalkan".`}
      >
        <Trash2 className="h-4 w-4" /> Hapus
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-down/40 text-down hover:bg-down/5"
      >
        <Trash2 className="h-4 w-4" /> Hapus
      </Button>
      <ConfirmDialog
        open={open}
        title="Hapus event ini?"
        description="Event belum punya transaksi. Tindakan ini permanen dan tidak bisa dibatalkan."
        confirmLabel="Hapus Event"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
