/**
 * Dashboard inteligente — Rede de Parceiros (RPV).
 * Mesmo padrão visual/técnico dos dashboards Financeiro e Pátio.
 */
(function partnersDashboardModule(global) {
  "use strict";

  let _cache = null;
  let _bound = false;
  let _filterPeriod = "30d";
  let _filterPartnerId = "";
  let _filterCustomDe = "";
  let _filterCustomAte = "";
  let _rankSort = { revenue: "revenue", vehicles: "vehicles", conversion: "conversion" };
  let _detailKey = null;

  const METRICS_FROM_YMD = "2026-04-01";

  function isCalendarYmd(v) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
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

  function pctChange(current, previous) {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  function inRange(ymd, fromYmd, toYmd) {
    if (!ymd) return false;
    if (fromYmd && ymd < fromYmd) return false;
    if (toYmd && ymd > toYmd) return false;
    return true;
  }

  function resolvePeriodRange(period, customDe, customAte) {
    const today = todayYmd();
    const curYm = yearMonthFromYmd(today);
    switch (period) {
      case "today":
        return { from: today, to: today, label: "Hoje" };
      case "7d":
        return { from: addDaysYmd(today, -6), to: today, label: "Últimos 7 dias" };
      case "30d":
        return { from: addDaysYmd(today, -29), to: today, label: "Últimos 30 dias" };
      case "week": {
        const dow = ymdToDate(today).getDay();
        const diff = dow === 0 ? -6 : 1 - dow;
        const mon = addDaysYmd(today, diff);
        return { from: mon, to: today, label: "Semana atual" };
      }
      case "month":
        return { from: monthStartYm(curYm), to: today, label: "Mês atual" };
      case "year":
        return { from: `${today.slice(0, 4)}-01-01`, to: today, label: "Ano atual" };
      case "custom":
        if (customDe && customAte) {
          const [a, b] = customDe <= customAte ? [customDe, customAte] : [customAte, customDe];
          return { from: a, to: b, label: `${a.split("-").reverse().join("/")} – ${b.split("-").reverse().join("/")}` };
        }
        return { from: addDaysYmd(today, -29), to: today, label: "Período personalizado" };
      default:
        return { from: addDaysYmd(today, -29), to: today, label: "Últimos 30 dias" };
    }
  }

  function prevPeriodRange(range) {
    if (!range.from || !range.to) return { from: null, to: null };
    const days =
      Math.round((ymdToDate(range.to).getTime() - ymdToDate(range.from).getTime()) / 86400000) + 1;
    const prevTo = addDaysYmd(range.from, -1);
    const prevFrom = addDaysYmd(prevTo, -(days - 1));
    return { from: prevFrom, to: prevTo };
  }

  function dataSignature(data) {
    const p = (data?.partners || []).length;
    const v = (data?.vehicles || []).length;
    const r = (data?.receivables || []).length;
    const c = (data?.cash || []).length;
    const lastP = (data?.partners || [])[0]?.updated_at || (data?.partners || [])[0]?.created_at || "";
    const lastV = (data?.vehicles || [])[0]?.updated_at || "";
    return `${p}:${v}:${r}:${c}:${lastP}:${lastV}:${_filterPeriod}:${_filterPartnerId}:${_filterCustomDe}:${_filterCustomAte}:v4`;
  }

  function activePartners(partners) {
    return (partners || []).filter((p) => {
      const st = String(p?.status || p?.ativo || "ativo").toLowerCase();
      return st !== "inativo" && st !== "false" && st !== "0";
    });
  }

  function vehicleMaps(vehicles) {
    return new Map((vehicles || []).map((v) => [String(v.id), v]));
  }

  function receivableMaps(receivables) {
    return new Map((receivables || []).map((r) => [String(r.id), r]));
  }

  function receivableValor(r) {
    return Math.max(0, Number(r?.valor || 0));
  }

  function receivableFaturamentoYmd(r, vehicle) {
    if (!r) return null;
    if (typeof global.financeReceivableSaidaYmd === "function") {
      const ymd = global.financeReceivableSaidaYmd(r, vehicle);
      if (ymd) return ymd;
    }
    return toLocalYmd(r.period_end || r.data_vencimento || r.updated_at || r.created_at);
  }

  function cashValor(m) {
    return Math.max(0, Number(m?.valor || 0));
  }

  function partnerVehicleEntryYmd(v) {
    return toLocalYmd(v?.data_entrada || v?.created_at);
  }

  function updateLastYmd(current, candidate) {
    if (!candidate) return current;
    if (!current || candidate > current) return candidate;
    return current;
  }

  function dedupeCash(list) {
    if (typeof global.financeDedupeCaixaMovs === "function") {
      return global.financeDedupeCaixaMovs(list || []);
    }
    return list || [];
  }

  function dedupeReceivables(list) {
    if (typeof global.financeDedupePatioReceivables === "function") {
      return global.financeDedupePatioReceivables(list || []);
    }
    return list || [];
  }

  function vehicleRemoved(v) {
    return String(v?.status || "").toUpperCase() === "REMOVIDO";
  }

  /** Um faturamento por veículo (evita títulos/sync duplicados no mesmo RPV). */
  function partnerRevenueCycleKey(vehicleId) {
    return String(vehicleId);
  }

  function initPartnerBucket(byPartner, p) {
    byPartner.set(String(p.id), {
      id: p.id,
      nome: p.nome || "Parceiro",
      vehicles: 0,
      revenue: 0,
      revenueVehicles: 0,
      cycleRevenue: new Map(),
      lastActivityYmd: null,
      createdAt: toLocalYmd(p.created_at),
    });
  }

  function addPartnerCycleRevenue(bucket, cycleKey, amount, activityYmd) {
    const val = Math.max(0, Number(amount || 0));
    if (!val || !cycleKey) return;
    const prev = bucket.cycleRevenue.get(cycleKey);
    // Em duplicatas do mesmo veículo, usa o menor valor (corrige títulos inflados no caixa).
    bucket.cycleRevenue.set(cycleKey, prev == null ? val : Math.min(prev, val));
    bucket.lastActivityYmd = updateLastYmd(bucket.lastActivityYmd, activityYmd);
  }

  function finalizePartnerBuckets(byPartner) {
    return [...byPartner.values()].map((row) => {
      const cycles = row.cycleRevenue ? [...row.cycleRevenue.values()] : [];
      const revenue = cycles.reduce((acc, n) => acc + n, 0);
      const revenueVehicles = row.cycleRevenue ? row.cycleRevenue.size : 0;
      const denom = revenueVehicles > 0 ? revenueVehicles : row.vehicles;
      return {
        id: row.id,
        nome: row.nome,
        vehicles: row.vehicles,
        revenue,
        revenueVehicles,
        lastActivityYmd: row.lastActivityYmd,
        createdAt: row.createdAt,
        ticket: denom > 0 ? revenue / denom : 0,
        conversion: denom > 0 ? revenue / denom : 0,
      };
    });
  }

  function buildPartnerAggregates(data, range, partnerFilterId) {
    const partners = activePartners(data.partners);
    const vehMap = vehicleMaps(data.vehicles);
    const recMap = receivableMaps(dedupeReceivables(data.receivables));
    const cash = dedupeCash(data.cash);

    const byPartner = new Map();
    for (const p of partners) {
      initPartnerBucket(byPartner, p);
    }

    // Faturamento real: somente entradas RECEBER no caixa (valor do movimento), veículo REMOVIDO.
    // Igual ao ranking legado «Top retorno financeiro» — sem fallback inflado em receivable.valor.
    for (const m of cash) {
      if (String(m?.tipo_conta || "").toUpperCase() !== "RECEBER") continue;
      if (m?.conta_id == null || m.conta_id === "") continue;

      const rec = recMap.get(String(m.conta_id));
      if (!rec?.vehicle_id) continue;
      const v = vehMap.get(String(rec.vehicle_id));
      if (!v?.localizador_id || !vehicleRemoved(v)) continue;

      const pid = String(v.localizador_id);
      if (!byPartner.has(pid)) continue;
      if (partnerFilterId && pid !== String(partnerFilterId)) continue;

      const ymd = toLocalYmd(m.data_movimento || m.created_at);
      if (!ymd || !inRange(ymd, range.from, range.to)) continue;

      const rawVal = Number(m.valor ?? 0);
      if (!Number.isFinite(rawVal) || rawVal <= 0) continue;
      const recVal = receivableValor(rec);
      const val = recVal > 0 ? Math.min(rawVal, recVal) : rawVal;
      if (val <= 0) continue;

      const cycleKey = partnerRevenueCycleKey(v.id);
      addPartnerCycleRevenue(byPartner.get(pid), cycleKey, val, ymd);
    }

    for (const v of data.vehicles || []) {
      if (!v?.localizador_id) continue;
      const pid = String(v.localizador_id);
      if (!byPartner.has(pid)) continue;
      if (partnerFilterId && pid !== String(partnerFilterId)) continue;

      const entryYmd = partnerVehicleEntryYmd(v);
      const exitYmd = toLocalYmd(v.data_saida || v.updated_at);
      const bucket = byPartner.get(pid);
      bucket.lastActivityYmd = updateLastYmd(bucket.lastActivityYmd, exitYmd || entryYmd);

      if (entryYmd && inRange(entryYmd, range.from, range.to)) {
        bucket.vehicles += 1;
      }
    }

    return finalizePartnerBuckets(byPartner);
  }

  function sumRows(rows, field) {
    return rows.reduce((acc, r) => acc + Number(r[field] || 0), 0);
  }

  function countPartnersCreatedInRange(partners, fromYmd, toYmd) {
    return (partners || []).filter((p) => {
      const ymd = toLocalYmd(p.created_at);
      return ymd && inRange(ymd, fromYmd, toYmd);
    }).length;
  }

  function buildMonthlySeries(data, months = 6) {
    const today = todayYmd();
    const curYm = yearMonthFromYmd(today);
    const [cy, cm] = curYm.split("-").map(Number);
    const labels = [];
    const revenue = [];
    const vehicles = [];
    const newPartners = [];

    for (let i = months - 1; i >= 0; i--) {
      let m = cm - i;
      let y = cy;
      while (m < 1) {
        m += 12;
        y -= 1;
      }
      const ym = `${y}-${String(m).padStart(2, "0")}`;
      const from = monthStartYm(ym);
      const to = monthEndYm(ym);
      const cappedTo = to > today ? today : to;
      const range = { from: from < METRICS_FROM_YMD ? METRICS_FROM_YMD : from, to: cappedTo };
      const rows = buildPartnerAggregates(data, range, _filterPartnerId);
      labels.push(ym);
      revenue.push(sumRows(rows, "revenue"));
      vehicles.push(sumRows(rows, "vehicles"));
      newPartners.push(countPartnersCreatedInRange(data.partners, range.from, range.to));
    }
    return { labels, revenue, vehicles, newPartners };
  }

  function computeMetrics(data) {
    const partners = activePartners(data.partners);
    const range = resolvePeriodRange(_filterPeriod, _filterCustomDe, _filterCustomAte);
    const prev = prevPeriodRange(range);
    const rows = buildPartnerAggregates(data, range, _filterPartnerId);
    const prevRows = buildPartnerAggregates(data, prev, _filterPartnerId);

    const totalPartners = partners.length;
    const curYm = yearMonthFromYmd(todayYmd());
    const prevYm = yearMonthFromYmd(addDaysYmd(monthStartYm(curYm), -1));
    const partnersThisMonth = countPartnersCreatedInRange(partners, monthStartYm(curYm), todayYmd());
    const partnersPrevMonth = countPartnersCreatedInRange(
      partners,
      monthStartYm(prevYm),
      monthEndYm(prevYm)
    );
    const partnerGrowthPct = pctChange(partnersThisMonth, partnersPrevMonth);

    const totalRevenue = sumRows(rows, "revenue");
    const prevRevenue = sumRows(prevRows, "revenue");
    const revenueTrend = pctChange(totalRevenue, prevRevenue);

    const totalVehicles = sumRows(rows, "vehicles");
    const prevVehicles = sumRows(prevRows, "vehicles");
    const vehiclesTrend = pctChange(totalVehicles, prevVehicles);

    const ticketMedio = totalVehicles > 0 ? totalRevenue / totalVehicles : 0;
    const prevTicket = prevVehicles > 0 ? prevRevenue / prevVehicles : 0;
    const ticketTrend = pctChange(ticketMedio, prevTicket);

    const monthlySeries = buildMonthlySeries(data, 6);
    const ticketSpark = monthlySeries.revenue.map((rev, i) => {
      const v = monthlySeries.vehicles[i] || 0;
      return v > 0 ? rev / v : 0;
    });

    const rankedRevenue = [...rows].sort((a, b) => b.revenue - a.revenue);
    const rankedVehicles = [...rows].sort((a, b) => b.vehicles - a.vehicles);
    const rankedActive = [...rows].sort((a, b) => b.vehicles + b.revenue - (a.vehicles + a.revenue));
    const rankedConversion = [...rows]
      .filter((r) => r.revenue > 0 && r.revenueVehicles > 0)
      .sort((a, b) => b.conversion - a.conversion);

    const inactive = partners
      .map((p) => {
        const row = rows.find((r) => String(r.id) === String(p.id)) || {
          id: p.id,
          nome: p.nome,
          vehicles: 0,
          revenue: 0,
          lastActivityYmd: null,
        };
        const allTime = buildPartnerAggregates(data, { from: METRICS_FROM_YMD, to: todayYmd() }, String(p.id))[0];
        const lastYmd = allTime?.lastActivityYmd || toLocalYmd(p.created_at);
        const daysIdle = lastYmd ? Math.max(0, Math.round((ymdToDate(todayYmd()) - ymdToDate(lastYmd)) / 86400000)) : null;
        const noMovementInPeriod = row.vehicles === 0 && row.revenue === 0;
        return { ...row, lastYmd, daysIdle, noMovementInPeriod };
      })
      .filter((p) => p.noMovementInPeriod);

    const monthsInRange = Math.max(
      1,
      Math.round((ymdToDate(range.to).getTime() - ymdToDate(range.from).getTime()) / (86400000 * 30))
    );
    const avgMonthlyVehicles = totalVehicles / monthsInRange;

    return {
      hasData: partners.length > 0 || (data.vehicles || []).some((v) => v.localizador_id),
      range,
      prev,
      totalPartners,
      partnerGrowthPct,
      partnersThisMonth,
      totalRevenue,
      revenueTrend,
      revenueSpark: monthlySeries.revenue,
      totalVehicles,
      vehiclesTrend,
      vehiclesSpark: monthlySeries.vehicles,
      ticketMedio,
      ticketTrend,
      ticketSpark,
      rankedRevenue,
      rankedVehicles,
      rankedActive,
      rankedConversion,
      inactive,
      avgMonthlyVehicles,
      monthlySeries,
      totalRevenueShare: (id) => {
        if (!totalRevenue) return 0;
        const row = rows.find((r) => String(r.id) === String(id));
        return row ? (row.revenue / totalRevenue) * 100 : 0;
      },
    };
  }

  function getMetrics(data) {
    const key = dataSignature(data);
    if (_cache?.key === key) return _cache.data;
    const result = computeMetrics(data);
    _cache = { key, data: result };
    return result;
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
      return { text: "estável", cls: "partner-ops-trend--flat", arrow: "→" };
    }
    const up = pct > 0;
    const positive = invert ? !up : up;
    return {
      text: `${up ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%`,
      cls: positive ? "partner-ops-trend--up" : "partner-ops-trend--down",
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
    return `<svg class="partner-ops-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <polygon points="0,${h} ${pts} ${w},${h}" fill="${color}" opacity="0.12"></polygon>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>`;
  }

  function multiBarChartSvg(series, colors, height) {
    const labels = series.labels || [];
    if (!labels.length) return "";
    const w = 640;
    const h = height || 200;
    const pad = { l: 8, r: 8, t: 12, b: 28 };
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const datasets = series.datasets || [];
    const max = Math.max(1, ...datasets.flatMap((d) => d.values || []));
    const groupW = innerW / labels.length;
    const barW = Math.min(18, (groupW / Math.max(datasets.length, 1)) * 0.7);

    let bars = "";
    labels.forEach((lbl, i) => {
      const gx = pad.l + i * groupW + groupW / 2;
      datasets.forEach((ds, di) => {
        const val = (ds.values || [])[i] || 0;
        const bh = (val / max) * innerH;
        const x = gx - (datasets.length * barW) / 2 + di * barW;
        const y = pad.t + innerH - bh;
        bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${colors[di] || "#60a5fa"}" opacity="0.88"></rect>`;
      });
      const lx = gx;
      const ly = h - 8;
      bars += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.55">${escapeHtml(lbl.slice(5))}</text>`;
    });

    return `<svg class="partner-evolution-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Evolução mensal">
      ${bars}
    </svg>`;
  }

  function iconSvg(name) {
    const icons = {
      partners:
        '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
      active:
        '<path d="M13 2L3 14h9l-1 8 11-14h-9l1-6z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      ticket:
        '<path d="M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V8z" stroke="currentColor" stroke-width="2" fill="none"/>',
      revenue:
        '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
      vehicles:
        '<path d="M4 16l2-6h12l2 6M6 16h12M8 20h2M14 20h2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
      billing:
        '<path d="M4 20V10M12 20V4M20 20v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      conversion:
        '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      idle:
        '<path d="M12 9v4M12 17h.01M10.3 4.3l-7.2 12.4A2 2 0 0 0 4.7 20h14.6a2 2 0 0 0 1.6-3.3L13.7 4.3a2 2 0 0 0-3.4 0z" stroke="currentColor" stroke-width="2" fill="none"/>',
      growth:
        '<path d="M23 6l-9.5 9.5-4-4L1 18M23 6h-6M23 6v6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    };
    return `<svg class="partner-ops-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${icons[name] || icons.partners}</svg>`;
  }

  function renderCard(opts) {
    const trend = formatTrend(opts.trend, opts.invertTrend);
    const fmt = opts.formatCurrency || ((n) => String(n));
    const value =
      opts.valueType === "currency"
        ? escapeHtml(fmt(opts.value))
        : opts.valueType === "pct"
          ? escapeHtml(`${Number(opts.value).toFixed(1).replace(".", ",")}%`)
          : escapeHtml(String(opts.value));
    const clickable = opts.detailKey ? ` data-partner-dash-card="${escapeHtml(opts.detailKey)}" tabindex="0" role="button"` : "";
    return `<article class="partner-ops-card partner-ops-card--${escapeHtml(opts.theme)} partner-ops-card--clickable"${clickable}>
      <div class="partner-ops-card-top">
        <div class="partner-ops-card-icon">${iconSvg(opts.icon)}</div>
        <div class="partner-ops-card-trend ${trend.cls}" title="${escapeHtml(opts.trendLabel || "")}">
          <span>${trend.arrow}</span><span>${escapeHtml(trend.text)}</span>
        </div>
      </div>
      <span class="partner-ops-card-label">${escapeHtml(opts.label)}</span>
      <strong class="partner-ops-card-value">${value}</strong>
      <small class="partner-ops-card-meta">${escapeHtml(opts.meta || "")}</small>
      <div class="partner-ops-card-spark">${sparklineSvg(opts.spark, opts.sparkColor || "#60a5fa")}</div>
      <small class="partner-ops-card-compare">${escapeHtml(opts.compare || "")}</small>
    </article>`;
  }

  function renderRankTable(rows, opts) {
    const fmt = opts.formatCurrency || ((n) => String(n));
    const sortKey = opts.sortKey || "revenue";
    const sorted = [...rows].sort((a, b) => Number(b[sortKey] || 0) - Number(a[sortKey] || 0));
    if (!sorted.length) {
      return `<p class="partner-rank-empty">Sem movimentação no período.</p>`;
    }
    return `<div class="partner-rank-table-wrap table-wrap">
      <table class="table partner-rank-table">
        <thead><tr>
          <th>#</th><th>Parceiro</th><th>Veíc.</th><th>Faturado</th><th>Ticket</th><th>Part.</th>
        </tr></thead>
        <tbody>
          ${sorted
            .slice(0, opts.limit || 10)
            .map((r, i) => {
              const share = opts.shareFn ? opts.shareFn(r.id) : 0;
              return `<tr data-partner-rank-id="${escapeHtml(r.id)}" class="partner-rank-row" tabindex="0">
                <td data-label="#">${i + 1}</td>
                <td data-label="Parceiro">${escapeHtml(r.nome)}</td>
                <td data-label="Veíc.">${r.vehicles}</td>
                <td data-label="Faturado">${escapeHtml(fmt(r.revenue))}</td>
                <td data-label="Ticket">${escapeHtml(fmt(r.ticket))}</td>
                <td data-label="Part.">${share.toFixed(1).replace(".", ",")}%</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;
  }

  function renderDetailPanel(m, opts) {
    const el = document.getElementById("partnerDashDetail");
    if (!el) return;
    if (!_detailKey) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    const fmt = opts.formatCurrency || ((n) => String(n));
    let title = "";
    let body = "";
    switch (_detailKey) {
      case "active":
        title = "Parceiros mais ativos";
        body = renderRankTable(m.rankedActive, { formatCurrency: fmt, shareFn: m.totalRevenueShare, sortKey: "vehicles", limit: 20 });
        break;
      case "total":
        title = "Parceiros cadastrados";
        body = `<p>${m.totalPartners} parceiro(s) ativo(s). +${m.partnersThisMonth} neste mês.</p>`;
        break;
      case "revenue":
        title = "Faturamento por parceiros";
        body = renderRankTable(m.rankedRevenue, { formatCurrency: fmt, shareFn: m.totalRevenueShare, sortKey: "revenue", limit: 20 });
        break;
      case "vehicles":
        title = "Veículos recebidos via parceiros";
        body = renderRankTable(m.rankedVehicles, { formatCurrency: fmt, shareFn: m.totalRevenueShare, sortKey: "vehicles", limit: 20 });
        break;
      case "ticket":
        title = "Ticket médio por parceiro";
        body = renderRankTable(m.rankedRevenue, { formatCurrency: fmt, shareFn: m.totalRevenueShare, sortKey: "ticket", limit: 20 });
        break;
      case "conversion":
        title = "Conversão financeira (R$ / veículo)";
        body = renderRankTable(m.rankedConversion, { formatCurrency: fmt, shareFn: m.totalRevenueShare, sortKey: "conversion", limit: 20 });
        break;
      case "inactive":
        title = "Parceiros sem movimentação";
        body =
          m.inactive.length === 0
            ? `<p class="partner-rank-empty">Todos os parceiros tiveram movimentação no período.</p>`
            : `<div class="table-wrap"><table class="table"><thead><tr><th>Parceiro</th><th>Última mov.</th><th>Dias parado</th></tr></thead><tbody>
              ${m.inactive
                .map(
                  (p) => `<tr><td>${escapeHtml(p.nome)}</td><td>${p.lastYmd ? escapeHtml(p.lastYmd.split("-").reverse().join("/")) : "—"}</td><td>${p.daysIdle ?? "—"}</td></tr>`
                )
                .join("")}
            </tbody></table></div>`;
        break;
      default:
        title = "Detalhes";
        body = renderRankTable(m.rankedActive, { formatCurrency: fmt, shareFn: m.totalRevenueShare, limit: 15 });
    }
    el.classList.remove("hidden");
    el.innerHTML = `<div class="partner-dash-detail-inner section-card">
      <div class="partner-dash-detail-head">
        <h4>${escapeHtml(title)}</h4>
        <button type="button" class="secondary" data-partner-dash-detail-close aria-label="Fechar">×</button>
      </div>
      ${body}
    </div>`;
  }

  function syncFiltersFromDom() {
    const periodEl = document.getElementById("partnerDashFilterPeriod");
    const partnerEl = document.getElementById("partnerDashFilterPartner");
    const deEl = document.getElementById("partnerDashFilterDe");
    const ateEl = document.getElementById("partnerDashFilterAte");
    if (periodEl) _filterPeriod = periodEl.value || "30d";
    if (partnerEl) _filterPartnerId = partnerEl.value || "";
    if (deEl) _filterCustomDe = deEl.value || "";
    if (ateEl) _filterCustomAte = ateEl.value || "";
    const customWrap = document.getElementById("partnerDashCustomRange");
    if (customWrap) customWrap.classList.toggle("hidden", _filterPeriod !== "custom");
  }

  function populatePartnerFilter(partners) {
    const sel = document.getElementById("partnerDashFilterPartner");
    if (!sel || sel.dataset.filled === "1") return;
    const list = (partners || []).slice().sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
    sel.innerHTML =
      `<option value="">Todos os parceiros</option>` +
      list.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome || "-")}</option>`).join("");
    sel.dataset.filled = "1";
    if (_filterPartnerId) sel.value = _filterPartnerId;
  }

  function partnersDashboardRender(data, ctx) {
    const cardsEl = document.getElementById("partnerDashCards");
    if (!cardsEl) return;
    syncFiltersFromDom();
    populatePartnerFilter(data.partners);
    const formatCurrency = ctx?.formatCurrency || ((n) => `R$ ${Number(n || 0).toFixed(2)}`);
    const m = getMetrics(data);

    if (!m.hasData) {
      cardsEl.innerHTML = `<p class="partner-ops-footnote">Cadastre parceiros e vincule RPV nos veículos para gerar métricas.</p>`;
      return;
    }

    const footnote = `Período: ${m.range.label} · comparativo vs. período anterior equivalente`;

    cardsEl.innerHTML = [
      renderCard({
        theme: "total",
        icon: "partners",
        label: "Total de parceiros",
        value: m.totalPartners,
        meta: `+${m.partnersThisMonth} novo(s) no mês`,
        trend: m.partnerGrowthPct,
        trendLabel: "crescimento mensal",
        compare: "Parceiros ativos cadastrados",
        spark: m.monthlySeries.newPartners,
        sparkColor: "#a78bfa",
        detailKey: "total",
      }),
      renderCard({
        theme: "active",
        icon: "active",
        label: "Parceiros mais ativos",
        value: m.rankedActive[0]?.nome ? m.rankedActive[0].nome.slice(0, 18) : "—",
        meta: m.rankedActive[0]
          ? `${m.rankedActive[0].vehicles} veíc. · ${formatCurrency(m.rankedActive[0].revenue)}`
          : "sem movimentação",
        trend: m.vehiclesTrend,
        trendLabel: "volume no período",
        compare: "Ranking por veículos + faturamento",
        spark: m.vehiclesSpark,
        sparkColor: "#34d399",
        detailKey: "active",
      }),
      renderCard({
        theme: "ticket",
        icon: "ticket",
        label: "Ticket médio mensal",
        value: m.ticketMedio,
        valueType: "currency",
        formatCurrency,
        meta: "faturamento ÷ veículos no período",
        trend: m.ticketTrend,
        trendLabel: "vs. período anterior",
        compare: footnote,
        spark: m.ticketSpark,
        sparkColor: "#f472b6",
        detailKey: "ticket",
      }),
      renderCard({
        theme: "revenue",
        icon: "revenue",
        label: "Maior retorno financeiro",
        value: m.rankedRevenue[0]?.nome ? m.rankedRevenue[0].nome.slice(0, 18) : "—",
        meta: m.rankedRevenue[0] ? formatCurrency(m.rankedRevenue[0].revenue) : "—",
        trend: m.revenueTrend,
        trendLabel: "faturamento total",
        compare: `Top: ${m.rankedRevenue.length} parceiro(s) com receita`,
        spark: m.revenueSpark,
        sparkColor: "#60a5fa",
        detailKey: "revenue",
      }),
      renderCard({
        theme: "vehicles",
        icon: "vehicles",
        label: "Ranking de veículos",
        value: m.rankedVehicles[0]?.vehicles || 0,
        meta: m.rankedVehicles[0]?.nome || "—",
        trend: m.vehiclesTrend,
        trendLabel: "volume total",
        compare: `Média mensal: ${m.avgMonthlyVehicles.toFixed(1).replace(".", ",")} veíc.`,
        spark: m.vehiclesSpark,
        sparkColor: "#22d3ee",
        detailKey: "vehicles",
      }),
      renderCard({
        theme: "billing",
        icon: "billing",
        label: "Faturamento via parceiros",
        value: m.totalRevenue,
        valueType: "currency",
        formatCurrency,
        meta: m.range.label,
        trend: m.revenueTrend,
        trendLabel: "vs. período anterior",
        compare: "Receitas de veículos com RPV",
        spark: m.revenueSpark,
        sparkColor: "#38bdf8",
        detailKey: "revenue",
      }),
      renderCard({
        theme: "entries",
        icon: "vehicles",
        label: "Veículos recebidos",
        value: m.totalVehicles,
        meta: "entradas originadas de parceiros",
        trend: m.vehiclesTrend,
        trendLabel: "vs. período anterior",
        compare: footnote,
        spark: m.vehiclesSpark,
        sparkColor: "#4ade80",
        detailKey: "vehicles",
      }),
      renderCard({
        theme: "conversion",
        icon: "conversion",
        label: "Conversão financeira",
        value: m.rankedConversion[0]?.conversion || 0,
        valueType: "currency",
        formatCurrency,
        meta: m.rankedConversion[0]
          ? `${m.rankedConversion[0].nome} · ${formatCurrency(m.rankedConversion[0].revenue)} faturado`
          : "R$ / veículo recebido",
        trend: m.ticketTrend,
        trendLabel: "ticket médio no período",
        compare: "Faturamento recebido ÷ veículos com receita",
        spark: m.ticketSpark,
        sparkColor: "#fbbf24",
        detailKey: "conversion",
      }),
      renderCard({
        theme: "idle",
        icon: "idle",
        label: "Sem movimentação",
        value: m.inactive.length,
        meta: `de ${m.totalPartners} parceiro(s) ativos`,
        trend: 0,
        trendLabel: "no período selecionado",
        compare: "Clique para ver última atividade",
        spark: [],
        sparkColor: "#f87171",
        detailKey: "inactive",
      }),
      `<p class="partner-ops-footnote">${escapeHtml(footnote)}</p>`,
    ].join("");

    const rankRev = document.getElementById("partnerDashRankRevenue");
    if (rankRev) {
      rankRev.innerHTML = `<h4>Ranking — retorno financeiro</h4>${renderRankTable(m.rankedRevenue, {
        formatCurrency,
        shareFn: m.totalRevenueShare,
        sortKey: _rankSort.revenue,
        limit: 8,
      })}`;
    }
    const rankVeh = document.getElementById("partnerDashRankVehicles");
    if (rankVeh) {
      rankVeh.innerHTML = `<h4>Ranking — quantidade de veículos</h4>${renderRankTable(m.rankedVehicles, {
        formatCurrency,
        shareFn: m.totalRevenueShare,
        sortKey: _rankSort.vehicles,
        limit: 8,
      })}`;
    }
    const rankConv = document.getElementById("partnerDashRankConversion");
    if (rankConv) {
      rankConv.innerHTML = `<h4>Conversão financeira (R$ / veículo)</h4>${renderRankTable(m.rankedConversion, {
        formatCurrency,
        shareFn: m.totalRevenueShare,
        sortKey: _rankSort.conversion,
        limit: 8,
      })}`;
    }

    const evo = document.getElementById("partnerDashEvolution");
    if (evo) {
      evo.innerHTML = `<h4>Evolução mensal dos parceiros</h4>
        <div class="partner-evolution-legend">
          <span><i style="background:#60a5fa"></i> Faturamento</span>
          <span><i style="background:#34d399"></i> Veículos</span>
          <span><i style="background:#a78bfa"></i> Novos parceiros</span>
        </div>
        ${multiBarChartSvg(
          {
            labels: m.monthlySeries.labels,
            datasets: [
              { values: m.monthlySeries.revenue },
              { values: m.monthlySeries.vehicles },
              { values: m.monthlySeries.newPartners },
            ],
          },
          ["#60a5fa", "#34d399", "#a78bfa"],
          220
        )}`;
    }

    renderDetailPanel(m, { formatCurrency });
  }

  function partnersDashboardInvalidateCache() {
    _cache = null;
  }

  function partnersDashboardInit() {
    if (_bound) return;
    _bound = true;
    const root = document.getElementById("viewParceiros");
    if (!root) return;

    root.addEventListener("change", (e) => {
      if (
        e.target?.id === "partnerDashFilterPeriod" ||
        e.target?.id === "partnerDashFilterPartner" ||
        e.target?.id === "partnerDashFilterDe" ||
        e.target?.id === "partnerDashFilterAte"
      ) {
        partnersDashboardInvalidateCache();
        if (typeof global.renderPartnersDashboard === "function") global.renderPartnersDashboard();
      }
    });

    root.addEventListener("click", (e) => {
      const card = e.target.closest("[data-partner-dash-card]");
      if (card) {
        _detailKey = card.getAttribute("data-partner-dash-card");
        if (typeof global.renderPartnersDashboard === "function") global.renderPartnersDashboard();
        return;
      }
      if (e.target.closest("[data-partner-dash-detail-close]")) {
        _detailKey = null;
        if (typeof global.renderPartnersDashboard === "function") global.renderPartnersDashboard();
        return;
      }
      const rankRow = e.target.closest("[data-partner-rank-id]");
      if (rankRow) {
        const id = rankRow.getAttribute("data-partner-rank-id");
        const sel = document.getElementById("partnerDashFilterPartner");
        if (sel && id) {
          sel.value = id;
          _filterPartnerId = id;
          partnersDashboardInvalidateCache();
          if (typeof global.renderPartnersDashboard === "function") global.renderPartnersDashboard();
        }
      }
    });
  }

  global.partnersDashboardRender = partnersDashboardRender;
  global.partnersDashboardInvalidateCache = partnersDashboardInvalidateCache;
  global.partnersDashboardInit = partnersDashboardInit;
})(typeof window !== "undefined" ? window : globalThis);
