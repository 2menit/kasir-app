import ExcelJS from "exceljs";
import {
  formatDateTimeWIB,
  formatDateWIB,
  formatTimeRangeWIB,
} from "@/lib/format";
import { pricingLabel } from "@/lib/pricing";
import type { EventRecap, PeriodRecap } from "@/lib/recap";

const RP_FMT = '"Rp"#,##0';
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0052FF" },
};

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle" };
  });
}

const methodLabel = (m: string) => (m === "CASH" ? "Tunai" : "QRIS");

/** Per-event workbook: Sheet 1 summary, Sheet 2 transaction detail. */
export async function buildEventWorkbook(recap: EventRecap): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Photobooth Cashier";
  wb.created = new Date();

  // ── Sheet 1: Summary ──
  const s1 = wb.addWorksheet("Ringkasan");
  s1.columns = [{ width: 28 }, { width: 40 }];
  const { event, totals } = recap;

  const timeRange = formatTimeRangeWIB(event.startTime, event.endTime);
  const summaryRows: [string, string | number][] = [
    ["Nama Event", event.name],
    ["Tanggal", formatDateWIB(event.eventDate)],
    ["Waktu", timeRange ? `${timeRange} WIB` : "-"],
    ["Lokasi", event.location],
    ["Skema Harga", pricingLabel[event.pricingType]],
    [
      event.pricingType === "PISAH" ? "Harga Cetak Pertama" : "Harga per Print",
      event.pricePerPrint,
    ],
    ...(event.pricingType === "PISAH"
      ? ([["Harga Salinan", event.copyPrice ?? 0]] as [string, number][])
      : []),
    ["Status", event.status],
    ["Total Transaksi", totals.transactionCount],
    ["Total Print", totals.totalPrints],
    ["Total Pendapatan", totals.totalRevenue],
    ["Pendapatan Tunai", totals.cashRevenue],
    ["Pendapatan QRIS", totals.qrisRevenue],
    ["Jumlah Crew", totals.crewCount],
    ["Crew Hadir", totals.crewAttended],
  ];

  const title = s1.addRow(["Ringkasan Event", ""]);
  title.font = { bold: true, size: 14 };
  s1.addRow([]);
  for (const [label, value] of summaryRows) {
    const row = s1.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    if (
      typeof value === "number" &&
      (label.toLowerCase().includes("pendapatan") ||
        label.toLowerCase().includes("harga"))
    ) {
      row.getCell(2).numFmt = RP_FMT;
    }
  }

  s1.addRow([]);
  const crewHeader = s1.addRow(["Crew", "Kehadiran"]);
  styleHeaderRow(crewHeader);
  for (const c of recap.crew) {
    s1.addRow([c.name, c.attended ? "Hadir" : "Tidak Hadir"]);
  }

  // ── Sheet 2: Transactions ──
  const s2 = wb.addWorksheet("Transaksi");
  s2.columns = [
    { header: "No.", key: "no", width: 6 },
    { header: "Waktu (WIB)", key: "time", width: 22 },
    { header: "Crew", key: "crew", width: 22 },
    { header: "Jumlah Print", key: "prints", width: 14 },
    { header: "Metode", key: "method", width: 12 },
    { header: "Total", key: "total", width: 16 },
    { header: "Catatan", key: "note", width: 30 },
  ];
  styleHeaderRow(s2.getRow(1));

  recap.transactions.forEach((t, i) => {
    const row = s2.addRow({
      no: i + 1,
      time: formatDateTimeWIB(t.createdAt),
      crew: t.crewName,
      prints: t.printCount,
      method: methodLabel(t.paymentMethod),
      total: t.total,
      note: t.note ?? "",
    });
    row.getCell("total").numFmt = RP_FMT;
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Period (monthly/quarterly) workbook: Sheet 1 summary, Sheet 2 events breakdown. */
export async function buildPeriodWorkbook(recap: PeriodRecap): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Photobooth Cashier";
  wb.created = new Date();

  const s1 = wb.addWorksheet("Ringkasan");
  s1.columns = [
    { header: "No.", key: "no", width: 6 },
    { header: "Nama Event", key: "name", width: 32 },
    { header: "Tanggal", key: "date", width: 16 },
    { header: "Lokasi", key: "location", width: 28 },
    { header: "Skema", key: "scheme", width: 12 },
    { header: "Transaksi", key: "txn", width: 12 },
    { header: "Total Print", key: "prints", width: 12 },
    { header: "Total Pendapatan", key: "revenue", width: 18 },
  ];

  const titleRow = s1.insertRow(1, [`Rekap ${recap.label}`]);
  titleRow.font = { bold: true, size: 14 };
  s1.mergeCells(1, 1, 1, 8);
  styleHeaderRow(s1.getRow(2));

  recap.rows.forEach((r, i) => {
    const row = s1.addRow({
      no: i + 1,
      name: r.name,
      date: formatDateWIB(r.eventDate),
      location: r.location,
      scheme: r.pricingType === "PISAH" ? "Pisah" : "Biasa",
      txn: r.transactionCount,
      prints: r.totalPrints,
      revenue: r.totalRevenue,
    });
    row.getCell("revenue").numFmt = RP_FMT;
  });

  const totalRow = s1.addRow({
    name: "TOTAL",
    txn: recap.totals.transactionCount,
    prints: recap.totals.totalPrints,
    revenue: recap.totals.totalRevenue,
  });
  totalRow.font = { bold: true };
  totalRow.getCell("revenue").numFmt = RP_FMT;

  // ── Sheet 2: Per-event breakdown incl. payment split ──
  const s2 = wb.addWorksheet("Rincian Pembayaran");
  s2.columns = [
    { header: "Nama Event", key: "name", width: 32 },
    { header: "Tunai", key: "cash", width: 16 },
    { header: "QRIS", key: "qris", width: 16 },
    { header: "Total", key: "total", width: 16 },
  ];
  styleHeaderRow(s2.getRow(1));
  for (const r of recap.rows) {
    const row = s2.addRow({
      name: r.name,
      cash: r.cashRevenue,
      qris: r.qrisRevenue,
      total: r.totalRevenue,
    });
    row.getCell("cash").numFmt = RP_FMT;
    row.getCell("qris").numFmt = RP_FMT;
    row.getCell("total").numFmt = RP_FMT;
  }
  const t2 = s2.addRow({
    name: "TOTAL",
    cash: recap.totals.cashRevenue,
    qris: recap.totals.qrisRevenue,
    total: recap.totals.totalRevenue,
  });
  t2.font = { bold: true };
  ["cash", "qris", "total"].forEach((k) => (t2.getCell(k).numFmt = RP_FMT));

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
