/**
 * Dashboard operacional da Gestão de Pátio.
 * Métricas baseadas exclusivamente em diárias geradas no pátio (não financeiro).
 */
(function patioDashboardModule(global) {
  "use strict";

  let _cache = null;

  /** Período mínimo para médias operacionais do dashboard (abril/2026 em diante). */
  const PATIO_METRICS_FROM_YMD = "2026-04-01";

  function isCalendarYmd(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
  }

  function toLocalYmd(value) {
    if (!value) return null;
    const s = String(value).trim();
    if (isCalendarYmd(s)) return s;
    const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function todayYmd() {
    return toLocalYmd(new Date());
  }

  function ymdToDate(ymd) {
    return new Date(`${ymd}T12:00:00`);
  }

  function addDaysYmd(ymd, days) {
    const d = ymdToDate(ymd);
    d.setDate(d.getDate() + days);
    return toLocalYmd(d);
  }

  function yearMonthFromYmd(ymd) {
    if (!ymd || ymd.length < 7) return null;
    return ymd.slice(0, 7);
  }

  function monthStartYm(ym) {
    return `${ym}-01`;
  }

  function monthEndYm(ym) {
    const [y, m] = ym.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  }

  function enumerateYmdRange(fromYmd, toYmd) {
    if (!fromYmd || !toYmd || fromYmd > toYmd) return [];
    const out = [];
    let cur = fromYmd;
    while (cur <= toYmd) {
      out.push(cur);
      cur = addDaysYmd(cur, 1);
    }
    return out;
  }

  function isoWeekMondayYmd(ymd) {
    const d = ymdToDate(ymd);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    return toLocalYmd(d);
  }

  function isoWeekSundayYmd(mondayYmd) {
    return addDaysYmd(mondayYmd, 6);
  }

  function vehicleStayIncludesDay(vehicle, dayYmd, endCapYmd) {
    if (!vehicle?.data_entrada || !dayYmd) return false;
    const start = toLocalYmd(vehicle.data_entrada);
    if (!start || dayYmd < start) return false;
    if (vehicle.data_saida) {
      const end = toLocalYmd(vehicle.data_saida);
      if (!end) return false;
      return dayYmd <= end;
    }
    if (endCapYmd && dayYmd > endCapYmd) return false;
    return true;
  }

  function vehicleValorDiaria(vehicle) {
    const vd = Number(vehicle?.valor_diaria);
    return Number.isFinite(vd) && vd > 0 ? vd : 0;
  }

  function diariasGeradasNoDia(vehicles, dayYmd, endCapYmd) {
    let total = 0;
    for (const v of vehicles) {
      if (!vehicleStayIncludesDay(v, dayYmd, endCapYmd)) continue;
      total += vehicleValorDiaria(v);
    }
    return total;
  }

  function ocupacaoNoDia(vehicles, dayYmd, endCapYmd) {
    let count = 0;
    for (const v of vehicles) {
      if (vehicleStayIncludesDay(v, dayYmd, endCapYmd)) count++;
    }
    return count;
  }

  function buildDailyOccupancyMap(vehicles, fromYmd, toYmd, endCapYmd) {
    const map = new Map();
    for (const day of enumerateYmdRange(fromYmd, toYmd)) {
      map.set(day, ocupacaoNoDia(vehicles, day, endCapYmd));
    }
    return map;
  }

  function patioOpsVehicles(vehicles) {
    return (vehicles || []).filter((v) => v?.data_entrada);
  }

  function patioLastClosedDayYmd() {
    return addDaysYmd(todayYmd(), -1);
  }

  function ymdMax(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return a > b ? a : b;
  }

  function patioFirstOperationalDay(vehicles) {
    let min = null;
    for (const v of patioOpsVehicles(vehicles)) {
      const ymd = toLocalYmd(v.data_entrada);
      if (ymd && (!min || ymd < min)) min = ymd;
    }
    return min;
  }

  function patioMetricsStartYmd(vehicles) {
    const first = patioFirstOperationalDay(vehicles);
    if (!first) return PATIO_METRICS_FROM_YMD;
    return first > PATIO_METRICS_FROM_YMD ? first : PATIO_METRICS_FROM_YMD;
  }

  function vehicleRelevantInMetricsPeriod(vehicle, fromYmd) {
    if (!vehicle?.data_entrada || !fromYmd) return false;
    const entrada = toLocalYmd(vehicle.data_entrada);
    if (!entrada) return false;
    if (entrada >= fromYmd) return true;
    if (!vehicle.data_saida) return true;
    const saida = toLocalYmd(vehicle.data_saida);
    return !!(saida && saida >= fromYmd);
  }

  function vehiclesSignature(vehicles) {
    let maxTs = 0;
    for (const v of vehicles || []) {
      const ts = new Date(v.updated_at || v.data_saida || v.data_entrada || v.created_at || 0).getTime();
      if (Number.isFinite(ts)) maxTs = Math.max(maxTs, ts);
    }
    return `${(vehicles || []).length}:${maxTs}`;
  }

  function buildDailyTotalsMap(vehicles, fromYmd, toYmd, endCapYmd) {
    const map = new Map();
    for (const day of enumerateYmdRange(fromYmd, toYmd)) {
      map.set(day, diariasGeradasNoDia(vehicles, day, endCapYmd));
    }
    return map;
  }

  function sumMapValues(days, map) {
    let s = 0;
    for (const d of days) s += map.get(d) || 0;
    return s;
  }

  function avgOf(values) {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function vehicleStayDays(vehicle, endYmd) {
    if (!vehicle?.data_entrada) return 0;
    const start = toLocalYmd(vehicle.data_entrada);
    if (!start) return 0;
    const end = vehicle.data_saida ? toLocalYmd(vehicle.data_saida) : endYmd || todayYmd();
    if (!end || end < start) return 0;
    const diff = Math.ceil((ymdToDate(end).getTime() - ymdToDate(start).getTime()) / 86400000);
    return Math.max(1, diff);
  }

  function vehicleStayDaysInPeriod(vehicle, fromYmd, endYmd) {
    if (!vehicle?.data_entrada || !fromYmd) return 0;
    const entrada = toLocalYmd(vehicle.data_entrada);
    if (!entrada) return 0;
    const end = vehicle.data_saida ? toLocalYmd(vehicle.data_saida) : endYmd || todayYmd();
    if (!end || end < fromYmd) return 0;
    const start = ymdMax(entrada, fromYmd);
    if (!start || start > end) return 0;
    const diff = Math.ceil((ymdToDate(end).getTime() - ymdToDate(start).getTime()) / 86400000);
    return Math.max(1, diff);
  }

  function vehicleTotalDiariasGeradas(vehicle, endYmd) {
    return vehicleTotalDiariasGeradasInPeriod(vehicle, toLocalYmd(vehicle?.data_entrada), endYmd);
  }

  function vehicleTotalDiariasGeradasInPeriod(vehicle, fromYmd, endYmd) {
    const entrada = toLocalYmd(vehicle?.data_entrada);
    if (!entrada || !fromYmd) return 0;
    const cap = vehicle.data_saida ? toLocalYmd(vehicle.data_saida) : endYmd || todayYmd();
    if (!cap || cap < fromYmd) return 0;
    const start = ymdMax(entrada, fromYmd);
    if (!start || start > cap) return 0;
    const vd = vehicleValorDiaria(vehicle);
    if (!vd) return 0;
    let total = 0;
    for (const day of enumerateYmdRange(start, cap)) {
      if (vehicleStayIncludesDay(vehicle, day, vehicle.data_saida ? null : endYmd)) total += vd;
    }
    return total;
  }

  function pctChange(current, previous) {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  function computeMetrics(vehicles) {
    const ops = patioOpsVehicles(vehicles);
    const lastClosed = patioLastClosedDayYmd();
    const metricsFrom = patioMetricsStartYmd(ops);
    const opsPeriod = ops.filter((v) => vehicleRelevantInMetricsPeriod(v, PATIO_METRICS_FROM_YMD));
    const empty = {
      hasData: false,
      lastClosed,
      metricsFrom: PATIO_METRICS_FROM_YMD,
      dailyAvg: 0,
      dailyTrend: 0,
      dailySpark: [],
      weeklyAvg: 0,
      weeklyTrend: 0,
      weeklySpark: [],
      monthlyAvg: 0,
      monthlyTrend: 0,
      monthlySpark: [],
      avgStayDays: 0,
      stayTrend: 0,
      avgDiariasPerVehicle: 0,
      avgStayPerVehicle: 0,
      perVehicleTrend: 0,
      avgOccupancy: 0,
      occupancyTrend: 0,
      occupancySpark: [],
      occupancyLastClosed: 0,
      vehicleCount: opsPeriod.length,
      closedDays: 0,
    };
    if (!metricsFrom || metricsFrom > lastClosed || !opsPeriod.length) return empty;

    const dailyMap = buildDailyTotalsMap(ops, metricsFrom, lastClosed, lastClosed);
    const occupancyMap = buildDailyOccupancyMap(ops, metricsFrom, lastClosed, lastClosed);
    const closedDays = enumerateYmdRange(metricsFrom, lastClosed);
    const dailyTotals = closedDays.map((d) => dailyMap.get(d) || 0);
    const dailyOccupancy = closedDays.map((d) => occupancyMap.get(d) || 0);
    const dailyAvg = avgOf(dailyTotals);
    const avgOccupancy = avgOf(dailyOccupancy);
    const occupancyLast30 = dailyOccupancy.slice(-30);
    const occupancyPrev30 = dailyOccupancy.slice(-60, -30);
    const occupancyTrend = pctChange(avgOf(occupancyLast30), avgOf(occupancyPrev30));
    const occupancySpark = dailyOccupancy.slice(-14);
    const occupancyLastClosed = dailyOccupancy[dailyOccupancy.length - 1] || 0;

    const last30 = dailyTotals.slice(-30);
    const prev30 = dailyTotals.slice(-60, -30);
    const dailyTrend = pctChange(avgOf(last30), avgOf(prev30));
    const dailySpark = dailyTotals.slice(-14);

    const weekMap = new Map();
    for (const day of closedDays) {
      const mon = isoWeekMondayYmd(day);
      if (!weekMap.has(mon)) weekMap.set(mon, 0);
      weekMap.set(mon, weekMap.get(mon) + (dailyMap.get(day) || 0));
    }
    const completeWeeks = [...weekMap.entries()]
      .filter(([mon]) => isoWeekSundayYmd(mon) <= lastClosed)
      .sort((a, b) => a[0].localeCompare(b[0]));
    const weeklyTotals = completeWeeks.map(([, v]) => v);
    const weeklyAvg = avgOf(weeklyTotals);
    const last4w = weeklyTotals.slice(-4);
    const prev4w = weeklyTotals.slice(-8, -4);
    const weeklyTrend = pctChange(avgOf(last4w), avgOf(prev4w));
    const weeklySpark = weeklyTotals.slice(-8);

    const monthSet = new Set(closedDays.map(yearMonthFromYmd));
    const months = [...monthSet].sort();
    const monthlyTotals = months.map((ym) => {
      const mStart = monthStartYm(ym);
      const mEnd = monthEndYm(ym);
      const from = mStart < metricsFrom ? metricsFrom : mStart;
      const to = mEnd > lastClosed ? lastClosed : mEnd;
      return sumMapValues(enumerateYmdRange(from, to), dailyMap);
    });
    const monthlyAvg = avgOf(monthlyTotals);
    const last3m = monthlyTotals.slice(-3);
    const prev3m = monthlyTotals.slice(-6, -3);
    const monthlyTrend = pctChange(avgOf(last3m), avgOf(prev3m));
    const monthlySpark = monthlyTotals.slice(-6);

    const today = todayYmd();
    const stayDaysList = opsPeriod.map((v) => vehicleStayDaysInPeriod(v, PATIO_METRICS_FROM_YMD, today));
    const avgStayDays = avgOf(stayDaysList);

    const exited = opsPeriod
      .filter((v) => v.data_saida)
      .sort((a, b) => String(b.data_saida).localeCompare(String(a.data_saida)));
    const recentExited = exited.slice(0, Math.min(20, exited.length));
    const priorExited = exited.slice(20, 40);
    const stayTrend = pctChange(
      avgOf(recentExited.map((v) => vehicleStayDaysInPeriod(v, PATIO_METRICS_FROM_YMD, toLocalYmd(v.data_saida)))),
      avgOf(priorExited.map((v) => vehicleStayDaysInPeriod(v, PATIO_METRICS_FROM_YMD, toLocalYmd(v.data_saida))))
    );

    const diariasPerVehicle = opsPeriod.map((v) =>
      vehicleTotalDiariasGeradasInPeriod(v, PATIO_METRICS_FROM_YMD, today)
    );
    const avgDiariasPerVehicle = avgOf(diariasPerVehicle);
    const avgStayPerVehicle = avgStayDays;

    const sixMonthsAgo = addDaysYmd(today, -183);
    const recentOps = opsPeriod.filter((v) => {
      const ent = toLocalYmd(v.data_entrada);
      return ent && ent >= sixMonthsAgo;
    });
    const olderOps = opsPeriod.filter((v) => {
      const ent = toLocalYmd(v.data_entrada);
      return ent && ent < sixMonthsAgo;
    });
    const perVehicleTrend = pctChange(
      avgOf(recentOps.map((v) => vehicleTotalDiariasGeradasInPeriod(v, PATIO_METRICS_FROM_YMD, today))),
      avgOf(olderOps.map((v) => vehicleTotalDiariasGeradasInPeriod(v, PATIO_METRICS_FROM_YMD, today)))
    );

    return {
      hasData: true,
      lastClosed,
      metricsFrom: PATIO_METRICS_FROM_YMD,
      dailyAvg,
      dailyTrend,
      dailySpark,
      weeklyAvg,
      weeklyTrend,
      weeklySpark,
      monthlyAvg,
      monthlyTrend,
      monthlySpark,
      avgStayDays,
      stayTrend,
      avgDiariasPerVehicle,
      avgStayPerVehicle,
      perVehicleTrend,
      avgOccupancy,
      occupancyTrend,
      occupancySpark,
      occupancyLastClosed,
      vehicleCount: ops.length,
      closedDays: closedDays.length,
    };
  }

  function getMetrics(vehicles) {
    const sig = vehiclesSignature(vehicles);
    const lastClosed = patioLastClosedDayYmd();
    const key = `${sig}:${lastClosed}`;
    if (_cache?.key === key) return _cache.data;
    const data = computeMetrics(vehicles);
    _cache = { key, data };
    return data;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTrend(pct, invert) {
    if (!Number.isFinite(pct) || Math.abs(pct) < 0.05) {
      return { text: "estável", cls: "patio-ops-trend--flat", arrow: "→" };
    }
    const up = pct > 0;
    const positive = invert ? !up : up;
    return {
      text: `${up ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%`,
      cls: positive ? "patio-ops-trend--up" : "patio-ops-trend--down",
      arrow: up ? "↑" : "↓",
    };
  }

  function sparklineSvg(values, color) {
    if (!values?.length) return "";
    const w = 88;
    const h = 32;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const pts = values
      .map((v, i) => {
        const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
        const y = h - ((v - min) / span) * (h - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const fillPts = `0,${h} ${pts} ${w},${h}`;
    return `<svg class="patio-ops-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <polygon points="${fillPts}" fill="${color}" opacity="0.12"></polygon>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>`;
  }

  function iconSvg(name) {
    const icons = {
      daily:
        '<path d="M4 20V10M12 20V4M20 20v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      weekly:
        '<rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      monthly:
        '<path d="M6 4v16M6 12h12M18 4v16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      stay:
        '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      vehicle:
        '<path d="M4 16l2-6h12l2 6M6 16h12M8 20h2M14 20h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      occupancy:
        '<rect x="3" y="4" width="7" height="16" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/><rect x="14" y="4" width="7" height="16" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M6.5 9h0M17.5 9h0M6.5 15h0M17.5 15h0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    };
    const body = icons[name] || icons.daily;
    return `<svg class="patio-ops-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${body}</svg>`;
  }

  function renderCard(opts) {
    const trend = formatTrend(opts.trend, opts.invertTrend);
    const fmt = opts.formatCurrency || ((n) => String(n));
    const valueHtml =
      opts.valueType === "currency"
        ? escapeHtml(fmt(opts.value))
        : escapeHtml(String(opts.value));
    return `<article class="patio-ops-card patio-ops-card--${escapeHtml(opts.theme)}">
      <div class="patio-ops-card-top">
        <div class="patio-ops-card-icon">${iconSvg(opts.icon)}</div>
        <div class="patio-ops-card-trend ${trend.cls}" title="${escapeHtml(opts.trendLabel)}">
          <span class="patio-ops-trend-arrow">${trend.arrow}</span>
          <span>${escapeHtml(trend.text)}</span>
        </div>
      </div>
      <span class="patio-ops-card-label">${escapeHtml(opts.label)}</span>
      <strong class="patio-ops-card-value">${valueHtml}</strong>
      <small class="patio-ops-card-meta">${escapeHtml(opts.meta)}</small>
      <div class="patio-ops-card-spark">${sparklineSvg(opts.spark, opts.sparkColor)}</div>
      <small class="patio-ops-card-compare">${escapeHtml(opts.compare)}</small>
    </article>`;
  }

  function patioDashboardRender(vehicles, ctx) {
    const el = document.getElementById("patioDashOpsCards");
    if (!el) return;
    const formatCurrency = ctx?.formatCurrency || ((n) => `R$ ${Number(n || 0).toFixed(2)}`);
    const m = getMetrics(vehicles);
    const footnote = m.hasData
      ? `Base: ${m.closedDays} dia(s) fechado(s) até ${m.lastClosed?.split("-").reverse().join("/") || "—"}`
      : "Sem histórico operacional suficiente";

    if (!m.hasData) {
      el.innerHTML = `<p class="patio-ops-empty">${escapeHtml(footnote)}</p>`;
      return;
    }

    const fmtDays = (n) => `${Number(n).toFixed(1).replace(".", ",")} dias`;
    const fmtVehicles = (n) => `${Number(n).toFixed(1).replace(".", ",")} veíc.`;

    el.innerHTML = [
      renderCard({
        theme: "daily",
        icon: "daily",
        label: "Média diária gerada",
        value: m.dailyAvg,
        valueType: "currency",
        formatCurrency,
        meta: "diárias operacionais / dia fechado",
        trend: m.dailyTrend,
        trendLabel: "vs. 30 dias anteriores",
        compare: "Comparado aos 30 dias fechados anteriores",
        spark: m.dailySpark,
        sparkColor: "#34d399",
      }),
      renderCard({
        theme: "weekly",
        icon: "weekly",
        label: "Média semanal gerada",
        value: m.weeklyAvg,
        valueType: "currency",
        formatCurrency,
        meta: "semanas completas no histórico",
        trend: m.weeklyTrend,
        trendLabel: "vs. 4 semanas anteriores",
        compare: "Média real por semana fechada (não projetada)",
        spark: m.weeklySpark,
        sparkColor: "#60a5fa",
      }),
      renderCard({
        theme: "monthly",
        icon: "monthly",
        label: "Média mensal gerada",
        value: m.monthlyAvg,
        valueType: "currency",
        formatCurrency,
        meta: "meses com dias encerrados",
        trend: m.monthlyTrend,
        trendLabel: "vs. 3 meses anteriores",
        compare: "Soma real por mês / meses analisados",
        spark: m.monthlySpark,
        sparkColor: "#a78bfa",
      }),
      renderCard({
        theme: "occupancy",
        icon: "occupancy",
        label: "Média de ocupação do pátio",
        value: fmtVehicles(m.avgOccupancy),
        meta: `último dia fechado: ${m.occupancyLastClosed} veículo(s)`,
        trend: m.occupancyTrend,
        trendLabel: "vs. 30 dias anteriores",
        compare: "Veículos no pátio por dia fechado (média histórica)",
        spark: m.occupancySpark,
        sparkColor: "#22d3ee",
      }),
      renderCard({
        theme: "stay",
        icon: "stay",
        label: "Tempo médio de permanência",
        value: fmtDays(m.avgStayDays),
        meta: `${m.vehicleCount} veículo(s) no histórico`,
        trend: m.stayTrend,
        invertTrend: true,
        trendLabel: "vs. saídas anteriores",
        compare: "Entrada → saída (ativos até hoje)",
        spark: [],
        sparkColor: "#fbbf24",
      }),
      renderCard({
        theme: "vehicle",
        icon: "vehicle",
        label: "Média operacional / veículo",
        value: m.avgDiariasPerVehicle,
        valueType: "currency",
        formatCurrency,
        meta: `permanência média ${fmtDays(m.avgStayPerVehicle)}`,
        trend: m.perVehicleTrend,
        trendLabel: "entradas recentes vs. anteriores",
        compare: "Diárias geradas acumuladas ÷ veículos",
        spark: [],
        sparkColor: "#f472b6",
      }),
      `<p class="patio-ops-footnote">${escapeHtml(footnote)} · ${m.vehicleCount} veículo(s)</p>`,
    ].join("");
  }

  function patioDashboardInvalidateCache() {
    _cache = null;
  }

  global.patioDashboardRender = patioDashboardRender;
  global.patioDashboardInvalidateCache = patioDashboardInvalidateCache;
  global.patioDashboardGetMetrics = getMetrics;
})(typeof window !== "undefined" ? window : globalThis);
