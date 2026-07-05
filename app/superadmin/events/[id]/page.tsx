import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { getEventRecap } from "@/lib/recap";
import {
  formatRupiah,
  formatNumber,
  formatDateRangeWIB,
  formatDateTimeWIB,
  formatTimeRangeWIB,
} from "@/lib/format";
import { pricingLabel } from "@/lib/pricing";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { StatusBadge, PricingBadge, MethodBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { DownloadRecapButton } from "@/components/download-recap-button";
import { DeleteEventButton } from "@/components/delete-event-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const recap = await getEventRecap(params.id);
  if (!recap) notFound();

  const { event, totals, crew, transactions } = recap;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/superadmin/events"
          className="inline-flex items-center gap-1 text-sm text-body hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke daftar event
        </Link>
        <div className="flex gap-2">
          <DownloadRecapButton
            href={`/api/recaps/export?type=event&id=${event.id}`}
          />
          <DeleteEventButton
            eventId={event.id}
            transactionCount={totals.transactionCount}
          />
          <Link href={`/superadmin/events/${event.id}/edit`}>
            <Button>
              <Pencil className="h-4 w-4" /> Edit Event
            </Button>
          </Link>
        </div>
      </div>

      {/* SECTION 1 — Event info card + 4 KPI cards (same row) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={event.status} />
              <PricingBadge type={event.pricingType} />
            </div>
            <h1 className="text-2xl font-semibold tracking-display">
              {event.name}
            </h1>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-muted">Tanggal</dt>
                <dd className="font-medium">{formatDateRangeWIB(event.eventDateStart, event.eventDateEnd)}</dd>
              </div>
              <div>
                <dt className="text-muted">Waktu</dt>
                <dd className="font-medium">
                  {formatTimeRangeWIB(event.startTime, event.endTime) || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Lokasi</dt>
                <dd className="font-medium">{event.location}</dd>
              </div>
              <div>
                <dt className="text-muted">Skema Harga</dt>
                <dd className="font-medium">{pricingLabel[event.pricingType]}</dd>
              </div>
              <div className={event.pricingType === "PISAH" ? "" : "col-span-2"}>
                <dt className="text-muted">
                  {event.pricingType === "PISAH" ? "Cetak Pertama" : "Harga / Print"}
                </dt>
                <dd className="font-mono font-medium tabular-nums">
                  {formatRupiah(event.pricePerPrint)}
                </dd>
              </div>
              {event.pricingType === "PISAH" && (
                <div>
                  <dt className="text-muted">Harga Salinan</dt>
                  <dd className="font-mono font-medium tabular-nums">
                    {formatRupiah(event.copyPrice ?? 0)}
                  </dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="text-muted">Pembayaran</dt>
                <dd className="font-mono font-medium tabular-nums">
                  Tunai {formatRupiah(totals.cashRevenue)} · QRIS{" "}
                  {formatRupiah(totals.qrisRevenue)}
                </dd>
              </div>
              {event.addOnEnabled && (
                <div className="col-span-2">
                  <dt className="text-muted">
                    Add-on · {event.addOnName} (
                    {formatRupiah(event.addOnPrice ?? 0)}/item)
                  </dt>
                  <dd className="font-mono font-medium tabular-nums">
                    {formatNumber(totals.addOnQty)} item terjual ·{" "}
                    {formatRupiah(totals.addOnRevenue)}
                  </dd>
                </div>
              )}
              {event.notes && (
                <div className="col-span-2">
                  <dt className="text-muted">Catatan</dt>
                  <dd className="font-medium">{event.notes}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <KpiCard
            label="Total Pendapatan"
            value={formatRupiah(totals.totalRevenue)}
          />
          <KpiCard
            label="Total Transaksi"
            value={formatNumber(totals.transactionCount)}
          />
          <KpiCard
            label="Total Print"
            value={formatNumber(totals.totalPrints)}
          />
          <KpiCard
            label="Crew Hadir"
            value={`${totals.crewAttended}/${totals.crewCount}`}
          />
        </div>
      </div>

      {/* SECTION 2 — Crew attendance, compact horizontal pills */}
      <Card>
        <CardContent>
          <h2 className="mb-3 text-base font-semibold tracking-display">
            Kehadiran Crew
          </h2>
          {crew.length === 0 ? (
            <p className="text-sm text-muted">Belum ada crew yang ditugaskan.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {crew.map((c) => (
                <span
                  key={c.id}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm font-medium",
                    c.attended
                      ? "bg-up/10 text-up"
                      : "bg-surface-strong text-muted"
                  )}
                >
                  {c.attended ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 3 — Riwayat Transaksi, full width */}
      <Card>
        <CardContent>
          <h2 className="mb-4 text-base font-semibold tracking-display">
            Riwayat Transaksi
          </h2>
          {transactions.length === 0 ? (
            <p className="rounded-md border border-dashed border-hairline p-8 text-center text-sm text-muted">
              Belum ada transaksi pada event ini.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH className="w-12">No.</TH>
                  <TH>Waktu</TH>
                  <TH>Crew</TH>
                  <TH className="text-right">Print</TH>
                  {event.addOnEnabled && (
                    <TH className="text-right">{event.addOnName}</TH>
                  )}
                  <TH>Metode</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Catatan</TH>
                </TR>
              </THead>
              <TBody>
                {transactions.map((t, i) => (
                  <TR key={t.id}>
                    <TD className="text-muted">{i + 1}</TD>
                    <TD className="whitespace-nowrap">
                      {formatDateTimeWIB(t.createdAt)}
                    </TD>
                    <TD className="font-medium">{t.crewName}</TD>
                    <TD className="text-right font-mono tabular-nums">
                      {t.printCount}
                    </TD>
                    {event.addOnEnabled && (
                      <TD className="text-right font-mono tabular-nums">
                        {t.addOnQty || "—"}
                      </TD>
                    )}
                    <TD>
                      <MethodBadge method={t.paymentMethod} />
                    </TD>
                    <TD className="text-right font-mono tabular-nums">
                      {formatRupiah(t.total)}
                    </TD>
                    <TD className="max-w-[200px] truncate text-body">
                      {t.note ?? "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
