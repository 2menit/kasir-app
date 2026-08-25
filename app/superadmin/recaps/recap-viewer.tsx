"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { KpiCard } from "@/components/kpi-card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { DownloadRecapButton } from "@/components/download-recap-button";
import { RevenueBarChart, type RevenuePoint } from "@/components/revenue-bar-chart";
import { apiFetch } from "@/lib/client";
import { formatRupiah, formatNumber, formatDateWIB, MONTH_NAMES_ID } from "@/lib/format";

type Row = {
  id: string;
  name: string;
  eventDateStart: string;
  location: string;
  pricingType: "BIASA" | "PISAH";
  cityName: string | null;
  transactionCount: number;
  totalPrints: number;
  totalRevenue: number;
};

type PeriodRecap = {
  label: string;
  rows: Row[];
  totals: {
    eventCount: number;
    transactionCount: number;
    totalPrints: number;
    totalRevenue: number;
    cashRevenue: number;
    qrisRevenue: number;
    addOnRevenue: number;
  };
};

type Mode = "monthly" | "quarterly";
type CityOption = { id: string; name: string };

export function RecapViewer({
  defaultMonth,
  defaultYear,
  cities,
}: {
  defaultMonth: number;
  defaultYear: number;
  cities?: CityOption[];
}) {
  const [mode, setMode] = useState<Mode>("monthly");
  const [month, setMonth] = useState(defaultMonth);
  const [quarter, setQuarter] = useState(Math.ceil(defaultMonth / 3));
  const [year, setYear] = useState(defaultYear);
  const [cityId, setCityId] = useState("");
  const [data, setData] = useState<PeriodRecap | null>(null);
  const [loading, setLoading] = useState(false);
  const [yearly, setYearly] = useState<RevenuePoint[]>([]);

  const years = Array.from({ length: 6 }, (_, i) => defaultYear - i);

  const load = useCallback(async () => {
    setLoading(true);
    const cityParam = cityId ? `&city=${encodeURIComponent(cityId)}` : "";
    const query =
      mode === "monthly"
        ? `month=${month}&year=${year}${cityParam}`
        : `quarter=${quarter}&year=${year}${cityParam}`;
    const res = await apiFetch<PeriodRecap>(`/api/recaps/monthly?${query}`);
    setLoading(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setData(res.data);
  }, [mode, month, quarter, year, cityId]);

  useEffect(() => {
    load();
  }, [load]);

  // Yearly revenue series for the chart — refetched only when year or city changes.
  useEffect(() => {
    let active = true;
    const cityParam = cityId ? `&city=${encodeURIComponent(cityId)}` : "";
    apiFetch<RevenuePoint[]>(`/api/recaps/yearly?year=${year}${cityParam}`).then((res) => {
      if (!active) return;
      if (res.success) setYearly(res.data);
      else setYearly([]);
    });
    return () => {
      active = false;
    };
  }, [year, cityId]);

  const exportHref = (() => {
    const cityParam = cityId ? `&city=${encodeURIComponent(cityId)}` : "";
    return mode === "monthly"
      ? `/api/recaps/export?type=monthly&month=${month}&year=${year}${cityParam}`
      : `/api/recaps/export?type=quarterly&quarter=${quarter}&year=${year}${cityParam}`;
  })();

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <Field label="Periode" className="w-40">
            <Select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="monthly">Bulanan</option>
              <option value="quarterly">Kuartal</option>
            </Select>
          </Field>

          {mode === "monthly" ? (
            <Field label="Bulan" className="w-44">
              <Select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTH_NAMES_ID.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Kuartal" className="w-44">
              <Select
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
              >
                <option value={1}>Q1 (Jan–Mar)</option>
                <option value={2}>Q2 (Apr–Jun)</option>
                <option value={3}>Q3 (Jul–Sep)</option>
                <option value={4}>Q4 (Okt–Des)</option>
              </Select>
            </Field>
          )}

          <Field label="Tahun" className="w-32">
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>

          {cities && cities.length > 0 && (
            <Field label="Kota" className="w-44">
              <Select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
              >
                <option value="">Semua kota</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="ml-auto">
            <DownloadRecapButton href={exportHref} />
          </div>
        </CardContent>
      </Card>

      {/* Yearly revenue chart (driven by selected year + city) */}
      <Card>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-display">
              Grafik Pendapatan {year}
            </h2>
          </div>
          <RevenueBarChart
            data={yearly}
            highlightMonth={mode === "monthly" ? month : undefined}
          />
        </CardContent>
      </Card>

      {/* Period recap table + KPIs */}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total Pendapatan"
              value={formatRupiah(data.totals.totalRevenue)}
            />
            <KpiCard
              label="Transaksi"
              value={formatNumber(data.totals.transactionCount)}
            />
            <KpiCard
              label="Total Cetak"
              value={formatNumber(data.totals.totalPrints)}
            />
            <KpiCard
              label="Event"
              value={formatNumber(data.totals.eventCount)}
            />
          </div>

          <Card>
            <CardContent>
              <h2 className="mb-4 text-base font-semibold tracking-display">
                Rincian per Event — {data.label}
              </h2>
              {data.rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-hairline p-10 text-center text-sm text-muted">
                  Tidak ada transaksi pada periode ini.
                </p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Event</TH>
                      <TH>Lokasi</TH>
                      <TH>Kota</TH>
                      <TH>Mulai</TH>
                      <TH className="text-right">Transaksi</TH>
                      <TH className="text-right">Cetak</TH>
                      <TH className="text-right">Pendapatan</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.rows.map((r) => (
                      <TR key={r.id}>
                        <TD className="font-medium">{r.name}</TD>
                        <TD className="text-sm">{r.location}</TD>
                        <TD className="text-sm">
                          {r.cityName ?? "—"}
                        </TD>
                        <TD className="text-sm text-muted">
                          {formatDateWIB(r.eventDateStart)}
                        </TD>
                        <TD className="text-right font-mono tabular-nums">
                          {formatNumber(r.transactionCount)}
                        </TD>
                        <TD className="text-right font-mono tabular-nums">
                          {formatNumber(r.totalPrints)}
                        </TD>
                        <TD className="text-right font-mono tabular-nums">
                          {formatRupiah(r.totalRevenue)}
                        </TD>
                      </TR>
                    ))}
                    <TR className="border-t-2 border-hairline font-semibold">
                      <TD />
                      <TD>TOTAL</TD>
                      <TD />
                      <TD />
                      <TD className="text-right font-mono tabular-nums">
                        {formatNumber(data.totals.transactionCount)}
                      </TD>
                      <TD className="text-right font-mono tabular-nums">
                        {formatNumber(data.totals.totalPrints)}
                      </TD>
                      <TD className="text-right font-mono tabular-nums">
                        {formatRupiah(data.totals.totalRevenue)}
                      </TD>
                    </TR>
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
