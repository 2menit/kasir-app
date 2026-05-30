import { PageHeader } from "@/components/kpi-card";
import { RecapViewer } from "./recap-viewer";

export default function RecapsPage() {
  const now = new Date();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Keuangan"
        description="Ringkasan pendapatan per bulan atau kuartal."
      />
      <RecapViewer
        defaultMonth={now.getMonth() + 1}
        defaultYear={now.getFullYear()}
      />
    </div>
  );
}
