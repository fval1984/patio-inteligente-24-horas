/**
 * BICharts — helpers de séries temporais e agregações para gráficos.
 */

import type { DualSeries, NumberSeries, SeriesPoint, Ymd } from "./types";

export function isCalendarYmd(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function toLocalYmd(value: string | Date | null | undefined): Ymd | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const s = String(value).trim();
  if (isCalendarYmd(s)) return s;
  const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return toLocalYmd(d);
}

export function todayYmd(now: Date = new Date()): Ymd {
  return toLocalYmd(now) as Ymd;
}

export function ymdToDate(ymd: Ymd): Date {
  return new Date(`${ymd}T12:00:00`);
}

export function addDaysYmd(ymd: Ymd, days: number): Ymd {
  const d = ymdToDate(ymd);
  d.setDate(d.getDate() + days);
  return toLocalYmd(d) as Ymd;
}

export function yearMonthFromYmd(ymd: Ymd): string {
  return ymd.slice(0, 7);
}

export function monthStartYm(ym: string): Ymd {
  return `${ym}-01`;
}

export function monthEndYm(ym: string): Ymd {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export function labelYm(ym: string): string {
  return `${ym.slice(5)}/${ym.slice(2, 4)}`;
}

export function lastNMonths(asOf: Ymd, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = ymdToDate(asOf);
    d.setMonth(d.getMonth() - i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function emptyDual(labels: string[], aLabel = "A", bLabel = "B"): DualSeries {
  return { labels, a: labels.map(() => 0), b: labels.map(() => 0), aLabel, bLabel };
}

export function emptyNumber(labels: string[]): NumberSeries {
  return { labels, values: labels.map(() => 0) };
}

export function topSeriesPoints(
  map: Map<string, number>,
  labelOf: (id: string) => string,
  limit = 20
): SeriesPoint[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, value]) => ({ id, label: labelOf(id), value }));
}

export function sumMap(map: Map<string, number>): number {
  let s = 0;
  for (const v of map.values()) s += v;
  return s;
}
