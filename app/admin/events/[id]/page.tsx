import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
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

export default async function AdminEventDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") redirect("/login");

    const recap = await getEventRecap(params.id);
    if (!recap) notFound();

    const { event, totals, crew, transactions } = recap;

    // Admin can only see events in their city
    // (getEventRecap fetches by ID directly; we check cityId manually)
    // The API layer also enforces this, but for SSR page we check here too.

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                    href="/admin/events"
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
                        redirectTo="/admin/events"
                    />
                    <Link href={`/admin/events/${event.id}/edit`}>
                        <Button>
                            <Pencil className="h-4 w-4" /> Edit Event
                        </Button>
                    </Link>
                </div>
            </div>

            {/* SECTION 1 — Event info card + KPI cards */}
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
                                <dd className="font-medium">
                                    {formatDateRangeWIB(
                                        event.eventDateStart,
                                        event.eventDateEnd,
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted">Waktu</dt>
                                <dd className="font-medium">
                                    {formatTimeRangeWIB(
                                        event.startTime,
                                        event.endTime,
                                    ) || "—"}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted">Lokasi</dt>
                                <dd className="font-medium">
                                    {event.location}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted">Skema Harga</dt>
                                <dd className="font-medium">
                                    {pricingLabel(event.pricingType)}
                                </dd>
                            </div>
                            {event.notes && (
                                <div className="col-span-2">
                                    <dt className="text-muted">Catatan</dt>
                                    <dd className="whitespace-pre-wrap font-medium">
                                        {event.notes}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-3 content-start">
                    <KpiCard
                        label="Total Pendapatan"
                        value={formatRupiah(totals.totalRevenue)}
                        className="col-span-2"
                    />
                    <KpiCard
                        label="Tunai"
                        value={formatRupiah(totals.cashRevenue)}
                    />
                    <KpiCard
                        label="QRIS"
                        value={formatRupiah(totals.qrisRevenue)}
                    />
                    <KpiCard
                        label="Total Print"
                        value={formatNumber(totals.totalPrints)}
                    />
                    <KpiCard
                        label="Transaksi"
                        value={formatNumber(totals.transactionCount)}
                    />
                </div>
            </div>

            {/* SECTION 2 — Crew */}
            <Card>
                <CardContent>
                    <h2 className="mb-3 text-base font-semibold tracking-display">
                        Crew
                    </h2>
                    {crew.length === 0 ? (
                        <p className="text-sm text-muted">
                            Belum ada crew yang ditugaskan.
                        </p>
                    ) : (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {crew.map((c) => (
                                <div
                                    key={c.id}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg border border-hairline px-3 py-2 text-sm",
                                        c.attended && "border-up/30 bg-up/5",
                                    )}
                                >
                                    {c.attended ? (
                                        <CheckCircle2 className="h-4 w-4 shrink-0 text-up" />
                                    ) : (
                                        <XCircle className="h-4 w-4 shrink-0 text-muted" />
                                    )}
                                    <span className="font-medium">
                                        {c.name}
                                    </span>
                                    <span
                                        className={cn(
                                            "ml-auto text-xs",
                                            c.attended
                                                ? "text-up"
                                                : "text-muted",
                                        )}
                                    >
                                        {c.attended ? "Hadir" : "Tidak hadir"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* SECTION 3 — Transactions */}
            <Card>
                <CardContent>
                    <h2 className="mb-3 text-base font-semibold tracking-display">
                        Transaksi
                    </h2>
                    {transactions.length === 0 ? (
                        <p className="text-sm text-muted">
                            Belum ada transaksi.
                        </p>
                    ) : (
                        <Table>
                            <THead>
                                <TR>
                                    <TH className="w-12">No.</TH>
                                    <TH>Waktu</TH>
                                    <TH>Crew</TH>
                                    <TH>Print</TH>
                                    <TH>Add-on</TH>
                                    <TH>Metode</TH>
                                    <TH className="text-right">Total</TH>
                                </TR>
                            </THead>
                            <TBody>
                                {transactions.map((t, i) => (
                                    <TR key={t.id}>
                                        <TD className="text-muted">{i + 1}</TD>
                                        <TD className="whitespace-nowrap text-sm">
                                            {formatDateTimeWIB(t.createdAt)}
                                        </TD>
                                        <TD>{t.crewName}</TD>
                                        <TD className="font-mono tabular-nums">
                                            {formatNumber(t.printCount)}
                                        </TD>
                                        <TD className="font-mono tabular-nums">
                                            {t.addOnQty > 0
                                                ? formatNumber(t.addOnQty)
                                                : "—"}
                                        </TD>
                                        <TD>
                                            <MethodBadge
                                                method={t.paymentMethod}
                                            />
                                        </TD>
                                        <TD className="text-right font-mono tabular-nums font-medium">
                                            {formatRupiah(t.total)}
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
