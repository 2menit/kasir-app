import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/kpi-card";
import { RecapViewer } from "./recap-viewer";

export const dynamic = "force-dynamic";

export default async function RecapsPage() {
  const now = new Date();
  const cities = await prisma.city.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Keuangan"
        description="Ringkasan pendapatan per bulan atau kuartal, dengan filter kota."
      />
      <RecapViewer
        defaultMonth={now.getMonth() + 1}
        defaultYear={now.getFullYear()}
        cities={cities}
      />
    </div>
  );
}
